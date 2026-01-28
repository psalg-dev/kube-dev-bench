import FormField from './FormField';

export default function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
}) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      htmlFor={id}
    >
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: '#181818',
          border: '1px solid #3c3c3c',
          color: '#fff',
          boxSizing: 'border-box',
        }}
      />
    </FormField>
  );
}
