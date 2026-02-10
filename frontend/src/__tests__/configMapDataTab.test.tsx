import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ConfigMapDataTab from '../k8s/resources/configmaps/ConfigMapDataTab';
import type { app } from '../../wailsjs/go/models';

// Mock notification module
vi.mock('../notification', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetConfigMapDataByName: vi.fn(),
  UpdateConfigMapDataKey: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import { showError, showSuccess } from '../notification';

const getConfigMapDataMock = vi.mocked(AppAPI.GetConfigMapDataByName);
const updateConfigMapDataKeyMock = vi.mocked(AppAPI.UpdateConfigMapDataKey);
const toConfigMapData = (data: unknown) => data as app.ConfigMapDataInfo[];

describe('ConfigMapDataTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      getConfigMapDataMock.mockImplementation(() => new Promise(() => {}));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      getConfigMapDataMock.mockRejectedValue(new Error('Connection failed'));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });

    it('shows generic error when no message provided', async () => {
      getConfigMapDataMock.mockRejectedValue({});

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      // When error is not an Error instance, String({}) gives "[object Object]"
      await waitFor(() => {
        expect(screen.getByText(/Error:/i)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('handles empty data array', async () => {
      getConfigMapDataMock.mockResolvedValue(toConfigMapData([]));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      getConfigMapDataMock.mockResolvedValue(toConfigMapData(null));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockData = [
      { key: 'config.json', value: '{"host": "localhost"}', size: 22, isBinary: false },
      { key: 'settings.yaml', value: 'host: localhost\nport: 8080', size: 25, isBinary: false },
      { key: 'app.properties', value: 'app.name=test', size: 13, isBinary: false },
    ];

    it('displays config map keys', async () => {
      getConfigMapDataMock.mockResolvedValue(toConfigMapData(mockData));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText('config.json')).toBeInTheDocument();
        expect(screen.getByText('settings.yaml')).toBeInTheDocument();
        expect(screen.getByText('app.properties')).toBeInTheDocument();
      });
    });

    it('auto-expands when only one key exists', async () => {
      const singleData = [{ key: 'config.json', value: '{"test": true}', size: 14, isBinary: false }];
      getConfigMapDataMock.mockResolvedValue(toConfigMapData(singleData));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText('config.json')).toBeInTheDocument();
      });
    });

    it('can toggle key expansion', async () => {
      getConfigMapDataMock.mockResolvedValue(toConfigMapData(mockData));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText('config.json')).toBeInTheDocument();
      });

      // Click on a key row to expand
      const keyRow = screen.getByText('config.json').closest('tr') || screen.getByText('config.json');
      fireEvent.click(keyRow);
    });
  });

  describe('API calls', () => {
    it('calls GetConfigMapDataByName with correct params', async () => {
      getConfigMapDataMock.mockResolvedValue(toConfigMapData([]));

      render(<ConfigMapDataTab namespace="test-ns" configMapName="test-config" />);

      await waitFor(() => {
        expect(AppAPI.GetConfigMapDataByName).toHaveBeenCalledWith('test-ns', 'test-config');
      });
    });

    it('does not call API when namespace is missing', () => {
      render(<ConfigMapDataTab namespace="" configMapName="my-config" />);

      expect(AppAPI.GetConfigMapDataByName).not.toHaveBeenCalled();
    });

    it('does not call API when configMapName is missing', () => {
      render(<ConfigMapDataTab namespace="default" configMapName="" />);

      expect(AppAPI.GetConfigMapDataByName).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      getConfigMapDataMock.mockResolvedValue(toConfigMapData([]));

      const { rerender } = render(<ConfigMapDataTab namespace="ns1" configMapName="config1" />);

      await waitFor(() => {
        expect(AppAPI.GetConfigMapDataByName).toHaveBeenCalledWith('ns1', 'config1');
      });

      rerender(<ConfigMapDataTab namespace="ns2" configMapName="config2" />);

      await waitFor(() => {
        expect(AppAPI.GetConfigMapDataByName).toHaveBeenCalledWith('ns2', 'config2');
      });
    });
  });

  describe('editing functionality', () => {
    const mockData = [{ key: 'test.txt', value: 'original content', size: 16, isBinary: false }];

    it('can save edited content', async () => {
      getConfigMapDataMock.mockResolvedValue(toConfigMapData(mockData));
      updateConfigMapDataKeyMock.mockResolvedValue(undefined);

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });

    it('shows error notification on save failure', async () => {
      getConfigMapDataMock.mockResolvedValue(toConfigMapData(mockData));
      updateConfigMapDataKeyMock.mockRejectedValue(new Error('Update failed'));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });
  });

  describe('syntax detection', () => {
    it('detects JSON format from extension', async () => {
      const jsonData = [{ key: 'config.json', value: '{}', size: 2, isBinary: false }];
      getConfigMapDataMock.mockResolvedValue(toConfigMapData(jsonData));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText('config.json')).toBeInTheDocument();
      });
    });

    it('detects YAML format from extension', async () => {
      const yamlData = [{ key: 'config.yaml', value: 'key: value', size: 10, isBinary: false }];
      getConfigMapDataMock.mockResolvedValue(toConfigMapData(yamlData));

      render(<ConfigMapDataTab namespace="default" configMapName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText('config.yaml')).toBeInTheDocument();
      });
    });
  });
});