import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeploymentRolloutTab from '../k8s/resources/deployments/DeploymentRolloutTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetDeploymentDetail: vi.fn(),
  RollbackDeploymentToRevision: vi.fn(),
}));

// Mock notification functions
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import { showSuccess, showError } from '../notification';

describe('DeploymentRolloutTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      AppAPI.GetDeploymentDetail.mockImplementation(() => new Promise(() => {}));
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      AppAPI.GetDeploymentDetail.mockRejectedValue(new Error('Deployment not found'));
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Deployment not found/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows no revisions message when revisions array is empty', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue({ revisions: [] });
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        expect(screen.getByText(/No revisions found/i)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockRevisions = {
      revisions: [
        {
          revision: '3',
          replicaSet: 'my-deploy-abc123',
          image: 'nginx:1.21',
          createdAt: '2024-01-15T10:30:00Z',
          replicas: 3,
          isCurrent: true,
        },
        {
          revision: '2',
          replicaSet: 'my-deploy-def456',
          image: 'nginx:1.20',
          createdAt: '2024-01-10T08:00:00Z',
          replicas: 0,
          isCurrent: false,
        },
      ],
    };

    it('displays revisions table with correct headers', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockRevisions);
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        expect(screen.getByText('Revision')).toBeInTheDocument();
        expect(screen.getByText('ReplicaSet')).toBeInTheDocument();
        expect(screen.getByText('Image')).toBeInTheDocument();
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getByText('Replicas')).toBeInTheDocument();
        expect(screen.getByText('Current')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
      });
    });

    it('displays revision data', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockRevisions);
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        expect(screen.getByText('#3')).toBeInTheDocument();
        expect(screen.getByText('#2')).toBeInTheDocument();
        expect(screen.getByText('my-deploy-abc123')).toBeInTheDocument();
        expect(screen.getByText('my-deploy-def456')).toBeInTheDocument();
        expect(screen.getByText('nginx:1.21')).toBeInTheDocument();
        expect(screen.getByText('nginx:1.20')).toBeInTheDocument();
      });
    });

    it('shows Active badge for current revision', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockRevisions);
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('displays Rollback buttons for revisions', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockRevisions);
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        const rollbackButtons = screen.getAllByText('Rollback');
        expect(rollbackButtons.length).toBe(2);
      });
    });
  });

  describe('rollback action', () => {
    const mockRevisions = {
      revisions: [
        { revision: '2', replicaSet: 'my-deploy-def456', image: 'nginx:1.20', createdAt: '-', replicas: 0, isCurrent: false },
      ],
    };

    it('calls RollbackDeploymentToRevision on rollback button click', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockRevisions);
      AppAPI.RollbackDeploymentToRevision.mockResolvedValue({});
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        expect(screen.getByText('Rollback')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Rollback'));
      
      await waitFor(() => {
        expect(AppAPI.RollbackDeploymentToRevision).toHaveBeenCalledWith('default', 'my-deploy', 2);
      });
    });

    it('shows success notification on successful rollback', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockRevisions);
      AppAPI.RollbackDeploymentToRevision.mockResolvedValue({});
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        expect(screen.getByText('Rollback')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Rollback'));
      
      await waitFor(() => {
        expect(showSuccess).toHaveBeenCalled();
      });
    });

    it('shows error notification on rollback failure', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockRevisions);
      AppAPI.RollbackDeploymentToRevision.mockRejectedValue(new Error('Rollback failed'));
      
      render(<DeploymentRolloutTab namespace="default" deploymentName="my-deploy" />);
      
      await waitFor(() => {
        expect(screen.getByText('Rollback')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Rollback'));
      
      await waitFor(() => {
        expect(showError).toHaveBeenCalled();
      });
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<DeploymentRolloutTab namespace="" deploymentName="my-deploy" />);
      
      await new Promise(r => setTimeout(r, 50));
      
      expect(AppAPI.GetDeploymentDetail).not.toHaveBeenCalled();
    });

    it('does not call API when deploymentName is missing', async () => {
      render(<DeploymentRolloutTab namespace="default" deploymentName="" />);
      
      await new Promise(r => setTimeout(r, 50));
      
      expect(AppAPI.GetDeploymentDetail).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue({ revisions: [] });
      
      const { rerender } = render(<DeploymentRolloutTab namespace="ns1" deploymentName="deploy-1" />);
      
      await waitFor(() => {
        expect(AppAPI.GetDeploymentDetail).toHaveBeenCalledWith('ns1', 'deploy-1');
      });

      rerender(<DeploymentRolloutTab namespace="ns2" deploymentName="deploy-2" />);
      
      await waitFor(() => {
        expect(AppAPI.GetDeploymentDetail).toHaveBeenCalledWith('ns2', 'deploy-2');
      });
    });
  });
});
