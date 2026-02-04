import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CronJobNextRunsTab from '../k8s/resources/cronjobs/CronJobNextRunsTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetCronJobDetail: vi.fn(),
}));

// Import after mocking
import * as AppAPI from '../../wailsjs/go/main/App';

describe('CronJobNextRunsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      AppAPI.GetCronJobDetail.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      AppAPI.GetCronJobDetail.mockRejectedValue(new Error('Connection failed'));
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it('shows the error message from the API', async () => {
      AppAPI.GetCronJobDetail.mockRejectedValue(new Error('Network error'));
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });
  });

  describe('suspended state', () => {
    it('displays suspended message when CronJob is suspended', async () => {
      AppAPI.GetCronJobDetail.mockResolvedValue({ nextRuns: [] });
      
      render(
        <CronJobNextRunsTab 
          namespace="default" 
          cronJobName="my-cronjob" 
          suspend={true}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('CronJob is suspended.')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('displays message when no upcoming runs', async () => {
      AppAPI.GetCronJobDetail.mockResolvedValue({ nextRuns: [] });
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText('No upcoming runs available.')).toBeInTheDocument();
      });
    });

    it('handles null nextRuns', async () => {
      AppAPI.GetCronJobDetail.mockResolvedValue({ nextRuns: null });
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText('No upcoming runs available.')).toBeInTheDocument();
      });
    });

    it('handles missing nextRuns property', async () => {
      AppAPI.GetCronJobDetail.mockResolvedValue({});
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText('No upcoming runs available.')).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays table header', async () => {
      const mockData = {
        nextRuns: ['2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'],
      };
      AppAPI.GetCronJobDetail.mockResolvedValue(mockData);
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText('Next Runs (Next 5)')).toBeInTheDocument();
      });
    });

    it('displays column headers', async () => {
      const mockData = {
        nextRuns: ['2024-01-15T10:00:00Z'],
      };
      AppAPI.GetCronJobDetail.mockResolvedValue(mockData);
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText('#')).toBeInTheDocument();
        expect(screen.getByText('Scheduled Time')).toBeInTheDocument();
      });
    });

    it('displays run indices', async () => {
      const mockData = {
        nextRuns: ['2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'],
      };
      AppAPI.GetCronJobDetail.mockResolvedValue(mockData);
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls GetCronJobDetail with correct parameters', async () => {
      AppAPI.GetCronJobDetail.mockResolvedValue({ nextRuns: [] });
      
      render(<CronJobNextRunsTab namespace="prod" cronJobName="backup-job" />);
      
      await waitFor(() => {
        expect(AppAPI.GetCronJobDetail).toHaveBeenCalledWith('prod', 'backup-job');
      });
    });

    it('does not call API when namespace is missing', () => {
      render(<CronJobNextRunsTab namespace="" cronJobName="my-cronjob" />);
      
      expect(AppAPI.GetCronJobDetail).not.toHaveBeenCalled();
    });

    it('does not call API when cronJobName is missing', () => {
      render(<CronJobNextRunsTab namespace="default" cronJobName="" />);
      
      expect(AppAPI.GetCronJobDetail).not.toHaveBeenCalled();
    });

    it('re-fetches when cronJobName changes', async () => {
      AppAPI.GetCronJobDetail.mockResolvedValue({ nextRuns: [] });
      
      const { rerender } = render(
        <CronJobNextRunsTab namespace="default" cronJobName="job1" />
      );
      
      await waitFor(() => {
        expect(AppAPI.GetCronJobDetail).toHaveBeenCalledWith('default', 'job1');
      });
      
      rerender(<CronJobNextRunsTab namespace="default" cronJobName="job2" />);
      
      await waitFor(() => {
        expect(AppAPI.GetCronJobDetail).toHaveBeenCalledWith('default', 'job2');
      });
    });
  });

  describe('NextRuns property variations', () => {
    it('handles NextRuns with capital N', async () => {
      const mockData = {
        NextRuns: ['2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'],
      };
      AppAPI.GetCronJobDetail.mockResolvedValue(mockData);
      
      render(<CronJobNextRunsTab namespace="default" cronJobName="my-cronjob" />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });
});
