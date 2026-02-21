package holmesgpt

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Logger provides structured logging for Holmes operations
type Logger struct {
	mu      sync.Mutex
	file    *os.File
	logger  *log.Logger
	logPath string
	enabled bool
}

var (
	defaultLogger *Logger
	loggerOnce    sync.Once
)

// InitLogger initializes the global Holmes logger
// It writes logs to the workspace/logs directory
func InitLogger(workspacePath string) error {
	var initErr error
	loggerOnce.Do(func() {
		logDir := workspacePath
		if logDir == "" {
			// Default to user's home directory
			home, err := os.UserHomeDir()
			if err != nil {
				initErr = fmt.Errorf("failed to get home directory: %w", err)
				return
			}
			logDir = filepath.Join(home, "KubeDevBench", "logs")
		}

		if err := os.MkdirAll(logDir, 0o750); err != nil {
			initErr = fmt.Errorf("failed to create log directory: %w", err)
			return
		}

		logPath := filepath.Join(logDir, "holmes.log")
		// #nosec G304 -- log path is within the app logs directory.
		file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
		if err != nil {
			initErr = fmt.Errorf("failed to open log file: %w", err)
			return
		}

		// Write to both file and stdout for debugging
		multiWriter := io.MultiWriter(file, os.Stdout)

		defaultLogger = &Logger{
			file:    file,
			logger:  log.New(multiWriter, "", 0),
			logPath: logPath,
			enabled: true,
		}

		defaultLogger.Info("Holmes logger initialized", "logPath", logPath)
	})
	return initErr
}

// GetLogger returns the default logger instance
func GetLogger() *Logger {
	if defaultLogger == nil {
		// Create a fallback logger that writes to stdout only
		return &Logger{
			logger:  log.New(os.Stdout, "", 0),
			enabled: true,
		}
	}
	return defaultLogger
}

// GetLogPath returns the path to the log file
func GetLogPath() string {
	if defaultLogger != nil {
		return defaultLogger.logPath
	}
	return ""
}

func (l *Logger) log(level, msg string, keyvals ...interface{}) {
	if l == nil || !l.enabled {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	timestamp := time.Now().Format("2006-01-02 15:04:05.000")

	// Build the log message with key-value pairs
	logMsg := fmt.Sprintf("[%s] [%s] %s", timestamp, level, msg)

	for i := 0; i < len(keyvals)-1; i += 2 {
		key := keyvals[i]
		val := keyvals[i+1]
		logMsg += fmt.Sprintf(" %v=%v", key, val)
	}

	l.logger.Println(logMsg)
}

// Debug logs a debug message
func (l *Logger) Debug(msg string, keyvals ...interface{}) {
	l.log("DEBUG", msg, keyvals...)
}

// Info logs an info message
func (l *Logger) Info(msg string, keyvals ...interface{}) {
	l.log("INFO", msg, keyvals...)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string, keyvals ...interface{}) {
	l.log("WARN", msg, keyvals...)
}

// Error logs an error message
func (l *Logger) Error(msg string, keyvals ...interface{}) {
	l.log("ERROR", msg, keyvals...)
}

// Close closes the log file
func (l *Logger) Close() error {
	if l == nil || l.file == nil {
		return nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.file.Close()
}

// Package-level convenience functions

// Debug logs a debug message using the default logger
func Debug(msg string, keyvals ...interface{}) {
	GetLogger().Debug(msg, keyvals...)
}

// Info logs an info message using the default logger
func Info(msg string, keyvals ...interface{}) {
	GetLogger().Info(msg, keyvals...)
}

// Warn logs a warning message using the default logger
func Warn(msg string, keyvals ...interface{}) {
	GetLogger().Warn(msg, keyvals...)
}

// Error logs an error message using the default logger
func Error(msg string, keyvals ...interface{}) {
	GetLogger().Error(msg, keyvals...)
}
