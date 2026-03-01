import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PVAnnotationsTab from '../k8s/resources/persistentvolumes/PVAnnotationsTab';

describe('PVAnnotationsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('shows no annotations message when empty object', () => {
      render(<PVAnnotationsTab annotations={{}} />);
      
      expect(screen.getByText(/No annotations/i)).toBeInTheDocument();
    });

    it('shows no annotations message when null', () => {
      render(<PVAnnotationsTab annotations={null} />);
      
      expect(screen.getByText(/No annotations/i)).toBeInTheDocument();
    });

    it('shows no annotations message when undefined', () => {
      render(<PVAnnotationsTab annotations={undefined} />);
      
      expect(screen.getByText(/No annotations/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    const mockAnnotations = {
      'kubernetes.io/pv-protection': 'true',
      'volume.beta.kubernetes.io/storage-class': 'standard',
      'pv.kubernetes.io/bind-completed': 'yes',
    };

    it('displays annotation keys', () => {
      render(<PVAnnotationsTab annotations={mockAnnotations} />);
      
      expect(screen.getByText('kubernetes.io/pv-protection')).toBeInTheDocument();
      expect(screen.getByText('volume.beta.kubernetes.io/storage-class')).toBeInTheDocument();
      expect(screen.getByText('pv.kubernetes.io/bind-completed')).toBeInTheDocument();
    });

    it('displays annotation values', () => {
      render(<PVAnnotationsTab annotations={mockAnnotations} />);
      
      expect(screen.getByText('true')).toBeInTheDocument();
      expect(screen.getByText('standard')).toBeInTheDocument();
      expect(screen.getByText('yes')).toBeInTheDocument();
    });

    it('renders as a table', () => {
      render(<PVAnnotationsTab annotations={mockAnnotations} />);
      
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('shows column headers', () => {
      render(<PVAnnotationsTab annotations={mockAnnotations} />);
      
      expect(screen.getByRole('button', { name: /Key/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Value/ })).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    const mockAnnotations = {
      'c-key': 'value-c',
      'a-key': 'value-a',
      'b-key': 'value-b',
    };

    it('can sort by key column', () => {
      render(<PVAnnotationsTab annotations={mockAnnotations} />);
      
      const keyHeader = screen.getByRole('button', { name: /Key/ });
      fireEvent.click(keyHeader);
      
      // Should toggle sort
      fireEvent.click(keyHeader);
    });

    it('can sort by value column', () => {
      render(<PVAnnotationsTab annotations={mockAnnotations} />);
      
      const valueHeader = screen.getByRole('button', { name: /Value/ });
      fireEvent.click(valueHeader);
    });
  });

  describe('edge cases', () => {
    it('handles empty string value', () => {
      render(<PVAnnotationsTab annotations={{ 'empty-key': '' }} />);
      
      expect(screen.getByText('empty-key')).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('handles null value', () => {
      render(<PVAnnotationsTab annotations={{ 'null-key': null }} />);
      
      expect(screen.getByText('null-key')).toBeInTheDocument();
    });

    it('handles numeric value', () => {
      render(<PVAnnotationsTab annotations={{ 'count': 42 }} />);
      
      expect(screen.getByText('count')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('handles boolean value', () => {
      render(<PVAnnotationsTab annotations={{ 'enabled': true }} />);
      
      expect(screen.getByText('enabled')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('handles long annotation key', () => {
      const longKey = 'very.long.kubernetes.io/annotation-key-that-is-quite-lengthy';
      render(<PVAnnotationsTab annotations={{ [longKey]: 'value' }} />);
      
      expect(screen.getByText(longKey)).toBeInTheDocument();
    });

    it('handles long annotation value', () => {
      const longValue = 'This is a very long annotation value that might contain useful information about the persistent volume configuration and its intended use.';
      render(<PVAnnotationsTab annotations={{ 'key': longValue }} />);
      
      expect(screen.getByText(longValue)).toBeInTheDocument();
    });
  });

  describe('single annotation', () => {
    it('renders single annotation correctly', () => {
      render(<PVAnnotationsTab annotations={{ 'single-key': 'single-value' }} />);
      
      expect(screen.getByText('single-key')).toBeInTheDocument();
      expect(screen.getByText('single-value')).toBeInTheDocument();
    });
  });
});
