// New tests for CreateManifestOverlay component
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocks -------------------------------------------------------------
vi.mock('@codemirror/view', () => {
  let ctorCount = 0;
  let lastInstance = null;
  const instances = [];
  class MockEditorView {
    static theme() { return {}; }
    static lineWrapping = {}; // used in extensions
    constructor({ state }) {
      ctorCount++; this.state = state; this._dispatches = []; lastInstance = this; instances.push(this);
      this.destroy = vi.fn();
    }
    dispatch(tr) {
      this._dispatches.push(tr);
      if (tr?.changes?.insert !== undefined) {
        const newDoc = tr.changes.insert;
        // mutate doc content helper
        this.state.doc.__set(newDoc);
      }
    }
  }
  return {
    EditorView: MockEditorView,
    lineNumbers: () => ({}),
    highlightActiveLineGutter: () => ({}),
    keymap: { of: () => ({}) },
    __getCtorCount: () => ctorCount,
    __getLastInstance: () => lastInstance,
    __getInstances: () => instances,
  };
});

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: ({ doc }) => {
      let content = doc || '';
      return {
        doc: {
          toString: () => content,
          get length() { return content.length; },
          __set: (v) => { content = v; }
        },
      };
    }
  }
}));

vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => ({}) }));
vi.mock('@codemirror/language', () => ({
  foldGutter: () => ({}),
  foldKeymap: [],
  syntaxHighlighting: () => ({}),
  defaultHighlightStyle: {},
}));

// Centralized Wails mocks (no longer mocking notifications globally)
import { createResourceMock, createSwarmConfigMock, createSwarmSecretMock, eventsEmitMock, resetAllMocks } from './wailsMocks';

// Local notification mocks for this test file
const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();
vi.mock('../notification.js', () => ({
  showSuccess: (...a) => showSuccessMock(...a),
  showError: (...a) => showErrorMock(...a),
}));

// Import after mocks
import CreateManifestOverlay from '../CreateManifestOverlay.jsx';
import { __getCtorCount, __getLastInstance } from '@codemirror/view';

function openOverlay(props = {}) {
  return render(<CreateManifestOverlay open kind="Deployment" namespace="dev" onClose={vi.fn()} {...props} />);
}

beforeEach(() => { resetAllMocks(); showSuccessMock.mockReset(); showErrorMock.mockReset(); document.body.innerHTML = ''; });

describe('CreateManifestOverlay', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<CreateManifestOverlay open={false} kind="Deployment" />);
    expect(container.firstChild).toBeNull();
  });

  it('mounts editor with default manifest for kind + namespace', () => {
    const before = __getCtorCount();
    openOverlay({ kind: 'Deployment', namespace: 'dev' });
    expect(__getCtorCount()).toBe(before + 1);
    const inst = __getLastInstance();
    const doc = inst.state.doc.toString();
    expect(doc).toMatch(/kind: Deployment/);
    expect(doc).toMatch(/namespace: dev/);
  });

  it('updates manifest when kind changes while open (dispatch used, no new ctor)', () => {
    const { rerender } = openOverlay({ kind: 'Deployment', namespace: 'dev' });
    const ctorAfterFirst = __getCtorCount();
    rerender(<CreateManifestOverlay open kind="Job" namespace="dev" onClose={vi.fn()} />);
    expect(__getCtorCount()).toBe(ctorAfterFirst); // same instance
    const inst = __getLastInstance();
    const doc = inst.state.doc.toString();
    expect(doc).toMatch(/kind: Job/);
  });

  it('destroys editor when closed & recreates on reopen', () => {
    const { rerender } = openOverlay({ kind: 'ConfigMap' });
    const firstInst = __getLastInstance();
    expect(firstInst.destroy).not.toHaveBeenCalled();
    rerender(<CreateManifestOverlay open={false} kind="ConfigMap" />);
    expect(firstInst.destroy).toHaveBeenCalled();
    const ctorAfterClose = __getCtorCount();
    rerender(<CreateManifestOverlay open kind="ConfigMap" namespace="x" />);
    expect(__getCtorCount()).toBe(ctorAfterClose + 1); // new instance created
  });

  it('calls CreateResource and emits events + success on Create', async () => {
    createResourceMock.mockResolvedValueOnce({});
    const onClose = vi.fn();
    openOverlay({ kind: 'Deployment', namespace: 'dev', onClose });
    const inst = __getLastInstance();
    const manifest = inst.state.doc.toString();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(createResourceMock).toHaveBeenCalled());
    expect(createResourceMock).toHaveBeenCalledWith('dev', manifest);
    expect(showSuccessMock).toHaveBeenCalled();
    expect(eventsEmitMock).toHaveBeenCalledWith('resource-updated', expect.objectContaining({ resource: 'deployment', namespace: 'dev' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error & does not close on create failure', async () => {
    createResourceMock.mockRejectedValueOnce(new Error('BoomFail'));
    const onClose = vi.fn();
    openOverlay({ kind: 'Secret', namespace: 'dev', onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(showErrorMock).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/BoomFail/)).toBeInTheDocument();
  });

  it('invokes onClose when clicking backdrop & Escape key', () => {
    const onClose = vi.fn();
    openOverlay({ kind: 'DaemonSet', onClose });
    // click backdrop: overlay root is the first div rendered
    const overlay = document.querySelector('body > div > div');
    fireEvent.click(overlay); // backdrop
    expect(onClose).toHaveBeenCalledTimes(1);
    // reopen to test Escape
    onClose.mockReset();
    const { rerender } = render(<CreateManifestOverlay open kind="DaemonSet" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    rerender(<CreateManifestOverlay open={false} kind="DaemonSet" onClose={onClose} />);
  });

  it('does not create resource when manifest doc is empty', async () => {
    const onClose = vi.fn();
    openOverlay({ kind: 'ConfigMap', onClose });
    // Force empty doc
    const inst = __getLastInstance();
    inst.state.doc.__set('');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getByText(/Manifest is empty/)).toBeInTheDocument());
    expect(createResourceMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('swarm: creates config via CreateSwarmConfig', async () => {
    createSwarmConfigMock.mockResolvedValueOnce('cfg-id');
    const onClose = vi.fn();
    render(<CreateManifestOverlay open platform="swarm" kind="config" onClose={onClose} />);
    // name field is required
    fireEvent.change(screen.getByLabelText(/swarm resource name/i), { target: { value: 'my-config' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(createSwarmConfigMock).toHaveBeenCalled());
    expect(createSwarmConfigMock).toHaveBeenCalledWith('my-config', expect.any(String), {});
    expect(showSuccessMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('swarm: creates secret via CreateSwarmSecret (labels parsed)', async () => {
    createSwarmSecretMock.mockResolvedValueOnce('sec-id');
    const onClose = vi.fn();
    render(<CreateManifestOverlay open platform="swarm" kind="secret" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/swarm resource name/i), { target: { value: 'my-secret' } });
    fireEvent.change(screen.getByLabelText(/swarm labels/i), { target: { value: 'a=b\n# comment\nempty=\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(createSwarmSecretMock).toHaveBeenCalled());
    expect(createSwarmSecretMock).toHaveBeenCalledWith('my-secret', expect.any(String), { a: 'b', empty: '' });
    expect(showSuccessMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('swarm: shows not-implemented error for unsupported kinds', async () => {
    const onClose = vi.fn();
    render(<CreateManifestOverlay open platform="swarm" kind="service" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/swarm resource name/i), { target: { value: 'my-service' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(showErrorMock).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
