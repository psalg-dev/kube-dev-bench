import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SelectOption = { label: string; value: string };
type MockSelectProps = {
  options?: SelectOption[];
  value?: SelectOption | SelectOption[] | null;
  isMulti?: boolean;
  placeholder?: string;
  onChange?: (_value: SelectOption | SelectOption[] | null) => void;
  onMenuOpen?: () => void;
  isDisabled?: boolean;
};
// Mock react-select with a simplified component capturing props
vi.mock('react-select', () => {
  return {
    __esModule: true,
    default: ({ options, value, isMulti, placeholder, onChange, onMenuOpen, isDisabled }: MockSelectProps) => (
      <div>
        <button
          disabled={isDisabled}
          data-testid="select-toggle"
          onClick={() => {
            if (onMenuOpen) {
              onMenuOpen();
            }
          }}
        >
          {placeholder}
        </button>
        <div data-testid="select-value">
          {isMulti
            ? ((value || []) as SelectOption[]).map((v) => v.label).join(',')
            : value
              ? (value as SelectOption).label
              : ''}
        </div>
        <ul data-testid="options">
          {(options || []).map((o: SelectOption) => (
            <li key={o.value}>
              <button
                onClick={() => {
                  if (isMulti) {
                    const current = (value || []) as SelectOption[];
                    const exists = current.find((c: SelectOption) => c.value === o.value);
                    const next = exists
                      ? current.filter((c: SelectOption) => c.value !== o.value)
                      : [...current, o];
                    if (onChange) {
                      onChange(next);
                    }
                  } else {
                    if (onChange) {
                      onChange(o);
                    }
                  }
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ),
  };
});

import { ContextSelect, NamespaceMultiSelect } from '../Dropdowns';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Dropdowns', () => {
  it('ContextSelect passes selected value', () => {
    const onChange = vi.fn();
    render(
      <ContextSelect value="ctx2" options={['ctx1', 'ctx2']} onChange={onChange} />
    );
    expect(screen.getByTestId('select-value').textContent).toBe('ctx2');
    fireEvent.click(screen.getAllByRole('button', { name: 'ctx1' })[0]);
    expect(onChange).toHaveBeenCalledWith('ctx1');
  });

  it('NamespaceMultiSelect toggles multi values', () => {
    const onChange = vi.fn();
    render(
      <NamespaceMultiSelect
        values={['ns1']}
        options={['ns1', 'ns2', 'ns3']}
        onChange={onChange}
      />
    );
    expect(screen.getByTestId('select-value').textContent).toBe('ns1');
    fireEvent.click(screen.getAllByRole('button', { name: 'ns2' })[0]);
    expect(onChange).toHaveBeenLastCalledWith(['ns1', 'ns2']);
    fireEvent.click(screen.getAllByRole('button', { name: 'ns1' })[0]);
    expect(onChange).toHaveBeenLastCalledWith(['ns2']);
  });

  it('calls onMenuOpen when menu opened', () => {
    const onMenuOpen = vi.fn();
    render(<ContextSelect options={['a']} onMenuOpen={onMenuOpen} />);
    fireEvent.click(screen.getByTestId('select-toggle'));
    expect(onMenuOpen).toHaveBeenCalled();
  });
});
