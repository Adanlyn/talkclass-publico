FROM alpine:3.20

RUN apk add --no-cache bash postgresql16-client ca-certificates tzdata

COPY ops/backup/scripts/ /scripts/
RUN chmod +x /scripts/*.sh

ENTRYPOINT ["/scripts/entrypoint.sh"]
