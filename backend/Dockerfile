# ==============================================================================
# STAGE 1: Build Go 1.26 Microservice Binary
# Parameterized for: api | room-service | stay-service | billing-service | notification-worker
# ==============================================================================
FROM golang:1.26-alpine AS builder

ARG SERVICE=room-service

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -ldflags="-s -w -extldflags '-static'" \
    -o /app/bin/service ./cmd/${SERVICE}

# ==============================================================================
# STAGE 2: Ultra-lightweight Minimal Alpine Production Image
# ==============================================================================
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/bin/service /app/service

USER appuser:appgroup

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-8081}/api/v1/health || exit 1

ENTRYPOINT ["/app/service"]
