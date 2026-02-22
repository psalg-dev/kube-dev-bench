import type { ReactNode } from 'react';

type FormFieldProps = {
  label?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  id?: string;
};

export default function FormField({ label, required, error, children, htmlFor, id }: FormFieldProps) {
  return (
    <div style={{ minWidth: 0 }}>
      {label && (
        <label
          htmlFor={htmlFor || id}
          style={{ fontSize: 12, color: '#858585', marginBottom: 6, display: 'block' }}
        >
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      {children}
      {error ? (
        <div style={{ marginTop: 6, fontSize: 12, color: '#f14c4c' }} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
