import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortForwardOutput from '../k8s/resources/pods/PortForwardOutput';

vi.mock('../../wailsjs/runtime', () => ({
  BrowserOpenURL: vi.fn(),
  EventsOff: vi.fn(),
  EventsOn: vi.fn(),
}));

describe('PortForwardOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the pod name', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={8080}
        remotePort={80}
      />
    );
    expect(screen.getByText('my-pod')).toBeInTheDocument();
  });

  it('renders port mapping info', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={8080}
        remotePort={80}
      />
    );
    expect(screen.getByText(/8080/)).toBeInTheDocument();
    expect(screen.getByText(/80/)).toBeInTheDocument();
  });

  it('renders the localhost URL', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={8080}
        remotePort={80}
      />
    );
    expect(screen.getByText('http://127.0.0.1:8080')).toBeInTheDocument();
  });

  it('renders waiting for output message initially', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={8080}
        remotePort={80}
      />
    );
    expect(screen.getByText(/Waiting for output/i)).toBeInTheDocument();
  });

  it('renders Open and Stop buttons', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName="my-pod"
        localPort={8080}
        remotePort={80}
      />
    );
    expect(screen.getByRole('button', { name: /Open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
  });

  it('shows select pod message when podName is empty', () => {
    render(
      <PortForwardOutput
        namespace="default"
        podName=""
        localPort={8080}
        remotePort={80}
      />
    );
    expect(screen.getByText(/Select a pod/i)).toBeInTheDocument();
  });
});
