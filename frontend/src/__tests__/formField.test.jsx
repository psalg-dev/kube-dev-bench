import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormField from '../components/forms/FormField';

describe('FormField', () => {
  describe('label rendering', () => {
    it('renders label when provided', () => {
      render(
        <FormField label="Username">
          <input />
        </FormField>
      );
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('does not render label when not provided', () => {
      const { container } = render(
        <FormField>
          <input />
        </FormField>
      );
      expect(container.querySelector('label')).not.toBeInTheDocument();
    });

    it('renders label with asterisk when required is true', () => {
      render(
        <FormField label="Email" required>
          <input />
        </FormField>
      );
      expect(screen.getByText('Email *')).toBeInTheDocument();
    });

    it('renders label without asterisk when required is false', () => {
      render(
        <FormField label="Optional Field" required={false}>
          <input />
        </FormField>
      );
      expect(screen.getByText('Optional Field')).toBeInTheDocument();
      expect(screen.queryByText('Optional Field *')).not.toBeInTheDocument();
    });

    it('associates label with input using htmlFor', () => {
      render(
        <FormField label="Username" htmlFor="username-input">
          <input id="username-input" />
        </FormField>
      );
      const label = screen.getByText('Username');
      expect(label).toHaveAttribute('for', 'username-input');
    });

    it('associates label with input using id when htmlFor not provided', () => {
      render(
        <FormField label="Username" id="username-field">
          <input id="username-field" />
        </FormField>
      );
      const label = screen.getByText('Username');
      expect(label).toHaveAttribute('for', 'username-field');
    });

    it('prefers htmlFor over id when both provided', () => {
      render(
        <FormField label="Username" htmlFor="html-for-id" id="id-value">
          <input id="html-for-id" />
        </FormField>
      );
      const label = screen.getByText('Username');
      expect(label).toHaveAttribute('for', 'html-for-id');
    });
  });

  describe('children rendering', () => {
    it('renders children', () => {
      render(
        <FormField>
          <input data-testid="test-input" />
        </FormField>
      );
      expect(screen.getByTestId('test-input')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <FormField>
          <input data-testid="input-1" />
          <input data-testid="input-2" />
        </FormField>
      );
      expect(screen.getByTestId('input-1')).toBeInTheDocument();
      expect(screen.getByTestId('input-2')).toBeInTheDocument();
    });
  });

  describe('error rendering', () => {
    it('renders error message when provided', () => {
      render(
        <FormField error="This field is required">
          <input />
        </FormField>
      );
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('does not render error when not provided', () => {
      const { container } = render(
        <FormField>
          <input />
        </FormField>
      );
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
    });

    it('renders error with alert role', () => {
      render(
        <FormField error="Invalid input">
          <input />
        </FormField>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid input');
    });

    it('does not render error when error is empty string', () => {
      const { container } = render(
        <FormField error="">
          <input />
        </FormField>
      );
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
    });
  });

  describe('full component integration', () => {
    it('renders complete form field with all props', () => {
      render(
        <FormField 
          label="Email Address" 
          required 
          error="Invalid email format"
          htmlFor="email-input"
        >
          <input id="email-input" type="email" />
        </FormField>
      );
      
      expect(screen.getByText('Email Address *')).toBeInTheDocument();
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders form field with label and children only', () => {
      render(
        <FormField label="Description">
          <textarea data-testid="textarea" />
        </FormField>
      );
      
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByTestId('textarea')).toBeInTheDocument();
    });
  });
});
