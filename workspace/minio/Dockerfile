FROM golang:1.24-bookworm AS builder

ARG MINIO_VERSION=latest

RUN go install github.com/minio/minio@${MINIO_VERSION}

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && groupadd --system minio \
    && useradd --system --gid minio --home-dir /data --shell /usr/sbin/nologin minio \
    && mkdir -p /data \
    && chown minio:minio /data \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /go/bin/minio /usr/local/bin/minio

USER minio

VOLUME ["/data"]
EXPOSE 9000 9001

ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
