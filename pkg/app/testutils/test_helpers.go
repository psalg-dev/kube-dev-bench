package testutils

import (
	"context"
	"fmt"
	"strings"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"

	"gowails/pkg/app"
)

// NewFakeApp returns an app.App instance configured for testing with the provided fake clientset.
// It also wires the provided exec stub functions to replace execInPod and execInPodLimited.
func NewFakeApp(ctx context.Context, client kubernetes.Interface, execStub func(namespace, pod, container string, command []string, timeout time.Duration) (string, error), execStubLimited func(namespace, pod, container string, command []string, timeout time.Duration, maxBytes int64) (string, error)) *app.App {
	a := app.NewApp()
	if ctx == nil {
		ctx = context.Background()
	}
	// Configure test clientset and exec stubs
	// Set test clientset and exec stubs
	a.TestClientset = client
	a.TestExecInPod = execStub
	a.TestExecInPodLimited = execStubLimited
	// Do not call Startup (would trigger Wails runtime). Tests should set a.ctx via Startup if they need full lifecycle.
	return a
}

// NewFakeClientset creates a fake kubernetes clientset pre-populated with provided objects (optional).
func NewFakeClientset() kubernetes.Interface {
	return fake.NewSimpleClientset()
}

// ExecStubFromLsOutput creates exec stubs for common pvc file operations.
// lsOutput is the raw output that should be returned for ls commands.
// files map maps absolute paths to file contents (string) which will be returned for head/cat commands.
// tarData (optional) will be returned when tar commands are executed (as bytes).
func ExecStubFromLsOutput(lsOutput string, files map[string]string, tarData []byte) (func(namespace, pod, container string, command []string, timeout time.Duration) (string, error), func(namespace, pod, container string, command []string, timeout time.Duration, maxBytes int64) (string, error)) {
	execStub := func(namespace, pod, container string, command []string, timeout time.Duration) (string, error) {
		cmd := strings.Join(command, " ")
		// Detect ls command
		if strings.Contains(cmd, "ls -alp") {
			return lsOutput, nil
		}
		// wc -c
		if strings.Contains(cmd, "wc -c") {
			// Attempt to find path in files map
			for _, c := range files {
				return fmt.Sprintf("%d", len(c)), nil
			}
			return "0", nil
		}
		// head -c or cat
		if strings.Contains(cmd, "head -c") || strings.Contains(cmd, "head -c") {
			// crude extraction of path between last two quotes
			idx := strings.LastIndex(cmd, " ")
			if idx >= 0 {
				p := strings.Trim(cmd[idx+1:], "\"'")
				if c, ok := files[p]; ok {
					return c, nil
				}
			}
			return "", nil
		}
		// default
		return "", nil
	}

	execStubLimited := func(namespace, pod, container string, command []string, timeout time.Duration, maxBytes int64) (string, error) {
		out, err := execStub(namespace, pod, container, command, timeout)
		if err != nil {
			return "", err
		}
		if tarData != nil && strings.Contains(strings.Join(command, " "), "tar -C") {
			// return tarData truncated to maxBytes as string
			if maxBytes > 0 && int64(len(tarData)) > maxBytes {
				return string(tarData[:maxBytes]), nil
			}
			return string(tarData), nil
		}
		if maxBytes > 0 && int64(len(out)) > maxBytes {
			return out[:maxBytes], nil
		}
		return out, nil
	}

	return execStub, execStubLimited
}
