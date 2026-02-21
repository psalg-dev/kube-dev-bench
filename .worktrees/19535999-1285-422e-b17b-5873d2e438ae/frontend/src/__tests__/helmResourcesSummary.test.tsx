import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HelmResourcesSummary from '../k8s/resources/helmreleases/HelmResourcesSummary';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetHelmReleaseManifest: vi.fn(),
  GetDeployments: vi.fn().mockResolvedValue([]),
  GetStatefulSets: vi.fn().mockResolvedValue([]),
  GetDaemonSets: vi.fn().mockResolvedValue([]),
  GetReplicaSets: vi.fn().mockResolvedValue([]),
  GetJobs: vi.fn().mockResolvedValue([]),
  GetCronJobs: vi.fn().mockResolvedValue([]),
  GetConfigMaps: vi.fn().mockResolvedValue([]),
  GetSecrets: vi.fn().mockResolvedValue([]),
  GetPersistentVolumeClaims: vi.fn().mockResolvedValue([]),
  GetIngresses: vi.fn().mockResolvedValue([]),
  GetRunningPods: vi.fn().mockResolvedValue([]),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
const getManifestMock = vi.mocked(AppAPI.GetHelmReleaseManifest);

describe('HelmResourcesSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getManifestMock.mockImplementation(() => new Promise(() => {}));
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    expect(screen.getByText(/Loading resources/i)).toBeInTheDocument();
  });

  it('shows error when manifest fetch fails', async () => {
    getManifestMock.mockRejectedValue(new Error('fetch error'));
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText(/Error:/i)).toBeInTheDocument();
    });
  });

  it('shows no resources message when manifest is empty', async () => {
    getManifestMock.mockResolvedValue('');
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText(/No resources found/i)).toBeInTheDocument();
    });
  });

  it('renders table with column headers when resources exist', async () => {
    const manifest = `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
  namespace: default
`;
    getManifestMock.mockResolvedValue(manifest);
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText('Health')).toBeInTheDocument();
      expect(screen.getByText('Kind')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  it('renders resource rows with kind and name', async () => {
    const manifest = `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
  namespace: default
`;
    getManifestMock.mockResolvedValue(manifest);
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('my-deploy')).toBeInTheDocument();
    });
  });

  it('shows resource count in header', async () => {
    const manifest = `---
apiVersion: v1
kind: ConfigMap
metadata:
  name: cfg1
---
apiVersion: v1
kind: Secret
metadata:
  name: sec1
`;
    getManifestMock.mockResolvedValue(manifest);
    render(<HelmResourcesSummary namespace="default" releaseName="my-release" />);
    await waitFor(() => {
      expect(screen.getByText(/Resources \(2\)/i)).toBeInTheDocument();
    });
  });
});
