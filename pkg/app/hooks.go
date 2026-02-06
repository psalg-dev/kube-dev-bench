package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type HookConfig struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Type           string `json:"type"` // "pre-connect" | "post-connect"
	ScriptPath     string `json:"scriptPath"`
	TimeoutSeconds int    `json:"timeoutSeconds"`
	AbortOnFailure bool   `json:"abortOnFailure"`
	Enabled        bool   `json:"enabled"`
	Scope          string `json:"scope"` // "global" | "connection"
	ConnectionID   string `json:"connectionId"`
	ConnectionType string `json:"connectionType"` // "kubernetes" | "swarm"
}

type HookExecutionResult struct {
	HookID    string `json:"hookId"`
	HookName  string `json:"hookName"`
	Success   bool   `json:"success"`
	ExitCode  int    `json:"exitCode"`
	Stdout    string `json:"stdout"`
	Stderr    string `json:"stderr"`
	Duration  int64  `json:"durationMs"`
	TimedOut  bool   `json:"timedOut"`
	Error     string `json:"error"`
	StartedAt string `json:"startedAt"`
}

type HooksConfig struct {
	Hooks []HookConfig `json:"hooks"`
}

const (
	hookTypePreConnect  = "pre-connect"
	hookTypePostConnect = "post-connect"

	hookScopeGlobal     = "global"
	hookScopeConnection = "connection"
)

func (a *App) hooksConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	// Spec path: ~/.KubeDevBench/hooks-config.json
	preferred := filepath.Join(home, ".KubeDevBench", "hooks-config.json")

	// Back-compat with existing app config dir (~/<home>/KubeDevBench)
	legacy := filepath.Join(home, "KubeDevBench", "hooks-config.json")

	// If preferred exists, use it. Else if legacy exists, read legacy.
	if _, err := os.Stat(preferred); err == nil {
		return preferred, nil
	}
	if _, err := os.Stat(legacy); err == nil {
		return legacy, nil
	}
	return preferred, nil
}

func (a *App) loadHooksConfig() (HooksConfig, error) {
	p, err := a.hooksConfigPath()
	if err != nil {
		return HooksConfig{Hooks: []HookConfig{}}, err
	}

	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return HooksConfig{Hooks: []HookConfig{}}, nil
		}
		return HooksConfig{Hooks: []HookConfig{}}, err
	}

	var cfg HooksConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		return HooksConfig{Hooks: []HookConfig{}}, err
	}
	if cfg.Hooks == nil {
		cfg.Hooks = []HookConfig{}
	}
	return cfg, nil
}

func (a *App) saveHooksConfig(cfg HooksConfig) error {
	p, err := a.hooksConfigPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, b, 0o644)
}

func (a *App) GetHooksConfig() (HooksConfig, error) {
	return a.loadHooksConfig()
}

func (a *App) SaveHook(hook HookConfig) (HookConfig, error) {
	cfg, err := a.loadHooksConfig()
	if err != nil {
		return HookConfig{}, err
	}

	if strings.TrimSpace(hook.ID) == "" {
		hook.ID = uuid.NewString()
	}
	if strings.TrimSpace(hook.Scope) == "" {
		hook.Scope = hookScopeGlobal
	}
	if strings.TrimSpace(hook.Type) == "" {
		hook.Type = hookTypePreConnect
	}

	updated := false
	for i := range cfg.Hooks {
		if cfg.Hooks[i].ID == hook.ID {
			cfg.Hooks[i] = hook
			updated = true
			break
		}
	}
	if !updated {
		cfg.Hooks = append(cfg.Hooks, hook)
	}

	if err := a.saveHooksConfig(cfg); err != nil {
		return HookConfig{}, err
	}
	return hook, nil
}

func (a *App) DeleteHook(hookID string) error {
	id := strings.TrimSpace(hookID)
	if id == "" {
		return errors.New("hookID required")
	}

	cfg, err := a.loadHooksConfig()
	if err != nil {
		return err
	}

	out := cfg.Hooks[:0]
	for _, h := range cfg.Hooks {
		if h.ID == id {
			continue
		}
		out = append(out, h)
	}
	cfg.Hooks = out

	return a.saveHooksConfig(cfg)
}

func (a *App) TestHook(hookID string) (HookExecutionResult, error) {
	cfg, err := a.loadHooksConfig()
	if err != nil {
		return HookExecutionResult{}, err
	}

	id := strings.TrimSpace(hookID)
	for _, h := range cfg.Hooks {
		if h.ID == id {
			env := map[string]string{
				"KDB_CONNECTION_TYPE": h.ConnectionType,
				"KDB_CONNECTION_ID":   h.ConnectionID,
			}
			return executeHook(h, env)
		}
	}
	return HookExecutionResult{}, fmt.Errorf("hook not found: %s", id)
}

func (a *App) SelectHookScript() (string, error) {
	// Let E2E runs bypass native dialogs.
	p, err := a.openFileDialogWithE2E(wailsRuntime.OpenDialogOptions{
		Title: "Select Hook Script",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Scripts / Executables", Pattern: "*.sh;*.bat;*.cmd;*.ps1;*.exe"},
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(p), nil
}

func executeHook(hook HookConfig, env map[string]string) (HookExecutionResult, error) {
	start := time.Now()
	res := HookExecutionResult{
		HookID:    hook.ID,
		HookName:  hook.Name,
		Success:   false,
		ExitCode:  -1,
		Stdout:    "",
		Stderr:    "",
		Duration:  0,
		TimedOut:  false,
		Error:     "",
		StartedAt: start.UTC().Format(time.RFC3339Nano),
	}

	script := strings.TrimSpace(hook.ScriptPath)
	if script == "" {
		res.Error = "scriptPath required"
		return res, errors.New(res.Error)
	}
	if _, err := os.Stat(script); err != nil {
		res.Error = fmt.Sprintf("script not accessible: %v", err)
		return res, err
	}

	timeout := hook.TimeoutSeconds
	if timeout <= 0 {
		timeout = 30
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	cmd, err := buildHookCommand(ctx, script)
	if err != nil {
		res.Error = err.Error()
		return res, err
	}

	cmd.Env = mergeEnv(os.Environ(), env)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	res.Stdout = stdout.String()
	res.Stderr = stderr.String()
	res.Duration = time.Since(start).Milliseconds()

	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			res.TimedOut = true
			res.Error = "hook timed out"
			return res, ctx.Err()
		}

		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			res.ExitCode = exitErr.ExitCode()
			res.Error = err.Error()
			return res, err
		}

		res.Error = err.Error()
		return res, err
	}

	if cmd.ProcessState != nil {
		res.ExitCode = cmd.ProcessState.ExitCode()
	} else {
		res.ExitCode = 0
	}
	res.Success = res.ExitCode == 0
	return res, nil
}

func buildHookCommand(ctx context.Context, scriptPath string) (*exec.Cmd, error) {
	ext := strings.ToLower(filepath.Ext(scriptPath))

	if runtime.GOOS == "windows" {
		switch ext {
		case ".bat", ".cmd":
			return exec.CommandContext(ctx, "cmd", "/c", scriptPath), nil
		case ".ps1":
			return exec.CommandContext(ctx, "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath), nil
		default:
			return exec.CommandContext(ctx, scriptPath), nil
		}
	}

	// Unix
	switch ext {
	case ".sh":
		return exec.CommandContext(ctx, "sh", scriptPath), nil
	default:
		return exec.CommandContext(ctx, scriptPath), nil
	}
}

func mergeEnv(base []string, overrides map[string]string) []string {
	if len(overrides) == 0 {
		return base
	}

	m := map[string]string{}
	order := []string{}
	for _, kv := range base {
		k, v, ok := strings.Cut(kv, "=")
		if !ok {
			continue
		}
		if _, exists := m[k]; !exists {
			order = append(order, k)
		}
		m[k] = v
	}

	for k, v := range overrides {
		if _, exists := m[k]; !exists {
			order = append(order, k)
		}
		m[k] = v
	}

	out := make([]string, 0, len(order))
	for _, k := range order {
		out = append(out, k+"="+m[k])
	}
	return out
}

type hookStartedEvent struct {
	Hook           HookConfig `json:"hook"`
	ConnectionType string     `json:"connectionType"`
	ConnectionID   string     `json:"connectionId"`
}

type hookCompletedEvent struct {
	Hook           HookConfig          `json:"hook"`
	Result         HookExecutionResult `json:"result"`
	ConnectionType string              `json:"connectionType"`
	ConnectionID   string              `json:"connectionId"`
}

func (a *App) emitHookStarted(h HookConfig, connectionType, connectionID string) {
	if a == nil || a.ctx == nil {
		return
	}
	emitEvent(a.ctx, EventHookStarted, hookStartedEvent{Hook: h, ConnectionType: connectionType, ConnectionID: connectionID})
}

func (a *App) emitHookCompleted(h HookConfig, r HookExecutionResult, connectionType, connectionID string) {
	if a == nil || a.ctx == nil {
		return
	}
	emitEvent(a.ctx, EventHookCompleted, hookCompletedEvent{Hook: h, Result: r, ConnectionType: connectionType, ConnectionID: connectionID})
}

func (a *App) getApplicableHooks(hookType, connectionType, connectionID string) ([]HookConfig, error) {
	cfg, err := a.loadHooksConfig()
	if err != nil {
		return nil, err
	}

	out := []HookConfig{}
	for _, h := range cfg.Hooks {
		if !h.Enabled {
			continue
		}
		if strings.TrimSpace(h.Type) != hookType {
			continue
		}
		if strings.TrimSpace(h.ConnectionType) != "" && h.ConnectionType != connectionType {
			continue
		}
		scope := strings.TrimSpace(h.Scope)
		if scope == "" {
			scope = hookScopeGlobal
		}
		switch scope {
		case hookScopeGlobal:
			out = append(out, h)
		case hookScopeConnection:
			if strings.TrimSpace(h.ConnectionID) == connectionID {
				out = append(out, h)
			}
		default:
			// unknown scope: ignore
		}
	}
	return out, nil
}

type runHooksResult struct {
	Results  []HookExecutionResult
	Aborted  bool
	AbortErr string
}

func (a *App) runPreConnectHooks(connectionType, connectionID string, connectionEnv map[string]string) (runHooksResult, error) {
	hooks, err := a.getApplicableHooks(hookTypePreConnect, connectionType, connectionID)
	if err != nil {
		return runHooksResult{}, err
	}

	out := runHooksResult{Results: []HookExecutionResult{}}
	for _, h := range hooks {
		a.emitHookStarted(h, connectionType, connectionID)
		res, execErr := executeHook(h, connectionEnv)
		a.emitHookCompleted(h, res, connectionType, connectionID)
		out.Results = append(out.Results, res)

		if execErr != nil && h.AbortOnFailure {
			out.Aborted = true
			out.AbortErr = res.Error
			return out, execErr
		}
	}
	return out, nil
}

func (a *App) runPostConnectHooksAsync(connectionType, connectionID string, connectionEnv map[string]string) {
	hooks, err := a.getApplicableHooks(hookTypePostConnect, connectionType, connectionID)
	if err != nil || len(hooks) == 0 {
		return
	}

	go func() {
		for _, h := range hooks {
			a.emitHookStarted(h, connectionType, connectionID)
			res, _ := executeHook(h, connectionEnv)
			a.emitHookCompleted(h, res, connectionType, connectionID)
		}
	}()
}
