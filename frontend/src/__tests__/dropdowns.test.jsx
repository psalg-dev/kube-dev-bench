import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-select with a simplified component capturing props
vi.mock('react-select', () => {
  return {
    __esModule: true,
    default: ({
      options,
      value,
      isMulti,
      placeholder,
      onChange,
      onMenuOpen,
      isDisabled,
    }) => (
      <div>
        <button
          disabled={isDisabled}
          data-testid="select-toggle"
          onClick={() => onMenuOpen && onMenuOpen()}
        >
          {placeholder}
        </button>
        <div data-testid="select-value">
          {isMulti
            ? (value || []).map((v) => v.label).join(',')
            : value
              ? value.label
              : ''}
        </div>
        <ul data-testid="options">
          {(options || []).map((o) => (
            <li key={o.value}>
              <button
                onClick={() => {
                  if (isMulti) {
                    const current = value || [];
                    const exists = current.find((c) => c.value === o.value);
                    const next = exists
                      ? current.filter((c) => c.value !== o.value)
                      : [...current, o];
                    onChange && onChange(next);
                  } else {
                    onChange && onChange(o);
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

import { ContextSelect, NamespaceMultiSelect } from '../Dropdowns.jsx';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Dropdowns', () => {
  it('ContextSelect passes selected value', () => {
    const onChange = vi.fn();
    render(
      <ContextSelect
        value="ctx2"
        options={['ctx1', 'ctx2']}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('select-value').textContent).toBe('ctx2');
    // select ctx1
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
      />,
    );
    // currently ns1
    expect(screen.getByTestId('select-value').textContent).toBe('ns1');
    // add ns2
    fireEvent.click(screen.getAllByRole('button', { name: 'ns2' })[0]);
    expect(onChange).toHaveBeenLastCalledWith(['ns1', 'ns2']);
    // remove ns1
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
