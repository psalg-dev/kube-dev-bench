import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { genericAPIMock, resetAllMocks } from './wailsMocks';

// Mock EventsOn and EventsOff
vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));

// Mock notification module
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
}));

// Import after mocks
import HelmReleasesOverviewTable from '../k8s/resources/helmreleases/HelmReleasesOverviewTable.jsx';
import HelmHistoryTab from '../k8s/resources/helmreleases/HelmHistoryTab.jsx';
import HelmValuesTab from '../k8s/resources/helmreleases/HelmValuesTab.jsx';
import HelmNotesTab from '../k8s/resources/helmreleases/HelmNotesTab.jsx';
import HelmResourcesTab from '../k8s/resources/helmreleases/HelmResourcesTab.jsx';
import HelmActions from '../k8s/resources/helmreleases/HelmActions.jsx';
import HelmInstallDialog from '../k8s/resources/helmreleases/HelmInstallDialog.jsx';
import HelmRepositoriesDialog from '../k8s/resources/helmreleases/HelmRepositoriesDialog.jsx';

describe('Helm Releases Overview Table', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
  });

  it('renders loading state initially', () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleases') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve([]);
    });

    render(<HelmReleasesOverviewTable namespace="default" namespaces={['default']} />);
    // The table should render (loading is handled internally)
    expect(screen.getByText('Helm Releases')).toBeInTheDocument();
  });

  it('renders empty state when no releases', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleases') {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    render(<HelmReleasesOverviewTable namespace="default" namespaces={['default']} />);

    await waitFor(() => {
      expect(screen.getByText('Helm Releases')).toBeInTheDocument();
    });
  });

  it('renders releases from API', async () => {
    const mockReleases = [
      {
        name: 'my-nginx',
        namespace: 'default',
        revision: 1,
        chart: 'nginx',
        chartVersion: '15.0.0',
        appVersion: '1.25.0',
        status: 'deployed',
        age: '5m',
        updated: '2024-01-01 12:00:00',
        labels: {},
      },
    ];

    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleases') {
        return Promise.resolve(mockReleases);
      }
      return Promise.resolve([]);
    });

    render(<HelmReleasesOverviewTable namespace="default" namespaces={['default']} />);

    await waitFor(() => {
      expect(screen.getByText('my-nginx')).toBeInTheDocument();
    });
  });
});

describe('HelmHistoryTab', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
  });

  it('renders loading state', () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleaseHistory') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve([]);
    });

    render(<HelmHistoryTab namespace="default" releaseName="my-nginx" />);
    expect(screen.getByText(/loading history/i)).toBeInTheDocument();
  });

  it('renders history entries', async () => {
    const mockHistory = [
      {
        revision: 2,
        updated: '2024-01-02 12:00:00',
        status: 'deployed',
        chart: 'nginx-15.0.0',
        appVersion: '1.25.0',
        description: 'Upgrade complete',
      },
      {
        revision: 1,
        updated: '2024-01-01 12:00:00',
        status: 'superseded',
        chart: 'nginx-14.0.0',
        appVersion: '1.24.0',
        description: 'Install complete',
      },
    ];

    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleaseHistory') {
        return Promise.resolve(mockHistory);
      }
      return Promise.resolve([]);
    });

    render(<HelmHistoryTab namespace="default" releaseName="my-nginx" />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Revision 2
      expect(screen.getByText('(current)')).toBeInTheDocument();
    });
  });

  it('shows rollback button for non-current revisions', async () => {
    const mockHistory = [
      {
        revision: 2,
        updated: '2024-01-02 12:00:00',
        status: 'deployed',
        chart: 'nginx-15.0.0',
        appVersion: '1.25.0',
        description: 'Upgrade complete',
      },
      {
        revision: 1,
        updated: '2024-01-01 12:00:00',
        status: 'superseded',
        chart: 'nginx-14.0.0',
        appVersion: '1.24.0',
        description: 'Install complete',
      },
    ];

    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleaseHistory') {
        return Promise.resolve(mockHistory);
      }
      return Promise.resolve([]);
    });

    render(<HelmHistoryTab namespace="default" releaseName="my-nginx" />);

    await waitFor(() => {
      const rollbackBtn = screen.getByRole('button', { name: /rollback/i });
      expect(rollbackBtn).toBeInTheDocument();
    });
  });
});

describe('HelmValuesTab', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
  });

  it('renders loading state', () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleaseValues') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve('');
    });

    render(<HelmValuesTab namespace="default" releaseName="my-nginx" />);
    expect(screen.getByText(/loading values/i)).toBeInTheDocument();
  });

  it('has toggle for showing all values', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleaseValues') {
        return Promise.resolve('replicaCount: 1');
      }
      return Promise.resolve('');
    });

    render(<HelmValuesTab namespace="default" releaseName="my-nginx" />);

    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(screen.getByText(/show all values/i)).toBeInTheDocument();
    });
  });
});

describe('HelmNotesTab', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
  });

  it('renders loading state', () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleaseNotes') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve('');
    });

    render(<HelmNotesTab namespace="default" releaseName="my-nginx" />);
    expect(screen.getByText(/loading notes/i)).toBeInTheDocument();
  });

  it('renders notes content', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmReleaseNotes') {
        return Promise.resolve('Thank you for installing NGINX!');
      }
      return Promise.resolve('');
    });

    render(<HelmNotesTab namespace="default" releaseName="my-nginx" />);

    await waitFor(() => {
      expect(screen.getByText(/thank you for installing nginx/i)).toBeInTheDocument();
    });
  });
});

describe('HelmResourcesTab', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
  });

  it('renders resources with health status', async () => {
    const manifest = [
      'apiVersion: v1',
      'kind: ConfigMap',
      'metadata:',
      '  name: my-release-e2e',
      '---',
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: my-deploy',
      '  namespace: default',
      '',
    ].join('\n');

    genericAPIMock.mockImplementation((name, ...args) => {
      if (name === 'GetHelmReleaseManifest') return Promise.resolve(manifest);
      if (name === 'GetConfigMaps') {
        return Promise.resolve([{ name: 'my-release-e2e', namespace: 'default', keys: 1, size: '1B', age: '1s', labels: {} }]);
      }
      if (name === 'GetDeployments') {
        return Promise.resolve([{ name: 'my-deploy', namespace: 'default', replicas: 1, ready: 1, available: 1, age: '1s', image: '', labels: {} }]);
      }
      // Other kind lists used by health calculation
      if (
        name === 'GetStatefulSets' ||
        name === 'GetDaemonSets' ||
        name === 'GetReplicaSets' ||
        name === 'GetJobs' ||
        name === 'GetCronJobs' ||
        name === 'GetSecrets' ||
        name === 'GetPersistentVolumeClaims' ||
        name === 'GetIngresses' ||
        name === 'GetRunningPods'
      ) {
        return Promise.resolve([]);
      }

      return Promise.resolve([]);
    });

    render(<HelmResourcesTab namespace="default" releaseName="my-release" />);

    await waitFor(() => {
      expect(screen.getByText('Health')).toBeInTheDocument();
      expect(screen.getByText('ConfigMap')).toBeInTheDocument();
      expect(screen.getByText('my-release-e2e')).toBeInTheDocument();
      expect(screen.getByText('OK')).toBeInTheDocument();
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('my-deploy')).toBeInTheDocument();
      expect(screen.getByText(/Healthy/i)).toBeInTheDocument();

      // Color-coding should be applied to the health values.
      expect(screen.getByText('OK')).toHaveStyle({ color: 'var(--gh-success-fg, #2ea44f)' });
      expect(screen.getByText('Healthy')).toHaveStyle({ color: 'var(--gh-success-fg, #2ea44f)' });
    });

    const handler = vi.fn();
    window.addEventListener('navigate-to-resource', handler);
    try {
      const row = screen.getByText('my-deploy').closest('tr');
      expect(row).toBeTruthy();
      fireEvent.click(row);

      expect(handler).toHaveBeenCalled();
      const evt = handler.mock.calls[0][0];
      expect(evt.detail).toEqual({ resource: 'Deployment', name: 'my-deploy', namespace: 'default' });
    } finally {
      window.removeEventListener('navigate-to-resource', handler);
    }
  });
});

describe('HelmActions', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
  });

  it('renders upgrade and uninstall buttons', () => {
    render(<HelmActions releaseName="my-nginx" namespace="default" chart="nginx" />);

    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /uninstall/i })).toBeInTheDocument();
  });

  it('prompts for confirmation before uninstall', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    genericAPIMock.mockImplementation(() => Promise.resolve());

    render(<HelmActions releaseName="my-nginx" namespace="default" chart="nginx" />);

    const uninstallBtn = screen.getByRole('button', { name: /uninstall/i });
    fireEvent.click(uninstallBtn);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('my-nginx'));
    confirmSpy.mockRestore();
  });
});

describe('HelmRepositoriesDialog', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
  });

  it('renders repositories list', async () => {
    const mockRepos = [
      { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
      { name: 'stable', url: 'https://charts.helm.sh/stable' },
    ];

    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmRepositories') {
        return Promise.resolve(mockRepos);
      }
      return Promise.resolve([]);
    });

    render(<HelmRepositoriesDialog onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('bitnami')).toBeInTheDocument();
      expect(screen.getByText('stable')).toBeInTheDocument();
    });
  });

  it('has Add Repository button', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmRepositories') {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    render(<HelmRepositoriesDialog onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add repository/i })).toBeInTheDocument();
    });
  });

  it('shows add form when Add Repository is clicked', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmRepositories') {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    render(<HelmRepositoriesDialog onClose={vi.fn()} />);

    await waitFor(() => {
      const addBtn = screen.getByRole('button', { name: /add repository/i });
      fireEvent.click(addBtn);
    });

    expect(screen.getByPlaceholderText(/e.g., bitnami/i)).toBeInTheDocument();
  });
});

describe('HelmInstallDialog', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
  });

  it('renders search interface', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmRepositories') {
        return Promise.resolve([{ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }]);
      }
      return Promise.resolve([]);
    });

    render(<HelmInstallDialog namespace="default" onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search charts/i)).toBeInTheDocument();
    });
  });

  it('shows warning when no repos configured', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmRepositories') {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    render(<HelmInstallDialog namespace="default" onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/no helm repositories configured/i)).toBeInTheDocument();
    });
  });

  it('searches for charts', async () => {
    const mockCharts = [
      {
        name: 'nginx',
        repo: 'bitnami',
        version: '15.0.0',
        appVersion: '1.25.0',
        description: 'NGINX web server',
        versions: ['15.0.0', '14.0.0'],
      },
    ];

    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHelmRepositories') {
        return Promise.resolve([{ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }]);
      }
      if (name === 'SearchHelmCharts') {
        return Promise.resolve(mockCharts);
      }
      return Promise.resolve([]);
    });

    render(<HelmInstallDialog namespace="default" onClose={vi.fn()} onSuccess={vi.fn()} />);

    const searchInput = await screen.findByPlaceholderText(/search charts/i);
    fireEvent.change(searchInput, { target: { value: 'nginx' } });

    const searchBtn = screen.getByRole('button', { name: /search/i });
    await waitFor(() => expect(searchBtn).not.toBeDisabled());
    fireEvent.click(searchBtn);

    expect(await screen.findByText('bitnami/nginx')).toBeInTheDocument();
  });
});
