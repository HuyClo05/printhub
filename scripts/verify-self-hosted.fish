#!/usr/bin/env fish

# Non-destructive verification for a running self-hosted PrintHub stack.
# Start the stack first with: fish scripts/start-local.fish --detach

set -l script_dir (dirname (realpath (status --current-filename)))
set -l project_root (realpath "$script_dir/..")
set -l compose_file "$project_root/Deployments/self-hosted/compose.yml"
set -l env_file "$project_root/.ph_env"
set -l base_url http://127.0.0.1:8080
set -g printhub_verify_checks 0

function fail
    echo "FAIL: $argv[1]" >&2
    exit 1
end

function pass
    set -g printhub_verify_checks (math $printhub_verify_checks + 1)
    echo "PASS: $argv[1]"
end

command -q podman; or fail "Podman is not installed."
command -q curl; or fail "curl is not installed."
test -f $compose_file; or fail "Compose file not found."
test -f $env_file; or fail ".ph_env not found."

set -l services postgres keycloak seaweedfs slicer api worker frontend caddy
for service in $services
    set -l container (podman ps -q --filter "name=printhub_$service" | head -n 1)
    test -n "$container"; or fail "$service container is not running."
    test (podman inspect --format '{{.State.Status}}' $container) = running; or fail "$service container is not in the running state."
end
pass "all eight Compose services are running"

curl --fail --silent --show-error "$base_url/health/live" >/dev/null; or fail "API liveness endpoint failed."
pass "API liveness"
curl --fail --silent --show-error "$base_url/health/ready" >/dev/null; or fail "API readiness endpoint failed."
pass "PostgreSQL and object-storage readiness"

set -l api_status (curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/api/v1/me")
test "$api_status" = 401; or fail "Caddy API route returned HTTP $api_status instead of 401."
curl --fail --silent --show-error "$base_url/realms/printhub/.well-known/openid-configuration" | string match -q '*authorization_endpoint*'; or fail "Keycloak was not reachable through Caddy."
pass "Caddy routes API and Keycloak requests"

set -l postgres_container (podman ps -q --filter name=printhub_postgres | head -n 1)
set -l db_name (string match -r '^POSTGRES_DB=.*' < $env_file | tail -n 1 | string replace 'POSTGRES_DB=' '')
set -l db_user (string match -r '^POSTGRES_USER=.*' < $env_file | tail -n 1 | string replace 'POSTGRES_USER=' '')
test -n "$db_name"; or set db_name printhub
test -n "$db_user"; or set db_user printhub
set -l migration (podman exec $postgres_container psql -X -q -t -A -U $db_user -d $db_name -c 'SELECT version_num FROM alembic_version LIMIT 1;' 2>/dev/null)
test "$migration" = 006_workspace_printers; or fail "Expected migration 006_workspace_printers, received '$migration'."
pass "PostgreSQL schema is at migration $migration"

set -l required_tables users resources profiles printers stl_files print_jobs print_tasks slicer_profile_versions idempotency_records printer_connections printer_commands
set -l table_count (podman exec $postgres_container psql -X -q -t -A -U $db_user -d $db_name -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','resources','profiles','printers','stl_files','print_jobs','print_tasks','slicer_profile_versions','idempotency_records','printer_connections','printer_commands');" 2>/dev/null)
test "$table_count" = (count $required_tables); or fail "Only $table_count of "(count $required_tables)" required tables were found."
pass "required database tables exist"

set -l slicer_container (podman ps -q --filter name=printhub_slicer | head -n 1)
podman exec $slicer_container node -e "fetch('http://127.0.0.1:3000/health').then(r => { if (!r.ok) process.exit(1); return r.json() }).then(v => { if (v.status !== 'ok') process.exit(1) })"; or fail "Private OrcaSlicer service health check failed."
pass "private OrcaSlicer service"

set -l caddy_container (podman ps -q --filter name=printhub_caddy | head -n 1)
set -l public_ports (podman port $caddy_container)
string match -q '*8080*' "$public_ports"; or fail "Caddy is not published on host port 8080."
set -l postgres_ports (podman port $postgres_container)
string match -q '*127.0.0.1:5433*' "$postgres_ports"; or fail "PostgreSQL is not bound to loopback port 5433 for DBeaver."
for service in keycloak seaweedfs slicer api worker frontend
    set -l container (podman ps -q --filter "name=printhub_$service" | head -n 1)
    set -l published (podman port $container)
    test -z "$published"; or fail "$service unexpectedly publishes a host port."
end
pass "ports expose Caddy on 8080 and PostgreSQL on loopback-only 5433"

curl --fail --silent --show-error "$base_url/" | string match -q '*<div id="root"></div>*'; or fail "React frontend was not served through Caddy."
pass "React frontend through Caddy"

echo ""
echo "Self-hosted verification complete: $printhub_verify_checks checks passed."
echo "Authentication, native slicing and printer commands still require an authenticated browser workflow."
