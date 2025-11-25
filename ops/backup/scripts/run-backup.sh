#!/bin/bash
set -euo pipefail

if [ ! -f /etc/backup.conf ]; then
  echo "Arquivo /etc/backup.conf ausente; verifique o entrypoint" >&2
  exit 1
fi

source /etc/backup.conf
export PGPASSWORD="$POSTGRES_PASSWORD"

mkdir -p "$BACKUP_DIR/full" "$BACKUP_DIR/incremental" "$BACKUP_DIR/pre-restore"

exec /scripts/backup.sh "$@"
