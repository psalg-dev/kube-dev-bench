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

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search charts/i);
      fireEvent.change(searchInput, { target: { value: 'nginx' } });
    });

    const searchBtn = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText('bitnami/nginx')).toBeInTheDocument();
    });
  });
});
