import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CronJobYamlTab from '../k8s/resources/cronjobs/CronJobYamlTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetCronJobYAML: vi.fn(),
}));

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

import * as AppAPI from '../../wailsjs/go/main/App';

const getCronJobYamlMock = vi.mocked(AppAPI.GetCronJobYAML);

describe('CronJobYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getCronJobYamlMock.mockImplementation(() => new Promise(() => {}));

      render(<CronJobYamlTab namespace="default" name="my-cronjob" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays cronjob name in header', async () => {
      getCronJobYamlMock.mockResolvedValue('');

      render(<CronJobYamlTab namespace="default" name="backup-job" />);

      await waitFor(() => {
        expect(AppAPI.GetCronJobYAML).toHaveBeenCalledWith('default', 'backup-job');
        expect(screen.getByText(/YAML for backup-job/)).toBeInTheDocument();
      });
    });

    it('displays action buttons', async () => {
      getCronJobYamlMock.mockResolvedValue('');

      render(<CronJobYamlTab namespace="default" name="my-cronjob" />);

      await waitFor(() => {
        expect(AppAPI.GetCronJobYAML).toHaveBeenCalledWith('default', 'my-cronjob');
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('Copy')).toBeInTheDocument();
        expect(screen.getByText('Download')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getCronJobYamlMock.mockRejectedValue(new Error('CronJob not found'));

      render(<CronJobYamlTab namespace="default" name="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText(/CronJob not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      getCronJobYamlMock.mockResolvedValue('schedule: "* * * * *"');

      render(<CronJobYamlTab namespace="default" name="my-cronjob" />);

      await waitFor(() => {
        expect(AppAPI.GetCronJobYAML).toHaveBeenCalledWith('default', 'my-cronjob');
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(AppAPI.GetCronJobYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: batch/v1\nkind: CronJob';
      getCronJobYamlMock.mockResolvedValue(mockYaml);

      render(<CronJobYamlTab namespace="default" name="my-cronjob" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<CronJobYamlTab namespace="" name="my-cronjob" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetCronJobYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<CronJobYamlTab namespace="default" name="" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetCronJobYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      getCronJobYamlMock.mockResolvedValue('yaml: content');

      const { rerender } = render(
        <CronJobYamlTab namespace="ns1" name="cron-1" />
      );

      await waitFor(() => {
        expect(AppAPI.GetCronJobYAML).toHaveBeenCalledWith('ns1', 'cron-1');
      });

      rerender(<CronJobYamlTab namespace="ns2" name="cron-2" />);

      await waitFor(() => {
        expect(AppAPI.GetCronJobYAML).toHaveBeenCalledWith('ns2', 'cron-2');
      });
    });
  });
});
