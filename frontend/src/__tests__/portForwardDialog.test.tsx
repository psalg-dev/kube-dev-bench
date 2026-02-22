import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PortForwardDialog from '../k8s/resources/pods/PortForwardDialog';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPodContainerPorts: vi.fn(),
}));

import { GetPodContainerPorts } from '../../wailsjs/go/main/App';
const getPodContainerPortsMock = vi.mocked(GetPodContainerPorts);

describe('PortForwardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    getPodContainerPortsMock.mockResolvedValue([] as never);
    const { container } = render(
      <PortForwardDialog open={false} podName="my-pod" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Port Forward dialog when open is true', () => {
    getPodContainerPortsMock.mockImplementation(() => new Promise(() => {}));
    render(<PortForwardDialog open={true} podName="my-pod" />);
    expect(screen.getByText('Port Forward')).toBeInTheDocument();
  });

  it('shows the pod name in dialog', () => {
    getPodContainerPortsMock.mockImplementation(() => new Promise(() => {}));
    render(<PortForwardDialog open={true} podName="test-pod-123" />);
    expect(screen.getByText('test-pod-123')).toBeInTheDocument();
  });

  it('renders local (source) port input', () => {
    getPodContainerPortsMock.mockImplementation(() => new Promise(() => {}));
    render(<PortForwardDialog open={true} podName="my-pod" />);
    expect(screen.getByText(/Source port/i)).toBeInTheDocument();
  });

  it('renders remote (target) port input', () => {
    getPodContainerPortsMock.mockImplementation(() => new Promise(() => {}));
    render(<PortForwardDialog open={true} podName="my-pod" />);
    expect(screen.getByText(/Target port/i)).toBeInTheDocument();
  });

  it('has two number inputs for local and remote ports', () => {
    getPodContainerPortsMock.mockImplementation(() => new Promise(() => {}));
    render(<PortForwardDialog open={true} podName="my-pod" />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
  });

  it('calls onCancel when Cancel button is clicked', () => {
    getPodContainerPortsMock.mockImplementation(() => new Promise(() => {}));
    const onCancel = vi.fn();
    render(<PortForwardDialog open={true} podName="my-pod" onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders Start button', () => {
    getPodContainerPortsMock.mockImplementation(() => new Promise(() => {}));
    render(<PortForwardDialog open={true} podName="my-pod" />);
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('calls onConfirm with port values when Start is clicked with valid ports', async () => {
    getPodContainerPortsMock.mockResolvedValue([8080] as never);
    const onConfirm = vi.fn();
    render(<PortForwardDialog open={true} podName="my-pod" onConfirm={onConfirm} />);

    // Wait for ports to load
    await waitFor(() => {
      const sourceInput = screen.getAllByRole('spinbutton')[0];
      expect((sourceInput as HTMLInputElement).value).toBe('8080');
    });

    // The target port should be pre-populated with a random high port
    // Get the current target port value and verify submit works
    const startBtn = screen.getByText('Start');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePort: 8080,
        })
      );
    });
  });

  it('shows detected container ports when available', async () => {
    getPodContainerPortsMock.mockResolvedValue([3000, 8080] as never);
    render(<PortForwardDialog open={true} podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/Detected container ports/i)).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
      expect(screen.getByText('8080')).toBeInTheDocument();
    });
  });

  it('shows loading indicator while fetching ports', () => {
    getPodContainerPortsMock.mockImplementation(() => new Promise(() => {}));
    render(<PortForwardDialog open={true} podName="my-pod" />);
    expect(screen.getByText(/Loading ports/i)).toBeInTheDocument();
  });
});
