#!/usr/bin/env bash
set -euo pipefail

/usr/local/bin/docker-entrypoint.sh "$@" &
entrypoint_pid="$!"

cleanup() {
  if kill -0 "${entrypoint_pid}" 2>/dev/null; then
    kill "${entrypoint_pid}"
    wait "${entrypoint_pid}"
  fi
}

trap cleanup TERM INT

for _ in {1..120}; do
  if mariadb-admin --protocol=tcp -h127.0.0.1 -uroot -p"${MARIADB_ROOT_PASSWORD:-rootpassword}" ping >/dev/null 2>&1; then
    /usr/local/bin/10-init-shadow-db.sh
    wait "${entrypoint_pid}"
    exit $?
  fi

  if ! kill -0 "${entrypoint_pid}" 2>/dev/null; then
    wait "${entrypoint_pid}"
    exit $?
  fi

  sleep 1
done

echo 'Timed out waiting for MariaDB to accept TCP connections.' >&2
kill "${entrypoint_pid}"
wait "${entrypoint_pid}"
