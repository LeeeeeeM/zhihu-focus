package main

import (
	"os"
	"path/filepath"
	"strings"
)

func loadConfig() Config {
	c := Config{AccessSecret: os.Getenv("ZHIHU_ACCESS_SECRET")}
	p := filepath.Join(".", ".env")
	b, err := os.ReadFile(p)
	if err != nil {
		return c
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		v = strings.TrimSpace(v)
		v = strings.Trim(v, "\"'")
		switch strings.TrimSpace(k) {
		case "ZHIHU_ACCESS_SECRET":
			if c.AccessSecret == "" {
				c.AccessSecret = v
			}
		}
	}
	return c
}
