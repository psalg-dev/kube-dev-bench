// Package logger provides structured logging for KubeDevBench using the
// standard library's log/slog package. It writes JSON-formatted logs to
// both a file (kubedevbench.log in the app's working directory) and stdout.
package logger

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
)

var (
	globalFile *os.File
	globalPath string
	initMu     sync.Mutex
	initialized bool
	stdoutWriter io.Writer = os.Stdout
)

// Init initializes the global slog logger. It creates a log file named
// "kubedevbench.log" in the given directory. If dir is empty, the current
// working directory is used. Output goes to both stdout and the file.
func Init(dir string) error {
	initMu.Lock()
	defer initMu.Unlock()

	if initialized {
		return nil
	}

	if dir == "" {
		dir = "."
	}
	dir = filepath.Clean(dir)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return fmt.Errorf("failed to create log directory %s: %w", dir, err)
	}
	logPath := filepath.Join(dir, "kubedevbench.log")
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return fmt.Errorf("failed to open log file %s: %w", logPath, err)
	}
	globalFile = f
	globalPath = logPath

	handler := slog.NewJSONHandler(writerFromDefault(), &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	slog.SetDefault(slog.New(handler))
	initialized = true
	slog.Info("logger initialized", "path", logPath)
	return nil
}

// SetLevel changes the minimum log level at runtime.
// Accepted values: slog.LevelDebug, slog.LevelInfo, slog.LevelWarn, slog.LevelError.
func SetLevel(level slog.Level) {
	handler := slog.NewJSONHandler(writerFromDefault(), &slog.HandlerOptions{
		Level: level,
	})
	slog.SetDefault(slog.New(handler))
}

// Close flushes and closes the log file. Call on application shutdown.
func Close() {
	if globalFile != nil {
		_ = globalFile.Sync()
		_ = globalFile.Close()
	}
}

// FilePath returns the path to the log file, or "" if not initialized.
func FilePath() string {
	return globalPath
}

// writerFromDefault returns the multi-writer (stdout + file) or just stdout.
func writerFromDefault() io.Writer {
	if globalFile != nil {
		return resilientMultiWriter{writers: []io.Writer{globalFile, stdoutWriter}}
	}
	return stdoutWriter
}

type resilientMultiWriter struct {
	writers []io.Writer
}

func (w resilientMultiWriter) Write(p []byte) (int, error) {
	var firstErr error
	wroteAny := false
	for _, writer := range w.writers {
		if writer == nil {
			continue
		}
		if _, err := writer.Write(p); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		wroteAny = true
	}
	if wroteAny {
		return len(p), nil
	}
	if firstErr != nil {
		return 0, firstErr
	}
	return len(p), nil
}

// ---- Convenience wrappers around slog (keep call sites short) ----

// Debug logs at DEBUG level.
func Debug(msg string, args ...any) {
	slog.Debug(msg, args...)
}

// Info logs at INFO level.
func Info(msg string, args ...any) {
	slog.Info(msg, args...)
}

// Warn logs at WARN level.
func Warn(msg string, args ...any) {
	slog.Warn(msg, args...)
}

// Error logs at ERROR level.
func Error(msg string, args ...any) {
	slog.Error(msg, args...)
}

// With returns a new slog.Logger with the given attributes pre-set.
// Useful for creating component-scoped loggers:
//
//	log := logger.With("component", "k8s")
//	log.Info("connected", "context", ctx)
func With(args ...any) *slog.Logger {
	return slog.With(args...)
}

// Logger returns the current default *slog.Logger for advanced usage.
func Logger() *slog.Logger {
	return slog.Default()
}

// ErrorContext logs at ERROR level with a context.
func ErrorContext(ctx context.Context, msg string, args ...any) {
	slog.ErrorContext(ctx, msg, args...)
}
