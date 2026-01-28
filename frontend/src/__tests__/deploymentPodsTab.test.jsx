import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DeploymentPodsTab from '../k8s/resources/deployments/DeploymentPodsTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetDeploymentDetail: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';

describe('DeploymentPodsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      AppAPI.GetDeploymentDetail.mockImplementation(
        () => new Promise(() => {}),
      );

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      AppAPI.GetDeploymentDetail.mockRejectedValue(
        new Error('Connection failed'),
      );

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });

    it('shows generic error when no message provided', async () => {
      AppAPI.GetDeploymentDetail.mockRejectedValue({});

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to fetch deployment details/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows no pods message when pods array is empty', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue({ pods: [] });

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/No pods found/i)).toBeInTheDocument();
      });
    });

    it('handles null pods', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue({ pods: null });

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/No pods found/i)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockDetail = {
      pods: [
        {
          name: 'pod-1',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '1h',
          node: 'node-1',
        },
        {
          name: 'pod-2',
          status: 'Running',
          ready: '1/1',
          restarts: 2,
          age: '2h',
          node: 'node-2',
        },
        {
          name: 'pod-3',
          status: 'Pending',
          ready: '0/1',
          restarts: 0,
          age: '5m',
          node: '-',
        },
      ],
      conditions: [
        {
          type: 'Available',
          status: 'True',
          reason: 'MinimumReplicasAvailable',
          message: 'Deployment has minimum availability.',
        },
        {
          type: 'Progressing',
          status: 'True',
          reason: 'NewReplicaSetAvailable',
          message: 'ReplicaSet has successfully progressed.',
        },
      ],
      revisions: [
        { revision: 1, createdAt: '2024-01-01T00:00:00Z', replicas: 3 },
      ],
    };

    it('displays pods in table', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockDetail);

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('pod-1')).toBeInTheDocument();
        expect(screen.getByText('pod-2')).toBeInTheDocument();
        expect(screen.getByText('pod-3')).toBeInTheDocument();
      });
    });

    it('displays pod status badges', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockDetail);

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('shows pod count in tab', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockDetail);

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/pods/i)).toBeInTheDocument();
      });
    });
  });

  describe('section switching', () => {
    const mockDetail = {
      pods: [
        {
          name: 'pod-1',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '1h',
          node: 'node-1',
        },
      ],
      conditions: [
        {
          type: 'Available',
          status: 'True',
          reason: 'MinimumReplicasAvailable',
          message: 'OK',
        },
      ],
      revisions: [
        { revision: 1, createdAt: '2024-01-01T00:00:00Z', replicas: 3 },
      ],
    };

    it('shows pods section by default', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockDetail);

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('pod-1')).toBeInTheDocument();
      });
    });

    it('can switch to conditions section', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockDetail);

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('pod-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /conditions/i }));

      await waitFor(() => {
        expect(screen.getByText('Available')).toBeInTheDocument();
      });
    });

    it('can switch to revisions section', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue(mockDetail);

      render(
        <DeploymentPodsTab
          namespace="default"
          deploymentName="my-deployment"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('pod-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /revisions/i }));
    });
  });

  describe('API calls', () => {
    it('calls GetDeploymentDetail with correct params', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue({ pods: [] });

      render(
        <DeploymentPodsTab
          namespace="test-ns"
          deploymentName="test-deployment"
        />,
      );

      await waitFor(() => {
        expect(AppAPI.GetDeploymentDetail).toHaveBeenCalledWith(
          'test-ns',
          'test-deployment',
        );
      });
    });

    it('does not call API when namespace is missing', () => {
      render(<DeploymentPodsTab namespace="" deploymentName="my-deployment" />);

      expect(AppAPI.GetDeploymentDetail).not.toHaveBeenCalled();
    });

    it('does not call API when deploymentName is missing', () => {
      render(<DeploymentPodsTab namespace="default" deploymentName="" />);

      expect(AppAPI.GetDeploymentDetail).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      AppAPI.GetDeploymentDetail.mockResolvedValue({ pods: [] });

      const { rerender } = render(
        <DeploymentPodsTab namespace="ns1" deploymentName="dep1" />,
      );

      await waitFor(() => {
        expect(AppAPI.GetDeploymentDetail).toHaveBeenCalledWith('ns1', 'dep1');
      });

      rerender(<DeploymentPodsTab namespace="ns2" deploymentName="dep2" />);

      await waitFor(() => {
        expect(AppAPI.GetDeploymentDetail).toHaveBeenCalledWith('ns2', 'dep2');
      });
    });
  });
});
