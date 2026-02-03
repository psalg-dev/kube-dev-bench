/**
 * ServicePlacementTab Component
 * 
 * Displays placement constraints and preferences for a Swarm service.
 */

export default function ServicePlacementTab({ row }) {
  const placement = row?.placement;
  const constraints = Array.isArray(placement?.constraints) ? placement.constraints : [];
  const preferences = Array.isArray(placement?.preferences) ? placement.preferences : [];
  const maxReplicas = placement?.maxReplicas;

  return (
    <div style={{ padding: 16, color: 'var(--gh-text, #c9d1d9)' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Placement</div>
      <div style={{ marginBottom: 12, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
        Placement constraints and preferences from the service spec.
      </div>

      <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', marginBottom: 4 }}>Constraints</div>
          {constraints.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {constraints.map((c) => <li key={c} style={{ marginBottom: 4 }}>{c}</li>)}
            </ul>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>-</div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', marginBottom: 4 }}>Preferences</div>
          {preferences.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {preferences.map((p) => <li key={p} style={{ marginBottom: 4 }}>{p}</li>)}
            </ul>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>-</div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', marginBottom: 4 }}>Max Replicas</div>
          <div style={{ fontSize: 12 }}>{maxReplicas ? String(maxReplicas) : '-'}</div>
        </div>
      </div>
    </div>
  );
}
