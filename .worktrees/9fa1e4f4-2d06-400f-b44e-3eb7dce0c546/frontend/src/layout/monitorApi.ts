import * as AppAPI from '../../wailsjs/go/main/App';
import { app } from '../../wailsjs/go/models';

export function ScanClusterHealth() {
  return AppAPI.ScanClusterHealth();
}

export function AnalyzeMonitorIssue(issueID: string) {
  return AppAPI.AnalyzeMonitorIssue(issueID);
}

export function AnalyzeAllMonitorIssues() {
  return AppAPI.AnalyzeAllMonitorIssues();
}

export function DismissMonitorIssue(issueID: string) {
  return AppAPI.DismissMonitorIssue(issueID);
}

export function GetPrometheusAlerts(prometheusURL: string) {
  return AppAPI.GetPrometheusAlerts(prometheusURL);
}

export function InvestigatePrometheusAlert(alert: app.PrometheusAlert | Record<string, unknown>) {
  const payload = alert instanceof app.PrometheusAlert
    ? alert
    : app.PrometheusAlert.createFrom(alert);
  return AppAPI.InvestigatePrometheusAlert(payload);
}

export function GetAlertInvestigationHistory() {
  return AppAPI.GetAlertInvestigationHistory();
}
