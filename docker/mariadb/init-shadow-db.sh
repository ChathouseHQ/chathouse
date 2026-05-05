#!/usr/bin/env bash
set -euo pipefail

shadow_database="${MARIADB_SHADOW_DATABASE:-${MARIADB_DATABASE:-chathouse}_shadow}"
database_user="${MARIADB_USER:-chathouse}"
root_password="${MARIADB_ROOT_PASSWORD:-rootpassword}"

mariadb --protocol=socket -uroot -p"${root_password}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${shadow_database}\`;
GRANT ALL PRIVILEGES ON \`${shadow_database}\`.* TO '${database_user}'@'%';
FLUSH PRIVILEGES;
SQL
