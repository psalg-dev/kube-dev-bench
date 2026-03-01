import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NetworkOptionsSection, NetworkIPAMSection } from '../docker/resources/networks/NetworkDetailsSections';

describe('NetworkDetailsSections', () => {
  describe('NetworkOptionsSection', () => {
    it('renders Options header', () => {
      render(<NetworkOptionsSection options={{}} />);
      
      expect(screen.getByText('Options')).toBeInTheDocument();
    });

    it('displays key-value pairs from options', () => {
      const options = {
        'com.docker.network.bridge.name': 'docker0',
        'com.docker.network.driver.mtu': '1500',
      };
      
      render(<NetworkOptionsSection options={options} />);
      
      expect(screen.getByText(/com.docker.network.bridge.name=docker0/)).toBeInTheDocument();
      expect(screen.getByText(/com.docker.network.driver.mtu=1500/)).toBeInTheDocument();
    });

    it('sorts options alphabetically', () => {
      const options = {
        'zebra': 'z',
        'apple': 'a',
        'mango': 'm',
      };
      
      render(<NetworkOptionsSection options={options} />);
      
      const items = screen.getAllByText(/=/);
      expect(items[0].textContent).toContain('apple');
      expect(items[1].textContent).toContain('mango');
      expect(items[2].textContent).toContain('zebra');
    });

    it('shows empty state when options is null', () => {
      render(<NetworkOptionsSection options={null} />);
      
      // Should show empty content
      expect(screen.getByText('Options')).toBeInTheDocument();
    });

    it('shows empty state when options is empty object', () => {
      render(<NetworkOptionsSection options={{}} />);
      
      expect(screen.getByText('Options')).toBeInTheDocument();
    });
  });

  describe('NetworkIPAMSection', () => {
    it('renders IPAM header', () => {
      render(<NetworkIPAMSection ipam={[]} />);
      
      expect(screen.getByText('IPAM')).toBeInTheDocument();
    });

    it('displays IPAM configuration data', () => {
      const ipam = [
        { subnet: '172.17.0.0/16', gateway: '172.17.0.1', ipRange: '172.17.0.0/24' },
      ];
      
      render(<NetworkIPAMSection ipam={ipam} />);
      
      expect(screen.getByText(/subnet 172.17.0.0\/16/)).toBeInTheDocument();
      expect(screen.getByText(/gateway 172.17.0.1/)).toBeInTheDocument();
      expect(screen.getByText(/ipRange 172.17.0.0\/24/)).toBeInTheDocument();
    });

    it('displays aux addresses label', () => {
      const ipam = [
        { subnet: '172.17.0.0/16', gateway: '172.17.0.1', auxAddresses: {} },
      ];
      
      render(<NetworkIPAMSection ipam={ipam} />);
      
      expect(screen.getByText('aux addresses')).toBeInTheDocument();
    });

    it('displays aux addresses key-value pairs', () => {
      const ipam = [
        { 
          subnet: '172.17.0.0/16', 
          gateway: '172.17.0.1',
          auxAddresses: { 'host1': '172.17.0.10', 'host2': '172.17.0.11' }
        },
      ];
      
      render(<NetworkIPAMSection ipam={ipam} />);
      
      expect(screen.getByText(/host1=172.17.0.10/)).toBeInTheDocument();
      expect(screen.getByText(/host2=172.17.0.11/)).toBeInTheDocument();
    });

    it('handles multiple IPAM configs', () => {
      const ipam = [
        { subnet: '172.17.0.0/16', gateway: '172.17.0.1' },
        { subnet: '192.168.0.0/24', gateway: '192.168.0.1' },
      ];
      
      render(<NetworkIPAMSection ipam={ipam} />);
      
      expect(screen.getByText(/172.17.0.0/)).toBeInTheDocument();
      expect(screen.getByText(/192.168.0.0/)).toBeInTheDocument();
    });

    it('shows dash for missing values', () => {
      const ipam = [
        { subnet: null, gateway: undefined, ipRange: null },
      ];
      
      render(<NetworkIPAMSection ipam={ipam} />);
      
      // Should show dashes for missing values
      expect(screen.getByText(/subnet -/)).toBeInTheDocument();
      expect(screen.getByText(/gateway -/)).toBeInTheDocument();
    });

    it('shows empty state when ipam is empty array', () => {
      render(<NetworkIPAMSection ipam={[]} />);
      
      expect(screen.getByText('IPAM')).toBeInTheDocument();
    });

    it('shows empty state when ipam is null', () => {
      render(<NetworkIPAMSection ipam={null} />);
      
      expect(screen.getByText('IPAM')).toBeInTheDocument();
    });
  });
});
