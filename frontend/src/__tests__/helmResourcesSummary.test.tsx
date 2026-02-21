import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetHelmReleaseManifest: vi.fn(),
  GetDeployments: vi.fn(),
  GetStatefulSets: vi.fn(),
  GetDaemonSets: vi.fn(),
  GetReplicaSets: vi.fn(),
  GetJobs: vi.fn(),
  GetCronJobs: vi.fn(),
  GetConfigMaps: vi.fn(),
  GetSecrets: vi.fn(),
  GetPersistentVolumeClaims: vi.fn(),
  GetIngresses: vi.fn(),
  GetRunningPods: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import HelmResourcesSummary from '../k8s/resources/helmreleases/HelmResourcesSummary';

const getManifestMock = vi.mocked(AppAPI.GetHelmReleaseManifest);

const SAMPLE_MANIFEST = `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
---
apiVersion: v1
kind: Service
metadata:
  name: my-svc
  namespace: default
`;

describe('HelmResourcesSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AppAPI.GetDeployments).mockResolvedValue([]);
    vi.mocked(AppAPI.GetStatefulSets).mockResolvedValue([]);
    vi.mocked(AppAPI.GetDaemonSets).mockResolvedValue([]);
    vi.mocked(AppAPI.GetReplicaSets).mockResolvedValue([]);
    vi.mocked(AppAPI.GetJobs).mockResolvedValue([]);
    vi.mocked(AppAPI.GetCronJobs).mockResolvedValue([]);
    vi.mocked(AppAPI.GetConfigMaps).mockResolvedValue([]);
    vi.mocked(AppAPI.GetSecrets).mockResolvedValue([]);
    vi.mocked(AppAPI.GetPersistentVolumeClaims).mockResolvedValue([]);
    vi.mocked(AppAPI.GetIngresses).mockResolvedValue([]);
    vi.mocked(AppAPI.GetRunningPods).mockResolvedValue([]);
  });

  it('shows loading state while fetching manifest', () => {
    getManifestMock.mockImplementation(() => new Promise(() => {}));

    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);

    expect(screen.getByText('Loading resources...')).toBeInTheDocument();
  });

  it('shows Resources header text during loading', () => {
    getManifestMock.mockImplementation(() => new Promise(() => {}));

    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);

    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('shows error message when API call fails', async () => {
    getManifestMock.mockRejectedValue(new Error('Helm fetch failed'));

    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);

    await waitFor(() => {
      expect(screen.getByText(/Error: Helm fetch failed/)).toBeInTheDocument();
    });
  });

  it('shows "No resources found" when manifest is empty', async () => {
    getManifestMock.mockResolvedValue('');

    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);

    await waitFor(() => {
      expect(screen.getByText('No resources found')).toBeInTheDocument();
    });
  });

  it('shows table with resources when manifest has content', async () => {
    getManifestMock.mockResolvedValue(SAMPLE_MANIFEST);

    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);

    await waitFor(() => {
      expect(screen.getByText(/Resources \(2\)/)).toBeInTheDocument();
    });
  });

  it('renders table columns: Health, Kind, Name', async () => {
    getManifestMock.mockResolvedValue(SAMPLE_MANIFEST);

    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);

    await waitFor(() => {
      expect(screen.getByText('Health')).toBeInTheDocument();
      expect(screen.getByText('Kind')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  it('displays parsed resource names from manifest', async () => {
    getManifestMock.mockResolvedValue(SAMPLE_MANIFEST);

    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);

    await waitFor(() => {
      expect(screen.getByText('my-app')).toBeInTheDocument();
      expect(screen.getByText('my-svc')).toBeInTheDocument();
    });
  });

  it('displays resource kinds from manifest', async () => {
    getManifestMock.mockResolvedValue(SAMPLE_MANIFEST);

    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);

    await waitFor(() => {
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
    });
  });

  it('calls GetHelmReleaseManifest with correct args', async () => {
    getManifestMock.mockResolvedValue('');

    render(<HelmResourcesSummary namespace="staging" releaseName="my-chart" />);

    await waitFor(() => {
      expect(getManifestMock).toHaveBeenCalledWith('staging', 'my-chart');
    });
  });
});
