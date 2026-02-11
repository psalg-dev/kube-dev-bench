import { useState, useEffect, useRef } from 'react';
import Select, { components, type SingleValue, type MultiValue, type MenuListProps } from 'react-select';

type SelectOption = { value: string; label: string };

type ContextSelectProps = {
  value?: string;
  options?: string[];
  disabled?: boolean;
  onChange?: (value: string) => void;
  onMenuOpen?: () => void;
};

type NamespaceMultiSelectProps = {
  values?: string[];
  options?: string[];
  disabled?: boolean;
  onChange?: (values: string[]) => void;
  placeholder?: string;
  onMenuOpen?: () => void;
  onAddNamespace?: (name: string) => Promise<boolean> | boolean;
  allowAddNamespace?: boolean;
};

const ADD_NAMESPACE_VALUE = '__add_namespace__';

// Shared dark theme styles matching app look, Material-inspired on GitHub Dark
const baseControl = (base: any, state: any) => ({
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

const baseMenu = (base: any) => ({
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

const baseOption = (base: any, state: any) => ({
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
  container: (b: any) => ({ ...b, fontSize: 14, color: 'var(--gh-text, #c9d1d9)' }),
  control: baseControl,
  valueContainer: (b: any) => ({ ...b, padding: '2px 8px', cursor: 'pointer' }),
  menu: baseMenu,
  menuList: (b: any) => ({ ...b, padding: 6 }),
  option: baseOption,
  placeholder: (b: any) => ({ ...b, color: 'var(--gh-text-secondary, #8b949e)' }),
  input: (b: any) => ({
    ...b,
    color: 'var(--gh-text, #c9d1d9)',
    caretColor: 'transparent',
    userSelect: 'none',
  }),
  singleValue: (b: any) => ({ ...b, color: 'var(--gh-text, #c9d1d9)', userSelect: 'none' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (b: any, state: any) => ({
    ...b,
    color: state.isFocused ? 'var(--gh-accent, #58a6ff)' : 'var(--gh-text-secondary, #8b949e)',
    ':hover': { color: 'var(--gh-accent, #58a6ff)' },
  }),
  // Hide clear button entirely
  clearIndicator: () => ({ display: 'none' }),
};

const multiStyles = {
  ...commonStyles,
  multiValue: (b: any) => ({ ...b, backgroundColor: 'rgba(88,166,255,0.12)', borderRadius: 6 }),
  multiValueLabel: (b: any) => ({ ...b, color: 'var(--gh-text, #c9d1d9)' }),
  multiValueRemove: (b: any) => ({
    ...b,
    color: '#58a6ff',
    ':hover': { backgroundColor: 'rgba(88,166,255,0.25)', color: '#58a6ff' },
  }),
};

type AddNamespaceSelectProps = {
  canAddNamespace: boolean;
  addingNamespace: boolean;
  newNamespace: string;
  onNewNamespaceChange: (value: string) => void;
  onAddConfirm: () => void;
  onAddCancel: () => void;
  addDisabled: boolean;
  addLabel: string;
};

function NamespaceMenuList(props: MenuListProps<SelectOption, true>) {
  const selectProps = props.selectProps as AddNamespaceSelectProps;
  return (
    <components.MenuList {...props}>
      {props.children}
      {selectProps.canAddNamespace && selectProps.addingNamespace && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            borderTop: '1px solid var(--gh-border, #30363d)',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 8,
            alignItems: 'center',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            value={selectProps.newNamespace}
            onChange={(e) => selectProps.onNewNamespaceChange(e.target.value)}
            placeholder="name"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                selectProps.onAddConfirm();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                selectProps.onAddCancel();
              }
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--gh-bg, #0d1117)',
              border: '1px solid var(--gh-border, #30363d)',
              color: 'var(--gh-text, #c9d1d9)',
              borderRadius: 4,
            }}
          />
          <button
            type="button"
            onClick={() => selectProps.onAddConfirm()}
            disabled={selectProps.addDisabled}
            style={{
              padding: '6px 10px',
              background: 'var(--gh-bg-elev, #161b22)',
              color: 'var(--gh-text, #c9d1d9)',
              border: '1px solid var(--gh-border, #30363d)',
              borderRadius: 4,
              cursor: selectProps.addDisabled ? 'not-allowed' : 'pointer',
              opacity: selectProps.addDisabled ? 0.6 : 1,
            }}
          >
            {selectProps.addLabel}
          </button>
        </div>
      )}
    </components.MenuList>
  );
}

export function ContextSelect({ value, options, disabled, onChange, onMenuOpen }: ContextSelectProps) {
  const selectOptions: SelectOption[] = (options || []).map((o) => ({ value: o, label: o }));
  const current = value ? { value, label: value } : null;
  return (
    <Select<SelectOption, false>
      options={selectOptions}
      value={current}
      isDisabled={!!disabled}
      onChange={(opt: SingleValue<SelectOption>) => onChange?.(opt?.value ?? '')}
      placeholder="Select context…"
      styles={commonStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      maxMenuHeight={280}
      instanceId="context-select"
      isClearable={false}
      isSearchable={false}
      classNamePrefix="kdv"
      onMenuOpen={onMenuOpen}
    />
  );
}

export function NamespaceMultiSelect({
  values,
  options,
  disabled,
  onChange,
  placeholder = 'Select namespaces…',
  onMenuOpen,
  onAddNamespace,
  allowAddNamespace,
}: NamespaceMultiSelectProps) {
  const [internal, setInternal] = useState<string[]>(values || []);
  const [addingNamespace, setAddingNamespace] = useState(false);
  const [newNamespace, setNewNamespace] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectRef = useRef<any>(null);

  // Sync when parent updates values prop (controlled usage)
  useEffect(() => { if (Array.isArray(values)) setInternal(values); }, [values]);

  const canAddNamespace = typeof allowAddNamespace === 'boolean'
    ? allowAddNamespace
    : ((options || []).length === 0);
  const selectOptions: SelectOption[] = (options || []).map((o) => ({ value: o, label: o }));
  if (canAddNamespace) {
    selectOptions.push({ value: ADD_NAMESPACE_VALUE, label: 'Add namespace' });
  }

  const current = internal.map((v) => ({ value: v, label: v }));

  function handleChange(opts: MultiValue<SelectOption>) {
    const next = opts.map((o) => o.value);
    if (next.includes(ADD_NAMESPACE_VALUE)) {
      setAddingNamespace(true);
      setMenuOpen(true);
      return;
    }
    setInternal(next);
    onChange?.(next);
  }

  async function handleAddConfirm() {
    if (addingBusy || !onAddNamespace) return;
    const name = newNamespace.trim();
    if (!name) return;
    setMenuOpen(false);
    setAddingNamespace(false);
    setAddingBusy(true);
    try {
      const result = await onAddNamespace(name);
      if (result !== false) {
        setNewNamespace('');
        selectRef.current?.blur();
      }
    } finally {
      setAddingBusy(false);
    }
  }

  function handleAddCancel() {
    setAddingNamespace(false);
    setNewNamespace('');
    setMenuOpen(false);
  }

  const addDisabled = addingBusy || !newNamespace.trim() || !onAddNamespace;

  return (
    <Select<SelectOption, true>
      ref={selectRef}
      isMulti
      options={selectOptions}
      value={current}
      isDisabled={!!disabled}
      onChange={handleChange}
      placeholder={placeholder}
      styles={multiStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      maxMenuHeight={300}
      instanceId="namespace-multi"
      closeMenuOnSelect={false}
      isSearchable={false}
      classNamePrefix="kdv"
      menuIsOpen={menuOpen || addingNamespace}
      canAddNamespace={canAddNamespace}
      addingNamespace={addingNamespace}
      newNamespace={newNamespace}
      onNewNamespaceChange={(value: string) => setNewNamespace(value)}
      onAddConfirm={() => { void handleAddConfirm(); }}
      onAddCancel={handleAddCancel}
      addDisabled={addDisabled}
      addLabel={addingBusy ? 'Creating…' : 'Confirm'}
      onMenuOpen={() => {
        setMenuOpen(true);
        onMenuOpen?.();
      }}
      onMenuClose={() => {
        setMenuOpen(false);
        setAddingNamespace(false);
        setNewNamespace('');
      }}
      components={{ MenuList: NamespaceMenuList }}
    />
  );
}