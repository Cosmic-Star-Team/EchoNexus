package main

import (
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func envOrDefault(name string, fallback string) string {
	if value, ok := os.LookupEnv(name); ok && value != "" {
		return value
	}

	return fallback
}

func max(left int, right int) int {
	if left > right {
		return left
	}

	return right
}

func scopeValueOrMissing(value any) string {
	scope, ok := value.(string)
	if !ok {
		return "missing"
	}

	return scope
}

func main() {
	workers, _ := strconv.Atoi(envOrDefault("BENCHMARK_WORKERS", "1"))
	runtime.GOMAXPROCS(max(workers, 1))

	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/v1/users/") {
			c.Set("scope", "user")
		}

		c.Next()
	})
	router.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	router.GET("/plaintext", func(c *gin.Context) {
		c.String(http.StatusOK, "Hello, World!")
	})
	router.GET("/json", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Hello, World!",
			"ok":      true,
		})
	})
	router.GET("/time_json", func(c *gin.Context) {
		now := time.Now()
		_, offsetSeconds := now.Zone()
		c.JSON(http.StatusOK, gin.H{
			"localTime":             now.Format(time.RFC3339Nano),
			"unixMs":                now.UnixMilli(),
			"timezoneOffsetMinutes": offsetSeconds / 60,
		})
	})
	router.GET("/api/v1/users/:id/profile", func(c *gin.Context) {
		scope, _ := c.Get("scope")
		c.JSON(http.StatusOK, gin.H{
			"id":     c.Param("id"),
			"scope":  scopeValueOrMissing(scope),
			"active": true,
		})
	})

	_ = router.Run("127.0.0.1:" + envOrDefault("BENCHMARK_PORT", "8080"))
}
