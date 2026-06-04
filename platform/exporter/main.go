// Go metrics exporter + health-check batch.
// Scrapes Redis queue depths (main/delayed/dlq) and exposes Prometheus metrics,
// so Grafana can alert on "DLQ growing" / "queue backing up". Also runs a
// periodic health batch that pings Redis.
//
//	GET /metrics   Prometheus
//	GET /healthz   liveness
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

var (
	queueDepth = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "graphrag_queue_depth", Help: "Jobs by queue partition.",
	}, []string{"partition"})
	redisUp = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "graphrag_redis_up", Help: "1 if Redis is reachable.",
	})
)

func main() {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		url = "redis://localhost:6379"
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Fatal(err)
	}
	rdb := redis.NewClient(opt)
	ctx := context.Background()

	go func() {
		for {
			if err := rdb.Ping(ctx).Err(); err != nil {
				redisUp.Set(0)
			} else {
				redisUp.Set(1)
				main_, _ := rdb.LLen(ctx, "q:graphrag").Result()
				delayed, _ := rdb.ZCard(ctx, "q:graphrag:delayed").Result()
				dlq, _ := rdb.LLen(ctx, "q:graphrag:dlq").Result()
				queueDepth.WithLabelValues("main").Set(float64(main_))
				queueDepth.WithLabelValues("delayed").Set(float64(delayed))
				queueDepth.WithLabelValues("dlq").Set(float64(dlq))
			}
			time.Sleep(5 * time.Second)
		}
	}()

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	log.Println("[exporter] listening :9100")
	log.Fatal(http.ListenAndServe(":9100", nil))
}
