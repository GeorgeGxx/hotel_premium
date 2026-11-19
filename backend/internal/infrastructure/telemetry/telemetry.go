package telemetry

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var Tracer trace.Tracer

func InitGlitchTip(serviceName string) {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		return
	}
	environment := os.Getenv("APP_ENV")
	if environment == "" {
		environment = os.Getenv("NODE_ENV")
	}
	if environment == "" {
		environment = "development"
	}
	release := os.Getenv("APP_RELEASE")
	if release == "" {
		release = "unknown"
	}
	if err := sentry.Init(sentry.ClientOptions{
		Dsn: dsn, Environment: environment, Release: release,
		SendDefaultPII: false, TracesSampleRate: 0,
		BeforeSend: func(event *sentry.Event, _ *sentry.EventHint) *sentry.Event {
			event.Request = nil
			event.User = sentry.User{}
			event.Contexts = nil
			event.Breadcrumbs = nil
			event.Message = ""
			event.Transaction = ""
			event.Tags = map[string]string{"service": serviceName, "environment": environment}
			for i := range event.Exception {
				event.Exception[i].Value = "[redacted]"
			}
			return event
		},
	}); err != nil {
		slog.Warn("GlitchTip SDK initialization failed; error reporting is disabled", "service", serviceName, "error", err)
		return
	}
	slog.Info("GlitchTip error reporting initialized", "service", serviceName, "environment", environment, "release", release)
}

func FlushGlitchTip() {
	sentry.Flush(2 * time.Second)
}

func InitTracer(ctx context.Context, serviceName, collectorURL string) (func(context.Context) error, error) {
	conn, err := grpc.NewClient(collectorURL,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create gRPC client for OTel: %w", err)
	}

	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
			semconv.ServiceVersionKey.String("1.0.0"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	bsp := sdktrace.NewBatchSpanProcessor(exporter,
		sdktrace.WithBatchTimeout(1*time.Second),
		sdktrace.WithMaxExportBatchSize(512),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(bsp),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	Tracer = otel.Tracer(serviceName)
	slog.Info("OpenTelemetry distributed tracing initialized", "collector", collectorURL)

	return tp.Shutdown, nil
}
