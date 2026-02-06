import { useEffect, useMemo, useState } from 'react';
import { useConnectionsState } from './ConnectionsStateContext';
import './ConnectionHooksSettings.css';

type ConnectionHooksSettingsProps = {
  onClose: () => void;
};

type Hook = {
  id: string;
  name?: string;
  type?: 'pre-connect' | 'post-connect' | string;
  scriptPath?: string;
  timeoutSeconds?: number;
  abortOnFailure?: boolean;
  enabled?: boolean;
  scope?: 'global' | 'connection' | string;
  connectionType?: string;
  connectionId?: string;
};

type EditingConnection = {
  type?: string;
  path?: string;
  host?: string;
  name?: string;
  id?: string;
};

type HookForm = {
  id: string;
  name: string;
  type: string;
  scriptPath: string;
  timeoutSeconds: number;
  abortOnFailure: boolean;
  enabled: boolean;
  scope: string;
  connectionType: string;
  connectionId: string;
};

type TestResult = {
  success?: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
};

function safeIdPart(str: string) {
  return String(str || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);
}

function ConnectionHooksSettings({ onClose }: ConnectionHooksSettingsProps) {
  const { hooks, loading, error, editingConnectionHooks, actions } = useConnectionsState();

  const [localError, setLocalError] = useState('');
  const [activeHookId, setActiveHookId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<HookForm>({
    id: '',
    name: '',
    type: 'pre-connect',
    scriptPath: '',
    timeoutSeconds: 30,
    abortOnFailure: false,
    enabled: true,
    scope: 'global',
    connectionType: '',
    connectionId: '',
  });

  const [testRunningId, setTestRunningId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const title = editingConnectionHooks
    ? `🪝 Hooks - ${(editingConnectionHooks as EditingConnection).path || (editingConnectionHooks as EditingConnection).name || (editingConnectionHooks as EditingConnection).host || (editingConnectionHooks as EditingConnection).id}`
    : '🪝 Connection Hooks';

  const applicableHooks = useMemo(() => {
    const conn = editingConnectionHooks as EditingConnection | null;
    const filtered = (Array.isArray(hooks) ? (hooks as Hook[]) : []).filter((h) => {
      const scope = h?.scope || 'global';
      if (scope === 'global') return true;
      if (!conn) return false;
      return h?.connectionType === conn.type && h?.connectionId === (conn.path || conn.host || conn.id);
    });

    return filtered.sort((a, b) => {
      const at = (a?.type || 'pre-connect') === 'pre-connect' ? 0 : 1;
      const bt = (b?.type || 'pre-connect') === 'pre-connect' ? 0 : 1;
      if (at !== bt) return at - bt;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  }, [hooks, editingConnectionHooks]);

  const hasHooks = applicableHooks.length > 0;

  useEffect(() => {
    actions.loadHooks();
  }, [actions]);

  const openAdd = () => {
    setLocalError('');
    setTestResult(null);
    setActiveHookId(null);

    const conn = editingConnectionHooks as EditingConnection | null;
    const connId = conn ? conn.path || conn.host || conn.id || '' : '';

    setForm({
      id: '',
      name: '',
      type: 'pre-connect',
      scriptPath: '',
      timeoutSeconds: 30,
      abortOnFailure: false,
      enabled: true,
      scope: conn ? 'connection' : 'global',
      connectionType: conn ? conn.type || '' : '',
      connectionId: conn ? connId : '',
    });
    setFormOpen(true);
  };

  const openEdit = (hook: Hook) => {
    setLocalError('');
    setTestResult(null);
    setActiveHookId(hook.id);

    setForm({
      id: hook.id,
      name: hook.name || '',
      type: hook.type || 'pre-connect',
      scriptPath: hook.scriptPath || '',
      timeoutSeconds: Number(hook.timeoutSeconds || 30),
      abortOnFailure: !!hook.abortOnFailure,
      enabled: hook.enabled !== false,
      scope: hook.scope || 'global',
      connectionType: hook.connectionType || ((editingConnectionHooks as EditingConnection | null)?.type || ''),
      connectionId:
        hook.connectionId ||
        ((editingConnectionHooks as EditingConnection | null)
          ? (editingConnectionHooks as EditingConnection).path ||
            (editingConnectionHooks as EditingConnection).host ||
            (editingConnectionHooks as EditingConnection).id ||
            ''
          : ''),
    });
    setFormOpen(true);
  };

  const handleToggleEnabled = async (hook: Hook) => {
    const updated = {
      ...hook,
      enabled: !hook.enabled,
      name: hook.name || 'Unnamed Hook',
      type: hook.type || 'pre-connect',
      scriptPath: hook.scriptPath || '',
      timeoutSeconds: hook.timeoutSeconds ?? 30,
      abortOnFailure: hook.abortOnFailure ?? false,
      scope: hook.scope || 'global',
      connectionType: hook.connectionType || '',
      connectionId: hook.connectionId || '',
    };
    await actions.saveHook(updated);
    await actions.loadHooks();
  };

  const handleDelete = async (hook: Hook) => {
    if (!window.confirm(`Delete hook "${hook.name || 'Unnamed'}"?`)) return;
    await actions.deleteHook(hook.id);
    setFormOpen(false);
    setActiveHookId(null);
    setTestResult(null);
  };

  const validate = () => {
    if (!form.name.trim()) return 'Hook name is required';
    if (!form.scriptPath.trim()) return 'Script path is required';
    return '';
  };

  const handleSave = async () => {
    const v = validate();
    setLocalError(v);
    if (v) return;

    const conn = editingConnectionHooks as EditingConnection | null;
    const connId = conn ? conn.path || conn.host || conn.id || '' : '';

    const normalized = {
      ...form,
      timeoutSeconds: Number(form.timeoutSeconds || 30),
      scope: form.scope || 'global',
      type: form.type || 'pre-connect',
      connectionType: form.scope === 'connection' ? conn?.type || form.connectionType : '',
      connectionId: form.scope === 'connection' ? connId || form.connectionId : '',
    };

    const saved = await actions.saveHook(normalized);
    if (saved) {
      setFormOpen(false);
      setActiveHookId(saved.id);
      await actions.loadHooks();
    }
  };

  const handleTest = async (hookId: string) => {
    setTestRunningId(hookId);
    setTestResult(null);
    try {
      const res = await actions.testHook(hookId);
      setTestResult(res);
    } finally {
      setTestRunningId(null);
    }
  };

  const handleBrowse = async () => {
    const p = await actions.browseHookScript();
    if (p) setForm((prev) => ({ ...prev, scriptPath: p }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const hookTypeLabel = (type?: string) => {
    const t = type || 'pre-connect';
    return t === 'post-connect' ? 'Post-connect' : 'Pre-connect';
  };

  const connectionIdForDom = editingConnectionHooks
    ? safeIdPart(
        (editingConnectionHooks as EditingConnection).path ||
          (editingConnectionHooks as EditingConnection).host ||
          (editingConnectionHooks as EditingConnection).id ||
          ''
      )
    : 'global';

  return (
    <div
      id={`connection-hooks-overlay-${connectionIdForDom}`}
      className="hooks-settings-overlay connection-hooks-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="connection-hooks-dialog">
        <div className="connection-hooks-header">
          <div className="connection-hooks-header-text">
            <h2 className="connection-hooks-title">{title}</h2>
            <div className="connection-hooks-subtitle">
              Pre-connect hooks can block connections when &quot;Abort on failure&quot; is enabled.
            </div>
          </div>
          <button
            id="hooks-settings-close-btn"
            onClick={onClose}
            className="connection-hooks-close"
          >
            ✕
          </button>
        </div>

        {(error || localError) && (
          <div className="connection-hooks-alert">
            {localError || error}
          </div>
        )}

        <div className={`connection-hooks-content${hasHooks || formOpen ? ' is-split' : ''}`}>
          <div className={`connection-hooks-card connection-hooks-card--list${hasHooks ? '' : ' is-empty'}`}>
            {!hasHooks && !formOpen && (
              <div className="connection-hooks-empty">
                <div className="connection-hooks-empty-title">No hooks configured</div>
                <div className="connection-hooks-empty-text">
                  Add a hook to run a script before or after connecting. Pre-connect hooks can block connections when “Abort on
                  failure” is enabled.
                </div>
                <div>
                  <button id="add-hook-btn" className="connection-hooks-button connection-hooks-button--primary" onClick={openAdd}>
                    ➕ Add Hook
                  </button>
                </div>
              </div>
            )}

            {(hasHooks || formOpen) && (
              <>
                <div className="connection-hooks-note">
                  <div>
                    {editingConnectionHooks
                      ? 'Showing global hooks and hooks scoped to this connection.'
                      : 'Showing global hooks.'}
                  </div>
                </div>

                {applicableHooks.map((h) => {
                  const selected = activeHookId === h.id;
                  const type = h?.type || 'pre-connect';
                  return (
                    <div
                      key={h.id}
                      id={`hook-row-${safeIdPart(h.id)}`}
                      className={`connection-hooks-row${selected ? ' is-selected' : ''}`}
                    >
                      <div className="connection-hooks-row-inner">
                        <div className="connection-hooks-row-main">
                          <div className="connection-hooks-row-title">
                            <div className="connection-hooks-row-name">{h.name || '(Unnamed)'}</div>
                            <div className="connection-hooks-row-tag">{hookTypeLabel(type)}</div>
                            <div className="connection-hooks-row-scope">
                              {h.scope === 'connection' ? 'This connection' : 'Global'}
                            </div>
                          </div>
                          <div className="connection-hooks-row-path">{h.scriptPath}</div>
                          {h.abortOnFailure && type === 'pre-connect' && (
                            <div className="connection-hooks-row-warning">Abort on failure</div>
                          )}
                        </div>

                        <div className="connection-hooks-row-actions">
                          <label className="connection-hooks-toggle">
                            <input
                              id={`hook-enabled-${safeIdPart(h.id)}`}
                              type="checkbox"
                              checked={h.enabled !== false}
                              onChange={() => handleToggleEnabled(h)}
                            />
                            Enabled
                          </label>

                          <button
                            id={`hook-edit-${safeIdPart(h.id)}`}
                            className="connection-hooks-button connection-hooks-button--secondary"
                            onClick={() => openEdit(h)}
                          >
                            Edit
                          </button>
                          <button
                            id={`hook-test-${safeIdPart(h.id)}`}
                            className="connection-hooks-button connection-hooks-button--secondary"
                            onClick={() => handleTest(h.id)}
                            disabled={testRunningId === h.id}
                          >
                            {testRunningId === h.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            id={`hook-delete-${safeIdPart(h.id)}`}
                            className="connection-hooks-button connection-hooks-button--secondary"
                            onClick={() => handleDelete(h)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {hasHooks && (
                  <div className="connection-hooks-footer">
                    <button id="add-hook-btn" className="connection-hooks-button connection-hooks-button--primary" onClick={openAdd}>
                      ➕ Add Hook
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {(hasHooks || formOpen) && (
            <div className="connection-hooks-card connection-hooks-card--form">
              <div className="connection-hooks-form-title">
                {formOpen ? (form.id ? 'Edit Hook' : 'Add Hook') : 'Select “Add Hook” or “Edit”'}
              </div>

              {!formOpen && (
                <>
                  <div className="connection-hooks-form-text">
                    Use hooks to run scripts before or after connecting.
                  </div>

                  {testResult && (
                    <div className="connection-hooks-test">
                      <div className="connection-hooks-test-title">Test Result</div>
                      <div className={`connection-hooks-test-status${testResult.success ? ' is-success' : ' is-error'}`}>
                        {testResult.success ? '✓ Success' : '✗ Failed'} (exit {testResult.exitCode})
                      </div>
                      {testResult.stdout && (
                        <pre className="connection-hooks-test-output">
                          {testResult.stdout}
                        </pre>
                      )}
                      {testResult.stderr && (
                        <pre className="connection-hooks-test-output connection-hooks-test-output--error">
                          {testResult.stderr}
                        </pre>
                      )}
                      {testResult.error && (
                        <pre className="connection-hooks-test-output connection-hooks-test-output--error">
                          {testResult.error}
                        </pre>
                      )}
                    </div>
                  )}
                </>
              )}

              {formOpen && (
                <>
                  <div className="connection-hooks-field">
                    <div className="connection-hooks-field-row">
                      <label className="connection-hooks-label" htmlFor="hook-type-select">
                        Hook type
                      </label>
                    </div>
                    <select
                      id="hook-type-select"
                      className="connection-hooks-input"
                      value={form.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setForm((p) => ({
                          ...p,
                          type: nextType,
                          abortOnFailure: nextType === 'pre-connect' ? p.abortOnFailure : false,
                        }));
                      }}
                    >
                      <option value="pre-connect">Pre-connect</option>
                      <option value="post-connect">Post-connect</option>
                    </select>
                  </div>

                  <div className="connection-hooks-field">
                    <label className="connection-hooks-label" htmlFor="hook-name-input">
                      Hook name
                    </label>
                    <input
                      id="hook-name-input"
                      className="connection-hooks-input"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>

                  <div className="connection-hooks-field">
                    <label className="connection-hooks-label" htmlFor="hook-scriptpath-input">
                      Script path
                    </label>
                    <div className="connection-hooks-field-row">
                      <input
                        id="hook-scriptpath-input"
                        className="connection-hooks-input"
                        value={form.scriptPath}
                        onChange={(e) => setForm((p) => ({ ...p, scriptPath: e.target.value }))}
                      />
                      <button
                        id="hook-browse-btn"
                        className="connection-hooks-button connection-hooks-button--secondary"
                        onClick={handleBrowse}
                      >
                        Browse
                      </button>
                    </div>
                  </div>

                  <div className="connection-hooks-field">
                    <label className="connection-hooks-label" htmlFor="hook-timeout-input">
                      Timeout (seconds)
                    </label>
                    <input
                      id="hook-timeout-input"
                      type="number"
                      className="connection-hooks-input"
                      value={form.timeoutSeconds}
                      min={1}
                      onChange={(e) => setForm((p) => ({ ...p, timeoutSeconds: Number(e.target.value) }))}
                    />
                  </div>

                  {form.type === 'pre-connect' && (
                    <div className="connection-hooks-field">
                      <label className="connection-hooks-toggle connection-hooks-toggle--primary">
                        <input
                          id="hook-abort-checkbox"
                          type="checkbox"
                          checked={form.abortOnFailure}
                          onChange={(e) => setForm((p) => ({ ...p, abortOnFailure: e.target.checked }))}
                        />
                        Abort on failure
                      </label>
                    </div>
                  )}

                  <div className="connection-hooks-field">
                    <div className="connection-hooks-label">Scope</div>
                    <label className="connection-hooks-scope">
                      <input
                        id="hook-scope-global"
                        type="radio"
                        name="hook-scope"
                        checked={form.scope === 'global'}
                        onChange={() => setForm((p) => ({ ...p, scope: 'global' }))}
                      />{' '}
                      Global
                    </label>
                    <label className="connection-hooks-scope">
                      <input
                        id="hook-scope-connection"
                        type="radio"
                        name="hook-scope"
                        checked={form.scope === 'connection'}
                        disabled={!editingConnectionHooks}
                        onChange={() => setForm((p) => ({ ...p, scope: 'connection' }))}
                      />{' '}
                      This Connection
                    </label>
                  </div>

                  <div className="connection-hooks-actions">
                    <button
                      id="hook-cancel-btn"
                      className="connection-hooks-button connection-hooks-button--secondary"
                      onClick={() => {
                        setFormOpen(false);
                        setLocalError('');
                        setTestResult(null);
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      id="hook-save-btn"
                      className={`connection-hooks-button connection-hooks-button--primary${loading ? ' is-loading' : ''}`}
                      onClick={handleSave}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>

                  {testResult && (
                    <div className="connection-hooks-test">
                      <div className="connection-hooks-test-title">Test Result</div>
                      <div className={`connection-hooks-test-status${testResult.success ? ' is-success' : ' is-error'}`}>
                        {testResult.success ? '✓ Success' : '✗ Failed'} (exit {testResult.exitCode})
                      </div>
                      {testResult.stdout && (
                        <pre className="connection-hooks-test-output">
                          {testResult.stdout}
                        </pre>
                      )}
                      {testResult.stderr && (
                        <pre className="connection-hooks-test-output connection-hooks-test-output--error">
                          {testResult.stderr}
                        </pre>
                      )}
                      {testResult.error && (
                        <pre className="connection-hooks-test-output connection-hooks-test-output--error">
                          {testResult.error}
                        </pre>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConnectionHooksSettings;
