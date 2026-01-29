import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LabelsInline from '../LabelsInline';

describe('LabelsInline', () => {
  describe('empty states', () => {
    it('renders dash when no labels provided', () => {
      render(<LabelsInline labels={null} />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders dash when labels is undefined', () => {
      render(<LabelsInline labels={undefined} />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders dash when labels is empty object', () => {
      render(<LabelsInline labels={{}} />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders dash when labels is not a plain object', () => {
      render(<LabelsInline labels="not an object" />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders array indices as keys when labels is an array', () => {
      const labels = ['label1', 'label2'];
      render(<LabelsInline labels={labels} />);
      
      // Arrays are technically objects in JavaScript, so they will be rendered
      expect(screen.getByText('0=label1')).toBeInTheDocument();
      expect(screen.getByText('1=label2')).toBeInTheDocument();
    });
  });

  describe('label rendering', () => {
    it('renders single label as key=value chip', () => {
      const labels = { app: 'nginx' };
      render(<LabelsInline labels={labels} />);
      
      expect(screen.getByText('app=nginx')).toBeInTheDocument();
    });

    it('renders multiple labels as separate chips', () => {
      const labels = {
        app: 'nginx',
        env: 'production',
        version: '1.0',
      };
      render(<LabelsInline labels={labels} />);
      
      expect(screen.getByText('app=nginx')).toBeInTheDocument();
      expect(screen.getByText('env=production')).toBeInTheDocument();
      expect(screen.getByText('version=1.0')).toBeInTheDocument();
    });

    it('sorts labels alphabetically by key', () => {
      const labels = {
        version: '1.0',
        app: 'nginx',
        env: 'production',
      };
      const { container } = render(<LabelsInline labels={labels} />);
      
      const chips = container.querySelectorAll('span[style*="background"]');
      expect(chips[0]).toHaveTextContent('app=nginx');
      expect(chips[1]).toHaveTextContent('env=production');
      expect(chips[2]).toHaveTextContent('version=1.0');
    });
  });

  describe('maxVisible handling', () => {
    it('uses default maxVisible of 4 when not provided', () => {
      const labels = {
        label1: 'value1',
        label2: 'value2',
        label3: 'value3',
        label4: 'value4',
        label5: 'value5',
      };
      render(<LabelsInline labels={labels} />);
      
      // Should show 4 labels plus a +1 overflow indicator
      expect(screen.getByText('label1=value1')).toBeInTheDocument();
      expect(screen.getByText('label2=value2')).toBeInTheDocument();
      expect(screen.getByText('label3=value3')).toBeInTheDocument();
      expect(screen.getByText('label4=value4')).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.queryByText('label5=value5')).not.toBeInTheDocument();
    });

    it('respects custom maxVisible prop', () => {
      const labels = {
        label1: 'value1',
        label2: 'value2',
        label3: 'value3',
        label4: 'value4',
      };
      render(<LabelsInline labels={labels} maxVisible={2} />);
      
      // Should show 2 labels plus a +2 overflow indicator
      expect(screen.getByText('label1=value1')).toBeInTheDocument();
      expect(screen.getByText('label2=value2')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.queryByText('label3=value3')).not.toBeInTheDocument();
    });

    it('shows all labels when count is less than maxVisible', () => {
      const labels = {
        label1: 'value1',
        label2: 'value2',
      };
      render(<LabelsInline labels={labels} maxVisible={5} />);
      
      // Should show all labels, no overflow indicator
      expect(screen.getByText('label1=value1')).toBeInTheDocument();
      expect(screen.getByText('label2=value2')).toBeInTheDocument();
      expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    });

    it('shows all labels when count equals maxVisible', () => {
      const labels = {
        label1: 'value1',
        label2: 'value2',
        label3: 'value3',
      };
      render(<LabelsInline labels={labels} maxVisible={3} />);
      
      // Should show all 3 labels, no overflow indicator
      expect(screen.getByText('label1=value1')).toBeInTheDocument();
      expect(screen.getByText('label2=value2')).toBeInTheDocument();
      expect(screen.getByText('label3=value3')).toBeInTheDocument();
      expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies custom style prop', () => {
      const labels = { app: 'nginx' };
      const customStyle = { marginTop: '10px', padding: '5px' };
      
      const { container } = render(<LabelsInline labels={labels} style={customStyle} />);
      const wrapper = container.firstChild;
      
      // Check that custom style is applied (merged with default styles)
      expect(wrapper).toHaveStyle({ marginTop: '10px' });
    });

    it('maintains default styles when no custom style provided', () => {
      const labels = { app: 'nginx' };
      
      const { container } = render(<LabelsInline labels={labels} />);
      const wrapper = container.firstChild;
      
      // Check default styles are present
      expect(wrapper).toHaveStyle({
        display: 'flex',
        gap: '6px',
        overflow: 'hidden',
      });
    });

    it('limits max width to 55% by default', () => {
      const labels = { app: 'nginx' };
      
      const { container } = render(<LabelsInline labels={labels} />);
      const wrapper = container.firstChild;
      
      expect(wrapper).toHaveStyle({ maxWidth: '55%' });
    });
  });

  describe('title attribute', () => {
    it('sets title with all labels on container', () => {
      const labels = {
        app: 'nginx',
        env: 'production',
        version: '1.0',
      };
      
      const { container } = render(<LabelsInline labels={labels} />);
      const wrapper = container.firstChild;
      
      expect(wrapper).toHaveAttribute('title');
      const title = wrapper?.getAttribute('title');
      expect(title).toContain('app=nginx');
      expect(title).toContain('env=production');
      expect(title).toContain('version=1.0');
    });

    it('includes overflow indicator in title when labels exceed maxVisible', () => {
      const labels = {
        label1: 'value1',
        label2: 'value2',
        label3: 'value3',
        label4: 'value4',
        label5: 'value5',
      };
      
      const { container } = render(<LabelsInline labels={labels} maxVisible={3} />);
      const wrapper = container.firstChild;
      
      const title = wrapper?.getAttribute('title');
      expect(title).toContain('+2');
    });
  });

  describe('chip styling', () => {
    it('applies consistent chip styling to all labels', () => {
      const labels = {
        app: 'nginx',
        env: 'production',
      };
      
      const { container } = render(<LabelsInline labels={labels} />);
      const chips = container.querySelectorAll('span[style*="background"]');
      
      chips.forEach(chip => {
        expect(chip).toHaveStyle({
          fontSize: '12px',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          maxWidth: '160px',
        });
      });
    });
  });

  describe('memoization', () => {
    it('recomputes chips when labels change', () => {
      const { rerender } = render(<LabelsInline labels={{ app: 'nginx' }} />);
      expect(screen.getByText('app=nginx')).toBeInTheDocument();
      
      rerender(<LabelsInline labels={{ app: 'apache' }} />);
      expect(screen.getByText('app=apache')).toBeInTheDocument();
      expect(screen.queryByText('app=nginx')).not.toBeInTheDocument();
    });

    it('recomputes chips when maxVisible changes', () => {
      const labels = { l1: 'v1', l2: 'v2', l3: 'v3' };
      
      const { rerender } = render(<LabelsInline labels={labels} maxVisible={2} />);
      expect(screen.getByText('+1')).toBeInTheDocument();
      
      rerender(<LabelsInline labels={labels} maxVisible={3} />);
      expect(screen.queryByText('+1')).not.toBeInTheDocument();
    });
  });
});
