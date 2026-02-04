import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const notifications = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
}));

const swarmApi = vi.hoisted(() => ({
  AddRegistry: vi.fn(),
  TestRegistryConnection: vi.fn(),
}));

vi.mock('../notification.js', () => notifications);
vi.mock('../docker/swarmApi.js', () => swarmApi);

import AddRegistryModal from '../docker/registry/AddRegistryModal.jsx';

beforeEach(() => {
  notifications.showError.mockReset();
  notifications.showSuccess.mockReset();
  notifications.showWarning.mockReset();
  swarmApi.AddRegistry.mockReset();
  swarmApi.TestRegistryConnection.mockReset();
});

describe('AddRegistryModal', () => {
  it('validates required fields (default dockerhub/basic)', async () => {
    render(<AddRegistryModal open={true} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Docker Hub URL is readonly
    expect(screen.getByText('https://registry-1.docker.io')).toBeTruthy();

    fireEvent.click(screen.getByText('Save'));
    expect(notifications.showError).toHaveBeenCalledWith('Username is required for Basic auth.');
    expect(swarmApi.AddRegistry).not.toHaveBeenCalled();
  });

  it('saves dockerhub registry with basic auth', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();

    swarmApi.AddRegistry.mockResolvedValueOnce(undefined);

    const { container } = render(<AddRegistryModal open={true} onClose={onClose} onSaved={onSaved} />);

    const username = container.querySelector('#registry-username');
    const password = container.querySelector('#registry-password');
    expect(username).toBeTruthy();
    expect(password).toBeTruthy();

    await userEvent.type(username, 'u');
    await userEvent.type(password, 'p');

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(swarmApi.AddRegistry).toHaveBeenCalledTimes(1);
    });

    const cfg = swarmApi.AddRegistry.mock.calls[0][0];
    expect(cfg).toMatchObject({
      name: 'Docker Hub',
      type: 'dockerhub',
      url: 'https://registry-1.docker.io',
      credentials: { username: 'u', password: 'p', token: '', region: '' },
      timeoutSeconds: 30,
      insecureSkipTlsVerify: false,
      allowInsecureHttp: false,
    });

    expect(notifications.showSuccess).toHaveBeenCalledWith('Saved registry Docker Hub');
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('tests dockerhub token auth (token used as password)', async () => {
    swarmApi.TestRegistryConnection.mockResolvedValueOnce(undefined);

    const { container } = render(<AddRegistryModal open={true} onClose={vi.fn()} onSaved={vi.fn()} />);

    const authMethod = container.querySelector('#registry-auth-method');
    expect(authMethod).toBeTruthy();
    fireEvent.change(authMethod, { target: { value: 'token' } });

    const username = container.querySelector('#registry-username');
    const token = container.querySelector('#registry-token');
    expect(username).toBeTruthy();
    expect(token).toBeTruthy();

    await userEvent.type(username, 'user');
    await userEvent.type(token, 'tok');

    fireEvent.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(swarmApi.TestRegistryConnection).toHaveBeenCalledTimes(1);
    });

    const cfg = swarmApi.TestRegistryConnection.mock.calls[0][0];
    expect(cfg).toMatchObject({
      type: 'dockerhub',
      url: 'https://registry-1.docker.io',
      credentials: { username: 'user', password: 'tok', token: '', region: '' },
    });

    expect(notifications.showSuccess).toHaveBeenCalledWith('Registry connection OK');
  });
});
