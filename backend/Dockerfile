# ==============================================================================
# STAGE 1: Build Go 1.26 Binary
# ==============================================================================
FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o /app/bin/hotel-api ./cmd/api

# ==============================================================================
# STAGE 2: Ultra-lightweight Minimal Scratch / Alpine Production Image
# ==============================================================================
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/bin/hotel-api /app/hotel-api

USER appuser:appgroup

EXPOSE 8080

ENTRYPOINT ["/app/hotel-api"]
