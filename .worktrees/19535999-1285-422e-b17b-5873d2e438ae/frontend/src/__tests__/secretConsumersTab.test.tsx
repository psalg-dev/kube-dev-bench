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
const getConsumersMock = vi.mocked(GetSecretConsumers);

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
    getConsumersMock.mockRejectedValue(new Error('secret error'));
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: secret error/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no consumers', async () => {
    getConsumersMock.mockResolvedValue([] as never);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      // EmptyTabContent is rendered when list is empty
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });
  });

  it('renders column headers when consumers exist', async () => {
    getConsumersMock.mockResolvedValue([
      { kind: 'Pod', name: 'my-pod', refType: 'env' },
    ] as never);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('Kind')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });
  });

  it('renders consumer rows', async () => {
    getConsumersMock.mockResolvedValue([
      { kind: 'Deployment', name: 'my-deploy', refType: 'envFrom' },
    ] as never);
    render(<SecretConsumersTab namespace="default" secretName="my-secret" />);
    await waitFor(() => {
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('my-deploy')).toBeInTheDocument();
    });
  });

  it('does not call API when props are missing', () => {
    render(<SecretConsumersTab namespace="" secretName="" />);
    expect(getConsumersMock).not.toHaveBeenCalled();
  });
});
