import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ConfigMapConsumersTab from '../k8s/resources/configmaps/ConfigMapConsumersTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetConfigMapConsumers: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetConfigMapConsumers } from '../../wailsjs/go/main/App';
const getConsumersMock = vi.mocked(GetConfigMapConsumers);

describe('ConfigMapConsumersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getConsumersMock.mockImplementation(() => new Promise(() => {}));
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-config" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getConsumersMock.mockRejectedValue(new Error('configmap error'));
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-config" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: configmap error/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no consumers returned', async () => {
    getConsumersMock.mockResolvedValue([] as never);
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-config" />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });
  });

  it('renders column headers when consumers exist', async () => {
    getConsumersMock.mockResolvedValue([
      { kind: 'Pod', name: 'my-pod', refType: 'env', namespace: 'default' },
    ] as never);
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-config" />);
    await waitFor(() => {
      expect(screen.getByText('Kind')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });
  });

  it('renders consumer rows', async () => {
    getConsumersMock.mockResolvedValue([
      { kind: 'Deployment', name: 'my-app', refType: 'envFrom', namespace: 'default' },
    ] as never);
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-config" />);
    await waitFor(() => {
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('my-app')).toBeInTheDocument();
    });
  });

  it('does not call API when props are missing', () => {
    render(<ConfigMapConsumersTab namespace="" configMapName="" />);
    expect(getConsumersMock).not.toHaveBeenCalled();
  });
});
