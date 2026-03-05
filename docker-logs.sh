#!/bin/bash
# Minimal script to show recent logs and errors for all running containers

docker ps --format 'table {{.Names}}\t{{.Status}}'
echo
for c in $(docker ps --format '{{.Names}}'); do
  echo "--- $c ---"
  docker logs --tail 20 "$c" 2>&1 | tail -20
  echo
  docker inspect --format='{{.State.Status}}: {{.State.Error}}' "$c" 2>/dev/null
  echo
done