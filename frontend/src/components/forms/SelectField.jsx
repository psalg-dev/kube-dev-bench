import React from 'react';
import FormField from './FormField';

export default function SelectField({ id, label, value, onChange, options, required, error }) {
  return (
    <FormField id={id} label={label} required={required} error={error} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
      >
        {(options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FormField>
  );
}
