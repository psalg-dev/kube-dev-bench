import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortForwardOutput from '../k8s/resources/pods/PortForwardOutput';

// Mock Wails runtime
vi.mock('../../wailsjs/runtime', () => ({
  BrowserOpenURL: vi.fn(),
  EventsOff: vi.fn(),
  EventsOn: vi.fn(),
}));

describe('PortForwardOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows waiting for output message initially', () => {
    render(
      <PortForwardOutput namespace="default" podName="my-pod" localPort={8080} remotePort={3000} />
    );
    expect(screen.getByText(/Waiting for output/i)).toBeInTheDocument();
  });

  it('shows pod name in header', () => {
    render(
      <PortForwardOutput namespace="default" podName="test-pod-abc" localPort={8081} remotePort={9090} />
    );
    expect(screen.getByText('test-pod-abc')).toBeInTheDocument();
  });

  it('shows local and remote port in header', () => {
    render(
      <PortForwardOutput namespace="default" podName="my-pod" localPort={8080} remotePort={3000} />
    );
    expect(screen.getByText(/8080.*3000/)).toBeInTheDocument();
  });

  it('shows the local URL in header', () => {
    render(
      <PortForwardOutput namespace="default" podName="my-pod" localPort={9000} remotePort={80} />
    );
    expect(screen.getByText('http://127.0.0.1:9000')).toBeInTheDocument();
  });

  it('renders Open button', () => {
    render(
      <PortForwardOutput namespace="default" podName="my-pod" localPort={8080} remotePort={80} />
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders Stop button', () => {
    render(
      <PortForwardOutput namespace="default" podName="my-pod" localPort={8080} remotePort={80} />
    );
    expect(screen.getByText('Stop')).toBeInTheDocument();
  });

  it('Open button is disabled when not ready', () => {
    render(
      <PortForwardOutput namespace="default" podName="my-pod" localPort={8080} remotePort={80} />
    );
    const openBtn = screen.getByText('Open');
    expect(openBtn).toBeDisabled();
  });

  it('shows status indicator dot', () => {
    const { container } = render(
      <PortForwardOutput namespace="default" podName="my-pod" localPort={8080} remotePort={80} />
    );
    // Status indicator is a span with border-radius: '50%'
    const dots = container.querySelectorAll('span[style*="border-radius: 50%"]');
    expect(dots.length).toBeGreaterThan(0);
  });
});
