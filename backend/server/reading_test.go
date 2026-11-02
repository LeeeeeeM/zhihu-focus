package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReadingSignatureVectors(t *testing.T) {
	// Cross-checked against the independently executed reference ZSE v4 cipher.
	for dc0, want := range map[string]string{
		"token":         `2.0_xWFN9LSg/yNxdt/J+jQ9dXAniqks7qsVeIUWgL36lQDpLoZc+lRsln8wJLLVRkH4`,
		`"fixture|123"`: `2.0_yC=Fr7RJSkLzwLvIbJ1OHpAhFs2s/YOc+laAsWA4O2KYjts+8jQPyBhGTg3JOVH5`,
	} {
		if got := readingSignature(dc0); got != want {
			t.Fatalf("signature mismatch: %s", got)
		}
	}
}

func TestReadReportRequest(t *testing.T) {
	for _, kind := range []string{"answer", "article"} {
		t.Run(kind, func(t *testing.T) {
			const cookie = `session=fixture; d_c0="fixture|123"; _xsrf=xsrf-fixture`
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if r.Method != "POST" || r.URL.String() != "https://www.zhihu.com/lastread/touch" {
					t.Fatalf("unexpected destination: %s %s", r.Method, r.URL)
				}
				for header, want := range map[string]string{"Cookie": cookie, "Origin": "https://www.zhihu.com", "x-requested-with": "fetch", "x-xsrftoken": "xsrf-fixture", "x-zse-93": zhihuZse93, "x-zse-96": readingSignature(`"fixture|123"`)} {
					if r.Header.Get(header) != want {
						t.Fatalf("unexpected %s header", header)
					}
				}
				if err := r.ParseMultipartForm(4096); err != nil {
					t.Fatal(err)
				}
				if got := r.FormValue("items"); got != `[["`+kind+`","2097043375547536464","read"]]` {
					t.Fatalf("unexpected report: %s", got)
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"success":true}`))}, nil
			})}
			req := httptest.NewRequest("POST", "/api/read?type="+kind+"&id=2097043375547536464", nil)
			req.Header.Set("X-Zhihu-Cookie", cookie)
			w := httptest.NewRecorder()
			readReportHandler(client)(w, req)
			if w.Code != 200 || !strings.Contains(w.Body.String(), `"success":true`) {
				t.Fatalf("report failed: %d %s", w.Code, w.Body)
			}
		})
	}
}

func TestReadReportRejectsInvalidRequests(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("invalid request reached upstream")
		return nil, nil
	})}
	for _, tc := range []struct {
		query, cookie string
		status        int
	}{
		{"type=answer&id=123", "", 401},
		{"type=answer&id=123", "session=fixture", 401},
		{"type=question&id=123", "d_c0=token", 400},
		{"type=answer&id=invalid", "d_c0=token", 400},
		{"type=article", "d_c0=token", 400},
	} {
		req := httptest.NewRequest("POST", "/api/read?"+tc.query, nil)
		req.Header.Set("X-Zhihu-Cookie", tc.cookie)
		w := httptest.NewRecorder()
		readReportHandler(client)(w, req)
		if w.Code != tc.status {
			t.Fatalf("unexpected status: %d", w.Code)
		}
	}
}

func TestReadReportRequiresExplicitUpstreamSuccess(t *testing.T) {
	for _, tc := range []struct {
		status int
		body   string
	}{
		{403, `{"error":"private-upstream-data"}`}, {429, "rate limited"},
		{200, `{"success":false}`}, {200, `{}`}, {200, `null`}, {200, `<html>login</html>`},
	} {
		client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
		})}
		err := reportReading(context.Background(), client, "d_c0=token", "answer", "123")
		if err == nil || strings.Contains(err.Error(), "private-upstream-data") {
			t.Fatalf("expected sanitized failure, got %v", err)
		}
	}
}

func TestReadReportDoesNotFollowRedirect(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: 307, Header: http.Header{"Location": {"https://other.example/read"}}, Body: io.NopCloser(strings.NewReader(""))}, nil
	})}
	if err := reportReading(context.Background(), client, "d_c0=token", "answer", "123"); err == nil || calls != 1 {
		t.Fatalf("redirect was followed or accepted, calls=%d, err=%v", calls, err)
	}
}

func TestAddHistorySignsExactJSONBody(t *testing.T) {
	for _, kind := range []string{"answer", "article"} {
		client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.Method != "POST" || r.URL.String() != "https://www.zhihu.com/api/v4/read_history/add" || r.Header.Get("Content-Type") != "application/json" {
				t.Fatal("unexpected history write")
			}
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatal(err)
			}
			wantBody := `{"content_token":"2097043375547536464","content_type":"` + kind + `"}`
			if string(body) != wantBody {
				t.Fatalf("unexpected body: %s", body)
			}
			wantSignature := zhihuSignature("/api/v4/read_history/add", "token", wantBody)
			if kind == "answer" {
				wantSignature = "2.0_aczcgIX0FJ8tgdNj+1PGZmDFNk5ApKuvcY/i58DoJKJal2wxbUoFtraILr+Z6qhD"
			}
			if r.Header.Get("x-zse-96") != wantSignature || r.Header.Get("Cookie") != "d_c0=token; _xsrf=fixture" || r.Header.Get("x-xsrftoken") != "fixture" {
				t.Fatal("history authentication or body signature mismatch")
			}
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"success":true}`))}, nil
		})}
		r := httptest.NewRequest("POST", "/api/history?type="+kind+"&id=2097043375547536464", nil)
		r.Header.Set("X-Zhihu-Cookie", "d_c0=token; _xsrf=fixture")
		w := httptest.NewRecorder()
		readingWriteHandler(client, addHistory)(w, r)
		if w.Code != 200 {
			t.Fatalf("history write failed: %d %s", w.Code, w.Body)
		}
	}
}

func TestAddHistoryRequiresUpstreamConfirmation(t *testing.T) {
	for _, tc := range []struct {
		status int
		body   string
	}{
		{403, "private-error-data"}, {429, ""}, {200, `{"success":false}`}, {200, "invalid"},
		{200, `{"error":{"code":10003,"message":"private-error-data"}}`},
		{200, `{"code":10003}`}, {200, `{"success":true,"error":{"code":1}}`},
		{200, `[]`}, {200, `<html>login</html>`}, {500, `null`},
	} {
		client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
		})}
		err := addHistory(context.Background(), client, "d_c0=token", "answer", "123")
		if err == nil || strings.Contains(err.Error(), "private-error-data") {
			t.Fatalf("expected sanitized history failure: %v", err)
		}
	}
}

func TestAddHistoryAcceptsHTTPSuccessWithoutSuccessFlag(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
	}{
		{"empty JSON object", 200, `{}`},
		{"live JSON null response", 200, "null\n"},
		{"whitespace around null", 200, " \n null \n "},
		{"empty body", 200, ""},
		{"no content", 204, ""},
		{"whitespace body", 200, " \n "},
		{"explicit success", 200, `{"success":true}`},
		{"zero code", 200, `{"code":0}`},
		{"success with no error", 200, `{"error":null}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				calls++
				return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
			})}
			r := httptest.NewRequest("POST", "/api/history?type=answer&id=123", nil)
			r.Header.Set("X-Zhihu-Cookie", "d_c0=token")
			w := httptest.NewRecorder()
			readingWriteHandler(client, addHistory)(w, r)
			if w.Code != 200 || !strings.Contains(w.Body.String(), `"success":true`) || calls != 1 {
				t.Fatalf("history success misclassified or retried: %d %s, calls=%d", w.Code, w.Body, calls)
			}
		})
	}
}
