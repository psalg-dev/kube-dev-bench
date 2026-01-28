import { Link } from 'react-router-dom';
import { useSwarmResourceCounts } from './SwarmResourceCountsContext.jsx';

// Docker Swarm resource sections
const swarmSections = [
  { key: 'swarm-overview', label: 'Swarm' },
  { key: 'swarm-services', label: 'Services', countKey: 'services' },
  { key: 'swarm-tasks', label: 'Tasks', countKey: 'tasks' },
  { key: 'swarm-nodes', label: 'Nodes', countKey: 'nodes' },
  { key: 'swarm-stacks', label: 'Stacks', countKey: 'stacks' },
  { key: 'swarm-networks', label: 'Networks', countKey: 'networks' },
  { key: 'swarm-configs', label: 'Configs', countKey: 'configs' },
  { key: 'swarm-secrets', label: 'Secrets', countKey: 'secrets' },
  { key: 'swarm-volumes', label: 'Volumes', countKey: 'volumes' },
  { key: 'swarm-registries', label: 'Registries', countKey: 'registries' },
];

export function SwarmSidebarSections({ selected, onSelect }) {
  const { counts, registriesCount } = useSwarmResourceCounts();

  return (
    <div>
      {swarmSections.map((sec) => {
        const isSel = selected === sec.key;
        const commonStyle = {
          padding: '8px 16px',
          cursor: 'pointer',
          color: 'var(--gh-table-header-text, #fff)',
          fontSize: 15,
          margin: 0,
          borderRadius: 4,
          transition: 'background 0.15s',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'space-between',
        };
        const hasCount = Boolean(sec.countKey);
        const value =
          sec.countKey === 'registries'
            ? registriesCount
            : counts?.[sec.countKey];
        const isNumber = typeof value === 'number';
        return (
          <Link
            key={sec.key}
            to={`/${sec.key}`}
            id={`section-${sec.key}`}
            className={`sidebar-section${isSel ? ' selected' : ''}`}
            style={{ ...commonStyle, textDecoration: 'none' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(sec.key);
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{sec.label}</span>
            </span>
            {hasCount ? (
              <span
                style={{
                  minWidth: '2em',
                  textAlign: 'right',
                  color: isNumber && value > 0 ? '#8ecfff' : '#9aa0a6',
                  fontWeight: 700,
                }}
              >
                {isNumber ? value : '-'}
              </span>
            ) : (
              <span style={{ minWidth: '2em' }} />
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default SwarmSidebarSections;
