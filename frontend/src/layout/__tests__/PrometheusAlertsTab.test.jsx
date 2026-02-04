import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PrometheusAlertsTab from '../PrometheusAlertsTab.jsx';
import { appApiMocks, resetAllMocks } from '../../__tests__/wailsMocks';

beforeEach(() => {
  resetAllMocks();
});

describe('PrometheusAlertsTab', () => {
  it('fetches and displays alerts', async () => {
    appApiMocks.GetPrometheusAlerts.mockResolvedValueOnce([
      {
        name: 'HighCPU',
        state: 'firing',
        value: '1',
        labels: { alertname: 'HighCPU' },
        annotations: { summary: 'CPU high' },
        activeAt: new Date().toISOString(),
      },
    ]);

    render(<PrometheusAlertsTab />);

    fireEvent.change(screen.getByPlaceholderText(/Prometheus URL/i), { target: { value: 'http://localhost:9090' } });
    fireEvent.click(screen.getByText('Fetch Alerts'));

    await waitFor(() => {
      expect(screen.getByText('HighCPU')).toBeInTheDocument();
    });
  });

  it('investigates alert and shows analysis', async () => {
    appApiMocks.GetPrometheusAlerts.mockResolvedValueOnce([
      {
        name: 'DiskFull',
        state: 'firing',
        value: '1',
        labels: { alertname: 'DiskFull' },
        annotations: { summary: 'Disk full' },
        activeAt: new Date().toISOString(),
      },
    ]);
    appApiMocks.InvestigatePrometheusAlert.mockResolvedValueOnce({ response: 'Investigation result' });
    appApiMocks.GetAlertInvestigationHistory.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { alertName: 'DiskFull', timestamp: new Date().toISOString(), analysis: 'Investigation result' },
    ]);

    render(<PrometheusAlertsTab />);

    fireEvent.change(screen.getByPlaceholderText(/Prometheus URL/i), { target: { value: 'http://localhost:9090' } });
    fireEvent.click(screen.getByText('Fetch Alerts'));

    await waitFor(() => {
      expect(screen.getByText('DiskFull')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Investigate'));

    await waitFor(() => {
      expect(screen.getByText('Investigation result')).toBeInTheDocument();
    });

    expect(screen.getByText('Investigation history')).toBeInTheDocument();
  });
});
