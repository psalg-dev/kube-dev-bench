import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';

function KeyValueGrid({ data, emptyLabel, emptyMessageKey }) {
  const keys = data ? Object.keys(data) : [];
  if (!data || keys.length === 0) {
    if (emptyMessageKey) {
      const emptyMsg = getEmptyTabMessage(emptyMessageKey);
      return (
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
      );
    }
    return <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>{emptyLabel}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {keys
        .slice()
        .sort((a, b) => String(a).localeCompare(String(b)))
        .map((k) => (
          <div
            key={k}
            style={{
              padding: '6px 8px',
              border: '1px solid var(--gh-border, #30363d)',
              background: 'var(--gh-input-bg, #0d1117)',
              color: 'var(--gh-text, #c9d1d9)',
              fontFamily: 'monospace',
              fontSize: 12,
              wordBreak: 'break-word',
            }}
          >
            {k}={String(data[k])}
          </div>
        ))}
    </div>
  );
}

export function NetworkOptionsSection({ options }) {
  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>
        Options
      </div>
      <KeyValueGrid data={options} emptyLabel="No options." emptyMessageKey="swarm-options" />
    </div>
  );
}

export function NetworkIPAMSection({ ipam }) {
  const list = Array.isArray(ipam) ? ipam : [];
  const emptyMsg = getEmptyTabMessage('swarm-ipam');

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>
        IPAM
      </div>

      {list.length === 0 ? (
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map((cfg, idx) => (
            <div
              key={idx}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--gh-border, #30363d)',
                background: 'var(--gh-input-bg, #0d1117)',
                color: 'var(--gh-text, #c9d1d9)',
                fontFamily: 'monospace',
                fontSize: 12,
                wordBreak: 'break-word',
                display: 'grid',
                gap: 6,
              }}
            >
              <div>
                subnet {cfg?.subnet || '-'} · gateway {cfg?.gateway || '-'} · ipRange {cfg?.ipRange || '-'}
              </div>
              <div>
                <span style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>aux addresses</span>
              </div>
              <KeyValueGrid data={cfg?.auxAddresses || {}} emptyLabel="(none)" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
