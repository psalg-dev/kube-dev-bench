import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetHelmReleaseManifest: vi.fn(),
  GetDeployments: vi.fn(() => Promise.resolve([])),
  GetStatefulSets: vi.fn(() => Promise.resolve([])),
  GetDaemonSets: vi.fn(() => Promise.resolve([])),
  GetReplicaSets: vi.fn(() => Promise.resolve([])),
  GetJobs: vi.fn(() => Promise.resolve([])),
  GetCronJobs: vi.fn(() => Promise.resolve([])),
  GetConfigMaps: vi.fn(() => Promise.resolve([])),
  GetSecrets: vi.fn(() => Promise.resolve([])),
  GetPersistentVolumeClaims: vi.fn(() => Promise.resolve([])),
  GetIngresses: vi.fn(() => Promise.resolve([])),
  GetRunningPods: vi.fn(() => Promise.resolve([])),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import HelmResourcesSummary from '../k8s/resources/helmreleases/HelmResourcesSummary';

const getManifestMock = vi.mocked(AppAPI.GetHelmReleaseManifest);

const SAMPLE_MANIFEST = `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: default
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: default
`;

describe('HelmResourcesSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getManifestMock.mockImplementation(() => new Promise(() => {}));
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    expect(screen.getByText(/Loading resources/i)).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    getManifestMock.mockRejectedValue(new Error('API error'));
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText(/API error/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when manifest is empty', async () => {
    getManifestMock.mockResolvedValue('');
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText(/No resources found/i)).toBeInTheDocument();
    });
  });

  it('renders resources from manifest', async () => {
    getManifestMock.mockResolvedValue(SAMPLE_MANIFEST);
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('my-deployment')).toBeInTheDocument();
    });
  });

  it('shows resource count in header', async () => {
    getManifestMock.mockResolvedValue(SAMPLE_MANIFEST);
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText(/Resources \(2\)/i)).toBeInTheDocument();
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

  it('calls GetHelmReleaseManifest with correct params', async () => {
    getManifestMock.mockResolvedValue('');
    render(<HelmResourcesSummary namespace="my-ns" releaseName="my-release" />);
    await waitFor(() => {
      expect(AppAPI.GetHelmReleaseManifest).toHaveBeenCalledWith('my-ns', 'my-release');
    });
  });
});
