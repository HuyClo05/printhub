#!/usr/bin/env fish

set -l script_dir (dirname (realpath (status --current-filename)))
set -l project_root (realpath "$script_dir/..")
set -l compose_file "$project_root/Deployments/self-hosted/compose.yml"

podman compose -f $compose_file down
