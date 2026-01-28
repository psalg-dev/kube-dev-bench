package safeconv

import "testing"

func TestUint64ToInt64(t *testing.T) {
	_, err := Uint64ToInt64(^uint64(0))
	if err == nil {
		t.Fatal("expected overflow error")
	}

	val, err := Uint64ToInt64(42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val != 42 {
		t.Fatalf("expected 42, got %d", val)
	}
}

func TestUint64ToInt(t *testing.T) {
	val, err := Uint64ToInt(7)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val != 7 {
		t.Fatalf("expected 7, got %d", val)
	}
}

func TestIntToUint64(t *testing.T) {
	_, err := IntToUint64(-1)
	if err == nil {
		t.Fatal("expected error for negative value")
	}

	val, err := IntToUint64(9)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val != 9 {
		t.Fatalf("expected 9, got %d", val)
	}
}
