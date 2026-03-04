// Package logger provides structured logging for KubeDevBench using the
// standard library's log/slog package. It writes JSON-formatted logs to
// both a file (kubedevbench.log in the app's working directory) and stdout.
//
// The file writer syncs to disk after every write to guarantee data reaches
// the file even when the process exits abnormally (common for desktop apps).
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
	globalMu     sync.Mutex // protects all global state below
	globalFile   *os.File
	globalPath   string
	globalDir    string // directory passed to Init, kept for reopen
	globalLevel  slog.LevelVar
	initialized  bool
	stdoutWriter io.Writer = os.Stdout
)

// Init initializes the global slog logger. It creates a log file named
// "kubedevbench.log" in the given directory. If dir is empty, the current
// working directory is used. Output goes to both stdout and the file.
//
// Init is safe to call multiple times; subsequent calls are no-ops.
// The returned error (if any) is also written to os.Stderr so that
// production GUI builds (where stdout is disconnected) still surface it.
func Init(dir string) error {
	globalMu.Lock()
	defer globalMu.Unlock()

	if initialized {
		return nil
	}

	if dir == "" {
		dir = "."
	}
	dir = filepath.Clean(dir)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return reportInitError(fmt.Errorf("failed to create log directory %s: %w", dir, err))
	}

	logPath := filepath.Join(dir, "kubedevbench.log")
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return reportInitError(fmt.Errorf("failed to open log file %s: %w", logPath, err))
	}

	globalFile = f
	globalPath = logPath
	globalDir = dir
	globalLevel.Set(slog.LevelInfo)

	mw := newSyncWriter(globalFile, stdoutWriter)
	handler := slog.NewJSONHandler(mw, &slog.HandlerOptions{
		Level: &globalLevel,
	})
	slog.SetDefault(slog.New(handler))
	initialized = true
	slog.Info("logger initialized", "path", logPath)
	return nil
}

// reportInitError writes err to stderr (always available on Windows, even for
// GUI subsystem apps) so the failure is visible in Event Viewer / debug logs.
func reportInitError(err error) error {
	_, _ = fmt.Fprintf(os.Stderr, "kubedevbench: logger init error: %v\n", err)
	return err
}

// SetLevel changes the minimum log level at runtime.
// Because the handler references a LevelVar, this takes effect immediately
// for all loggers (including sub-loggers created via With) without replacing
// the handler or its writer.
func SetLevel(level slog.Level) {
	globalLevel.Set(level)
}

// Close flushes and closes the log file. Call on application shutdown.
func Close() {
	globalMu.Lock()
	defer globalMu.Unlock()
	if globalFile != nil {
		_ = globalFile.Sync()
		_ = globalFile.Close()
		globalFile = nil
	}
}

// FilePath returns the path to the log file, or "" if not initialized.
func FilePath() string {
	globalMu.Lock()
	defer globalMu.Unlock()
	return globalPath
}

// Sync forces an fsync of the log file. Useful for critical checkpoints
// where you want to guarantee durability (e.g. before a risky operation).
func Sync() {
	globalMu.Lock()
	f := globalFile
	globalMu.Unlock()
	if f != nil {
		_ = f.Sync()
	}
}

// newSyncWriter returns a resilientMultiWriter that syncs the primary (file)
// writer after every write.
func newSyncWriter(file *os.File, console io.Writer) io.Writer {
	return &syncingFileWriter{file: file, console: console}
}

// syncingFileWriter writes each log record to the file AND console.
// After each write it calls file.Sync() so that data is durable on disk
// immediately — essential for desktop apps that may be killed at any time.
type syncingFileWriter struct {
	mu      sync.Mutex
	file    *os.File
	console io.Writer
}

func (w *syncingFileWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	var (
		fileOK    bool
		consoleOK bool
		firstErr  error
	)

	// Write to file first (the durable destination).
	if w.file != nil {
		if _, err := w.file.Write(p); err != nil {
			firstErr = err
		} else {
			// Sync after every write so data survives abnormal exit.
			if err := w.file.Sync(); err != nil && firstErr == nil {
				firstErr = err
			}
			fileOK = true
		}
	}

	// Write to console (best-effort; may be disconnected in production).
	if w.console != nil {
		if _, err := w.console.Write(p); err == nil {
			consoleOK = true
		}
	}

	if fileOK || consoleOK {
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
