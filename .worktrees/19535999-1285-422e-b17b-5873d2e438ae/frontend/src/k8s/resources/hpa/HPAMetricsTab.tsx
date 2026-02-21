import type { app } from '../../../../wailsjs/go/models';

type HPAMetricsTabProps = {
  hpa: app.HorizontalPodAutoscalerInfo;
};

export default function HPAMetricsTab({ hpa }: HPAMetricsTabProps) {
  return (
    <div style={{ padding: 12, display: 'grid', gap: 10 }}>
      <div>
        <strong>CPU</strong>
        <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
          <div>Target: {hpa.targetCPU || '-'}</div>
          <div>Current: {hpa.currentCPU || '-'}</div>
        </div>
      </div>
      <div>
        <strong>Memory</strong>
        <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
          <div>Target: {hpa.targetMemory || '-'}</div>
          <div>Current: {hpa.currentMemory || '-'}</div>
        </div>
      </div>
    </div>
  );
}
