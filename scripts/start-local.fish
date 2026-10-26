#!/usr/bin/env fish

# Start the complete self-hosted PrintHub stack.
#
# Development (foreground):
#   fish scripts/start-local.fish
#
# Deployment-like local run (background):
#   fish scripts/start-local.fish --detach

set -l script_dir (dirname (realpath (status --current-filename)))
set -l project_root (realpath "$script_dir/..")
set -l compose_file "$project_root/Deployments/self-hosted/compose.yml"
set -l env_file "$project_root/.ph_env"

function fail
    echo "Error: $argv[1]" >&2
    exit 1
end

function run_with_progress
    set -l label $argv[1]
    set -l command_args $argv[2..-1]
    set -l log_file (mktemp)
    set -l width 28
    set -l position 1
    set -l direction 1

    command $command_args >$log_file 2>&1 &
    set -l process_id $last_pid

    while kill -0 $process_id 2>/dev/null
        set -l left (string repeat -n $position ' ')
        set -l right_count (math $width - $position)
        set -l right (string repeat -n $right_count ' ')
        printf '\r\033[2K[%s█%s] %s' $left $right $label
        set position (math $position + $direction)
        if test $position -ge $width
            set direction -1
        else if test $position -le 1
            set direction 1
        end
        sleep 0.12
    end

    wait $process_id
    set -l result $status
    if test $result -eq 0
        printf '\r\033[2K[############################] %s\n' "$label complete"
    else
        printf '\r\033[2K[############################] %s failed\n' $label
        echo "Last command output:"
        tail -n 60 $log_file
    end

    rm -f $log_file
    return $result
end

command -q podman; or fail "Podman is required. Install it with: sudo pacman -S podman"
test -f $compose_file; or fail "Compose file not found at $compose_file"
test -f $env_file; or fail "Configuration file not found at $env_file. Copy .ph_env.example to .ph_env first."

podman compose version >/dev/null 2>&1; or fail "No Podman Compose provider was found. Install podman-compose or configure a Compose provider."

set -l compose_prefix --env-file $env_file -f $compose_file

run_with_progress "[1/3] Pulling dependency images" podman compose $compose_prefix pull postgres keycloak seaweedfs caddy
or fail "Image download failed. Check your network connection and rerun the script."

echo "The frontend and OrcaSlicer dependency downloads can take a few minutes the first time."
run_with_progress "[2/3] Building API, slicer, and frontend images" podman compose $compose_prefix build
or fail "Container build failed."

echo "[3/3] Starting the complete PrintHub stack..."
echo "        Services: PostgreSQL, Keycloak, SeaweedFS, slicer, worker, API, frontend, and Caddy"
echo "        Application URL: http://localhost:8080"

set -l up_args up
if contains -- --detach $argv
    set up_args $up_args --detach
end

exec podman compose $compose_prefix $up_args
