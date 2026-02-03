import { useMemo, useState, useEffect } from 'react';
import { useConnectionsState } from './ConnectionsStateContext.jsx';
import { BaseModal, ModalButton } from '../../components/BaseModal';

const contentStyle = {
  padding: 20,
  overflowY: 'auto',
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1fr 340px',
  gap: 16,
};

const cardStyle = {
  background: 'var(--gh-card-bg, #161b22)',
  border: '1px solid var(--gh-border, #30363d)',
  borderRadius: 0,
  padding: 12,
};

const buttonStyle = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: 'var(--gh-accent, #0969da)',
  color: '#fff',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: 'var(--gh-button-secondary-bg, #444)',
  color: 'var(--gh-text, #fff)',
  border: '1px solid var(--gh-border, #555)',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--gh-input-bg, #0d1117)',
  border: '1px solid var(--gh-border, #30363d)',
  color: 'var(--gh-text, #c9d1d9)',
  fontSize: 14,
  boxSizing: 'border-box',
};

function safeIdPart(str) {
  return String(str || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);
}

function ConnectionHooksSettings({ onClose }) {
  const {
    hooks,
    loading,
    error,
    editingConnectionHooks,
    actions,
  } = useConnectionsState();

  const [localError, setLocalError] = useState('');
  const [activeHookId, setActiveHookId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
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

  const [testRunningId, setTestRunningId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const title = editingConnectionHooks
    ? `🪝 Hooks - ${editingConnectionHooks.path || editingConnectionHooks.name || editingConnectionHooks.host || editingConnectionHooks.id}`
    : '🪝 Connection Hooks';

  const applicableHooks = useMemo(() => {
    const conn = editingConnectionHooks;
    const filtered = (Array.isArray(hooks) ? hooks : []).filter((h) => {
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

  const openAdd = () => {
    setLocalError('');
    setTestResult(null);
    setActiveHookId(null);

    const conn = editingConnectionHooks;
    const connId = conn ? (conn.path || conn.host || conn.id) : '';

    setForm({
      id: '',
      name: '',
      type: 'pre-connect',
      scriptPath: '',
      timeoutSeconds: 30,
      abortOnFailure: false,
      enabled: true,
      scope: conn ? 'connection' : 'global',
      connectionType: conn ? conn.type : '',
      connectionId: conn ? connId : '',
    });
    setFormOpen(true);
  };

  const openEdit = (hook) => {
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
      connectionType: hook.connectionType || (editingConnectionHooks?.type || ''),
      connectionId: hook.connectionId || (editingConnectionHooks ? (editingConnectionHooks.path || editingConnectionHooks.host || editingConnectionHooks.id) : ''),
    });
    setFormOpen(true);
  };

  const handleToggleEnabled = async (hook) => {
    const updated = { ...hook, enabled: !hook.enabled };
    await actions.saveHook(updated);
    await actions.loadHooks();
  };

  const handleDelete = async (hook) => {
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

    const conn = editingConnectionHooks;
    const connId = conn ? (conn.path || conn.host || conn.id) : '';

    const normalized = {
      ...form,
      timeoutSeconds: Number(form.timeoutSeconds || 30),
      scope: form.scope || 'global',
      type: form.type || 'pre-connect',
      connectionType: form.scope === 'connection' ? (conn?.type || form.connectionType) : '',
      connectionId: form.scope === 'connection' ? (connId || form.connectionId) : '',
    };

    const saved = await actions.saveHook(normalized);
    if (saved) {
      setFormOpen(false);
      setActiveHookId(saved.id);
      await actions.loadHooks();
    }
  };

  const handleTest = async (hookId) => {
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hookTypeLabel = (type) => {
    const t = type || 'pre-connect';
    return t === 'post-connect' ? 'Post-connect' : 'Pre-connect';
  };

  const connectionIdForDom = editingConnectionHooks
    ? safeIdPart(editingConnectionHooks.path || editingConnectionHooks.host || editingConnectionHooks.id)
    : 'global';

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={title}
      width={760}
      className="hooks-settings-overlay"
      footer={
        <ModalButton onClick={onClose} id="hooks-settings-close-btn">
          Close
        </ModalButton>
      }
    >
      <div id={`connection-hooks-overlay-${connectionIdForDom}`} style={{ padding: 12, overflowY: 'auto' }}>
        <div style={{ color: 'var(--gh-text-secondary, #ccc)', fontSize: 12, marginBottom: 12 }}>
          Pre-connect hooks can block connections when &quot;Abort on failure&quot; is enabled.
        </div>

        {(error || localError) && (
          <div
            style={{
              background: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid #f85149',
              color: '#f85149',
              padding: '10px 12px',
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            {localError || error}
          </div>
        )}

        <div style={{ ...contentStyle, gridTemplateColumns: (hasHooks || formOpen) ? '1fr 340px' : '1fr' }}>
          {/* Left: hooks list */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', minHeight: hasHooks ? undefined : 260 }}>
            {!hasHooks && !formOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 8 }}>
                <div style={{ fontWeight: 700, color: 'var(--gh-text, #fff)', fontSize: 14 }}>
                  No hooks configured
                </div>
                <div style={{ color: 'var(--gh-text-secondary, #ccc)', fontSize: 13, lineHeight: 1.5 }}>
                  Add a hook to run a script before or after connecting.
                  Pre-connect hooks can block connections when “Abort on failure” is enabled.
                </div>
                <div>
                  <button id="add-hook-btn" style={primaryButtonStyle} onClick={openAdd}>
                    ➕ Add Hook
                  </button>
                </div>
              </div>
            )}

            {(hasHooks || formOpen) && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #ccc)' }}>
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
                      style={{
                        border: '1px solid var(--gh-border, #30363d)',
                        background: selected ? 'rgba(56, 139, 253, 0.08)' : 'transparent',
                        padding: 10,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700, color: 'var(--gh-text, #fff)' }}>{h.name || '(Unnamed)'}</div>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--gh-text-secondary, #ccc)',
                                border: '1px solid var(--gh-border, #30363d)',
                                padding: '2px 6px',
                              }}
                            >
                              {hookTypeLabel(type)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--gh-text-secondary, #ccc)' }}>
                              {h.scope === 'connection' ? 'This connection' : 'Global'}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #ccc)', fontFamily: 'monospace' }}>
                            {h.scriptPath}
                          </div>
                          {h.abortOnFailure && type === 'pre-connect' && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#f0c674' }}>Abort on failure</div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--gh-text-secondary, #ccc)' }}>
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
                            style={secondaryButtonStyle}
                            onClick={() => openEdit(h)}
                          >
                            Edit
                          </button>
                          <button
                            id={`hook-test-${safeIdPart(h.id)}`}
                            style={secondaryButtonStyle}
                            onClick={() => handleTest(h.id)}
                            disabled={testRunningId === h.id}
                          >
                            {testRunningId === h.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            id={`hook-delete-${safeIdPart(h.id)}`}
                            style={secondaryButtonStyle}
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
                  <div style={{ marginTop: 8 }}>
                    <button id="add-hook-btn" style={primaryButtonStyle} onClick={openAdd}>
                      ➕ Add Hook
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: add/edit form (when hooks exist or adding/editing from empty state) */}
          {(hasHooks || formOpen) && (
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: 'var(--gh-text, #fff)', marginBottom: 10 }}>
                {formOpen ? (form.id ? 'Edit Hook' : 'Add Hook') : 'Select “Add Hook” or “Edit”'}
              </div>

              {!formOpen && (
                <>
                  <div style={{ color: 'var(--gh-text-secondary, #ccc)', fontSize: 13 }}>
                    Use hooks to run scripts before or after connecting.
                  </div>

                  {testResult && (
                    <div style={{ marginTop: 16, borderTop: '1px solid var(--gh-border, #30363d)', paddingTop: 12 }}>
                      <div style={{ fontWeight: 700, color: 'var(--gh-text, #fff)', marginBottom: 8 }}>
                        Test Result
                      </div>
                      <div style={{ fontSize: 12, color: testResult.success ? '#2ea44f' : '#f85149' }}>
                        {testResult.success ? '✓ Success' : '✗ Failed'} (exit {testResult.exitCode})
                      </div>
                      {testResult.stdout && (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', color: 'var(--gh-text-secondary, #ccc)', fontSize: 12 }}>
                          {testResult.stdout}
                        </pre>
                      )}
                      {testResult.stderr && (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', color: '#f85149', fontSize: 12 }}>
                          {testResult.stderr}
                        </pre>
                      )}
                      {testResult.error && (
                        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', color: '#f85149', fontSize: 12 }}>
                          {testResult.error}
                        </pre>
                      )}
                    </div>
                  )}
                </>
              )}

              {formOpen && (
                <>
                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #fff)', fontSize: 13 }} htmlFor="hook-type-select">
                        Hook type
                      </label>
                    </div>
                    <select
                      id="hook-type-select"
                      style={inputStyle}
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

                  <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #fff)', fontSize: 13 }} htmlFor="hook-name-input">
                    Hook name
                  </label>
                  <input
                    id="hook-name-input"
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #fff)', fontSize: 13 }} htmlFor="hook-scriptpath-input">
                    Script path
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="hook-scriptpath-input"
                      style={inputStyle}
                      value={form.scriptPath}
                      onChange={(e) => setForm((p) => ({ ...p, scriptPath: e.target.value }))}
                    />
                    <button id="hook-browse-btn" style={secondaryButtonStyle} onClick={handleBrowse}>
                      Browse
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #fff)', fontSize: 13 }} htmlFor="hook-timeout-input">
                    Timeout (seconds)
                  </label>
                  <input
                    id="hook-timeout-input"
                    type="number"
                    style={inputStyle}
                    value={form.timeoutSeconds}
                    min={1}
                    onChange={(e) => setForm((p) => ({ ...p, timeoutSeconds: Number(e.target.value) }))}
                  />
                </div>

                {form.type === 'pre-connect' && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--gh-text, #fff)' }}>
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

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--gh-text, #fff)', marginBottom: 6 }}>Scope</div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--gh-text-secondary, #ccc)', marginBottom: 6 }}>
                    <input
                      id="hook-scope-global"
                      type="radio"
                      name="hook-scope"
                      checked={form.scope === 'global'}
                      onChange={() => setForm((p) => ({ ...p, scope: 'global' }))}
                    />{' '}
                    Global
                  </label>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--gh-text-secondary, #ccc)' }}>
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

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button
                    id="hook-cancel-btn"
                    style={secondaryButtonStyle}
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
                    style={{ ...primaryButtonStyle, opacity: loading ? 0.6 : 1 }}
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </div>

                {testResult && (
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--gh-border, #30363d)', paddingTop: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--gh-text, #fff)', marginBottom: 8 }}>
                      Test Result
                    </div>
                    <div style={{ fontSize: 12, color: testResult.success ? '#2ea44f' : '#f85149' }}>
                      {testResult.success ? '✓ Success' : '✗ Failed'} (exit {testResult.exitCode})
                    </div>
                    {testResult.stdout && (
                      <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', color: 'var(--gh-text-secondary, #ccc)', fontSize: 12 }}>
                        {testResult.stdout}
                      </pre>
                    )}
                    {testResult.stderr && (
                      <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', color: '#f85149', fontSize: 12 }}>
                        {testResult.stderr}
                      </pre>
                    )}
                    {testResult.error && (
                      <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', color: '#f85149', fontSize: 12 }}>
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
    </BaseModal>
  );
}

export default ConnectionHooksSettings;
