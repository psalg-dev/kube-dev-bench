import type { app } from '../../../../wailsjs/go/models';

type NodeConditionsTabProps = {
  node?: app.NodeInfo | null;
};

type NodeCondition = {
  type?: string;
  status?: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
};

export default function NodeConditionsTab({ node }: NodeConditionsTabProps) {
  const raw = (node as unknown as { raw?: { status?: { conditions?: NodeCondition[] } } })?.raw;
  const conditions = Array.isArray(raw?.status?.conditions) ? raw.status.conditions : [];

  if (conditions.length === 0) {
    return <div style={{ padding: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>No node conditions available.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Type</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Reason</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Message</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map((condition, index) => (
            <tr key={`${condition.type || 'condition'}-${index}`}>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{condition.type || '-'}</td>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{condition.status || '-'}</td>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{condition.reason || '-'}</td>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{condition.message || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
