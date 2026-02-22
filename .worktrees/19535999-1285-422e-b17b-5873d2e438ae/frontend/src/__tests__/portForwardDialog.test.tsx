import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PortForwardDialog from '../k8s/resources/pods/PortForwardDialog';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPodContainerPorts: vi.fn(),
}));

import { GetPodContainerPorts } from '../../wailsjs/go/main/App';
const getPortsMock = vi.mocked(GetPodContainerPorts);

describe('PortForwardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <PortForwardDialog open={false} podName="my-pod" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open is true', async () => {
    getPortsMock.mockResolvedValue([] as never);
    render(<PortForwardDialog open={true} podName="my-pod" />);
    expect(screen.getByText('Port Forward')).toBeInTheDocument();
  });

  it('shows pod name in dialog', async () => {
    getPortsMock.mockResolvedValue([] as never);
    render(<PortForwardDialog open={true} podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText('my-pod')).toBeInTheDocument();
    });
  });

  it('renders source port (container) input field', async () => {
    getPortsMock.mockResolvedValue([] as never);
    render(<PortForwardDialog open={true} podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/Source port/i)).toBeInTheDocument();
    });
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders target port (local) input field', async () => {
    getPortsMock.mockResolvedValue([] as never);
    render(<PortForwardDialog open={true} podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/Target port/i)).toBeInTheDocument();
    });
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('shows both local and remote port input fields in DOM', async () => {
    getPortsMock.mockResolvedValue([] as never);
    render(<PortForwardDialog open={true} podName="test-pod" />);
    await waitFor(() => {
      // Both source and target port inputs are present
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);
    });
  });

  it('shows Cancel and Start buttons', async () => {
    getPortsMock.mockResolvedValue([] as never);
    render(<PortForwardDialog open={true} podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start/i })).toBeInTheDocument();
    });
  });

  it('shows detected container ports when API returns ports', async () => {
    getPortsMock.mockResolvedValue([8080, 9090] as never);
    render(<PortForwardDialog open={true} podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText('8080')).toBeInTheDocument();
      expect(screen.getByText('9090')).toBeInTheDocument();
    });
  });

  it('calls onCancel when Cancel is clicked', async () => {
    getPortsMock.mockResolvedValue([] as never);
    const onCancel = vi.fn();
    render(<PortForwardDialog open={true} podName="my-pod" onCancel={onCancel} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /Cancel/i }).click();
    expect(onCancel).toHaveBeenCalled();
  });
});
