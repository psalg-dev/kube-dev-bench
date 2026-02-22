import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPodContainerPorts: vi.fn(),
}));

vi.mock('../../wailsjs/runtime', () => ({
  BrowserOpenURL: vi.fn(),
  EventsOff: vi.fn(),
  EventsOn: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import PortForwardDialog from '../k8s/resources/pods/PortForwardDialog';
import PortForwardOutput from '../k8s/resources/pods/PortForwardOutput';

const getPortsMock = vi.mocked(AppAPI.GetPodContainerPorts);

describe('PortForwardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open=false', () => {
    const { container } = render(
      <PortForwardDialog open={false} podName="my-pod" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open=true', async () => {
    getPortsMock.mockResolvedValue([8080]);
    render(<PortForwardDialog open podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText('Port Forward')).toBeInTheDocument();
    });
  });

  it('shows pod name in dialog', async () => {
    getPortsMock.mockResolvedValue([]);
    render(<PortForwardDialog open podName="my-pod-123" />);
    await waitFor(() => {
      expect(screen.getByText('my-pod-123')).toBeInTheDocument();
    });
  });

  it('renders source port and target port inputs', async () => {
    getPortsMock.mockResolvedValue([]);
    render(<PortForwardDialog open podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/Source port/i)).toBeInTheDocument();
      expect(screen.getByText(/Target port/i)).toBeInTheDocument();
    });
  });

  it('pre-fills source port from detected container ports', async () => {
    getPortsMock.mockResolvedValue([3000]);
    render(<PortForwardDialog open podName="my-pod" />);
    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs.some(i => i.value === '3000')).toBe(true);
    });
  });

  it('shows detected port buttons', async () => {
    getPortsMock.mockResolvedValue([8080, 9090]);
    render(<PortForwardDialog open podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '8080' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '9090' })).toBeInTheDocument();
    });
  });

  it('calls onConfirm with sourcePort and targetPort on Start click', async () => {
    getPortsMock.mockResolvedValue([8080]);
    const onConfirm = vi.fn();
    render(<PortForwardDialog open podName="my-pod" onConfirm={onConfirm} />);

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs.some(i => i.value === '8080')).toBe(true);
    });

    // Set a valid local port (> 20000)
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    const targetInput = inputs.find(i => Number(i.min) > 20000) || inputs[1];
    fireEvent.change(targetInput, { target: { value: '25000' } });

    const startBtn = screen.getByRole('button', { name: /Start/i });
    fireEvent.click(startBtn);

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePort: 8080,
        targetPort: 25000,
      })
    );
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    getPortsMock.mockResolvedValue([]);
    const onCancel = vi.fn();
    render(<PortForwardDialog open podName="my-pod" onCancel={onCancel} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows error message when port fetch fails', async () => {
    getPortsMock.mockRejectedValue(new Error('port fetch failed'));
    render(<PortForwardDialog open podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/port fetch failed/i)).toBeInTheDocument();
    });
  });
});

describe('PortForwardOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders output panel with pod name', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={25000}
        remotePort={8080}
      />
    );
    expect(screen.getByText('my-pod')).toBeInTheDocument();
  });

  it('shows local and remote port in header', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={25000}
        remotePort={8080}
      />
    );
    expect(screen.getByText(/25000/)).toBeInTheDocument();
    expect(screen.getByText(/8080/)).toBeInTheDocument();
  });

  it('shows "Waiting for output" initially', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={25000}
        remotePort={8080}
      />
    );
    expect(screen.getByText(/Waiting for output/i)).toBeInTheDocument();
  });

  it('shows the localhost URL', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={25000}
        remotePort={8080}
      />
    );
    expect(screen.getByText(/127\.0\.0\.1:25000/)).toBeInTheDocument();
  });

  it('renders Open and Stop buttons', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={25000}
        remotePort={8080}
      />
    );
    expect(screen.getByRole('button', { name: /Open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
  });
});
