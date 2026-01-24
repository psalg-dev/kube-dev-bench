export default function FormField({ label, required, error, children, htmlFor, id }) {
  return (
    <div style={{ minWidth: 0 }}>
      {label && (
        <label
          htmlFor={htmlFor || id}
          style={{ fontSize: 12, color: '#bbb', marginBottom: 6, display: 'block' }}
        >
          {label}{required ? ' *' : ''}
        </label>
      )}
      {children}
      {error ? (
        <div style={{ marginTop: 6, fontSize: 12, color: '#f85149' }} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
