package docker

const maxInt64 = int64(^uint64(0) >> 1)

func safeInt64FromUint64(v uint64) int64 {
	if v > uint64(maxInt64) {
		return maxInt64
	}
	return int64(v)
}
