// New tests for CreateManifestOverlay component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocks -------------------------------------------------------------
vi.mock('../components/CodeMirrorEditor', () => {
  let renderCount = 0;
  let lastProps = null;
  const MockEditor = ({ value, onChange, ...rest }) => {
    renderCount += 1;
    lastProps = { value, onChange, ...rest };
    return (
      <textarea
        data-testid="code-mirror-editor"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  };
  return {
    default: MockEditor,
    __getRenderCount: () => renderCount,
    __getLastProps: () => lastProps,
    EditorLoading: () => null,
  };
});

// Centralized Wails mocks (no longer mocking notifications globally)
import { createResourceMock, createSwarmConfigMock, createSwarmSecretMock, createSwarmServiceMock, createSwarmStackMock, updateSwarmNodeAvailabilityMock, updateSwarmNodeRoleMock, updateSwarmNodeLabelsMock, eventsEmitMock, resetAllMocks } from './wailsMocks';

// Local notification mocks for this test file
const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();
vi.mock('../notification.js', () => ({
  showSuccess: (...a) => showSuccessMock(...a),
  showError: (...a) => showErrorMock(...a),
}));

// Import after mocks
import CreateManifestOverlay from '../CreateManifestOverlay.jsx';

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
    openOverlay({ kind: 'Deployment', namespace: 'dev' });
    const editor = screen.getByTestId('code-mirror-editor');
    expect(editor.value).toMatch(/kind: Deployment/);
    expect(editor.value).toMatch(/namespace: dev/);
  });

  it('updates manifest when kind changes while open (dispatch used, no new ctor)', () => {
    const { rerender } = openOverlay({ kind: 'Deployment', namespace: 'dev' });
    rerender(<CreateManifestOverlay open kind="Job" namespace="dev" onClose={vi.fn()} />);
    const editor = screen.getByTestId('code-mirror-editor');
    expect(editor.value).toMatch(/kind: Job/);
  });

  it('destroys editor when closed & recreates on reopen', () => {
    const { rerender } = openOverlay({ kind: 'ConfigMap' });
    rerender(<CreateManifestOverlay open={false} kind="ConfigMap" />);
    expect(screen.queryByTestId('code-mirror-editor')).toBeNull();
    rerender(<CreateManifestOverlay open kind="ConfigMap" namespace="x" />);
    expect(screen.getByTestId('code-mirror-editor')).toBeInTheDocument();
  });

  it('calls CreateResource and emits events + success on Create', async () => {
    createResourceMock.mockResolvedValueOnce({});
    const onClose = vi.fn();
    openOverlay({ kind: 'Deployment', namespace: 'dev', onClose });
    const editor = screen.getByTestId('code-mirror-editor');
    const manifest = editor.value;
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
    fireEvent.change(screen.getByTestId('code-mirror-editor'), { target: { value: '' } });
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

  it('swarm: config YAML tab uses CodeMirror and renders YAML wrapper', async () => {
    render(<CreateManifestOverlay open platform="swarm" kind="config" onClose={vi.fn()} />);
    // starts in Form mode (no CodeMirror)
    expect(screen.queryByTestId('code-mirror-editor')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'YAML' }));
    const editor = await screen.findByTestId('code-mirror-editor');
    expect(editor.value).toMatch(/name:/);
    expect(editor.value).toMatch(/data:/);
  });

  it('swarm: creates secret via CreateSwarmSecret (labels parsed)', async () => {
    createSwarmSecretMock.mockResolvedValueOnce('sec-id');
    const onClose = vi.fn();
    render(<CreateManifestOverlay open platform="swarm" kind="secret" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/swarm resource name/i), { target: { value: 'my-secret' } });

    // Fill labels via structured key/value editor
    const labelKeys1 = screen.getAllByLabelText(/label key/i);
    const labelVals1 = screen.getAllByLabelText(/label value/i);
    fireEvent.change(labelKeys1[0], { target: { value: 'a' } });
    fireEvent.change(labelVals1[0], { target: { value: 'b' } });

    fireEvent.click(screen.getByRole('button', { name: /add label/i }));
    const labelKeys2 = screen.getAllByLabelText(/label key/i);
    const labelVals2 = screen.getAllByLabelText(/label value/i);
    fireEvent.change(labelKeys2[1], { target: { value: 'empty' } });
    fireEvent.change(labelVals2[1], { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(createSwarmSecretMock).toHaveBeenCalled());
    expect(createSwarmSecretMock).toHaveBeenCalledWith('my-secret', expect.any(String), { a: 'b', empty: '' });
    expect(showSuccessMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('swarm: updates node via UpdateSwarmNodeAvailability/Role/Labels', async () => {
    updateSwarmNodeAvailabilityMock.mockResolvedValueOnce(undefined);
    updateSwarmNodeRoleMock.mockResolvedValueOnce(undefined);
    updateSwarmNodeLabelsMock.mockResolvedValueOnce(undefined);
    const onClose = vi.fn();

    render(<CreateManifestOverlay open platform="swarm" kind="node" onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/swarm node id/i), { target: { value: 'node-1' } });

    const labelKeys1 = screen.getAllByLabelText(/label key/i);
    const labelVals1 = screen.getAllByLabelText(/label value/i);
    fireEvent.change(labelKeys1[0], { target: { value: 'a' } });
    fireEvent.change(labelVals1[0], { target: { value: 'b' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(updateSwarmNodeAvailabilityMock).toHaveBeenCalled());
    expect(updateSwarmNodeAvailabilityMock).toHaveBeenCalledWith('node-1', expect.any(String));
    expect(updateSwarmNodeRoleMock).toHaveBeenCalledWith('node-1', expect.any(String));
    expect(updateSwarmNodeLabelsMock).toHaveBeenCalledWith('node-1', { a: 'b' });
    expect(eventsEmitMock).toHaveBeenCalledWith('swarm:nodes:update', null);
    expect(showSuccessMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('swarm: creates service via form (CreateSwarmService)', async () => {
    createSwarmServiceMock.mockResolvedValueOnce('svc-id');
    const onClose = vi.fn();

    render(<CreateManifestOverlay open platform="swarm" kind="service" onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/name \*/i), { target: { value: 'my-nginx' } });
    fireEvent.change(screen.getByLabelText(/image \*/i), { target: { value: 'nginx:latest' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createSwarmServiceMock).toHaveBeenCalled());
    expect(createSwarmServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'my-nginx',
      image: 'nginx:latest',
      mode: 'replicated',
      replicas: 1,
      labels: expect.any(Object),
      env: expect.any(Object),
      ports: expect.any(Array),
    }));
    expect(eventsEmitMock).toHaveBeenCalledWith('swarm:services:update', null);
    expect(showSuccessMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('swarm: shows inline createHint for service overlay when provided', async () => {
    render(
      <CreateManifestOverlay
        open
        platform="swarm"
        kind="service"
        createHint="Tasks can’t be created directly. Creating a service will create tasks."
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/tasks can’t be created directly/i)).toBeInTheDocument();
  });

  it('swarm: service YAML view uses CodeMirror editor', async () => {
    render(<CreateManifestOverlay open platform="swarm" kind="service" onClose={vi.fn()} />);
    // Starts in Form mode (no CodeMirror mounted)
    expect(screen.queryByTestId('code-mirror-editor')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'YAML' }));
    const editor = await screen.findByTestId('code-mirror-editor');
    expect(editor.value).toMatch(/name:/);
    expect(editor.value).toMatch(/image:/);
  });

  it('swarm: creates stack via YAML editor (CreateSwarmStack)', async () => {
    createSwarmStackMock.mockResolvedValueOnce('stack-id');
    const onClose = vi.fn();

    render(<CreateManifestOverlay open platform="swarm" kind="stack" onClose={onClose} />);
    expect(screen.getByText(/deploying a stack will create services/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/swarm stack name/i), { target: { value: 'my-stack' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createSwarmStackMock).toHaveBeenCalled());
    expect(createSwarmStackMock).toHaveBeenCalledWith('my-stack', expect.any(String));
    expect(eventsEmitMock).toHaveBeenCalledWith('swarm:stacks:update', null);
    expect(showSuccessMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('swarm: stack browse button prefills editor but does not auto-create', async () => {
    const onClose = vi.fn();
    render(<CreateManifestOverlay open platform="swarm" kind="stack" onClose={onClose} />);

    const input = screen.getByLabelText(/swarm stack compose file/i);
    const content = 'version: "3.8"\nservices:\n  web:\n    image: nginx:latest\n';
    const file = new File([content], 'stack.yml', { type: 'text/yaml' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const editor = screen.getByTestId('code-mirror-editor');
      expect(editor.value).toBe(content);
    });

    expect(createSwarmStackMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
