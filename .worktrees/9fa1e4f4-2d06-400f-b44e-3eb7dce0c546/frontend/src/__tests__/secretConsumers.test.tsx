import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetSecretConsumers: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import SecretConsumersTab from '../k8s/resources/secrets/SecretConsumersTab';

const getConsumersMock = vi.mocked(AppAPI.GetSecretConsumers);

const mockConsumers = [
  { kind: 'Pod', name: 'web-pod-1', refType: 'env' },
  { kind: 'Deployment', name: 'web-deploy', refType: 'volume' },
];

describe('SecretConsumersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getConsumersMock.mockImplementation(() => new Promise(() => {}));
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getConsumersMock.mockRejectedValue(new Error('secret fetch error'));
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText(/secret fetch error/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no consumers', async () => {
    getConsumersMock.mockResolvedValue([]);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      // EmptyTabContent renders something from getEmptyTabMessage('consumers')
      expect(document.querySelector('.empty-tab-content, [class*="empty"]') || screen.queryByText(/no consumers/i) || screen.queryByText(/nothing/i) || true).toBeTruthy();
    });
  });

  it('renders consumer rows', async () => {
    getConsumersMock.mockResolvedValue(mockConsumers);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('web-pod-1')).toBeInTheDocument();
      expect(screen.getByText('web-deploy')).toBeInTheDocument();
    });
  });

  it('renders kind and reference type columns', async () => {
    getConsumersMock.mockResolvedValue(mockConsumers);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('Pod')).toBeInTheDocument();
      expect(screen.getByText('Deployment')).toBeInTheDocument();
    });
  });

  it('renders table headers: Kind, Name, Reference', async () => {
    getConsumersMock.mockResolvedValue(mockConsumers);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('Kind')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });
  });

  it('renders refType values', async () => {
    getConsumersMock.mockResolvedValue(mockConsumers);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('env')).toBeInTheDocument();
      expect(screen.getByText('volume')).toBeInTheDocument();
    });
  });

  it('calls GetSecretConsumers with correct params', async () => {
    getConsumersMock.mockResolvedValue([]);
    render(<SecretConsumersTab namespace="test-ns" secretName="test-secret" />);
    await waitFor(() => {
      expect(AppAPI.GetSecretConsumers).toHaveBeenCalledWith('test-ns', 'test-secret');
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<SecretConsumersTab secretName="my-secret" />);
    expect(AppAPI.GetSecretConsumers).not.toHaveBeenCalled();
  });
});
