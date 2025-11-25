#!/bin/bash
set -euo pipefail

DEFAULT_FULL_CRON="0 0 1 * *"         # once a month (approx. every 30 days)
DEFAULT_INCREMENTAL_CRON="59 23 * * *" # daily at 23:59

: "${BACKUP_DIR:=/backups}"
: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=talkclass}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_PASSWORD:=talkclass}"
: "${TZ:=}"

FULL_CRON_SCHEDULE="${FULL_CRON_SCHEDULE:-$DEFAULT_FULL_CRON}"
INCREMENTAL_CRON_SCHEDULE="${INCREMENTAL_CRON_SCHEDULE:-$DEFAULT_INCREMENTAL_CRON}"

mkdir -p "$BACKUP_DIR" "$BACKUP_DIR/full" "$BACKUP_DIR/incremental" "$BACKUP_DIR/pre-restore"

if [ -n "$TZ" ] && [ -f "/usr/share/zoneinfo/$TZ" ]; then
  ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime
  echo "$TZ" > /etc/timezone
  echo "Fuso horario configurado para $TZ"
else
  [ -n "$TZ" ] && echo "Aviso: TZ '$TZ' invalido ou ausente, usando UTC" >&2
fi

cat >/etc/backup.conf <<EOF
BACKUP_DIR=$BACKUP_DIR
POSTGRES_HOST=$POSTGRES_HOST
POSTGRES_PORT=$POSTGRES_PORT
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF

cat >/etc/crontabs/root <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
$FULL_CRON_SCHEDULE root /scripts/run-backup.sh full >> /var/log/cron.log 2>&1
$INCREMENTAL_CRON_SCHEDULE root /scripts/run-backup.sh incremental >> /var/log/cron.log 2>&1
EOF

touch /var/log/cron.log

echo "Backup cron agendado: full='$FULL_CRON_SCHEDULE' incremental='$INCREMENTAL_CRON_SCHEDULE'"
echo "Diretorio de backups: $BACKUP_DIR"

exec crond -f -l 2
