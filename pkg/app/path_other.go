//go:build !windows

package app

// supplementWindowsPath is a no-op on non-Windows platforms.
func supplementWindowsPath() {}
