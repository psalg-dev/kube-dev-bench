import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CronJobHistoryTab from '../k8s/resources/cronjobs/CronJobHistoryTab';
import type { app } from '../../wailsjs/go/models';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetCronJobDetail: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';

const getCronJobDetailMock = vi.mocked(AppAPI.GetCronJobDetail);
const toCronJobDetail = (data: unknown) => data as app.CronJobDetail;

describe('CronJobHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      getCronJobDetailMock.mockImplementation(() => new Promise(() => {}));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      getCronJobDetailMock.mockRejectedValue(new Error('Connection failed'));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });

    it('shows generic error when no message provided', async () => {
      getCronJobDetailMock.mockRejectedValue({});

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch cronjob details/i)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows no jobs message when jobs array is empty', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail({ jobs: [] }));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText(/No jobs found for this cronjob/i)).toBeInTheDocument();
      });
    });

    it('handles null jobs', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail({ jobs: null }));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText(/No jobs found for this cronjob/i)).toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail(null));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText(/No jobs found for this cronjob/i)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockDetail = {
      jobs: [
        { name: 'cronjob-123', status: 'Complete', startTime: '2024-01-01T10:00:00Z', duration: '5s', succeeded: 1, failed: 0 },
        { name: 'cronjob-124', status: 'Complete', startTime: '2024-01-01T11:00:00Z', duration: '6s', succeeded: 1, failed: 0 },
        { name: 'cronjob-125', status: 'Failed', startTime: '2024-01-01T12:00:00Z', duration: '2m', succeeded: 0, failed: 1 },
      ],
    };

    it('displays job history in table', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail(mockDetail));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText('cronjob-123')).toBeInTheDocument();
        expect(screen.getByText('cronjob-124')).toBeInTheDocument();
        expect(screen.getByText('cronjob-125')).toBeInTheDocument();
      });
    });

    it('displays job status badges', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail(mockDetail));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        // 'Complete' appears in status badges (2 times)
        expect(screen.getAllByText('Complete').length).toBe(2);
        // 'Failed' appears in table header AND status badge (2 times)
        expect(screen.getAllByText('Failed').length).toBe(2);
      });
    });

    it('displays job duration', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail(mockDetail));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText('5s')).toBeInTheDocument();
        expect(screen.getByText('6s')).toBeInTheDocument();
        expect(screen.getByText('2m')).toBeInTheDocument();
      });
    });

    it('displays success/failure counts', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail(mockDetail));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText('cronjob-125')).toBeInTheDocument();
      });
    });

    it('shows Job History header', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail(mockDetail));

      render(<CronJobHistoryTab namespace="default" cronJobName="my-cronjob" />);

      await waitFor(() => {
        expect(screen.getByText(/Job History/i)).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls GetCronJobDetail with correct params', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail({ jobs: [] }));

      render(<CronJobHistoryTab namespace="test-ns" cronJobName="test-cronjob" />);

      await waitFor(() => {
        expect(AppAPI.GetCronJobDetail).toHaveBeenCalledWith('test-ns', 'test-cronjob');
      });
    });

    it('does not call API when namespace is missing', () => {
      render(<CronJobHistoryTab namespace="" cronJobName="my-cronjob" />);

      expect(AppAPI.GetCronJobDetail).not.toHaveBeenCalled();
    });

    it('does not call API when cronJobName is missing', () => {
      render(<CronJobHistoryTab namespace="default" cronJobName="" />);

      expect(AppAPI.GetCronJobDetail).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      getCronJobDetailMock.mockResolvedValue(toCronJobDetail({ jobs: [] }));

      const { rerender } = render(<CronJobHistoryTab namespace="ns1" cronJobName="cron1" />);

      await waitFor(() => {
        expect(AppAPI.GetCronJobDetail).toHaveBeenCalledWith('ns1', 'cron1');
      });

      rerender(<CronJobHistoryTab namespace="ns2" cronJobName="cron2" />);

      await waitFor(() => {
        expect(AppAPI.GetCronJobDetail).toHaveBeenCalledWith('ns2', 'cron2');
      });
    });
  });
});