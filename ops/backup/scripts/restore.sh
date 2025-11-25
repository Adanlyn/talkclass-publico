#!/bin/bash
set -euo pipefail

if [ ! -f /etc/backup.conf ]; then
  echo "Arquivo /etc/backup.conf ausente; verifique o entrypoint" >&2
  exit 1
fi

if [ $# -ne 1 ]; then
  echo "Uso: $0 CAMINHO_DO_BACKUP" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup nao encontrado: $BACKUP_FILE" >&2
  exit 1
fi

source /etc/backup.conf
export PGPASSWORD="$POSTGRES_PASSWORD"

timestamp="$(date +"%Y-%m-%d_%H-%M")"
pre_dir="$BACKUP_DIR/pre-restore"
mkdir -p "$pre_dir"
pre_backup="$pre_dir/talkclass_pre_restore_${timestamp}.dump"

now_ts="$(date +"%Y-%m-%dT%H:%M:%S%z")"
echo "[$now_ts] Salvando estado atual em $pre_backup"
pg_dump \
  --format=custom \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --file="$pre_backup" \
  --no-owner \
  --no-privileges

now_ts="$(date +"%Y-%m-%dT%H:%M:%S%z")"
echo "[$now_ts] Reinicializando banco para restore"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}' AND pid <> pg_backend_pid();"

dropdb --if-exists -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB"
createdb -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB"

now_ts="$(date +"%Y-%m-%dT%H:%M:%S%z")"
echo "[$now_ts] Restaurando a partir de $BACKUP_FILE"
pg_restore \
  --format=custom \
  --no-owner \
  --role="$POSTGRES_USER" \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  "$BACKUP_FILE"

now_ts="$(date +"%Y-%m-%dT%H:%M:%S%z")"
echo "[$now_ts] Restore concluido. Backup de seguranca antes do restore: $pre_backup"
