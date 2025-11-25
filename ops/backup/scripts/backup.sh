#!/bin/bash
set -euo pipefail

if [ ! -f /etc/backup.conf ]; then
  echo "Arquivo /etc/backup.conf ausente; verifique o entrypoint" >&2
  exit 1
fi

source /etc/backup.conf
export PGPASSWORD="$POSTGRES_PASSWORD"

MODE="${1:-}"

if [[ "$MODE" != "full" && "$MODE" != "incremental" ]]; then
  echo "Uso: $0 full|incremental" >&2
  exit 1
fi

timestamp="$(date +"%Y-%m-%d_%H-%M")"

if [ "$MODE" = "full" ]; then
  target_dir="$BACKUP_DIR/full"
  filename="talkclass_full_${timestamp}.dump"
else
  target_dir="$BACKUP_DIR/incremental"
  filename="talkclass_incr_${timestamp}.dump"
fi

mkdir -p "$target_dir"
filepath="$target_dir/$filename"
now_ts="$(date +"%Y-%m-%dT%H:%M:%S%z")"
echo "[$now_ts] Iniciando backup ${MODE} em $filepath"

pg_dump \
  --format=custom \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --file="$filepath" \
  --no-owner \
  --no-privileges

now_ts="$(date +"%Y-%m-%dT%H:%M:%S%z")"
echo "[$now_ts] Backup concluido em $filepath"
