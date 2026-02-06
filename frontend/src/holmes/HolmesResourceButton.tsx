import './HolmesResourceButton.css';

type HolmesResourceButtonProps = {
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  prominent?: boolean;
};

export default function HolmesResourceButton({ onClick, loading = false, disabled = false, label = 'Ask Holmes', prominent = false }: HolmesResourceButtonProps) {
  return (
    <button
      type="button"
      className={`holmes-resource-button${prominent ? ' holmes-resource-button-prominent' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      title={label}
    >
      <span className="holmes-resource-button-icon" aria-hidden="true">🧠</span>
      <span>{label}</span>
    </button>
  );
}