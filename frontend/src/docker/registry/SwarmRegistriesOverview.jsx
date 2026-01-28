import { useCallback, useEffect, useMemo, useState } from 'react';
import { GetRegistries, RemoveRegistry } from '../swarmApi.js';
import { useSwarmResourceCounts } from '../SwarmResourceCountsContext.jsx';
import { showError, showSuccess } from '../../notification.js';
import AddRegistryModal from './AddRegistryModal.jsx';
import RegistryBrowser from './RegistryBrowser.jsx';
import BottomPanel from '../../layout/bottompanel/BottomPanel.jsx';
import './registry.css';
import '../../layout/overview/OverviewTableWithPanel.css';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../utils/tableSorting.js';

function formatType(type) {
  if (type === 'dockerhub') return 'Docker Hub';
  if (type === 'generic_v2') return 'Generic v2';
  if (type === 'ecr') return 'ECR';
  return String(type || '').trim() || '-';
}

export default function SwarmRegistriesOverview() {
  const [registries, setRegistries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedRegistry, setSelectedRegistry] = useState('');
  const [bottomOpen, setBottomOpen] = useState(false);

  const swarmCounts = useSwarmResourceCounts();

  const loadRegistries = useCallback(async () => {
    setLoading(true);
    try {
      const items = await GetRegistries();
      const list = Array.isArray(items) ? items : [];
      setRegistries(list);
      if (selectedRegistry && !list.find((r) => r?.name === selectedRegistry)) {
        setSelectedRegistry('');
      }
    } catch (e) {
      showError(`Failed to load registries: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [selectedRegistry]);

  useEffect(() => {
    loadRegistries();
    // Also refresh sidebar count on entry.
    swarmCounts?.refetch?.({ forceRegistries: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return (Array.isArray(registries) ? registries : []).map((r) => {
      const name = r?.name || '';
      return {
        name,
        type: r?.type,
        url: r?.url,
      };
    });
  }, [registries]);

  const columns = useMemo(() => ([
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'url', label: 'URL' },
  ]), []);
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({ key: defaultSortKey, direction: 'asc' }));
  const sortedRows = useMemo(() => sortRows(rows, sortState.key, sortState.direction), [rows, sortState]);

  const selectedRegistryType = useMemo(() => {
    if (!selectedRegistry) return '';
    const r = rows.find((x) => x?.name === selectedRegistry);
    return String(r?.type || '');
  }, [rows, selectedRegistry]);

  const closeBottomPanel = () => {
    setBottomOpen(false);
    setSelectedRegistry('');
  };

  useEffect(() => {
    if (!bottomOpen) return;

    const handleClick = (e) => {
      // Don't close if click is within bottom panel or resize handle
      if (
        e.target.closest('.bottom-panel') ||
        e.target.closest('[data-resizing]') ||
        document.body.style.cursor === 'ns-resize'
      ) {
        return;
      }
      closeBottomPanel();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeBottomPanel();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [bottomOpen]);

  const handleRemove = async (name) => {
    if (!name) return;
    const ok = window.confirm(`Remove registry '${name}'?`);
    if (!ok) return;

    try {
      await RemoveRegistry(name);
      showSuccess(`Removed registry ${name}`);
      await loadRegistries();
      swarmCounts?.refetch?.({ forceRegistries: true });

      if (selectedRegistry === name) {
        closeBottomPanel();
      }
    } catch (e) {
      showError(`Failed to remove registry: ${e}`);
    }
  };

  return (
    <div className="registry-overview" data-testid="swarm-registries-table">
      <div className="overview-header">
        <div className="overview-left">
          <button
            id="swarm-registries-add-btn"
            onClick={() => setShowAdd(true)}
            className="overview-create-btn"
            aria-label="Add registry"
            title="Add registry"
          >
            +
          </button>
        </div>
        <h2 className="overview-title">Registries</h2>
        <div className="overview-actions" />
      </div>

      <table className="gh-table registry-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th aria-sort={sortState.key === 'name' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" className="sortable-header" onClick={() => setSortState((cur) => toggleSortState(cur, 'name'))}>
                <span>Name</span>
                <span className="sortable-indicator" aria-hidden="true">{sortState.key === 'name' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
            <th aria-sort={sortState.key === 'type' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" className="sortable-header" onClick={() => setSortState((cur) => toggleSortState(cur, 'type'))}>
                <span>Type</span>
                <span className="sortable-indicator" aria-hidden="true">{sortState.key === 'type' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
            <th aria-sort={sortState.key === 'url' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" className="sortable-header" onClick={() => setSortState((cur) => toggleSortState(cur, 'url'))}>
                <span>URL</span>
                <span className="sortable-indicator" aria-hidden="true">{sortState.key === 'url' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={3} className="main-panel-loading">Loading…</td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="main-panel-loading">No registries configured.</td>
            </tr>
          ) : (
            sortedRows.map((r) => (
              <tr
                key={r.name || r.url}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (!r?.name) return;
                  setSelectedRegistry(r.name);
                  setBottomOpen(true);
                }}
              >
                <td>{r.name}</td>
                <td>{formatType(r.type)}</td>
                <td>{r.url || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <BottomPanel
        open={bottomOpen}
        onClose={closeBottomPanel}
        tabs={[{ key: 'browse', label: 'Browse', content: null }]}
        activeTab="browse"
        onTabChange={() => {}}
        headerRight={selectedRegistry ? (
          <button
            className="registry-action-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemove(selectedRegistry);
            }}
            title="Remove registry"
          >
            Remove
          </button>
        ) : null}
      >
        {selectedRegistry ? (
          <RegistryBrowser registryName={selectedRegistry} registryType={selectedRegistryType} />
        ) : null}
      </BottomPanel>

      <AddRegistryModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={async () => {
          await loadRegistries();
          swarmCounts?.refetch?.({ forceRegistries: true });
        }}
      />
    </div>
  );
}
