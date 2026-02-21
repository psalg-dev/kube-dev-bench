import type { app } from '../../../../wailsjs/go/models';

type HPATargetTabProps = {
  hpa: app.HorizontalPodAutoscalerInfo;
};

export default function HPATargetTab({ hpa }: HPATargetTabProps) {
  return (
    <div style={{ padding: 12, display: 'grid', gap: 8 }}>
      <div><strong>Target Kind:</strong> {hpa.targetKind || '-'}</div>
      <div><strong>Target Name:</strong> {hpa.targetName || '-'}</div>
      <div><strong>Replica Bounds:</strong> min {hpa.minReplicas ?? 0}, max {hpa.maxReplicas ?? 0}</div>
      <div><strong>Current / Desired:</strong> {hpa.currentReplicas ?? 0} / {hpa.desiredReplicas ?? 0}</div>
    </div>
  );
}
