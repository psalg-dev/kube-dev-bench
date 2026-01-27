import { useEffect, useMemo, useState } from 'react';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import EmptyTabContent from '../../../components/EmptyTabContent.jsx';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages.js';
import { GetSwarmNodeTasks, GetSwarmTaskLogs } from '../../swarmApi.js';

function pickBestTask(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const withContainer = list.filter((t) => t?.id && t?.containerId);
  const running = withContainer.find((t) => String(t.state || '').toLowerCase() === 'running');
  return running || withContainer[0] || null;
}

export default function NodeLogsTab({ nodeId, nodeName }) {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingTasks(true);
    setTasksError('');

    (async () => {
      try {
        const data = await GetSwarmNodeTasks(nodeId);
        if (!active) return;
        setTasks(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!active) return;
        setTasks([]);
        setTasksError(e?.message || String(e));
      } finally {
        if (active) setLoadingTasks(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [nodeId]);

  const selectedTask = useMemo(() => pickBestTask(tasks), [tasks]);

  if (loadingTasks) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Loading node tasks...
      </div>
    );
  }

  if (tasksError) {
    return (
      <div style={{ padding: 32, color: 'var(--gh-text, #c9d1d9)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Node Logs</div>
        <div style={{ color: 'var(--gh-text-secondary)' }}>
          Unable to load node tasks. Node logs fallback requires tasks.
        </div>
        <div style={{ marginTop: 12, color: 'var(--gh-text-secondary)' }}>Error: {tasksError}</div>
      </div>
    );
  }

  if (!selectedTask) {
    const emptyMsg = getEmptyTabMessage('swarm-node-logs');
    return (
      <div style={{ padding: 32 }}>
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
      </div>
    );
  }

  const title = `Node Logs (task fallback: ${selectedTask.serviceName || selectedTask.serviceId?.slice(0, 12) || 'service'} / ${selectedTask.id?.slice(0, 12) || 'task'})`;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--gh-border, #30363d)' }}>
        <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)' }}>Node Logs</div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
          Node: {nodeName || nodeId}. Showing task logs as a fallback.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <AggregateLogsTab
          title={title}
          reloadKey={`${nodeId}:${selectedTask.id}`}
          loadLogs={() => GetSwarmTaskLogs(selectedTask.id, '200')}
        />
      </div>
    </div>
  );
}
