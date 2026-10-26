"""PostgreSQL queue-claim concurrency: FOR UPDATE SKIP LOCKED between workers.

Needs a PostgreSQL server where the user may create databases. Each run creates
a throwaway database, applies the Alembic migrations and drops it afterwards.

Run from Backend (self-hosted stack exposes PostgreSQL on loopback 5433):
PRINTHUB_PG_TEST_URL=postgresql+psycopg://printhub:change-me@127.0.0.1:5433/postgres \
    ../.ph_venv/bin/python -m unittest tests.test_postgres_queue -v
"""
import os
import subprocess
import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app import worker
from app.models import PrintJob, PrintTask, StlFile, User

ADMIN_URL = os.getenv("PRINTHUB_PG_TEST_URL")
BACKEND_DIR = Path(__file__).resolve().parents[1]
WORKERS = 8


def utcnow():
    return datetime.now(timezone.utc)


@unittest.skipUnless(ADMIN_URL, "set PRINTHUB_PG_TEST_URL to run PostgreSQL concurrency tests")
class PostgresQueueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_name = f"printhub_queue_test_{uuid4().hex[:12]}"
        cls.admin = create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
        with cls.admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{cls.db_name}"'))
        cls.url = make_url(ADMIN_URL).set(database=cls.db_name)
        url_text = cls.url.render_as_string(hide_password=False)
        migration = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND_DIR,
            env={**os.environ, "DATABASE_URL": url_text},
            capture_output=True,
            text=True,
        )
        if migration.returncode != 0:
            cls.tearDownClass()
            raise RuntimeError(f"Alembic migration failed:\n{migration.stderr}")
        cls.engine = create_engine(url_text, pool_size=WORKERS + 2)
        cls.sessions = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)
        cls.session_patch = patch.object(worker, "SessionLocal", cls.sessions)
        cls.session_patch.start()

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "session_patch"):
            cls.session_patch.stop()
        if hasattr(cls, "engine"):
            cls.engine.dispose()
        with cls.admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{cls.db_name}" WITH (FORCE)'))
        cls.admin.dispose()

    def setUp(self):
        with self.engine.begin() as connection:
            connection.execute(text("TRUNCATE print_tasks, print_jobs, stl_files, users CASCADE"))

    def seed(self, count, **task_fields):
        """Create one job with ``count`` tasks; returns task ids in claim order."""

        now = utcnow()
        with Session(self.engine) as db:
            db.add(User(id="alice", email="alice@example.test", created_at=now))
            file = StlFile(file_name="cube.stl", file_size=32, stl_url="private/model", uploaded_by="alice", uploaded_at=now)
            job = PrintJob(created_by="alice", job_name="cube", status="queued", created_at=now)
            db.add_all([file, job])
            db.flush()
            tasks = []
            for index in range(count):
                fields = {"status": "queued", "available_at": now - timedelta(seconds=count - index)}
                fields.update(task_fields)
                tasks.append(PrintTask(job_id=job.id, file_id=file.id, created_at=now, **fields))
            db.add_all(tasks)
            db.commit()
            return [task.id for task in tasks]

    def race(self, function, rounds=1):
        """Call ``function`` from every worker thread at the same instant."""

        barrier = threading.Barrier(WORKERS)

        def run():
            barrier.wait()
            results = []
            for _ in range(rounds):
                results.append(function())
            return results

        with ThreadPoolExecutor(WORKERS) as pool:
            futures = [pool.submit(run) for _ in range(WORKERS)]
            return [result for future in futures for result in future.result(timeout=60)]

    def drain(self):
        claimed = []
        while (task_id := worker.claim_task()) is not None:
            claimed.append(task_id)
        return claimed

    def test_concurrent_workers_claim_every_task_exactly_once(self):
        task_ids = self.seed(40)

        claimed = [task_id for batch in self.race(self.drain) for task_id in batch]

        self.assertEqual(len(claimed), len(set(claimed)), "a task was claimed by more than one worker")
        self.assertEqual(sorted(claimed), sorted(task_ids))
        with Session(self.engine) as db:
            rows = db.scalars(select(PrintTask)).all()
            self.assertTrue(all(row.status == "slicing" and row.attempt_count == 1 for row in rows))

    def test_locked_task_is_skipped_instead_of_blocking(self):
        first, second = self.seed(2)

        pool = ThreadPoolExecutor(1)
        with self.engine.connect() as holder:
            lock = holder.begin()
            holder.execute(text("SELECT id FROM print_tasks WHERE id = :id FOR UPDATE"), {"id": first})
            claim = pool.submit(worker.claim_task)
            try:
                claimed = claim.result(timeout=5)
            finally:
                # Release the row before joining, or a blocking claim would hang the test.
                lock.rollback()
                pool.shutdown()

        self.assertEqual(claimed, second)
        self.assertEqual(worker.claim_task(), first)

    def test_expired_lease_is_reclaimed_by_only_one_worker(self):
        (task_id,) = self.seed(
            1,
            status="slicing",
            attempt_count=1,
            lease_owner="crashed-worker",
            lease_expires_at=utcnow() - timedelta(seconds=1),
        )

        claimed = [result for result in self.race(worker.claim_task) if result is not None]

        self.assertEqual(claimed, [task_id])
        with Session(self.engine) as db:
            task = db.get(PrintTask, task_id)
            self.assertEqual(task.attempt_count, 2)
            self.assertEqual(task.lease_owner, worker.WORKER_ID)

    def test_concurrent_dead_letter_sweeps_route_each_task_once(self):
        task_ids = self.seed(
            12,
            status="slicing",
            attempt_count=5,
            lease_owner="crashed-worker",
            lease_expires_at=utcnow() - timedelta(seconds=1),
        )

        swept = sum(self.race(worker.dead_letter_expired_final_attempts))

        self.assertEqual(swept, len(task_ids))
        self.assertIsNone(worker.claim_task())
        with Session(self.engine) as db:
            statuses = set(db.scalars(select(PrintTask.status)).all())
            self.assertEqual(statuses, {"dead-lettered"})


if __name__ == "__main__":
    unittest.main()
