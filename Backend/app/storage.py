"""Small S3-compatible storage adapter used for model and G-code artifacts."""

from __future__ import annotations

from io import BytesIO

import boto3
from botocore.config import Config

from app.config import frontend_url, s3_bucket, s3_endpoint, s3_region, setting


def client():
    return boto3.client(
        "s3",
        endpoint_url=s3_endpoint(),
        region_name=s3_region(),
        aws_access_key_id=setting("S3_ACCESS_KEY"),
        aws_secret_access_key=setting("S3_SECRET_KEY"),
    )


def put_bytes(key: str, content: bytes, content_type: str) -> None:
    client().upload_fileobj(
        BytesIO(content),
        s3_bucket(),
        key,
        ExtraArgs={"ContentType": content_type},
    )


def get_bytes(key: str) -> bytes:
    response = client().get_object(Bucket=s3_bucket(), Key=key)
    return response["Body"].read()


def delete_object(key: str) -> None:
    client().delete_object(Bucket=s3_bucket(), Key=key)


def head_object(key: str) -> dict:
    return client().head_object(Bucket=s3_bucket(), Key=key)


def presigned_put_url(key: str, content_type: str, expires_seconds: int = 600) -> str:
    """Sign a direct browser-to-SeaweedFS upload routed through Caddy."""

    public_client = boto3.client(
        "s3",
        endpoint_url=frontend_url(),
        region_name=s3_region(),
        aws_access_key_id=setting("S3_ACCESS_KEY"),
        aws_secret_access_key=setting("S3_SECRET_KEY"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    return public_client.generate_presigned_url(
        "put_object",
        Params={"Bucket": s3_bucket(), "Key": key, "ContentType": content_type},
        ExpiresIn=expires_seconds,
        HttpMethod="PUT",
    )


def presigned_get_url(key: str, expires_seconds: int = 300) -> str:
    public_client = boto3.client(
        "s3", endpoint_url=frontend_url(), region_name=s3_region(),
        aws_access_key_id=setting("S3_ACCESS_KEY"), aws_secret_access_key=setting("S3_SECRET_KEY"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    return public_client.generate_presigned_url("get_object", Params={"Bucket": s3_bucket(), "Key": key}, ExpiresIn=expires_seconds, HttpMethod="GET")
