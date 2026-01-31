import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import PersistentVolumeClaimYamlTab from './PersistentVolumeClaimYamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import FilesTab from '../../../layout/bottompanel/FilesTab.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import PVCBoundPVTab from './PVCBoundPVTab.jsx';
import PVCConsumersTab from './PVCConsumersTab.jsx';
import { showSuccess, showError } from '../../../notification';
import { AnalyzePersistentVolumeClaimStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';
import { useResourceData } from '../../../hooks/useResourceData';

export default function PersistentVolumeClaimsOverviewTable({ namespaces, onPVCCreate }) {
  const { state: holmesState, analyze: analyzePersistentVolumeClaim, cancel: cancelHolmesAnalysis } = useHolmesAnalysis({
    kind: 'PersistentVolumeClaim',
    analyzeFn: AnalyzePersistentVolumeClaimStream,
  });

  const { data: pvcs, loading } = useResourceData({
    fetchFn: AppAPI.GetPersistentVolumeClaims,
    eventName: 'pvc:update',
    namespaces,
    normalize: (i) => ({
      name: i.name ?? i.Name,
      namespace: i.namespace ?? i.Namespace,
      status: i.status ?? i.Status ?? '-',
      storage: i.storage ?? i.Storage ?? '-',
      accessModes: Array.isArray(i.accessModes ?? i.AccessModes) ? (i.accessModes ?? i.AccessModes).join(', ') : '-',
      volumeName: i.volumeName ?? i.VolumeName ?? '-',
      age: i.age ?? i.Age ?? '-',
      labels: i.labels ?? i.Labels ?? i.metadata?.labels ?? {}
    }),
  });

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'status', label: 'Status' },
    { key: 'storage', label: 'Storage' },
    { key: 'accessModes', label: 'Access Modes' },
    { key: 'volumeName', label: 'Volume' },
    { key: 'age', label: 'Age' }
  ];

  const bottomTabs = [
    { key: 'summary', label: 'Summary', countable: false },
    { key: 'boundpv', label: 'Bound PV', countable: false },
    { key: 'consumers', label: 'Consumers', countKey: 'consumers' },
    { key: 'events', label: 'Events', countKey: 'events' },
    { key: 'yaml', label: 'YAML', countable: false },
    { key: 'files', label: 'Files', countable: false },
    { key: 'holmes', label: 'Holmes', countable: false },
  ];

  function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
    if (tab === 'summary') {
      const quickInfoFields = [
        {
          key: 'status',
          label: 'Status',
          type: 'status',
          layout: 'flex',
          rightField: {
            key: 'age',
            label: 'Age',
            type: 'age',
            getValue: (data) => data.created || data.age
          }
        },
        { key: 'namespace', label: 'Namespace' },
        { key: 'storage', label: 'Storage' },
        { key: 'accessModes', label: 'Access Modes' },
        { key: 'volumeName', label: 'Volume Name' },
        { key: 'name', label: 'PVC name', type: 'break-word' }
      ];

      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="pvc" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource('pvc', ns, n);}} />} />
          {/* Main content */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
            <QuickInfoSection
              resourceName={row.name}
              data={row}
              loading={false}
              error={null}
              fields={quickInfoFields}
            />
            {/* Event History at a glance */}
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <ResourceEventsTab namespace={row.namespace} resourceKind="PersistentVolumeClaim" resourceName={row.name} limit={20} />
            </div>
          </div>
        </div>
      );
    }
    if (tab === 'yaml') {
      return <PersistentVolumeClaimYamlTab namespace={row.namespace} name={row.name} />;
    }
    if (tab === 'events') {
      return <ResourceEventsTab namespace={row.namespace} resourceKind="PersistentVolumeClaim" resourceName={row.name} />;
    }
    if (tab === 'boundpv') {
      return <PVCBoundPVTab namespace={row.namespace} pvcName={row.name} pvName={row.volumeName} />;
    }
    if (tab === 'consumers') {
      return <PVCConsumersTab namespace={row.namespace} pvcName={row.name} />;
    }
    if (tab === 'files') {
      return <FilesTab namespace={row.namespace} pvcName={row.name} />;
    }
    if (tab === 'holmes') {
      const key = `${row.namespace}/${row.name}`;
      return (
        <HolmesBottomPanel
          kind="PersistentVolumeClaim"
          namespace={row.namespace}
          name={row.name}
          onAnalyze={() => onAnalyze(row)}
          onCancel={holmesState.key === key && holmesState.streamId ? onCancel : null}
          response={holmesState.key === key ? holmesState.response : null}
          loading={holmesState.key === key && holmesState.loading}
          error={holmesState.key === key ? holmesState.error : null}
          queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
          streamingText={holmesState.key === key ? holmesState.streamingText : ''}
          reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
          toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
          contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
        />
      );
    }
    return null;
  }

  function panelHeader(row) {
    return <span style={{ fontWeight: 600 }}>{row.name}</span>;
  }

  const getRowActions = (row, api) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      {
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyzePersistentVolumeClaim(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('pvc', row.namespace, row.name);
            showSuccess(`PVC '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete PVC '${row.name}': ${err?.message || err}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      title="Persistent Volume Claims"
      columns={columns}
      data={pvcs}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzePersistentVolumeClaim, cancelHolmesAnalysis)}
      panelHeader={panelHeader}
      resourceKind="persistentvolumeclaim"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
      onCreateResource={onPVCCreate}
      getRowActions={getRowActions}
    />
  );
}
