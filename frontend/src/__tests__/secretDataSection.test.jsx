import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecretDataSection from '../docker/resources/secrets/SecretDataSection';

describe('SecretDataSection', () => {
  it('renders Secret Data header', () => {
    render(<SecretDataSection />);

    expect(screen.getByText('Secret Data')).toBeInTheDocument();
  });

  it('displays encrypted message title', () => {
    render(<SecretDataSection />);

    expect(screen.getByText('Secret data is encrypted')).toBeInTheDocument();
  });

  it('displays security explanation', () => {
    render(<SecretDataSection />);

    expect(
      screen.getByText(/Docker Swarm secrets cannot be read back/),
    ).toBeInTheDocument();
    expect(screen.getByText(/security feature/)).toBeInTheDocument();
  });

  it('displays lock icon', () => {
    render(<SecretDataSection />);

    expect(screen.getByText('🔒')).toBeInTheDocument();
  });

  it('displays tip about Edit or Rotate buttons', () => {
    render(<SecretDataSection />);

    expect(screen.getByText(/Edit or Rotate buttons/)).toBeInTheDocument();
  });
});
