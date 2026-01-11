import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const notifications = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const swarmApi = vi.hoisted(() => ({
  ListRegistryRepositories: vi.fn(),
  ListRegistryTags: vi.fn(),
  GetImageDigest: vi.fn(),
  SearchDockerHubRepositories: vi.fn(),
  GetDockerHubRepositoryDetails: vi.fn(),
  PullDockerImageLatest: vi.fn(),
  SearchRegistryRepositories: vi.fn(),
  GetRegistryRepositoryDetails: vi.fn(),
}));

vi.mock('../notification.js', () => notifications);
vi.mock('../docker/swarmApi.js', () => swarmApi);

import RegistryBrowser from '../docker/registry/RegistryBrowser.jsx';

beforeEach(() => {
  notifications.showError.mockReset();
  notifications.showSuccess.mockReset();

  for (const k of Object.keys(swarmApi)) {
    swarmApi[k].mockReset();
  }
});

describe('RegistryBrowser', () => {
  it('loads repositories, tags, and digests', async () => {
    swarmApi.ListRegistryRepositories.mockResolvedValueOnce(['library/ubuntu', 'nginx']);
    swarmApi.ListRegistryTags.mockResolvedValueOnce(['latest', '1.0']);
    swarmApi.GetImageDigest.mockImplementation(async (_registry, _repo, tag) => `sha-${tag}`);

    render(<RegistryBrowser registryName="Docker Hub" registryType="dockerhub" />);

    // First repo selected automatically
    await screen.findByText('library/ubuntu');

    await waitFor(() => {
      expect(swarmApi.ListRegistryTags).toHaveBeenCalledWith('Docker Hub', 'library/ubuntu');
    });

    expect(await screen.findByText('latest')).toBeTruthy();
    expect(await screen.findByText('sha-latest')).toBeTruthy();

    expect(swarmApi.GetImageDigest).toHaveBeenCalledWith('Docker Hub', 'library/ubuntu', 'latest');
    expect(swarmApi.GetImageDigest).toHaveBeenCalledWith('Docker Hub', 'library/ubuntu', '1.0');
  });

  it('searches Docker Hub, inspects a repo, and pulls latest', async () => {
    swarmApi.ListRegistryRepositories.mockResolvedValueOnce([]);

    swarmApi.SearchDockerHubRepositories.mockResolvedValueOnce([
      {
        fullName: 'library/ubuntu',
        description: 'Ubuntu base image',
        starCount: 1,
        pullCount: 2,
        lastUpdated: '2024-01-01T00:00:00Z',
      },
    ]);

    swarmApi.GetDockerHubRepositoryDetails.mockResolvedValueOnce({
      fullName: 'library/ubuntu',
      sizeBytes: 1024,
      description: 'Ubuntu base image',
      starCount: 10,
      pullCount: 100,
      lastUpdated: '2025-01-02T03:04:05Z',
    });

    swarmApi.PullDockerImageLatest.mockResolvedValueOnce(undefined);

    render(<RegistryBrowser registryName="Docker Hub" registryType="dockerhub" />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search Docker Hub' }), 'ubun');
    fireEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('library/ubuntu')).toBeTruthy();

    // Select result triggers inspect
    fireEvent.click(screen.getByText('library/ubuntu').closest('tr'));

    await waitFor(() => {
      expect(swarmApi.GetDockerHubRepositoryDetails).toHaveBeenCalledWith('library/ubuntu');
    });

    // URL is derived for library/* official images
    const link = await screen.findByRole('link', { name: 'https://hub.docker.com/_/ubuntu' });
    expect(link.getAttribute('href')).toBe('https://hub.docker.com/_/ubuntu');

    // Pull
    fireEvent.click(screen.getAllByText('Pull').slice(-1)[0]);

    await waitFor(() => {
      expect(swarmApi.PullDockerImageLatest).toHaveBeenCalledWith('library/ubuntu', 'Docker Hub');
      expect(notifications.showSuccess).toHaveBeenCalledWith('Pulled library/ubuntu:latest');
    });
  });

  it('shows an error when repository inspection fails', async () => {
    swarmApi.ListRegistryRepositories.mockResolvedValueOnce([]);

    swarmApi.SearchDockerHubRepositories.mockResolvedValueOnce([
      { fullName: 'library/ubuntu', description: '', starCount: 0, pullCount: 0, lastUpdated: '' },
    ]);

    swarmApi.GetDockerHubRepositoryDetails.mockRejectedValueOnce('boom');

    render(<RegistryBrowser registryName="Docker Hub" registryType="dockerhub" />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search Docker Hub' }), 'ub');
    fireEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('library/ubuntu')).toBeTruthy();
    fireEvent.click(screen.getByText('library/ubuntu').closest('tr'));

    expect(await screen.findByText('boom')).toBeTruthy();

    await waitFor(() => {
      expect(notifications.showError).toHaveBeenCalledWith('Failed to inspect repository: boom');
    });
  });
});
