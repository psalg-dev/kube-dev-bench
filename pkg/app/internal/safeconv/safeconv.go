package safeconv

import (
	"fmt"
	"math"
)

// Uint64ToInt64 safely converts uint64 to int64, returning error on overflow.
func Uint64ToInt64(v uint64) (int64, error) {
	if v > math.MaxInt64 {
		return 0, fmt.Errorf("value %d exceeds int64 max", v)
	}
	return int64(v), nil
}

// Uint64ToInt safely converts uint64 to int, returning error on overflow.
func Uint64ToInt(v uint64) (int, error) {
	maxInt := int(^uint(0) >> 1)
	if v > uint64(maxInt) {
		return 0, fmt.Errorf("value %d exceeds int max", v)
	}
	return int(v), nil
}

// IntToUint64 safely converts int to uint64, returning error for negative values.
func IntToUint64(v int) (uint64, error) {
	if v < 0 {
		return 0, fmt.Errorf("negative value %d cannot convert to uint64", v)
	}
	return uint64(v), nil
}
