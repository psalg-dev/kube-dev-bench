import { useEffect, useMemo, useState } from 'react';
import { registry } from '../../../wailsjs/go/models';
import { showError, showSuccess } from '../../notification';
import { AddRegistry, TestRegistryConnection } from '../swarmApi';
import './registry.css';

const REGISTRY_TYPES = [
  { value: 'dockerhub', label: 'Docker Hub' },
  { value: 'artifactory', label: 'Artifactory' },
  { value: 'generic_v2', label: 'Generic v2' },
  // ECR removed until implemented
];

const AUTH_METHODS = [
  { value: 'none', label: 'None' },
  { value: 'basic', label: 'Basic' },
  { value: 'token', label: 'Token' },
];

type RegistryForm = {
  name: string;
  type: string;
  url: string;
  authMethod: string;
  username: string;
  password: string;
  token: string;
  timeoutSeconds: number | string;
  insecureSkipTlsVerify: boolean;
  allowInsecureHttp: boolean;
  customCACert: string;
};

function defaultStateForType(type: string): RegistryForm {
  if (type === 'dockerhub') {
    return {
      name: 'Docker Hub',
      type,
      url: 'https://registry-1.docker.io',
      authMethod: 'basic',
      username: '',
      password: '',
      token: '',
      timeoutSeconds: 30,
      insecureSkipTlsVerify: false,
      allowInsecureHttp: false,
      customCACert: '',
    };
  }

  if (type === 'artifactory') {
    return {
      name: 'Artifactory',
      type,
      url: '',
      authMethod: 'basic',
      username: '',
      password: '',
      token: '',
      timeoutSeconds: 30,
      insecureSkipTlsVerify: false,
      allowInsecureHttp: false,
      customCACert: '',
    };
  }

  return {
    name: '',
    type,
    url: '',
    authMethod: 'none',
    username: '',
    password: '',
    token: '',
    timeoutSeconds: 30,
    insecureSkipTlsVerify: false,
    allowInsecureHttp: false,
    customCACert: '',
  };
}

type AddRegistryModalProps = {
  open: boolean;
  onClose?: () => void;
  onSaved?: () => void;
};

export default function AddRegistryModal({ open, onClose, onSaved }: AddRegistryModalProps) {
  const [form, setForm] = useState<RegistryForm>(() => defaultStateForType('dockerhub'));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(defaultStateForType('dockerhub'));
    setBusy(false);
  }, [open]);

  const typeLabel = useMemo(() => REGISTRY_TYPES.find(t => t.value === form.type)?.label ?? form.type, [form.type]);
  const isDockerHub = form.type === 'dockerhub';

  const effectiveUrl = isDockerHub ? 'https://registry-1.docker.io' : (form.url || '');

  const buildConfig = (): registry.RegistryConfig => {
    const credentials = { username: '', password: '', token: '', region: '' };
    if (form.authMethod === 'basic') {
      credentials.username = form.username || '';
      credentials.password = form.password || '';
    } else if (form.authMethod === 'token') {
      // Docker Hub uses PATs as a password (with username) rather than a registry bearer token.
      if (isDockerHub) {
        credentials.username = form.username || '';
        credentials.password = form.token || '';
      } else {
        credentials.token = form.token || '';
      }
    }

    return registry.RegistryConfig.createFrom({
      name: form.name || '',
      type: form.type,
      url: effectiveUrl,
      credentials,
      timeoutSeconds: Number(form.timeoutSeconds) || 0,
      insecureSkipTlsVerify: !!form.insecureSkipTlsVerify,
      allowInsecureHttp: !!form.allowInsecureHttp,
      disableTlsVerification: false,
      customCACert: form.customCACert?.trim() || '',
    });
  };

  const validate = () => {
    if (!String(form.name || '').trim()) return 'Name is required.';
    if (!isDockerHub && !String(effectiveUrl || '').trim()) return 'URL is required.';

    if (form.authMethod === 'basic') {
      if (!String(form.username || '').trim()) return 'Username is required for Basic auth.';
      if (!String(form.password || '').trim()) return 'Password is required for Basic auth.';
    }
    if (form.authMethod === 'token') {
      if (isDockerHub) {
        if (!String(form.username || '').trim()) return 'Username is required for Docker Hub token auth.';
        if (!String(form.token || '').trim()) return 'Token is required for Docker Hub token auth.';
      } else {
        if (!String(form.token || '').trim()) return 'Token is required for Token auth.';
      }
    }

    return null;
  };

  const handleTest = async () => {
    const err = validate();
    if (err) {
      showError(err);
      return;
    }

    setBusy(true);
    try {
      await TestRegistryConnection(buildConfig());
      showSuccess('Registry connection OK');
    } catch (e: unknown) {
      showError(`Registry connection failed: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      showError(err);
      return;
    }

    setBusy(true);
    try {
      await AddRegistry(buildConfig());
      showSuccess(`Saved registry ${form.name}`);
      onSaved?.();
      onClose?.();
    } catch (e: unknown) {
      showError(`Failed to save registry: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="overlay registry-modal"
      onClick={() => onClose?.()}
    >
      <div
        className="overlay-content registry-modal__content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overlay-header">
          <div className="registry-modal__headerLeft">
            <div className="overlay-title">Add Registry</div>
            <div className="registry-modal__subtitle">{typeLabel}</div>
          </div>
          <button
            onClick={() => onClose?.()}
            className="overlay-close"
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="registry-modal__body">
          <div className="registry-modal__grid2">
            <div>
              <div className="registry-modal__label">Type</div>
              <select
                id="registry-type"
                value={form.type}
                onChange={(e) => setForm(defaultStateForType(e.target.value))}
                disabled={busy}
              >
                {REGISTRY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="registry-modal__label">Name</div>
              <input
                id="registry-name"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                disabled={busy}
                placeholder="e.g. Docker Hub"
              />
            </div>
          </div>

          <div>
            <div className="registry-modal__label">URL</div>
            {isDockerHub ? (
              <div className="registry-modal__readonly">{effectiveUrl}</div>
            ) : (
              <input
                id="registry-url"
                value={form.url}
                onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))}
                disabled={busy}
                placeholder="https://registry.example.com"
              />
            )}
          </div>

          <div className="registry-modal__grid2">
            <div>
              <div className="registry-modal__label">Auth Method</div>
              <select
                id="registry-auth-method"
                value={form.authMethod}
                onChange={(e) => setForm((s) => ({ ...s, authMethod: e.target.value, username: '', password: '', token: '' }))}
                disabled={busy}
              >
                {AUTH_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="registry-modal__label">Timeout (seconds)</div>
              <input
                id="registry-timeout-seconds"
                type="number"
                min={0}
                value={form.timeoutSeconds}
                onChange={(e) => setForm((s) => ({ ...s, timeoutSeconds: e.target.value }))}
                disabled={busy}
              />
            </div>
          </div>

          {form.authMethod === 'basic' && (
            <div className="registry-modal__grid2">
              <div>
                <div className="registry-modal__label">Username</div>
                <input
                  id="registry-username"
                  value={form.username}
                  onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div>
                <div className="registry-modal__label">Password</div>
                <input
                  id="registry-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                  disabled={busy}
                />
              </div>
            </div>
          )}

          {form.authMethod === 'token' && (
            <div className={isDockerHub ? 'registry-modal__grid2' : 'registry-modal__grid1'}>
              {isDockerHub && (
                <div>
                  <div className="registry-modal__label">Username</div>
                  <input
                    id="registry-username"
                    value={form.username}
                    onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                    disabled={busy}
                  />
                </div>
              )}
              <div>
                <div className="registry-modal__label">{isDockerHub ? 'Access Token' : 'Token'}</div>
                <input
                  id="registry-token"
                  type="password"
                  value={form.token}
                  onChange={(e) => setForm((s) => ({ ...s, token: e.target.value }))}
                  disabled={busy}
                />
              </div>
            </div>
          )}

          <div className="registry-modal__checkboxRow">
            <label className="registry-modal__checkbox">
              <input
                id="registry-insecure-skip-tls"
                type="checkbox"
                checked={!!form.insecureSkipTlsVerify}
                onChange={(e) => setForm((s) => ({ ...s, insecureSkipTlsVerify: e.target.checked }))}
                disabled={busy}
              />
              Insecure Skip TLS Verify
            </label>
            <label className="registry-modal__checkbox">
              <input
                id="registry-allow-insecure-http"
                type="checkbox"
                checked={!!form.allowInsecureHttp}
                onChange={(e) => setForm((s) => ({ ...s, allowInsecureHttp: e.target.checked }))}
                disabled={busy}
              />
              Allow Insecure HTTP
            </label>
          </div>

          <div>
            <div className="registry-modal__label">Custom CA Certificate Path</div>
            <input
              id="registry-custom-ca-cert"
              value={form.customCACert}
              onChange={(e) => setForm((s) => ({ ...s, customCACert: e.target.value }))}
              disabled={busy}
              placeholder="/path/to/ca-bundle.crt"
            />
            <div className="registry-modal__hint">
              PEM-encoded CA certificate for registries using a private certificate authority
            </div>
          </div>
        </div>

        <div className="registry-modal__footer">
          <div className="registry-modal__footerLeft">
            <button onClick={handleTest} disabled={busy} className="overlay-cancel-btn">
              Test Connection
            </button>
          </div>
          <div className="registry-modal__footerRight">
            <button onClick={() => onClose?.()} disabled={busy} className="overlay-cancel-btn">
              Cancel
            </button>
            <button onClick={handleSave} disabled={busy} className="overlay-create-btn">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

