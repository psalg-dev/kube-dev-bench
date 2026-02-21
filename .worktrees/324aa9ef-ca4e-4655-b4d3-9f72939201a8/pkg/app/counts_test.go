package app

import (
	"testing"
)

func TestResourceCountsEqual_BothEmpty(t *testing.T) {
	a := ResourceCounts{}
	b := ResourceCounts{}

	if !resourceCountsEqual(a, b) {
		t.Error("Expected empty counts to be equal")
	}
}

func TestResourceCountsEqual_SameValues(t *testing.T) {
	a := ResourceCounts{
		PodStatus: PodStatusCounts{
			Running:   5,
			Pending:   2,
			Failed:    1,
			Succeeded: 3,
			Unknown:   0,
			Total:     11,
		},
		Deployments:            10,
		Jobs:                   5,
		CronJobs:               3,
		DaemonSets:             2,
		StatefulSets:           1,
		ReplicaSets:            4,
		ConfigMaps:             8,
		Secrets:                6,
		Ingresses:              2,
		PersistentVolumeClaims: 3,
		PersistentVolumes:      4,
		Roles:                  2,
		ClusterRoles:           1,
		RoleBindings:           3,
		ClusterRoleBindings:    1,
	}

	b := ResourceCounts{
		PodStatus: PodStatusCounts{
			Running:   5,
			Pending:   2,
			Failed:    1,
			Succeeded: 3,
			Unknown:   0,
			Total:     11,
		},
		Deployments:            10,
		Jobs:                   5,
		CronJobs:               3,
		DaemonSets:             2,
		StatefulSets:           1,
		ReplicaSets:            4,
		ConfigMaps:             8,
		Secrets:                6,
		Ingresses:              2,
		PersistentVolumeClaims: 3,
		PersistentVolumes:      4,
		Roles:                  2,
		ClusterRoles:           1,
		RoleBindings:           3,
		ClusterRoleBindings:    1,
	}

	if !resourceCountsEqual(a, b) {
		t.Error("Expected identical counts to be equal")
	}
}

func TestResourceCountsEqual_DifferentPodStatus(t *testing.T) {
	a := ResourceCounts{
		PodStatus: PodStatusCounts{Running: 5},
	}
	b := ResourceCounts{
		PodStatus: PodStatusCounts{Running: 3},
	}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different pod status to be unequal")
	}
}

func TestResourceCountsEqual_DifferentDeployments(t *testing.T) {
	a := ResourceCounts{Deployments: 10}
	b := ResourceCounts{Deployments: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different deployments to be unequal")
	}
}

func TestResourceCountsEqual_DifferentJobs(t *testing.T) {
	a := ResourceCounts{Jobs: 10}
	b := ResourceCounts{Jobs: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different jobs to be unequal")
	}
}

func TestResourceCountsEqual_DifferentCronJobs(t *testing.T) {
	a := ResourceCounts{CronJobs: 10}
	b := ResourceCounts{CronJobs: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different cronjobs to be unequal")
	}
}

func TestResourceCountsEqual_DifferentDaemonSets(t *testing.T) {
	a := ResourceCounts{DaemonSets: 10}
	b := ResourceCounts{DaemonSets: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different daemonsets to be unequal")
	}
}

func TestResourceCountsEqual_DifferentStatefulSets(t *testing.T) {
	a := ResourceCounts{StatefulSets: 10}
	b := ResourceCounts{StatefulSets: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different statefulsets to be unequal")
	}
}

func TestResourceCountsEqual_DifferentReplicaSets(t *testing.T) {
	a := ResourceCounts{ReplicaSets: 10}
	b := ResourceCounts{ReplicaSets: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different replicasets to be unequal")
	}
}

func TestResourceCountsEqual_DifferentConfigMaps(t *testing.T) {
	a := ResourceCounts{ConfigMaps: 10}
	b := ResourceCounts{ConfigMaps: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different configmaps to be unequal")
	}
}

func TestResourceCountsEqual_DifferentSecrets(t *testing.T) {
	a := ResourceCounts{Secrets: 10}
	b := ResourceCounts{Secrets: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different secrets to be unequal")
	}
}

func TestResourceCountsEqual_DifferentIngresses(t *testing.T) {
	a := ResourceCounts{Ingresses: 10}
	b := ResourceCounts{Ingresses: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different ingresses to be unequal")
	}
}

func TestResourceCountsEqual_DifferentPVCs(t *testing.T) {
	a := ResourceCounts{PersistentVolumeClaims: 10}
	b := ResourceCounts{PersistentVolumeClaims: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different PVCs to be unequal")
	}
}

func TestResourceCountsEqual_DifferentPVs(t *testing.T) {
	a := ResourceCounts{PersistentVolumes: 10}
	b := ResourceCounts{PersistentVolumes: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different PVs to be unequal")
	}
}

func TestResourceCountsEqual_DifferentRoles(t *testing.T) {
	a := ResourceCounts{Roles: 2}
	b := ResourceCounts{Roles: 3}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different roles to be unequal")
	}
}

func TestResourceCountsEqual_DifferentClusterRoles(t *testing.T) {
	a := ResourceCounts{ClusterRoles: 2}
	b := ResourceCounts{ClusterRoles: 3}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different cluster roles to be unequal")
	}
}

func TestResourceCountsEqual_DifferentRoleBindings(t *testing.T) {
	a := ResourceCounts{RoleBindings: 2}
	b := ResourceCounts{RoleBindings: 3}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different role bindings to be unequal")
	}
}

func TestResourceCountsEqual_DifferentClusterRoleBindings(t *testing.T) {
	a := ResourceCounts{ClusterRoleBindings: 2}
	b := ResourceCounts{ClusterRoleBindings: 3}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different cluster role bindings to be unequal")
	}
}

func TestResourceCountsEqual_AllPodStatusFields(t *testing.T) {
	tests := []struct {
		name string
		a    PodStatusCounts
		b    PodStatusCounts
	}{
		{"different Pending", PodStatusCounts{Pending: 1}, PodStatusCounts{Pending: 2}},
		{"different Failed", PodStatusCounts{Failed: 1}, PodStatusCounts{Failed: 2}},
		{"different Succeeded", PodStatusCounts{Succeeded: 1}, PodStatusCounts{Succeeded: 2}},
		{"different Unknown", PodStatusCounts{Unknown: 1}, PodStatusCounts{Unknown: 2}},
		{"different Total", PodStatusCounts{Total: 1}, PodStatusCounts{Total: 2}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			a := ResourceCounts{PodStatus: tc.a}
			b := ResourceCounts{PodStatus: tc.b}
			if resourceCountsEqual(a, b) {
				t.Error("Expected counts with different pod status to be unequal")
			}
		})
	}
}

// Tests for GetResourceCounts function
func TestGetResourceCounts(t *testing.T) {
	app := &App{
		lastResourceCounts: ResourceCounts{
			PodStatus: PodStatusCounts{
				Running: 10,
				Pending: 2,
				Total:   12,
			},
			Deployments: 5,
			Jobs:        3,
		},
	}

	result := app.GetResourceCounts()

	if result.Deployments != 5 {
		t.Errorf("expected 5 deployments, got %d", result.Deployments)
	}
	if result.Jobs != 3 {
		t.Errorf("expected 3 jobs, got %d", result.Jobs)
	}
	if result.PodStatus.Running != 10 {
		t.Errorf("expected 10 running pods, got %d", result.PodStatus.Running)
	}
}

// Tests for GetResourceCounts concurrency safety
func TestGetResourceCounts_Concurrency(t *testing.T) {
	app := &App{
		lastResourceCounts: ResourceCounts{
			Deployments: 1,
		},
	}

	// Read from multiple goroutines
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func() {
			_ = app.GetResourceCounts()
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

// Tests for GetResourceCounts returns copy
func TestGetResourceCounts_ReturnsCopy(t *testing.T) {
	app := &App{
		lastResourceCounts: ResourceCounts{
			Deployments: 5,
		},
	}

	result := app.GetResourceCounts()
	result.Deployments = 100 // Modify returned copy

	// Original should be unchanged
	if app.lastResourceCounts.Deployments != 5 {
		t.Error("GetResourceCounts should return a copy, not a reference")
	}
}
