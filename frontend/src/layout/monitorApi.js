import * as AppAPI from '../../wailsjs/go/main/App';

export function ScanClusterHealth() {
  return AppAPI.ScanClusterHealth();
}

export function AnalyzeMonitorIssue(issueID) {
  return AppAPI.AnalyzeMonitorIssue(issueID);
}

export function AnalyzeAllMonitorIssues() {
  return AppAPI.AnalyzeAllMonitorIssues();
}

export function DismissMonitorIssue(issueID) {
  return AppAPI.DismissMonitorIssue(issueID);
}

export function GetPrometheusAlerts(prometheusURL) {
  return AppAPI.GetPrometheusAlerts(prometheusURL);
}

export function InvestigatePrometheusAlert(alert) {
  return AppAPI.InvestigatePrometheusAlert(alert);
}

export function GetAlertInvestigationHistory() {
  return AppAPI.GetAlertInvestigationHistory();
}
