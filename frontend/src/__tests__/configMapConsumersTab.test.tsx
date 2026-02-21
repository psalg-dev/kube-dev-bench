import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ConfigMapConsumersTab from '../k8s/resources/configmaps/ConfigMapConsumersTab';
import type { app } from '../../wailsjs/go/models';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetConfigMapConsumers: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetConfigMapConsumers } from '../../wailsjs/go/main/App';
const getConfigMapConsumersMock = vi.mocked(GetConfigMapConsumers);

const toConsumer = (data: unknown) => data as app.ConfigMapConsumer[];

describe('ConfigMapConsumersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getConfigMapConsumersMock.mockImplementation(() => new Promise(() => {}));
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-cm" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getConfigMapConsumersMock.mockRejectedValue(new Error('ConfigMap not found'));
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-cm" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: ConfigMap not found/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no consumers', async () => {
    getConfigMapConsumersMock.mockResolvedValue(toConsumer([]));
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-cm" />);
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('renders table column headers when consumers exist', async () => {
    getConfigMapConsumersMock.mockResolvedValue(toConsumer([
      { kind: 'Pod', name: 'my-pod', namespace: 'default', refType: 'envFrom' },
    ]));
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-cm" />);
    await waitFor(() => {
      expect(screen.getByText('Kind')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });
  });

  it('renders consumer kind and name', async () => {
    getConfigMapConsumersMock.mockResolvedValue(toConsumer([
      { kind: 'Deployment', name: 'my-app', namespace: 'default', refType: 'volume' },
    ]));
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-cm" />);
    await waitFor(() => {
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('my-app')).toBeInTheDocument();
    });
  });

  it('renders refType in table', async () => {
    getConfigMapConsumersMock.mockResolvedValue(toConsumer([
      { kind: 'Pod', name: 'pod-1', namespace: 'default', refType: 'envFrom' },
    ]));
    render(<ConfigMapConsumersTab namespace="default" configMapName="my-cm" />);
    await waitFor(() => {
      expect(screen.getByText('envFrom')).toBeInTheDocument();
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<ConfigMapConsumersTab configMapName="my-cm" />);
    expect(getConfigMapConsumersMock).not.toHaveBeenCalled();
  });

  it('does not call API when configMapName is missing', () => {
    render(<ConfigMapConsumersTab namespace="default" />);
    expect(getConfigMapConsumersMock).not.toHaveBeenCalled();
  });

  it('calls API with correct arguments', async () => {
    getConfigMapConsumersMock.mockResolvedValue(toConsumer([]));
    render(<ConfigMapConsumersTab namespace="test-ns" configMapName="test-cm" />);
    await waitFor(() => {
      expect(getConfigMapConsumersMock).toHaveBeenCalledWith('test-ns', 'test-cm');
    });
  });
});
