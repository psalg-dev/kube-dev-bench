/**
 * Tests for BaseModal component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseModal, ModalButton, ModalPrimaryButton, ModalDangerButton } from '../components/BaseModal';

describe('BaseModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(
      <BaseModal isOpen={false} onClose={vi.fn()}>
        Content
      </BaseModal>
    );

    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()}>
        Content
      </BaseModal>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()} title="Test Title">
        Content
      </BaseModal>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should not render header when title is not provided', () => {
    const { container } = render(
      <BaseModal isOpen={true} onClose={vi.fn()}>
        Content
      </BaseModal>
    );

    expect(container.querySelector('.base-modal-header')).not.toBeInTheDocument();
  });

  it('should call onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose}>
        Content
      </BaseModal>
    );

    const overlay = document.querySelector('.base-modal-overlay');
    if (!overlay) throw new Error('Expected modal overlay');
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when modal content is clicked', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose}>
        <button>Test Button</button>
      </BaseModal>
    );

    fireEvent.click(screen.getByText('Test Button'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BaseModal isOpen={true} onClose={onClose} title="Title">
        Content
      </BaseModal>
    );

    fireEvent.click(screen.getByLabelText('Close modal'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should render footer when provided', () => {
    render(
      <BaseModal
        isOpen={true}
        onClose={vi.fn()}
        footer={<button>Save</button>}
      >
        Content
      </BaseModal>
    );

    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should apply custom width', () => {
    const { container } = render(
      <BaseModal isOpen={true} onClose={vi.fn()} width={800}>
        Content
      </BaseModal>
    );

    const modalContainer = container.querySelector('.base-modal-container');
    expect(modalContainer).toHaveStyle({ width: '800px' });
  });

  it('should apply testId to container', () => {
    render(
      <BaseModal isOpen={true} onClose={vi.fn()} testId="test-modal">
        Content
      </BaseModal>
    );

    expect(screen.getByTestId('test-modal')).toBeInTheDocument();
  });

  it('should apply additional className to container', () => {
    const { container } = render(
      <BaseModal isOpen={true} onClose={vi.fn()} className="custom-class">
        Content
      </BaseModal>
    );

    const modalContainer = container.querySelector('.base-modal-container');
    expect(modalContainer).toHaveClass('custom-class');
  });
});

describe('ModalButton', () => {
  it('should render with default variant', () => {
    render(<ModalButton>Click me</ModalButton>);

    const button = screen.getByText('Click me');
    expect(button).toHaveClass('base-modal-btn');
    expect(button).not.toHaveClass('base-modal-btn-primary');
    expect(button).not.toHaveClass('base-modal-btn-danger');
  });

  it('should handle click events', () => {
    const onClick = vi.fn();
    render(<ModalButton onClick={onClick}>Click me</ModalButton>);

    fireEvent.click(screen.getByText('Click me'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should support disabled state', () => {
    render(<ModalButton disabled>Click me</ModalButton>);

    expect(screen.getByText('Click me')).toBeDisabled();
  });

  it('should apply additional className', () => {
    render(<ModalButton className="extra-class">Click me</ModalButton>);

    expect(screen.getByText('Click me')).toHaveClass('extra-class');
  });
});

describe('ModalPrimaryButton', () => {
  it('should render with primary variant', () => {
    render(<ModalPrimaryButton>Save</ModalPrimaryButton>);

    const button = screen.getByText('Save');
    expect(button).toHaveClass('base-modal-btn');
    expect(button).toHaveClass('base-modal-btn-primary');
  });

  it('should handle click events', () => {
    const onClick = vi.fn();
    render(<ModalPrimaryButton onClick={onClick}>Save</ModalPrimaryButton>);

    fireEvent.click(screen.getByText('Save'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ModalDangerButton', () => {
  it('should render with danger variant', () => {
    render(<ModalDangerButton>Delete</ModalDangerButton>);

    const button = screen.getByText('Delete');
    expect(button).toHaveClass('base-modal-btn');
    expect(button).toHaveClass('base-modal-btn-danger');
  });

  it('should handle click events', () => {
    const onClick = vi.fn();
    render(<ModalDangerButton onClick={onClick}>Delete</ModalDangerButton>);

    fireEvent.click(screen.getByText('Delete'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});