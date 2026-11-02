package main

import (
	"encoding/json"
	"html"
	"regexp"
	"strings"
	"time"
)

var tagPattern = regexp.MustCompile(`<[^>]*>`)
var blockPattern = regexp.MustCompile(`(?i)<br\s*/?>|</(p|div|li|h[1-6]|blockquote)>`)

func plainText(s string) string {
	s = blockPattern.ReplaceAllString(s, "\n\n")
	s = tagPattern.ReplaceAllString(s, "")
	return strings.TrimSpace(html.UnescapeString(s))
}
func formatUnix(v int64) string {
	if v <= 0 {
		return ""
	}
	return time.Unix(v, 0).UTC().Format(time.RFC3339)
}
func rawID(v json.RawMessage) string {
	if len(v) == 0 {
		return ""
	}
	var s string
	if json.Unmarshal(v, &s) == nil {
		return s
	}
	return strings.Trim(string(v), "\\\"")
}
func validID(v string) bool {
	if v == "" || len(v) > 32 {
		return false
	}
	for _, r := range v {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func feedString(v any) string {
	switch value := v.(type) {
	case string:
		return value
	case json.Number:
		return value.String()
	default:
		return ""
	}
}
