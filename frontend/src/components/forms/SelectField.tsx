import FormField from './FormField';

type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  required?: boolean;
  error?: string;
};

export default function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  required,
  error,
}: SelectFieldProps) {
  return (
    <FormField id={id} label={label} required={required} error={error} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: '#181818',
          border: '1px solid #3c3c3c',
          color: '#fff',
          boxSizing: 'border-box',
        }}
      >
        {(options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
