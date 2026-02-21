import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StackServicesTab from '../docker/resources/stacks/StackServicesTab';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmStackServices: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmStackServices } from '../docker/swarmApi';
const getServicesMock = vi.mocked(GetSwarmStackServices);

describe('StackServicesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no services returned', async () => {
    getServicesMock.mockResolvedValue([] as never);
    render(<StackServicesTab stackName="my-stack" />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    getServicesMock.mockRejectedValue(new Error('swarm error'));
    render(<StackServicesTab stackName="my-stack" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load services: swarm error/i)).toBeInTheDocument();
    });
  });

  it('renders table column headers when services exist', async () => {
    getServicesMock.mockResolvedValue([
      { id: 'svc1', name: 'my-stack_web', image: 'nginx:latest', mode: 'replicated', replicas: 2, runningTasks: 2, createdAt: '2024-01-01T00:00:00Z' },
    ] as never);
    render(<StackServicesTab stackName="my-stack" />);
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
      expect(screen.getByText('Mode')).toBeInTheDocument();
      expect(screen.getByText('Replicas')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });
  });

  it('renders service rows with stack prefix stripped', async () => {
    getServicesMock.mockResolvedValue([
      { id: 'svc1', name: 'my-stack_web', image: 'nginx:latest', mode: 'replicated', replicas: 2, runningTasks: 2, createdAt: '2024-01-01T00:00:00Z' },
    ] as never);
    render(<StackServicesTab stackName="my-stack" />);
    await waitFor(() => {
      // Stack prefix "my-stack_" should be stripped from display name
      expect(screen.getByText('web')).toBeInTheDocument();
    });
  });

  it('renders image and mode columns', async () => {
    getServicesMock.mockResolvedValue([
      { id: 'svc2', name: 'my-stack_api', image: 'myapp:v1', mode: 'replicated', replicas: 3, runningTasks: 3, createdAt: '2024-01-01T00:00:00Z' },
    ] as never);
    render(<StackServicesTab stackName="my-stack" />);
    await waitFor(() => {
      expect(screen.getByText('myapp:v1')).toBeInTheDocument();
      expect(screen.getByText('replicated')).toBeInTheDocument();
    });
  });

  it('does not call API when stackName is empty', () => {
    render(<StackServicesTab stackName="" />);
    expect(getServicesMock).not.toHaveBeenCalled();
  });
});
