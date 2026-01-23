package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gowails/pkg/app/holmesgpt"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const monitorIssuesFileName = "monitor_issues.json"
const dismissedIssueTTL = 24 * time.Hour

// PersistedIssue stores persisted analysis and dismissal state for a monitor issue.
type PersistedIssue struct {
	IssueID          string    `json:"issueID"`
	Dismissed        bool      `json:"dismissed"`
	DismissedAt      time.Time `json:"dismissedAt"`
	HolmesAnalysis   string    `json:"holmesAnalysis"`
	HolmesAnalyzedAt time.Time `json:"holmesAnalyzedAt"`
}

func generateIssueID(issue MonitorIssue) string {
	return fmt.Sprintf("%s-%s-%s-%s", issue.Resource, issue.Namespace, issue.Name, issue.Reason)
}

func monitorIssuesPath() (string, error) {
	if override := os.Getenv("KDB_MONITOR_ISSUES_PATH"); override != "" {
		return override, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "KubeDevBench", monitorIssuesFileName), nil
}

func loadPersistedIssues() (map[string]PersistedIssue, error) {
	path, err := monitorIssuesPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return map[string]PersistedIssue{}, nil
		}
		return nil, err
	}
	if len(data) == 0 {
		return map[string]PersistedIssue{}, nil
	}
	var issues map[string]PersistedIssue
	if err := json.Unmarshal(data, &issues); err != nil {
		return nil, err
	}
	if issues == nil {
		issues = map[string]PersistedIssue{}
	}
	return issues, nil
}

func savePersistedIssues(issues map[string]PersistedIssue) error {
	path, err := monitorIssuesPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(issues, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func cleanupExpiredIssues(issues map[string]PersistedIssue, now time.Time) (bool, map[string]PersistedIssue) {
	changed := false
	for id, persisted := range issues {
		if persisted.Dismissed && !persisted.DismissedAt.IsZero() {
			if now.Sub(persisted.DismissedAt) > dismissedIssueTTL {
				delete(issues, id)
				changed = true
			}
		}
	}
	return changed, issues
}

func mergePersistedIntoIssue(issue MonitorIssue, persisted PersistedIssue) MonitorIssue {
	issue.Dismissed = persisted.Dismissed
	issue.DismissedAt = persisted.DismissedAt
	issue.HolmesAnalysis = persisted.HolmesAnalysis
	issue.HolmesAnalyzedAt = persisted.HolmesAnalyzedAt
	issue.HolmesAnalyzed = persisted.HolmesAnalysis != "" || !persisted.HolmesAnalyzedAt.IsZero()
	return issue
}

func (a *App) enrichMonitorInfo(info MonitorInfo) MonitorInfo {
	persisted, err := loadPersistedIssues()
	if err != nil {
		for i := range info.Warnings {
			info.Warnings[i].IssueID = generateIssueID(info.Warnings[i])
		}
		for i := range info.Errors {
			info.Errors[i].IssueID = generateIssueID(info.Errors[i])
		}
		return info
	}
	now := time.Now()
	changed, persisted := cleanupExpiredIssues(persisted, now)
	if changed {
		_ = savePersistedIssues(persisted)
	}

	warnings := make([]MonitorIssue, 0, len(info.Warnings))
	for _, issue := range info.Warnings {
		issue.IssueID = generateIssueID(issue)
		if persistedIssue, ok := persisted[issue.IssueID]; ok {
			if persistedIssue.Dismissed && !persistedIssue.DismissedAt.IsZero() && now.Sub(persistedIssue.DismissedAt) <= dismissedIssueTTL {
				continue
			}
			issue = mergePersistedIntoIssue(issue, persistedIssue)
		}
		warnings = append(warnings, issue)
	}

	errors := make([]MonitorIssue, 0, len(info.Errors))
	for _, issue := range info.Errors {
		issue.IssueID = generateIssueID(issue)
		if persistedIssue, ok := persisted[issue.IssueID]; ok {
			if persistedIssue.Dismissed && !persistedIssue.DismissedAt.IsZero() && now.Sub(persistedIssue.DismissedAt) <= dismissedIssueTTL {
				continue
			}
			issue = mergePersistedIntoIssue(issue, persistedIssue)
		}
		errors = append(errors, issue)
	}

	info.Warnings = warnings
	info.Errors = errors
	info.WarningCount = len(warnings)
	info.ErrorCount = len(errors)
	return info
}

// ScanClusterHealth performs a deep scan across all namespaces.
func (a *App) ScanClusterHealth() (MonitorInfo, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return MonitorInfo{}, err
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	nsList, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return MonitorInfo{}, err
	}

	var warnings []MonitorIssue
	var errors []MonitorIssue

	for _, ns := range nsList.Items {
		nsName := ns.Name
		podIssues := a.checkPodIssues(nsName)
		for _, issue := range podIssues {
			if issue.Type == "error" {
				errors = append(errors, issue)
			} else {
				warnings = append(warnings, issue)
			}
		}

		eventIssues := a.checkEventIssues(nsName)
		for _, issue := range eventIssues {
			if issue.Type == "error" {
				errors = append(errors, issue)
			} else {
				warnings = append(warnings, issue)
			}
		}

		deployments, _ := clientset.AppsV1().Deployments(nsName).List(ctx, metav1.ListOptions{})
		for _, deploy := range deployments.Items {
			desired := int32(1)
			if deploy.Spec.Replicas != nil {
				desired = *deploy.Spec.Replicas
			}
			if deploy.Status.ReadyReplicas < desired {
				issues := MonitorIssue{
					Type:      "warning",
					Resource:  "Deployment",
					Namespace: nsName,
					Name:      deploy.Name,
					Reason:    "UnavailableReplicas",
					Message:   fmt.Sprintf("Ready replicas %d/%d", deploy.Status.ReadyReplicas, desired),
					Age:       formatAge(deploy.CreationTimestamp.Time),
				}
				warnings = append(warnings, issues)
			}
		}

		statefulSets, _ := clientset.AppsV1().StatefulSets(nsName).List(ctx, metav1.ListOptions{})
		for _, sts := range statefulSets.Items {
			desired := int32(1)
			if sts.Spec.Replicas != nil {
				desired = *sts.Spec.Replicas
			}
			if sts.Status.ReadyReplicas < desired {
				warnings = append(warnings, MonitorIssue{
					Type:      "warning",
					Resource:  "StatefulSet",
					Namespace: nsName,
					Name:      sts.Name,
					Reason:    "UnavailableReplicas",
					Message:   fmt.Sprintf("Ready replicas %d/%d", sts.Status.ReadyReplicas, desired),
					Age:       formatAge(sts.CreationTimestamp.Time),
				})
			}
		}

		daemonSets, _ := clientset.AppsV1().DaemonSets(nsName).List(ctx, metav1.ListOptions{})
		for _, ds := range daemonSets.Items {
			if ds.Status.NumberReady < ds.Status.DesiredNumberScheduled {
				warnings = append(warnings, MonitorIssue{
					Type:      "warning",
					Resource:  "DaemonSet",
					Namespace: nsName,
					Name:      ds.Name,
					Reason:    "UnavailablePods",
					Message:   fmt.Sprintf("Ready %d/%d", ds.Status.NumberReady, ds.Status.DesiredNumberScheduled),
					Age:       formatAge(ds.CreationTimestamp.Time),
				})
			}
		}

		quotas, _ := clientset.CoreV1().ResourceQuotas(nsName).List(ctx, metav1.ListOptions{})
		for _, quota := range quotas.Items {
			for resourceName, hard := range quota.Status.Hard {
				used, ok := quota.Status.Used[resourceName]
				if !ok {
					continue
				}
				if used.Cmp(hard) >= 0 {
					warnings = append(warnings, MonitorIssue{
						Type:      "warning",
						Resource:  "ResourceQuota",
						Namespace: nsName,
						Name:      quota.Name,
						Reason:    "QuotaExceeded",
						Message:   fmt.Sprintf("%s usage %s/%s", resourceName, used.String(), hard.String()),
						Age:       formatAge(quota.CreationTimestamp.Time),
					})
				}
			}
		}
	}

	nodes, _ := clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	for _, node := range nodes.Items {
		age := formatAge(node.CreationTimestamp.Time)
		for _, cond := range node.Status.Conditions {
			reason := string(cond.Type)
			message := cond.Message
			if cond.Type == v1.NodeReady && cond.Status != v1.ConditionTrue {
				errors = append(errors, MonitorIssue{
					Type:      "error",
					Resource:  "Node",
					Namespace: "",
					Name:      node.Name,
					Reason:    "NotReady",
					Message:   message,
					Age:       age,
				})
			} else if strings.Contains(string(cond.Type), "Pressure") && cond.Status == v1.ConditionTrue {
				warnings = append(warnings, MonitorIssue{
					Type:      "warning",
					Resource:  "Node",
					Namespace: "",
					Name:      node.Name,
					Reason:    reason,
					Message:   message,
					Age:       age,
				})
			}
		}
	}

	pvs, _ := clientset.CoreV1().PersistentVolumes().List(ctx, metav1.ListOptions{})
	for _, pv := range pvs.Items {
		age := formatAge(pv.CreationTimestamp.Time)
		switch pv.Status.Phase {
		case v1.VolumeFailed:
			errors = append(errors, MonitorIssue{
				Type:     "error",
				Resource: "PersistentVolume",
				Name:     pv.Name,
				Reason:   "VolumeFailed",
				Message:  pv.Status.Message,
				Age:      age,
			})
		case v1.VolumePending:
			warnings = append(warnings, MonitorIssue{
				Type:     "warning",
				Resource: "PersistentVolume",
				Name:     pv.Name,
				Reason:   "VolumePending",
				Message:  pv.Status.Message,
				Age:      age,
			})
		}
	}

	info := MonitorInfo{
		WarningCount: len(warnings),
		ErrorCount:   len(errors),
		Warnings:     warnings,
		Errors:       errors,
	}
	return a.enrichMonitorInfo(info), nil
}

func (a *App) AnalyzeMonitorIssue(issueID string) (*MonitorIssue, error) {
	if issueID == "" {
		return nil, fmt.Errorf("issueID required")
	}

	nsList := a.preferredNamespaces
	if len(nsList) == 0 && a.currentNamespace != "" {
		nsList = []string{a.currentNamespace}
	}
	if len(nsList) == 0 {
		return nil, fmt.Errorf("no namespaces selected")
	}

	info := a.collectMonitorInfo(nsList)
	var found *MonitorIssue
	for _, issue := range append(info.Errors, info.Warnings...) {
		if issue.IssueID == issueID {
			copy := issue
			found = &copy
			break
		}
	}
	if found == nil {
		return nil, fmt.Errorf("issue not found")
	}

	contextText := ""
	switch strings.ToLower(found.Resource) {
	case "pod", "pods":
		ctx, err := a.getPodContext(found.Namespace, found.Name)
		if err == nil {
			contextText = ctx
		}
	case "deployment", "deployments":
		ctx, err := a.getDeploymentContext(found.Namespace, found.Name)
		if err == nil {
			contextText = ctx
		}
	case "statefulset", "statefulsets":
		ctx, err := a.getStatefulSetContext(found.Namespace, found.Name)
		if err == nil {
			contextText = ctx
		}
	case "daemonset", "daemonsets":
		ctx, err := a.getDaemonSetContext(found.Namespace, found.Name)
		if err == nil {
			contextText = ctx
		}
	}

	question := fmt.Sprintf("Analyze this monitoring issue and provide likely cause, impact, and remediation steps.\n\nIssue:\nResource: %s\nNamespace: %s\nName: %s\nReason: %s\nMessage: %s\nContainer: %s\nRestarts: %d\n\nContext:\n%s", found.Resource, found.Namespace, found.Name, found.Reason, found.Message, found.ContainerName, found.RestartCount, contextText)

	resp, err := a.AskHolmes(question)
	if err != nil {
		return nil, err
	}

	analysis := ""
	if resp != nil {
		analysis = resp.Response
		if analysis == "" {
			analysis = resp.Analysis
		}
		if analysis == "" {
			analysis = resp.Response
		}
	}

	found.HolmesAnalysis = analysis
	found.HolmesAnalyzed = analysis != ""
	found.HolmesAnalyzedAt = time.Now()

	persisted, err := loadPersistedIssues()
	if err != nil {
		return nil, err
	}
	persistedIssue := persisted[found.IssueID]
	persistedIssue.IssueID = found.IssueID
	persistedIssue.HolmesAnalysis = found.HolmesAnalysis
	persistedIssue.HolmesAnalyzedAt = found.HolmesAnalyzedAt
	if persistedIssue.Dismissed {
		persistedIssue.DismissedAt = persistedIssue.DismissedAt
	}
	persisted[found.IssueID] = persistedIssue
	if err := savePersistedIssues(persisted); err != nil {
		return nil, err
	}

	if a.ctx != nil {
		emitEvent(a.ctx, "holmes:analysis:update", found)
		emitEvent(a.ctx, "monitor:update", a.collectMonitorInfo(nsList))
	}

	return found, nil
}

func (a *App) AnalyzeAllMonitorIssues() error {
	nsList := a.preferredNamespaces
	if len(nsList) == 0 && a.currentNamespace != "" {
		nsList = []string{a.currentNamespace}
	}
	if len(nsList) == 0 {
		return fmt.Errorf("no namespaces selected")
	}

	info := a.collectMonitorInfo(nsList)
	issues := append([]MonitorIssue{}, info.Errors...)
	issues = append(issues, info.Warnings...)

	total := len(issues)
	for i, issue := range issues {
		_ = issue
		_, _ = a.AnalyzeMonitorIssue(issue.IssueID)
		if a.ctx != nil {
			emitEvent(a.ctx, "holmes:analysis:progress", map[string]int{
				"total":     total,
				"completed": i + 1,
			})
		}
	}
	return nil
}

func (a *App) DismissMonitorIssue(issueID string) error {
	if issueID == "" {
		return fmt.Errorf("issueID required")
	}
	persisted, err := loadPersistedIssues()
	if err != nil {
		return err
	}
	entry := persisted[issueID]
	entry.IssueID = issueID
	entry.Dismissed = true
	entry.DismissedAt = time.Now()
	persisted[issueID] = entry
	if err := savePersistedIssues(persisted); err != nil {
		return err
	}
	if a.ctx != nil {
		nsList := a.preferredNamespaces
		if len(nsList) == 0 && a.currentNamespace != "" {
			nsList = []string{a.currentNamespace}
		}
		info := a.collectMonitorInfo(nsList)
		emitEvent(a.ctx, "monitor:update", info)
	}
	return nil
}

func (a *App) GetDismissedIssues() ([]MonitorIssue, error) {
	persisted, err := loadPersistedIssues()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	_, persisted = cleanupExpiredIssues(persisted, now)
	issues := make([]MonitorIssue, 0, len(persisted))
	for _, p := range persisted {
		if p.Dismissed && !p.DismissedAt.IsZero() && now.Sub(p.DismissedAt) <= dismissedIssueTTL {
			issues = append(issues, MonitorIssue{
				IssueID:          p.IssueID,
				Dismissed:        p.Dismissed,
				DismissedAt:      p.DismissedAt,
				HolmesAnalysis:   p.HolmesAnalysis,
				HolmesAnalyzedAt: p.HolmesAnalyzedAt,
				HolmesAnalyzed:   p.HolmesAnalysis != "" || !p.HolmesAnalyzedAt.IsZero(),
			})
		}
	}
	sort.Slice(issues, func(i, j int) bool {
		return issues[i].DismissedAt.After(issues[j].DismissedAt)
	})
	return issues, nil
}

func (a *App) AnalyzeMonitorIssueStream(issueID, streamID string) error {
	if issueID == "" || streamID == "" {
		return fmt.Errorf("issueID and streamID required")
	}

	nsList := a.preferredNamespaces
	if len(nsList) == 0 && a.currentNamespace != "" {
		nsList = []string{a.currentNamespace}
	}
	if len(nsList) == 0 {
		return fmt.Errorf("no namespaces selected")
	}

	info := a.collectMonitorInfo(nsList)
	var found *MonitorIssue
	for _, issue := range append(info.Errors, info.Warnings...) {
		if issue.IssueID == issueID {
			copy := issue
			found = &copy
			break
		}
	}
	if found == nil {
		return fmt.Errorf("issue not found")
	}

	contextText := ""
	switch strings.ToLower(found.Resource) {
	case "pod", "pods":
		ctx, err := a.getPodContext(found.Namespace, found.Name)
		if err == nil {
			contextText = ctx
		}
	case "deployment", "deployments":
		ctx, err := a.getDeploymentContext(found.Namespace, found.Name)
		if err == nil {
			contextText = ctx
		}
	case "statefulset", "statefulsets":
		ctx, err := a.getStatefulSetContext(found.Namespace, found.Name)
		if err == nil {
			contextText = ctx
		}
	case "daemonset", "daemonsets":
		ctx, err := a.getDaemonSetContext(found.Namespace, found.Name)
		if err == nil {
			contextText = ctx
		}
	}

	question := fmt.Sprintf("Analyze this monitoring issue and provide likely cause, impact, and remediation steps.\n\nIssue:\nResource: %s\nNamespace: %s\nName: %s\nReason: %s\nMessage: %s\nContainer: %s\nRestarts: %d\n\nContext:\n%s", found.Resource, found.Namespace, found.Name, found.Reason, found.Message, found.ContainerName, found.RestartCount, contextText)

	return a.AskHolmesStream(question, streamID)
}

func (a *App) SaveMonitorIssueAnalysis(issueID string, response *holmesgpt.HolmesResponse) error {
	if issueID == "" || response == nil {
		return fmt.Errorf("invalid input")
	}
	analysis := response.Response
	if analysis == "" {
		analysis = response.Analysis
	}
	if analysis == "" {
		analysis = response.Response
	}

	persisted, err := loadPersistedIssues()
	if err != nil {
		return err
	}
	entry := persisted[issueID]
	entry.IssueID = issueID
	entry.HolmesAnalysis = analysis
	entry.HolmesAnalyzedAt = time.Now()
	persisted[issueID] = entry
	if err := savePersistedIssues(persisted); err != nil {
		return err
	}
	return nil
}
