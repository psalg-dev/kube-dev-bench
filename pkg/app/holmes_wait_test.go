package app

import (
	"net"
	"testing"
	"time"
)

func TestWaitForLocalPort_Success(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}
	defer ln.Close()
	addr := ln.Addr().(*net.TCPAddr)
	port := addr.Port

	if err := waitForLocalPort("127.0.0.1", port, 2*time.Second); err != nil {
		t.Fatalf("expected port to be ready, got error: %v", err)
	}
}

func TestWaitForLocalPort_Timeout(t *testing.T) {
	// use a high-numbered port that is unlikely to be in use
	port := 54321
	start := time.Now()
	if err := waitForLocalPort("127.0.0.1", port, 1*time.Second); err == nil {
		t.Fatalf("expected timeout error for unused port %d", port)
	}
	if time.Since(start) < 900*time.Millisecond {
		t.Fatalf("waitForLocalPort returned too quickly")
	}
}
