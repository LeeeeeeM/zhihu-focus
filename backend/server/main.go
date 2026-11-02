package main

import (
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	cfg := loadConfig()
	client := &http.Client{Timeout: 20 * time.Second}
	addr := os.Getenv("ZHIFOCUS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8787"
	}
	server := &http.Server{Addr: addr, Handler: newAPIHandler(cfg, client), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("Zhihu Focus API listening on http://%s", addr)
	log.Fatal(server.ListenAndServe())
}
