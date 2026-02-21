import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SecretConsumersTab from '../k8s/resources/secrets/SecretConsumersTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetSecretConsumers: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSecretConsumers } from '../../wailsjs/go/main/App';
const getSecretConsumersMock = vi.mocked(GetSecretConsumers);

describe('SecretConsumersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getSecretConsumersMock.mockImplementation(() => new Promise(() => {}));
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getSecretConsumersMock.mockRejectedValue(new Error('Secret not found'));
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Secret not found/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no consumers', async () => {
    getSecretConsumersMock.mockResolvedValue([] as never);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      // EmptyTabContent should be shown
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('renders table columns when consumers exist', async () => {
    getSecretConsumersMock.mockResolvedValue([
      { kind: 'Pod', name: 'my-pod', refType: 'envFrom' },
    ] as never);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('Kind')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });
  });

  it('renders consumer kind and name', async () => {
    getSecretConsumersMock.mockResolvedValue([
      { kind: 'Deployment', name: 'my-deploy', refType: 'volume' },
    ] as never);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('my-deploy')).toBeInTheDocument();
    });
  });

  it('renders refType in table', async () => {
    getSecretConsumersMock.mockResolvedValue([
      { kind: 'Pod', name: 'test-pod', refType: 'imagePullSecret' },
    ] as never);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('imagePullSecret')).toBeInTheDocument();
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<SecretConsumersTab secretName="my-secret" />);
    expect(getSecretConsumersMock).not.toHaveBeenCalled();
  });

  it('does not call API when secretName is missing', () => {
    render(<SecretConsumersTab namespace="default" />);
    expect(getSecretConsumersMock).not.toHaveBeenCalled();
  });

  it('calls API with correct arguments', async () => {
    getSecretConsumersMock.mockResolvedValue([] as never);
    render(<SecretConsumersTab namespace="test-ns" secretName="test-secret" />);
    await waitFor(() => {
      expect(getSecretConsumersMock).toHaveBeenCalledWith('test-ns', 'test-secret');
    });
  });
});
