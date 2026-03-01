import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CollapsibleSection from '../components/forms/CollapsibleSection';

describe('CollapsibleSection', () => {
  describe('rendering', () => {
    it('renders title correctly', () => {
      render(
        <CollapsibleSection id="section1" title="Environment Variables" count={3}>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByText(/Environment Variables/)).toBeInTheDocument();
    });

    it('renders count in header', () => {
      render(
        <CollapsibleSection id="section1" title="Labels" count={5}>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByText(/\(5\)/)).toBeInTheDocument();
    });

    it('renders zero count', () => {
      render(
        <CollapsibleSection id="section1" title="Annotations" count={0}>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByText(/\(0\)/)).toBeInTheDocument();
    });

    it('renders count as 0 when undefined', () => {
      render(
        <CollapsibleSection id="section1" title="Items">
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByText(/\(0\)/)).toBeInTheDocument();
    });

    it('applies correct id to container', () => {
      const { container } = render(
        <CollapsibleSection id="my-section" title="Test" count={0}>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(container.querySelector('#my-section')).toBeInTheDocument();
    });
  });

  describe('initial state', () => {
    it('starts collapsed by default', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0}>
          <div>Hidden Content</div>
        </CollapsibleSection>
      );
      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
    });

    it('starts expanded when defaultOpen is true', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0} defaultOpen>
          <div>Visible Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByText('Visible Content')).toBeInTheDocument();
    });
  });

  describe('toggle behavior', () => {
    it('expands when header button is clicked', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0}>
          <div>Toggle Content</div>
        </CollapsibleSection>
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByText('Toggle Content')).toBeInTheDocument();
    });

    it('collapses when header button is clicked again', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0} defaultOpen>
          <div>Toggle Content</div>
        </CollapsibleSection>
      );
      
      const button = screen.getByRole('button');
      expect(screen.getByText('Toggle Content')).toBeInTheDocument();
      
      fireEvent.click(button);
      
      expect(screen.queryByText('Toggle Content')).not.toBeInTheDocument();
    });

    it('toggles multiple times', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0}>
          <div>Content</div>
        </CollapsibleSection>
      );
      
      const button = screen.getByRole('button');
      
      // Click to expand
      fireEvent.click(button);
      expect(screen.getByText('Content')).toBeInTheDocument();
      
      // Click to collapse
      fireEvent.click(button);
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
      
      // Click to expand again
      fireEvent.click(button);
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('caret indicator', () => {
    it('shows right caret when collapsed', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0}>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByText(/▶/)).toBeInTheDocument();
    });

    it('shows down caret when expanded', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0} defaultOpen>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByText(/▼/)).toBeInTheDocument();
    });

    it('changes caret on toggle', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0}>
          <div>Content</div>
        </CollapsibleSection>
      );
      
      expect(screen.getByText(/▶/)).toBeInTheDocument();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByText(/▼/)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('button has aria-expanded false when collapsed', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0}>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    });

    it('button has aria-expanded true when expanded', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0} defaultOpen>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    });

    it('aria-expanded updates on toggle', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0}>
          <div>Content</div>
        </CollapsibleSection>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('button has type="button" to prevent form submission', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={0}>
          <div>Content</div>
        </CollapsibleSection>
      );
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
  });

  describe('children rendering', () => {
    it('renders complex children when expanded', () => {
      render(
        <CollapsibleSection id="section1" title="Test" count={2} defaultOpen>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </CollapsibleSection>
      );
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('renders nested components when expanded', () => {
      const NestedComponent = () => <span>Nested Content</span>;
      
      render(
        <CollapsibleSection id="section1" title="Test" count={1} defaultOpen>
          <NestedComponent />
        </CollapsibleSection>
      );
      expect(screen.getByText('Nested Content')).toBeInTheDocument();
    });
  });
});
