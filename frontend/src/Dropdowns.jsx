import React from 'react';
import Select from 'react-select';

// Shared dark theme styles matching app look, Material-inspired on GitHub Dark
const baseControl = (base, state) => ({
  ...base,
  backgroundColor: 'var(--gh-bg, #0d1117)',
  borderColor: (state.isFocused || state.menuIsOpen)
    ? 'var(--gh-accent, #58a6ff)'
    : 'var(--gh-border, #30363d)',
  boxShadow: state.isFocused ? '0 0 0 2px rgba(56,139,253,0.3)' : 'none',
  minHeight: 40,
  borderWidth: 1,
  borderRadius: 6,
  outline: 'none',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
  ':hover': { borderColor: 'var(--gh-accent, #58a6ff)' },
  // When menu is open, visually connect control with menu
  borderBottomLeftRadius: state.menuIsOpen ? 0 : 6,
  borderBottomRightRadius: state.menuIsOpen ? 0 : 6,
  borderBottomColor: state.menuIsOpen ? 'transparent' : (state.isFocused ? 'var(--gh-accent, #58a6ff)' : 'var(--gh-border, #30363d)'),
  cursor: state.isDisabled ? 'not-allowed' : 'pointer',
});

const baseMenu = (base) => ({
  ...base,
  backgroundColor: 'var(--gh-bg-elev, #161b22)',
  border: '1px solid var(--gh-border, #30363d)',
  // Attach to control: remove gap and top border, square top corners
  marginTop: 0,
  borderTop: 'none',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: 6,
  borderBottomRightRadius: 6,
  boxShadow: '0 8px 24px rgba(1,4,9,0.6)',
  zIndex: 9999,
});

const baseOption = (base, state) => ({
  ...base,
  backgroundColor: state.isSelected
    ? 'rgba(88,166,255,0.25)'
    : state.isFocused
      ? 'rgba(88,166,255,0.12)'
      : 'transparent',
  color: 'var(--gh-text, #c9d1d9)',
  cursor: 'pointer',
  paddingTop: 8,
  paddingBottom: 8,
  paddingLeft: 12,
  paddingRight: 12,
});

const commonStyles = {
  container: (b) => ({ ...b, fontSize: 14, color: 'var(--gh-text, #c9d1d9)' }),
  control: baseControl,
  valueContainer: (b) => ({ ...b, padding: '2px 8px', cursor: 'pointer' }),
  menu: baseMenu,
  menuList: (b) => ({ ...b, padding: 6 }),
  option: baseOption,
  placeholder: (b) => ({ ...b, color: 'var(--gh-text-secondary, #8b949e)' }),
  input: (b) => ({
    ...b,
    color: 'var(--gh-text, #c9d1d9)',
    caretColor: 'transparent',
    userSelect: 'none',
  }),
  singleValue: (b) => ({ ...b, color: 'var(--gh-text, #c9d1d9)', userSelect: 'none' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (b, state) => ({
    ...b,
    color: state.isFocused ? 'var(--gh-accent, #58a6ff)' : 'var(--gh-text-secondary, #8b949e)',
    ':hover': { color: 'var(--gh-accent, #58a6ff)' },
  }),
  // Hide clear button entirely
  clearIndicator: () => ({ display: 'none' }),
};

const multiStyles = {
  ...commonStyles,
  multiValue: (b) => ({ ...b, backgroundColor: 'rgba(88,166,255,0.12)', borderRadius: 6 }),
  multiValueLabel: (b) => ({ ...b, color: 'var(--gh-text, #c9d1d9)' }),
  multiValueRemove: (b) => ({
    ...b,
    color: '#58a6ff',
    ':hover': { backgroundColor: 'rgba(88,166,255,0.25)', color: '#58a6ff' },
  }),
};

export function ContextSelect({ value, options, disabled, onChange }) {
  const selectOptions = (options || []).map((o) => ({ value: o, label: o }));
  const current = value ? { value, label: value } : null;
  return (
    <Select
      options={selectOptions}
      value={current}
      isDisabled={!!disabled}
      onChange={(opt) => onChange?.(opt?.value ?? '')}
      placeholder="Select context…"
      styles={commonStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      maxMenuHeight={280}
      instanceId="context-select"
      isClearable={false}
      isSearchable={false}
      classNamePrefix="kdv"
    />
  );
}

export function NamespaceMultiSelect({ values, options, disabled, onChange, placeholder = 'Select namespaces…' }) {
  const selectOptions = (options || []).map((o) => ({ value: o, label: o }));
  const current = (values || []).map((v) => ({ value: v, label: v }));
  return (
    <Select
      isMulti
      options={selectOptions}
      value={current}
      isDisabled={!!disabled}
      onChange={(opts) => onChange?.((opts || []).map((o) => o.value))}
      placeholder={placeholder}
      styles={multiStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      maxMenuHeight={300}
      instanceId="namespace-multi"
      closeMenuOnSelect={false}
      isSearchable={false}
      classNamePrefix="kdv"
    />
  );
}
