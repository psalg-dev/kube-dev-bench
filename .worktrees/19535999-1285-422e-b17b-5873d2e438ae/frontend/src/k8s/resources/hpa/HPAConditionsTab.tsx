import type { app } from '../../../../wailsjs/go/models';

type HPAConditionsTabProps = {
  hpa: app.HorizontalPodAutoscalerInfo;
};

export default function HPAConditionsTab({ hpa }: HPAConditionsTabProps) {
  const isUnderProvisioned = (hpa.desiredReplicas || 0) > (hpa.currentReplicas || 0);
  const isOverProvisioned = (hpa.desiredReplicas || 0) < (hpa.currentReplicas || 0);
  const scalingState = isUnderProvisioned ? 'Scaling up' : isOverProvisioned ? 'Scaling down' : 'Stable';

  return (
    <div style={{ padding: 12, display: 'grid', gap: 8 }}>
      <div><strong>Scaling State:</strong> {scalingState}</div>
      <div><strong>Current Replicas:</strong> {hpa.currentReplicas ?? 0}</div>
      <div><strong>Desired Replicas:</strong> {hpa.desiredReplicas ?? 0}</div>
      <div><strong>Range:</strong> min {hpa.minReplicas ?? 0}, max {hpa.maxReplicas ?? 0}</div>
      <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>
        For detailed condition transitions and controller reasons, use the Holmes tab and Events tab.
      </div>
    </div>
  );
}
