import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfigDataSection from '../docker/resources/configs/ConfigDataSection';

type ConfigDataTabProps = {
  configId?: string;
  configName?: string;
};

// Mock ConfigDataTab
vi.mock('../docker/resources/configs/ConfigDataTab', () => ({
  default: ({ configId, configName }: ConfigDataTabProps) => (
    <div data-testid="config-data-tab">
      <span data-testid="config-id">{configId}</span>
      <span data-testid="config-name">{configName}</span>
    </div>
  ),
}));

describe('ConfigDataSection', () => {
  it('renders Config Data header', () => {
    render(<ConfigDataSection configId="cfg-123" configName="my-config" />);

    expect(screen.getByText('Config Data')).toBeInTheDocument();
  });

  it('renders ConfigDataTab with correct props', () => {
    render(<ConfigDataSection configId="cfg-123" configName="my-config" />);

    expect(screen.getByTestId('config-data-tab')).toBeInTheDocument();
    expect(screen.getByTestId('config-id').textContent).toBe('cfg-123');
    expect(screen.getByTestId('config-name').textContent).toBe('my-config');
  });

  it('passes configId prop to ConfigDataTab', () => {
    render(<ConfigDataSection configId="test-config-id" configName="test" />);

    expect(screen.getByTestId('config-id').textContent).toBe('test-config-id');
  });

  it('passes configName prop to ConfigDataTab', () => {
    render(<ConfigDataSection configId="test" configName="test-config-name" />);

    expect(screen.getByTestId('config-name').textContent).toBe('test-config-name');
  });
});
