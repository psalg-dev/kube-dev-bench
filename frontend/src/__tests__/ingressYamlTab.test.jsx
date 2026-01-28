import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IngressYamlTab from '../k8s/resources/ingresses/IngressYamlTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressYAML: vi.fn(),
}));

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

import * as AppAPI from '../../wailsjs/go/main/App';

describe('IngressYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      AppAPI.GetIngressYAML.mockImplementation(() => new Promise(() => {}));
      
      render(<IngressYamlTab namespace="default" name="my-ingress" />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays ingress name in header', async () => {
      AppAPI.GetIngressYAML.mockResolvedValue('');
      
      render(<IngressYamlTab namespace="default" name="api-ingress" />);
      
      expect(screen.getByText(/YAML for api-ingress/)).toBeInTheDocument();
    });

    it('displays action buttons', async () => {
      AppAPI.GetIngressYAML.mockResolvedValue('');
      
      render(<IngressYamlTab namespace="default" name="my-ingress" />);
      
      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      AppAPI.GetIngressYAML.mockRejectedValue(new Error('Ingress not found'));
      
      render(<IngressYamlTab namespace="default" name="my-ingress" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Ingress not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      AppAPI.GetIngressYAML.mockResolvedValue('rules: []');
      
      render(<IngressYamlTab namespace="default" name="my-ingress" />);
      
      await waitFor(() => {
        expect(AppAPI.GetIngressYAML).toHaveBeenCalledWith('default', 'my-ingress');
      });

      fireEvent.click(screen.getByText('Refresh'));
      
      await waitFor(() => {
        expect(AppAPI.GetIngressYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: networking.k8s.io/v1\nkind: Ingress';
      AppAPI.GetIngressYAML.mockResolvedValue(mockYaml);
      
      render(<IngressYamlTab namespace="default" name="my-ingress" />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<IngressYamlTab namespace="" name="my-ingress" />);
      
      await new Promise(r => setTimeout(r, 50));
      
      expect(AppAPI.GetIngressYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<IngressYamlTab namespace="default" name="" />);
      
      await new Promise(r => setTimeout(r, 50));
      
      expect(AppAPI.GetIngressYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      AppAPI.GetIngressYAML.mockResolvedValue('yaml: content');
      
      const { rerender } = render(<IngressYamlTab namespace="ns1" name="ingress-1" />);
      
      await waitFor(() => {
        expect(AppAPI.GetIngressYAML).toHaveBeenCalledWith('ns1', 'ingress-1');
      });

      rerender(<IngressYamlTab namespace="ns2" name="ingress-2" />);
      
      await waitFor(() => {
        expect(AppAPI.GetIngressYAML).toHaveBeenCalledWith('ns2', 'ingress-2');
      });
    });
  });
});
