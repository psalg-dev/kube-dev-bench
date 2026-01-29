import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortMappingEditor from '../components/forms/PortMappingEditor';

describe('PortMappingEditor', () => {
  describe('initial rendering', () => {
    it('renders empty state with add button', () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[]} onChange={onChange} />);
      
      expect(screen.getByText('Add port')).toBeInTheDocument();
    });

    it('renders with undefined ports', () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={undefined} onChange={onChange} />);
      
      expect(screen.getByText('Add port')).toBeInTheDocument();
    });

    it('renders with null ports', () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={null} onChange={onChange} />);
      
      expect(screen.getByText('Add port')).toBeInTheDocument();
    });
  });

  describe('adding ports', () => {
    it('calls onChange with new port when add button is clicked', async () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[]} onChange={onChange} />);
      
      const addButton = screen.getByText('Add port');
      await userEvent.click(addButton);
      
      expect(onChange).toHaveBeenCalledTimes(1);
      const newPorts = onChange.mock.calls[0][0];
      expect(newPorts).toHaveLength(1);
      expect(newPorts[0]).toMatchObject({
        protocol: 'tcp',
        targetPort: '',
        publishedPort: '',
        publishMode: 'ingress',
      });
      expect(newPorts[0].id).toBeDefined();
    });

    it('adds multiple ports sequentially', async () => {
      const onChange = vi.fn();
      const { rerender } = render(<PortMappingEditor ports={[]} onChange={onChange} />);
      
      const addButton = screen.getByText('Add port');
      await userEvent.click(addButton);
      
      const firstPort = onChange.mock.calls[0][0];
      rerender(<PortMappingEditor ports={firstPort} onChange={onChange} />);
      
      await userEvent.click(addButton);
      
      expect(onChange).toHaveBeenCalledTimes(2);
      const secondPorts = onChange.mock.calls[1][0];
      expect(secondPorts).toHaveLength(2);
    });
  });

  describe('rendering existing ports', () => {
    const samplePort = {
      id: 'port_1',
      protocol: 'tcp',
      targetPort: '80',
      publishedPort: '8080',
      publishMode: 'ingress',
    };

    it('renders port with all fields', () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[samplePort]} onChange={onChange} />);
      
      expect(screen.getByLabelText('Port protocol')).toHaveValue('tcp');
      expect(screen.getByLabelText('Target port')).toHaveValue('80');
      expect(screen.getByLabelText('Published port')).toHaveValue('8080');
      expect(screen.getByLabelText('Publish mode')).toHaveValue('ingress');
    });

    it('adds id to ports that do not have one', () => {
      const onChange = vi.fn();
      const portWithoutId = {
        protocol: 'udp',
        targetPort: '53',
        publishedPort: '53',
        publishMode: 'host',
      };
      
      render(<PortMappingEditor ports={[portWithoutId]} onChange={onChange} />);
      
      expect(screen.getByLabelText('Port protocol')).toHaveValue('udp');
      expect(screen.getByLabelText('Target port')).toHaveValue('53');
    });

    it('renders multiple ports', () => {
      const onChange = vi.fn();
      const ports = [
        { id: 'port_1', protocol: 'tcp', targetPort: '80', publishedPort: '8080', publishMode: 'ingress' },
        { id: 'port_2', protocol: 'udp', targetPort: '53', publishedPort: '53', publishMode: 'host' },
      ];
      
      render(<PortMappingEditor ports={ports} onChange={onChange} />);
      
      const protocolSelects = screen.getAllByLabelText('Port protocol');
      expect(protocolSelects).toHaveLength(2);
      expect(protocolSelects[0]).toHaveValue('tcp');
      expect(protocolSelects[1]).toHaveValue('udp');
    });
  });

  describe('editing ports', () => {
    const samplePort = {
      id: 'port_1',
      protocol: 'tcp',
      targetPort: '80',
      publishedPort: '8080',
      publishMode: 'ingress',
    };

    it('updates protocol when changed', async () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[samplePort]} onChange={onChange} />);
      
      const protocolSelect = screen.getByLabelText('Port protocol');
      await userEvent.selectOptions(protocolSelect, 'udp');
      
      expect(onChange).toHaveBeenCalledWith([
        { ...samplePort, protocol: 'udp' },
      ]);
    });

    it('updates target port field value', async () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[samplePort]} onChange={onChange} />);
      
      const targetPortInput = screen.getByLabelText('Target port');
      await userEvent.type(targetPortInput, '3');
      
      // Check it was called and the last value includes our change
      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0][0];
      expect(lastCall.targetPort).toContain('3');
    });

    it('updates published port field value', async () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[samplePort]} onChange={onChange} />);
      
      const publishedPortInput = screen.getByLabelText('Published port');
      await userEvent.type(publishedPortInput, '0');
      
      // Check it was called and the last value includes our change
      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0][0];
      expect(lastCall.publishedPort).toContain('0');
    });

    it('updates publish mode when changed', async () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[samplePort]} onChange={onChange} />);
      
      const publishModeSelect = screen.getByLabelText('Publish mode');
      await userEvent.selectOptions(publishModeSelect, 'host');
      
      expect(onChange).toHaveBeenCalledWith([
        { ...samplePort, publishMode: 'host' },
      ]);
    });
  });

  describe('removing ports', () => {
    it('removes port when remove button is clicked', async () => {
      const onChange = vi.fn();
      const ports = [
        { id: 'port_1', protocol: 'tcp', targetPort: '80', publishedPort: '8080', publishMode: 'ingress' },
      ];
      
      render(<PortMappingEditor ports={ports} onChange={onChange} />);
      
      const removeButton = screen.getByLabelText('Remove port mapping');
      await userEvent.click(removeButton);
      
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('removes correct port from multiple ports', async () => {
      const onChange = vi.fn();
      const ports = [
        { id: 'port_1', protocol: 'tcp', targetPort: '80', publishedPort: '8080', publishMode: 'ingress' },
        { id: 'port_2', protocol: 'udp', targetPort: '53', publishedPort: '53', publishMode: 'host' },
        { id: 'port_3', protocol: 'tcp', targetPort: '443', publishedPort: '4430', publishMode: 'ingress' },
      ];
      
      render(<PortMappingEditor ports={ports} onChange={onChange} />);
      
      const removeButtons = screen.getAllByLabelText('Remove port mapping');
      await userEvent.click(removeButtons[1]); // Remove middle port
      
      expect(onChange).toHaveBeenCalledWith([ports[0], ports[2]]);
    });
  });

  describe('placeholder text', () => {
    it('shows placeholder for target port', () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[{ id: 'port_1', protocol: 'tcp' }]} onChange={onChange} />);
      
      const targetPortInput = screen.getByLabelText('Target port');
      expect(targetPortInput).toHaveAttribute('placeholder', '80');
    });

    it('shows placeholder for published port', () => {
      const onChange = vi.fn();
      render(<PortMappingEditor ports={[{ id: 'port_1', protocol: 'tcp' }]} onChange={onChange} />);
      
      const publishedPortInput = screen.getByLabelText('Published port');
      expect(publishedPortInput).toHaveAttribute('placeholder', '8080');
    });
  });
});
