import React from 'react';
import './HolmesResourceButton.css';

export default function HolmesResourceButton({ onClick, loading = false, disabled = false, label = 'Ask Holmes' }) {
  return (
    <button
      type="button"
      className="holmes-resource-button"
      onClick={onClick}
      disabled={disabled || loading}
      title={label}
    >
      <span className="holmes-resource-button-icon" aria-hidden="true">🧠</span>
      <span>{label}</span>
    </button>
  );
}
