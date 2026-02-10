import { useEffect, useMemo, useState } from 'react';
import { useSwarmState } from './SwarmStateContext';
import SwarmMetricsDashboard from './metrics/SwarmMetricsDashboard';
import TopologyView from './topology/TopologyView';
import './swarm-overview.css';

const TAB_METRICS = 'metrics';
const TAB_TOPOLOGY = 'topology';

type SwarmOverviewProps = {
  initialTab?: string;
};

export default function SwarmOverview({ initialTab = TAB_METRICS }: SwarmOverviewProps) {
  const swarm = useSwarmState() as any;
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const headerText = useMemo(() => {
    if (!swarm) return '';
    const parts: string[] = [];
    if (swarm.serverVersion) parts.push(swarm.serverVersion);
    parts.push(swarm.swarmActive ? '(Swarm)' : '(Standalone)');
    return parts.join(' ');
  }, [swarm]);

  return (
    <div className="swarmOverviewRoot" data-testid="swarm-overview">
      <div className="swarmOverviewHeader">
        <div>
          <div className="swarmOverviewTitle">Swarm</div>
          <div className="swarmOverviewMeta">{headerText}</div>
        </div>
        <div className="swarmOverviewTabs" role="tablist" aria-label="Docker Swarm Overview Tabs">
          <button
            id="swarm-overview-tab-metrics"
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_METRICS}
            className={`swarmOverviewTabBtn${activeTab === TAB_METRICS ? ' active' : ''}`}
            onClick={() => setActiveTab(TAB_METRICS)}
          >
            Metrics
          </button>
          <button
            id="swarm-overview-tab-topology"
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_TOPOLOGY}
            className={`swarmOverviewTabBtn${activeTab === TAB_TOPOLOGY ? ' active' : ''}`}
            onClick={() => setActiveTab(TAB_TOPOLOGY)}
          >
            Topology
          </button>
        </div>
      </div>

      <div className="swarmOverviewContent">
        {activeTab === TAB_METRICS ? (
          <SwarmMetricsDashboard />
        ) : null}
        {activeTab === TAB_TOPOLOGY ? (
          <TopologyView />
        ) : null}
      </div>
    </div>
  );
}