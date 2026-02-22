package docker

import (
	"context"
	"testing"
	"time"
)

func TestGetRecentEvents_NilClient(t *testing.T) {
	if _, err := GetRecentEvents(context.Background(), nil, 1*time.Minute); err == nil {
		t.Fatalf("expected error when client is nil")
	}
}

func TestGetSwarmServiceEvents_NilClient(t *testing.T) {
	if _, err := GetSwarmServiceEvents(context.Background(), nil, "svc", 1*time.Minute); err == nil {
		t.Fatalf("expected error when client is nil")
	}
}
