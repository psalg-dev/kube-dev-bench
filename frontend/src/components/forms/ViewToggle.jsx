export default function ViewToggle({ mode, onChange }) {
  const baseBtn = {
    padding: '6px 10px',
    background: 'transparent',
    color: '#fff',
    border: '1px solid #30363d',
    borderRadius: 0,
    cursor: 'pointer',
    fontSize: 12,
  };

  const activeBtn = {
    ...baseBtn,
    border: '1px solid #2ea44f',
  };

  return (
    <div
      id="swarm-view-toggle"
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
    >
      <button
        id="swarm-view-form-btn"
        type="button"
        onClick={() => onChange('form')}
        aria-pressed={mode === 'form'}
        style={mode === 'form' ? activeBtn : baseBtn}
      >
        Form
      </button>
      <button
        id="swarm-view-yaml-btn"
        type="button"
        onClick={() => onChange('yaml')}
        aria-pressed={mode === 'yaml'}
        style={mode === 'yaml' ? activeBtn : baseBtn}
      >
        YAML
      </button>
    </div>
  );
}
