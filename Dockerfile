# ponytail: multi-stage build using bun compile to standalone linux binary
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM debian:bookworm-slim AS runner
WORKDIR /app

# ponytail: copy ca-certificates from builder so HTTPS requests work without apt bloat
COPY --from=builder /etc/ssl/certs /etc/ssl/certs
COPY --from=builder /app/dist/katz-live-linux-* /usr/local/bin/katz-live

ENV PORT=3030
EXPOSE 3030

CMD ["katz-live"]
