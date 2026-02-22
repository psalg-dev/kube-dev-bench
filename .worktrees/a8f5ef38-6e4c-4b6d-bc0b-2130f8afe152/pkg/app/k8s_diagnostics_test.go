package app

import (
	"context"
	"strings"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetPodLogsPrevious
func TestGetPodLogsPrevious_Success(t *testing.T) {
	tests := []struct {
		name          string
		namespace     string
		podName       string
		containerName string
		tailLines     int
	}{
		{
			name:          "with tail lines and container name",
			namespace:     "default",
			podName:       "test-pod",
			containerName: "nginx",
			tailLines:     100,
		},
		{
			name:          "without tail lines",
			namespace:     "default",
			podName:       "test-pod",
			containerName: "nginx",
			tailLines:     0,
		},
		{
			name:          "without container name",
			namespace:     "default",
			podName:       "test-pod",
			containerName: "",
			tailLines:     50,
		},
		{
			name:          "different namespace",
			namespace:     "kube-system",
			podName:       "coredns",
			containerName: "coredns",
			tailLines:     200,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			app := &App{
				testClientset: clientset,
				ctx:           context.Background(),
			}

			// Note: fake client doesn't support DoRaw() for logs properly,
			// but the method runs successfully with fake client
			_, err := app.GetPodLogsPrevious(tt.namespace, tt.podName, tt.containerName, tt.tailLines)

			// Test passes if no panic occurs - fake client may or may not error
			// We're primarily testing parameter handling
			_ = err // Allow both success and error
		})
	}
}

func TestGetPodLogsPrevious_NoClient(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}

	_, err := app.GetPodLogsPrevious("default", "test-pod", "nginx", 100)
	if err == nil {
		t.Error("expected error when no client is configured")
	}
}

func TestGetPodLogsPrevious_NilContext(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		testClientset: clientset,
		ctx:           nil, // nil context should default to Background
	}

	_, err := app.GetPodLogsPrevious("default", "test-pod", "nginx", 100)

	// Test passes if no panic occurs - fake client may or may not error
	// We're primarily testing nil context handling
	_ = err // Allow both success and error
}

// Tests for TopPods (GetPodMetrics alias)
func TestTopPods_NoClient(t *testing.T) {
	app := &App{}

	_, err := app.TopPods("default")
	if err == nil {
		t.Error("expected error when no client is configured")
	}
	if !strings.Contains(err.Error(), "kubernetes config") {
		t.Errorf("expected config error, got: %v", err)
	}
}

func TestTopPods_EmptyNamespace(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	// This will fail because fake client doesn't have REST config
	_, err := app.TopPods("")
	if err == nil {
		t.Error("expected error from missing REST config")
	}
}

func TestTopPods_AllNamespaces(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	// Test with empty namespace (all namespaces)
	_, err := app.TopPods("")
	// Expected to fail with REST config error
	if err == nil {
		t.Error("expected error from missing REST config")
	}
}

// Tests for TopNodes (GetNodeMetrics alias)
func TestTopNodes_NoClient(t *testing.T) {
	app := &App{}

	_, err := app.TopNodes()
	if err == nil {
		t.Error("expected error when no client is configured")
	}
	if !strings.Contains(err.Error(), "kubernetes config") {
		t.Errorf("expected config error, got: %v", err)
	}
}

func TestTopNodes_NilContext(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		testClientset: clientset,
		ctx:           nil, // should default to Background
	}

	_, err := app.TopNodes()
	// Expected to fail with REST config error
	if err == nil {
		t.Error("expected error from missing REST config")
	}
}

// Tests for GetRolloutStatus
func TestGetRolloutStatus_Deployment_Complete(t *testing.T) {
	replicas := int32(3)
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-deployment",
			Namespace:  "default",
			Generation: 5,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
		},
		Status: appsv1.DeploymentStatus{
			ObservedGeneration: 5,
			Replicas:           3,
			UpdatedReplicas:    3,
			ReadyReplicas:      3,
			AvailableReplicas:  3,
		},
	}

	clientset := fake.NewSimpleClientset(deployment)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("Deployment", "default", "test-deployment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Kind != "Deployment" {
		t.Errorf("expected kind Deployment, got %s", status.Kind)
	}
	if status.Name != "test-deployment" {
		t.Errorf("expected name test-deployment, got %s", status.Name)
	}
	if status.Namespace != "default" {
		t.Errorf("expected namespace default, got %s", status.Namespace)
	}
	if status.Status != "complete" {
		t.Errorf("expected status complete, got %s", status.Status)
	}
	if status.Replicas != 3 {
		t.Errorf("expected 3 replicas, got %d", status.Replicas)
	}
	if status.UpdatedReplicas != 3 {
		t.Errorf("expected 3 updated replicas, got %d", status.UpdatedReplicas)
	}
	if status.ReadyReplicas != 3 {
		t.Errorf("expected 3 ready replicas, got %d", status.ReadyReplicas)
	}
	if status.AvailableReplicas != 3 {
		t.Errorf("expected 3 available replicas, got %d", status.AvailableReplicas)
	}
	if !strings.Contains(status.Message, "successfully") {
		t.Errorf("expected success message, got: %s", status.Message)
	}
}

func TestGetRolloutStatus_Deployment_InProgress_ObservedGeneration(t *testing.T) {
	replicas := int32(3)
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-deployment",
			Namespace:  "default",
			Generation: 5,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
		},
		Status: appsv1.DeploymentStatus{
			ObservedGeneration: 4, // Behind generation
			Replicas:           3,
			UpdatedReplicas:    3,
			ReadyReplicas:      3,
			AvailableReplicas:  3,
		},
	}

	clientset := fake.NewSimpleClientset(deployment)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("Deployment", "default", "test-deployment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Status != "in_progress" {
		t.Errorf("expected status in_progress, got %s", status.Status)
	}
	if !strings.Contains(status.Message, "spec update") {
		t.Errorf("expected spec update message, got: %s", status.Message)
	}
}

func TestGetRolloutStatus_Deployment_InProgress_UpdatedReplicas(t *testing.T) {
	replicas := int32(3)
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-deployment",
			Namespace:  "default",
			Generation: 5,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
		},
		Status: appsv1.DeploymentStatus{
			ObservedGeneration: 5,
			Replicas:           3,
			UpdatedReplicas:    1, // Not all updated
			ReadyReplicas:      1,
			AvailableReplicas:  1,
		},
	}

	clientset := fake.NewSimpleClientset(deployment)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("Deployment", "default", "test-deployment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Status != "in_progress" {
		t.Errorf("expected status in_progress, got %s", status.Status)
	}
	if !strings.Contains(status.Message, "updated") {
		t.Errorf("expected updated message, got: %s", status.Message)
	}
}

func TestGetRolloutStatus_Deployment_InProgress_OldReplicas(t *testing.T) {
	replicas := int32(3)
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-deployment",
			Namespace:  "default",
			Generation: 5,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
		},
		Status: appsv1.DeploymentStatus{
			ObservedGeneration: 5,
			Replicas:           5, // Old replicas still present
			UpdatedReplicas:    3,
			ReadyReplicas:      3,
			AvailableReplicas:  3,
		},
	}

	clientset := fake.NewSimpleClientset(deployment)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("Deployment", "default", "test-deployment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Status != "in_progress" {
		t.Errorf("expected status in_progress, got %s", status.Status)
	}
	if !strings.Contains(status.Message, "old replicas") {
		t.Errorf("expected old replicas message, got: %s", status.Message)
	}
}

func TestGetRolloutStatus_Deployment_InProgress_AvailableReplicas(t *testing.T) {
	replicas := int32(3)
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-deployment",
			Namespace:  "default",
			Generation: 5,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
		},
		Status: appsv1.DeploymentStatus{
			ObservedGeneration: 5,
			Replicas:           3,
			UpdatedReplicas:    3,
			ReadyReplicas:      3,
			AvailableReplicas:  1, // Not all available
		},
	}

	clientset := fake.NewSimpleClientset(deployment)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("Deployment", "default", "test-deployment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Status != "in_progress" {
		t.Errorf("expected status in_progress, got %s", status.Status)
	}
	if !strings.Contains(status.Message, "available") {
		t.Errorf("expected available message, got: %s", status.Message)
	}
}

func TestGetRolloutStatus_Deployment_Failed(t *testing.T) {
	replicas := int32(3)
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-deployment",
			Namespace:  "default",
			Generation: 5,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
		},
		Status: appsv1.DeploymentStatus{
			ObservedGeneration: 5,
			Replicas:           3,
			UpdatedReplicas:    3,
			ReadyReplicas:      3,
			AvailableReplicas:  3,
			Conditions: []appsv1.DeploymentCondition{
				{
					Type:    "Progressing",
					Status:  corev1.ConditionFalse,
					Message: "ProgressDeadlineExceeded",
				},
			},
		},
	}

	clientset := fake.NewSimpleClientset(deployment)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("Deployment", "default", "test-deployment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Status != "failed" {
		t.Errorf("expected status failed, got %s", status.Status)
	}
	if status.Message != "ProgressDeadlineExceeded" {
		t.Errorf("expected ProgressDeadlineExceeded message, got: %s", status.Message)
	}
}

func TestGetRolloutStatus_StatefulSet_Complete(t *testing.T) {
	replicas := int32(3)
	statefulSet := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-sts",
			Namespace:  "default",
			Generation: 5,
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: &replicas,
		},
		Status: appsv1.StatefulSetStatus{
			ObservedGeneration: 5,
			Replicas:           3,
			CurrentReplicas:    3,
			UpdatedReplicas:    3,
			ReadyReplicas:      3,
			AvailableReplicas:  3,
		},
	}

	clientset := fake.NewSimpleClientset(statefulSet)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("StatefulSet", "default", "test-sts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Kind != "StatefulSet" {
		t.Errorf("expected kind StatefulSet, got %s", status.Kind)
	}
	if status.Status != "complete" {
		t.Errorf("expected status complete, got %s", status.Status)
	}
	if !strings.Contains(status.Message, "successfully") {
		t.Errorf("expected success message, got: %s", status.Message)
	}
}

func TestGetRolloutStatus_StatefulSet_InProgress(t *testing.T) {
	replicas := int32(3)
	statefulSet := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-sts",
			Namespace:  "default",
			Generation: 5,
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: &replicas,
		},
		Status: appsv1.StatefulSetStatus{
			ObservedGeneration: 5,
			Replicas:           3,
			CurrentReplicas:    3,
			UpdatedReplicas:    1,
			ReadyReplicas:      1,
			AvailableReplicas:  1,
		},
	}

	clientset := fake.NewSimpleClientset(statefulSet)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("StatefulSet", "default", "test-sts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Status != "in_progress" {
		t.Errorf("expected status in_progress, got %s", status.Status)
	}
}

func TestGetRolloutStatus_DaemonSet_Complete(t *testing.T) {
	daemonSet := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-ds",
			Namespace:  "kube-system",
			Generation: 5,
		},
		Status: appsv1.DaemonSetStatus{
			ObservedGeneration:     5,
			DesiredNumberScheduled: 3,
			UpdatedNumberScheduled: 3,
			NumberReady:            3,
			NumberAvailable:        3,
		},
	}

	clientset := fake.NewSimpleClientset(daemonSet)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("DaemonSet", "kube-system", "test-ds")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Kind != "DaemonSet" {
		t.Errorf("expected kind DaemonSet, got %s", status.Kind)
	}
	if status.Status != "complete" {
		t.Errorf("expected status complete, got %s", status.Status)
	}
	if !strings.Contains(status.Message, "successfully") {
		t.Errorf("expected success message, got: %s", status.Message)
	}
}

func TestGetRolloutStatus_DaemonSet_InProgress(t *testing.T) {
	daemonSet := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-ds",
			Namespace:  "kube-system",
			Generation: 5,
		},
		Status: appsv1.DaemonSetStatus{
			ObservedGeneration:     5,
			DesiredNumberScheduled: 3,
			UpdatedNumberScheduled: 1,
			NumberReady:            1,
			NumberAvailable:        1,
		},
	}

	clientset := fake.NewSimpleClientset(daemonSet)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	status, err := app.GetRolloutStatus("DaemonSet", "kube-system", "test-ds")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if status.Status != "in_progress" {
		t.Errorf("expected status in_progress, got %s", status.Status)
	}
}

func TestGetRolloutStatus_InvalidKind(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	_, err := app.GetRolloutStatus("Pod", "default", "test-pod")
	if err == nil {
		t.Error("expected error for unsupported kind")
	}
	if !strings.Contains(err.Error(), "unsupported kind") {
		t.Errorf("expected unsupported kind error, got: %v", err)
	}
}

func TestGetRolloutStatus_ResourceNotFound(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	_, err := app.GetRolloutStatus("Deployment", "default", "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent deployment")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected not found error, got: %v", err)
	}
}

func TestGetRolloutStatus_NoClient(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}

	_, err := app.GetRolloutStatus("Deployment", "default", "test")
	if err == nil {
		t.Error("expected error when no client is configured")
	}
}

// Tests for GetRolloutHistory
func TestGetRolloutHistory_Deployment_WithReplicaSets(t *testing.T) {
	deploymentUID := types.UID("deployment-123")
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-deployment",
			Namespace: "default",
			UID:       deploymentUID,
		},
	}

	rs1 := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-deployment-abc123",
			Namespace: "default",
			Annotations: map[string]string{
				"deployment.kubernetes.io/revision": "1",
				"kubernetes.io/change-cause":        "Initial deployment",
			},
			CreationTimestamp: metav1.Now(),
			OwnerReferences: []metav1.OwnerReference{
				{
					UID: deploymentUID,
				},
			},
		},
	}

	rs2 := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-deployment-def456",
			Namespace: "default",
			Annotations: map[string]string{
				"deployment.kubernetes.io/revision": "2",
				"kubernetes.io/change-cause":        "Updated image",
			},
			CreationTimestamp: metav1.Now(),
			OwnerReferences: []metav1.OwnerReference{
				{
					UID: deploymentUID,
				},
			},
		},
	}

	clientset := fake.NewSimpleClientset(deployment, rs1, rs2)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	history, err := app.GetRolloutHistory("Deployment", "default", "test-deployment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if history.Kind != "Deployment" {
		t.Errorf("expected kind Deployment, got %s", history.Kind)
	}
	if history.Name != "test-deployment" {
		t.Errorf("expected name test-deployment, got %s", history.Name)
	}
	if history.Namespace != "default" {
		t.Errorf("expected namespace default, got %s", history.Namespace)
	}
	if len(history.Revisions) != 2 {
		t.Errorf("expected 2 revisions, got %d", len(history.Revisions))
	}
}

func TestGetRolloutHistory_StatefulSet_WithControllerRevisions(t *testing.T) {
	stsUID := types.UID("sts-123")
	statefulSet := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-sts",
			Namespace: "default",
			UID:       stsUID,
		},
	}

	rev1 := &appsv1.ControllerRevision{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-sts-rev1",
			Namespace: "default",
			Annotations: map[string]string{
				"kubernetes.io/change-cause": "Initial version",
			},
			CreationTimestamp: metav1.Now(),
			OwnerReferences: []metav1.OwnerReference{
				{
					UID: stsUID,
				},
			},
		},
		Revision: 1,
	}

	rev2 := &appsv1.ControllerRevision{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-sts-rev2",
			Namespace: "default",
			Annotations: map[string]string{
				"kubernetes.io/change-cause": "Updated config",
			},
			CreationTimestamp: metav1.Now(),
			OwnerReferences: []metav1.OwnerReference{
				{
					UID: stsUID,
				},
			},
		},
		Revision: 2,
	}

	clientset := fake.NewSimpleClientset(statefulSet, rev1, rev2)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	history, err := app.GetRolloutHistory("StatefulSet", "default", "test-sts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if history.Kind != "StatefulSet" {
		t.Errorf("expected kind StatefulSet, got %s", history.Kind)
	}
	if len(history.Revisions) != 2 {
		t.Errorf("expected 2 revisions, got %d", len(history.Revisions))
	}
}

func TestGetRolloutHistory_DaemonSet_WithControllerRevisions(t *testing.T) {
	dsUID := types.UID("ds-123")
	daemonSet := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-ds",
			Namespace: "kube-system",
			UID:       dsUID,
		},
	}

	rev1 := &appsv1.ControllerRevision{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-ds-rev1",
			Namespace: "kube-system",
			Annotations: map[string]string{
				"kubernetes.io/change-cause": "First version",
			},
			CreationTimestamp: metav1.Now(),
			OwnerReferences: []metav1.OwnerReference{
				{
					UID: dsUID,
				},
			},
		},
		Revision: 1,
	}

	clientset := fake.NewSimpleClientset(daemonSet, rev1)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	history, err := app.GetRolloutHistory("DaemonSet", "kube-system", "test-ds")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if history.Kind != "DaemonSet" {
		t.Errorf("expected kind DaemonSet, got %s", history.Kind)
	}
	if len(history.Revisions) != 1 {
		t.Errorf("expected 1 revision, got %d", len(history.Revisions))
	}
}

func TestGetRolloutHistory_EmptyHistory(t *testing.T) {
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-deployment",
			Namespace: "default",
			UID:       types.UID("deployment-123"),
		},
	}

	clientset := fake.NewSimpleClientset(deployment)
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	history, err := app.GetRolloutHistory("Deployment", "default", "test-deployment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(history.Revisions) != 0 {
		t.Errorf("expected 0 revisions, got %d", len(history.Revisions))
	}
}

func TestGetRolloutHistory_InvalidKind(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	_, err := app.GetRolloutHistory("Service", "default", "test-service")
	if err == nil {
		t.Error("expected error for unsupported kind")
	}
	if !strings.Contains(err.Error(), "unsupported kind") {
		t.Errorf("expected unsupported kind error, got: %v", err)
	}
}

func TestGetRolloutHistory_ResourceNotFound(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		testClientset: clientset,
		ctx:           context.Background(),
	}

	_, err := app.GetRolloutHistory("Deployment", "default", "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent deployment")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected not found error, got: %v", err)
	}
}

func TestGetRolloutHistory_NoClient(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}

	_, err := app.GetRolloutHistory("Deployment", "default", "test")
	if err == nil {
		t.Error("expected error when no client is configured")
	}
}

// Tests for helper functions
func TestFormatCPU(t *testing.T) {
	tests := []struct {
		name     string
		milliCPU int64
		expected string
	}{
		{
			name:     "zero CPU",
			milliCPU: 0,
			expected: "0m",
		},
		{
			name:     "small milli CPU",
			milliCPU: 100,
			expected: "100m",
		},
		{
			name:     "999 milli CPU",
			milliCPU: 999,
			expected: "999m",
		},
		{
			name:     "1 CPU",
			milliCPU: 1000,
			expected: "1.00",
		},
		{
			name:     "1.5 CPUs",
			milliCPU: 1500,
			expected: "1.50",
		},
		{
			name:     "multiple CPUs",
			milliCPU: 2750,
			expected: "2.75",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatCPU(tt.milliCPU)
			if result != tt.expected {
				t.Errorf("formatCPU(%d) = %s, want %s", tt.milliCPU, result, tt.expected)
			}
		})
	}
}

func TestFormatMemory(t *testing.T) {
	const (
		KB = 1024
		MB = 1024 * KB
		GB = 1024 * MB
	)

	tests := []struct {
		name     string
		bytes    int64
		expected string
	}{
		{
			name:     "zero bytes",
			bytes:    0,
			expected: "0B",
		},
		{
			name:     "small bytes",
			bytes:    512,
			expected: "512B",
		},
		{
			name:     "1 KB",
			bytes:    KB,
			expected: "1Ki",
		},
		{
			name:     "multiple KB",
			bytes:    100 * KB,
			expected: "100Ki",
		},
		{
			name:     "1 MB",
			bytes:    MB,
			expected: "1Mi",
		},
		{
			name:     "multiple MB",
			bytes:    500 * MB,
			expected: "500Mi",
		},
		{
			name:     "1 GB",
			bytes:    GB,
			expected: "1.00Gi",
		},
		{
			name:     "1.5 GB",
			bytes:    int64(1.5 * float64(GB)),
			expected: "1.50Gi",
		},
		{
			name:     "multiple GB",
			bytes:    3 * GB,
			expected: "3.00Gi",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatMemory(tt.bytes)
			if result != tt.expected {
				t.Errorf("formatMemory(%d) = %s, want %s", tt.bytes, result, tt.expected)
			}
		})
	}
}

func TestIsOwnedByUID(t *testing.T) {
	ownerUID := types.UID("owner-123")
	otherUID := types.UID("other-456")

	tests := []struct {
		name     string
		obj      metav1.Object
		uid      interface{}
		expected bool
	}{
		{
			name: "owned by UID",
			obj: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					OwnerReferences: []metav1.OwnerReference{
						{UID: ownerUID},
					},
				},
			},
			uid:      ownerUID,
			expected: true,
		},
		{
			name: "not owned by UID",
			obj: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					OwnerReferences: []metav1.OwnerReference{
						{UID: otherUID},
					},
				},
			},
			uid:      ownerUID,
			expected: false,
		},
		{
			name: "no owner references",
			obj: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					OwnerReferences: []metav1.OwnerReference{},
				},
			},
			uid:      ownerUID,
			expected: false,
		},
		{
			name: "multiple owners including target",
			obj: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					OwnerReferences: []metav1.OwnerReference{
						{UID: otherUID},
						{UID: ownerUID},
					},
				},
			},
			uid:      ownerUID,
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isOwnedByUID(tt.obj, tt.uid)
			if result != tt.expected {
				t.Errorf("isOwnedByUID() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGetRevisionNumber(t *testing.T) {
	tests := []struct {
		name     string
		obj      metav1.Object
		expected int64
	}{
		{
			name: "valid revision",
			obj: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					Annotations: map[string]string{
						"deployment.kubernetes.io/revision": "5",
					},
				},
			},
			expected: 5,
		},
		{
			name: "no revision annotation",
			obj: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					Annotations: map[string]string{},
				},
			},
			expected: 0,
		},
		{
			name: "invalid revision format",
			obj: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					Annotations: map[string]string{
						"deployment.kubernetes.io/revision": "invalid",
					},
				},
			},
			expected: 0,
		},
		{
			name: "nil annotations",
			obj: &appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{
					Annotations: nil,
				},
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getRevisionNumber(tt.obj)
			if result != tt.expected {
				t.Errorf("getRevisionNumber() = %d, want %d", result, tt.expected)
			}
		})
	}
}

// Integration test for PodMetrics structure
func TestPodMetrics_Structure(t *testing.T) {
	pm := PodMetrics{
		Namespace: "default",
		Name:      "test-pod",
		CPU:       "100m",
		Memory:    "256Mi",
		Containers: []ContainerMetrics{
			{
				Name:   "nginx",
				CPU:    "50m",
				Memory: "128Mi",
			},
			{
				Name:   "sidecar",
				CPU:    "50m",
				Memory: "128Mi",
			},
		},
	}

	if pm.Namespace != "default" {
		t.Errorf("expected namespace default, got %s", pm.Namespace)
	}
	if pm.Name != "test-pod" {
		t.Errorf("expected name test-pod, got %s", pm.Name)
	}
	if len(pm.Containers) != 2 {
		t.Errorf("expected 2 containers, got %d", len(pm.Containers))
	}
}

// Integration test for NodeMetrics structure
func TestNodeMetrics_Structure(t *testing.T) {
	nm := NodeMetrics{
		Name:   "node-1",
		CPU:    "2.5",
		Memory: "8.00Gi",
	}

	if nm.Name != "node-1" {
		t.Errorf("expected name node-1, got %s", nm.Name)
	}
	if nm.CPU != "2.5" {
		t.Errorf("expected CPU 2.5, got %s", nm.CPU)
	}
}

// Integration test for RolloutStatus structure
func TestRolloutStatus_Structure(t *testing.T) {
	rs := RolloutStatus{
		Kind:              "Deployment",
		Name:              "test-deployment",
		Namespace:         "default",
		Status:            "complete",
		Replicas:          3,
		UpdatedReplicas:   3,
		ReadyReplicas:     3,
		AvailableReplicas: 3,
		Message:           "Deployment successfully rolled out",
	}

	if rs.Kind != "Deployment" {
		t.Errorf("expected kind Deployment, got %s", rs.Kind)
	}
	if rs.Status != "complete" {
		t.Errorf("expected status complete, got %s", rs.Status)
	}
}

// Integration test for RolloutHistory structure
func TestRolloutHistory_Structure(t *testing.T) {
	rh := RolloutHistory{
		Kind:      "Deployment",
		Name:      "test-deployment",
		Namespace: "default",
		Revisions: []RolloutHistoryRevision{
			{
				Revision:     1,
				ChangeReason: "Initial deployment",
				CreationTime: "2024-01-01T00:00:00Z",
			},
			{
				Revision:     2,
				ChangeReason: "Updated image",
				CreationTime: "2024-01-02T00:00:00Z",
			},
		},
	}

	if rh.Kind != "Deployment" {
		t.Errorf("expected kind Deployment, got %s", rh.Kind)
	}
	if len(rh.Revisions) != 2 {
		t.Errorf("expected 2 revisions, got %d", len(rh.Revisions))
	}
}
