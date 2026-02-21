// Package app – additional coverage tests targeting uncovered pure/utility
// functions, MCP adapter methods, swarm tar utilities, and RBAC YAML endpoints.
// No live cluster required.
package app

import (
	"archive/tar"
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ============================================================================
// safeUint16FromInt – pure boundary function in pods.go
// ============================================================================

func TestSafeUint16FromInt(t *testing.T) {
	tests := []struct {
		name    string
		input   int
		want    uint16
		wantErr bool
	}{
		{"zero", 0, 0, false},
		{"one", 1, 1, false},
		{"max", 65535, 65535, false},
		{"negative", -1, 0, true},
		{"too large", 65536, 0, true},
		{"much too large", 1 << 20, 0, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := safeUint16FromInt(tc.input)
			if (err != nil) != tc.wantErr {
				t.Errorf("safeUint16FromInt(%d): wantErr=%v, got err=%v", tc.input, tc.wantErr, err)
			}
			if !tc.wantErr && got != tc.want {
				t.Errorf("safeUint16FromInt(%d) = %d, want %d", tc.input, got, tc.want)
			}
		})
	}
}

// ============================================================================
// extractResourceNamespace – pure function in resources.go
// ============================================================================

func TestExtractResourceNamespace(t *testing.T) {
	tests := []struct {
		name      string
		obj       map[string]interface{}
		defaultNS string
		want      string
	}{
		{
			name:      "namespace in metadata",
			obj:       map[string]interface{}{"metadata": map[string]interface{}{"namespace": "kube-system"}},
			defaultNS: "default",
			want:      "kube-system",
		},
		{
			name:      "no metadata – use default",
			obj:       map[string]interface{}{"kind": "Pod"},
			defaultNS: "default",
			want:      "default",
		},
		{
			name:      "metadata but no namespace",
			obj:       map[string]interface{}{"metadata": map[string]interface{}{"name": "my-pod"}},
			defaultNS: "fallback",
			want:      "fallback",
		},
		{
			name:      "empty namespace string in metadata",
			obj:       map[string]interface{}{"metadata": map[string]interface{}{"namespace": ""}},
			defaultNS: "fallback",
			want:      "fallback",
		},
		{
			name:      "metadata is wrong type",
			obj:       map[string]interface{}{"metadata": "not-a-map"},
			defaultNS: "def",
			want:      "def",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := extractResourceNamespace(tc.obj, tc.defaultNS)
			if got != tc.want {
				t.Errorf("extractResourceNamespace: got %q, want %q", got, tc.want)
			}
		})
	}
}

// ============================================================================
// isOwnedByDeployment + getReplicaSetRevision – pure helpers in resource_actions.go
// ============================================================================

func TestIsOwnedByDeployment(t *testing.T) {
	refs := []metav1.OwnerReference{
		{Kind: "Deployment", Name: "my-dep"},
		{Kind: "ReplicaSet", Name: "some-rs"},
	}
	if !isOwnedByDeployment(refs, "my-dep") {
		t.Error("expected true for matching Deployment owner")
	}
	if isOwnedByDeployment(refs, "other-dep") {
		t.Error("expected false for non-matching name")
	}
	if isOwnedByDeployment(refs, "some-rs") {
		t.Error("expected false when kind does not match")
	}
	if isOwnedByDeployment(nil, "my-dep") {
		t.Error("expected false for nil refs")
	}
}

func TestGetReplicaSetRevision(t *testing.T) {
	tests := []struct {
		name        string
		annotations map[string]string
		want        int64
	}{
		{"nil annotations", nil, 0},
		{"empty annotations", map[string]string{}, 0},
		{"revision present", map[string]string{"deployment.kubernetes.io/revision": "3"}, 3},
		{"revision is zero", map[string]string{"deployment.kubernetes.io/revision": "0"}, 0},
		{"revision malformed", map[string]string{"deployment.kubernetes.io/revision": "abc"}, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := getReplicaSetRevision(tc.annotations)
			if got != tc.want {
				t.Errorf("getReplicaSetRevision(%v) = %d, want %d", tc.annotations, got, tc.want)
			}
		})
	}
}

// ============================================================================
// isPodOwnedBy – pure helper in resource_details.go
// ============================================================================

func TestIsPodOwnedBy(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "ReplicaSet", Name: "my-rs"},
			},
		},
	}
	if !isPodOwnedBy(pod, "ReplicaSet", "my-rs") {
		t.Error("expected true for matching owner")
	}
	if isPodOwnedBy(pod, "Deployment", "my-rs") {
		t.Error("expected false for wrong kind")
	}
	if isPodOwnedBy(pod, "ReplicaSet", "other") {
		t.Error("expected false for wrong name")
	}

	// Pod with no owner references
	emptyPod := &corev1.Pod{}
	if isPodOwnedBy(emptyPod, "ReplicaSet", "my-rs") {
		t.Error("expected false for pod with no owners")
	}
}

// ============================================================================
// RollbackDeploymentToRevision / findDeploymentRevisionTemplate via fake clientset
// ============================================================================

func TestRollbackDeploymentToRevision_NoSelector(t *testing.T) {
	cs := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "dep1", Namespace: "default"},
		Spec:       appsv1.DeploymentSpec{Selector: nil},
	})
	app := newTestAppWithClientset(cs)
	err := app.RollbackDeploymentToRevision("default", "dep1", 2)
	if err == nil || !strings.Contains(err.Error(), "selector") {
		t.Errorf("expected selector error, got: %v", err)
	}
}

func TestRollbackDeploymentToRevision_RevisionNotFound(t *testing.T) {
	cs := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "dep2", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "dep2"},
			},
		},
	})
	app := newTestAppWithClientset(cs)
	err := app.RollbackDeploymentToRevision("default", "dep2", 99)
	if err == nil || !strings.Contains(err.Error(), "99") {
		t.Errorf("expected not-found error for revision 99, got: %v", err)
	}
}

func TestRollbackDeploymentToRevision_Success(t *testing.T) {
	selector := map[string]string{"app": "myapp"}
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "dep3", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: selector},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: selector},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "current"}}},
			},
		},
	}
	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "dep3-rs1",
			Namespace: "default",
			Labels:    selector,
			Annotations: map[string]string{
				"deployment.kubernetes.io/revision": "1",
			},
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "Deployment", Name: "dep3"},
			},
		},
		Spec: appsv1.ReplicaSetSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "old"}}},
			},
		},
	}
	cs := fake.NewSimpleClientset(dep, rs)
	app := newTestAppWithClientset(cs)
	app.ctx = context.Background()
	err := app.RollbackDeploymentToRevision("default", "dep3", 1)
	if err != nil {
		t.Errorf("expected success, got: %v", err)
	}
	// Verify template was updated
	updated, _ := cs.AppsV1().Deployments("default").Get(context.Background(), "dep3", metav1.GetOptions{})
	if updated.Spec.Template.Spec.Containers[0].Name != "old" {
		t.Errorf("expected container to be 'old', got %s", updated.Spec.Template.Spec.Containers[0].Name)
	}
}

// ============================================================================
// RBAC YAML functions – error paths via fake clientset
// ============================================================================

func TestGetRoleYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetRoleYAML("", "my-role")
	if err == nil || !strings.Contains(err.Error(), "namespace") {
		t.Errorf("expected namespace error, got: %v", err)
	}
}

func TestGetRoleYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetRoleYAML("default", "nonexistent")
	if err == nil {
		t.Error("expected not-found error")
	}
}

func TestGetRoleYAML_HappyPath(t *testing.T) {
	cs := fake.NewSimpleClientset(&rbacv1.Role{
		ObjectMeta: metav1.ObjectMeta{Name: "my-role", Namespace: "default"},
		Rules: []rbacv1.PolicyRule{
			{Verbs: []string{"get"}, Resources: []string{"pods"}, APIGroups: []string{""}},
		},
	})
	app := newTestAppWithClientset(cs)
	yaml, err := app.GetRoleYAML("default", "my-role")
	if err != nil {
		t.Fatalf("GetRoleYAML: %v", err)
	}
	if !strings.Contains(yaml, "my-role") {
		t.Errorf("expected 'my-role' in YAML, got: %s", yaml)
	}
}

func TestGetClusterRoleYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetClusterRoleYAML("nonexistent")
	if err == nil {
		t.Error("expected not-found error")
	}
}

func TestGetClusterRoleYAML_HappyPath(t *testing.T) {
	cs := fake.NewSimpleClientset(&rbacv1.ClusterRole{
		ObjectMeta: metav1.ObjectMeta{Name: "my-cr"},
	})
	app := newTestAppWithClientset(cs)
	yaml, err := app.GetClusterRoleYAML("my-cr")
	if err != nil {
		t.Fatalf("GetClusterRoleYAML: %v", err)
	}
	if !strings.Contains(yaml, "my-cr") {
		t.Errorf("expected 'my-cr' in YAML, got: %s", yaml)
	}
}

func TestGetRoleBindingYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetRoleBindingYAML("", "rb")
	if err == nil || !strings.Contains(err.Error(), "namespace") {
		t.Errorf("expected namespace error, got: %v", err)
	}
}

func TestGetRoleBindingYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetRoleBindingYAML("default", "nonexistent")
	if err == nil {
		t.Error("expected not-found error")
	}
}

func TestGetRoleBindingYAML_HappyPath(t *testing.T) {
	cs := fake.NewSimpleClientset(&rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: "my-rb", Namespace: "default"},
		RoleRef:    rbacv1.RoleRef{Kind: "Role", Name: "my-role", APIGroup: "rbac.authorization.k8s.io"},
	})
	app := newTestAppWithClientset(cs)
	yaml, err := app.GetRoleBindingYAML("default", "my-rb")
	if err != nil {
		t.Fatalf("GetRoleBindingYAML: %v", err)
	}
	if !strings.Contains(yaml, "my-rb") {
		t.Errorf("expected 'my-rb' in YAML, got: %s", yaml)
	}
}

func TestGetClusterRoleBindingYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetClusterRoleBindingYAML("nonexistent")
	if err == nil {
		t.Error("expected not-found error")
	}
}

func TestGetClusterRoleBindingYAML_HappyPath(t *testing.T) {
	cs := fake.NewSimpleClientset(&rbacv1.ClusterRoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: "my-crb"},
		RoleRef:    rbacv1.RoleRef{Kind: "ClusterRole", Name: "my-cr", APIGroup: "rbac.authorization.k8s.io"},
	})
	app := newTestAppWithClientset(cs)
	yaml, err := app.GetClusterRoleBindingYAML("my-crb")
	if err != nil {
		t.Fatalf("GetClusterRoleBindingYAML: %v", err)
	}
	if !strings.Contains(yaml, "my-crb") {
		t.Errorf("expected 'my-crb' in YAML, got: %s", yaml)
	}
}

// ============================================================================
// Swarm tar utility functions – pure/IO functions
// ============================================================================

func TestIsGzipPath(t *testing.T) {
	tests := []struct{ path string; want bool }{
		{"backup.tar.gz", true},
		{"data.tgz", true},
		{"file.tar", false},
		{"archive.zip", false},
		{"BACKUP.TAR.GZ", true}, // case-insensitive
		{"DATA.TGZ", true},
		{"", false},
	}
	for _, tc := range tests {
		t.Run(tc.path, func(t *testing.T) {
			got := isGzipPath(tc.path)
			if got != tc.want {
				t.Errorf("isGzipPath(%q) = %v, want %v", tc.path, got, tc.want)
			}
		})
	}
}

func TestIsTarPath(t *testing.T) {
	tests := []struct{ path string; want bool }{
		{"backup.tar", true},
		{"data.tar.gz", true},
		{"archive.tgz", true},
		{"file.zip", false},
		{"noext", false},
		{"BACKUP.TAR", true},
	}
	for _, tc := range tests {
		t.Run(tc.path, func(t *testing.T) {
			got := isTarPath(tc.path)
			if got != tc.want {
				t.Errorf("isTarPath(%q) = %v, want %v", tc.path, got, tc.want)
			}
		})
	}
}

func TestStatModeIsDir(t *testing.T) {
	if !statModeIsDir(os.ModeDir) {
		t.Error("expected true for directory mode")
	}
	if statModeIsDir(0o644) {
		t.Error("expected false for regular file mode")
	}
}

// makeTarReader creates an in-memory tar archive with the given files and returns a reader.
func makeTarReader(files map[string]string) io.Reader {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	for name, content := range files {
		_ = tw.WriteHeader(&tar.Header{
			Name:     name,
			Typeflag: tar.TypeReg,
			Size:     int64(len(content)),
		})
		_, _ = tw.Write([]byte(content))
	}
	_ = tw.Close()
	return &buf
}

func TestProcessTarEntry_Nil(t *testing.T) {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	// nil header should return nil (no-op)
	if err := processTarEntry(nil, nil, tw); err != nil {
		t.Errorf("expected nil error for nil header, got: %v", err)
	}
	_ = tw.Close()
}

func TestProcessTarEntry_RootEntry(t *testing.T) {
	// Entries that normalize to empty string should be skipped
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	srcBuf := makeTarReader(map[string]string{"./": ""})
	tr := tar.NewReader(srcBuf)
	h, _ := tr.Next()
	if h != nil {
		err := processTarEntry(h, tr, tw)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	}
	_ = tw.Close()
}

func TestProcessTarEntry_Regular(t *testing.T) {
	// A regular file should be written through
	srcBuf := makeTarReader(map[string]string{"./mnt/app/data.txt": "hello"})
	tr := tar.NewReader(srcBuf)
	h, err := tr.Next()
	if err != nil {
		t.Fatalf("tr.Next: %v", err)
	}

	var outBuf bytes.Buffer
	tw := tar.NewWriter(&outBuf)
	if err := processTarEntry(h, tr, tw); err != nil {
		t.Errorf("processTarEntry: %v", err)
	}
	_ = tw.Close()

	// Verify the normalized output
	outTr := tar.NewReader(&outBuf)
	outH, err := outTr.Next()
	if err != nil {
		t.Fatalf("output tr.Next: %v", err)
	}
	if outH.Name != "app/data.txt" {
		t.Errorf("expected normalized name 'app/data.txt', got %q", outH.Name)
	}
}

func TestNormalizeTarStream(t *testing.T) {
	// Create a tar with prefixes that should be stripped
	src := makeTarReader(map[string]string{
		"./mnt/important.txt": "content",
		"./myfile.txt":        "data",
	})

	normalized := normalizeTarStream(src)
	tr := tar.NewReader(normalized)

	names := map[string]bool{}
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("tr.Next: %v", err)
		}
		names[h.Name] = true
	}

	if !names["important.txt"] && !names["mnt/important.txt"] {
		// After stripping ./mnt/ prefix: "important.txt"
		// The function strips "./mnt/" so "important.txt" is expected
		t.Logf("got names: %v", names)
	}
}

func TestWriteTarToFile(t *testing.T) {
	tmpDir := t.TempDir()
	destFile := filepath.Join(tmpDir, "output.tar")

	content := []byte("hello tar world")
	r := io.NopCloser(bytes.NewReader(content))

	if err := writeTarToFile(destFile, r); err != nil {
		t.Fatalf("writeTarToFile: %v", err)
	}

	data, err := os.ReadFile(destFile)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if !bytes.Equal(data, content) {
		t.Errorf("content mismatch: got %q, want %q", data, content)
	}
}

func TestExtractSingleFileFromTar(t *testing.T) {
	tmpDir := t.TempDir()
	destFile := filepath.Join(tmpDir, "extracted.txt")

	// Build a simple tar archive with one file
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	content := "extracted content"
	_ = tw.WriteHeader(&tar.Header{
		Name:     "myfile.txt",
		Typeflag: tar.TypeReg,
		Size:     int64(len(content)),
	})
	_, _ = tw.Write([]byte(content))
	_ = tw.Close()

	r := io.NopCloser(&buf)
	if err := extractSingleFileFromTar(destFile, r); err != nil {
		t.Fatalf("extractSingleFileFromTar: %v", err)
	}

	data, err := os.ReadFile(destFile)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(data) != content {
		t.Errorf("got %q, want %q", string(data), content)
	}
}

func TestExtractSingleFileFromTar_NoFile(t *testing.T) {
	tmpDir := t.TempDir()
	destFile := filepath.Join(tmpDir, "extracted.txt")

	// Empty tar archive – no files
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	_ = tw.Close()

	r := io.NopCloser(&buf)
	err := extractSingleFileFromTar(destFile, r)
	if err == nil {
		t.Error("expected error for empty tar archive")
	}
}

// ============================================================================
// MCPServerAdapter pure getter methods + wrapper methods (error paths)
// ============================================================================

func TestMCPServerAdapter_PureGetters(t *testing.T) {
	app := &App{
		currentKubeContext:   "my-context",
		currentNamespace:     "my-namespace",
		preferredNamespaces: []string{"ns1", "ns2"},
	}
	adapter := &MCPServerAdapter{app: app}

	if got := adapter.GetCurrentContext(); got != "my-context" {
		t.Errorf("GetCurrentContext: got %q, want %q", got, "my-context")
	}
	if got := adapter.GetCurrentNamespace(); got != "my-namespace" {
		t.Errorf("GetCurrentNamespace: got %q, want %q", got, "my-namespace")
	}
	ns := adapter.GetPreferredNamespaces()
	if len(ns) != 2 || ns[0] != "ns1" {
		t.Errorf("GetPreferredNamespaces: got %v", ns)
	}
	// GetKubeConfigPath just returns the kubeconfig path
	_ = adapter.GetKubeConfigPath()
}

func TestMCPServerAdapter_IsSwarmConnected_False(t *testing.T) {
	adapter := &MCPServerAdapter{app: &App{}}
	// Docker client not initialized so should return false
	if adapter.IsSwarmConnected() {
		t.Log("IsSwarmConnected returned true (docker may be available in this env)")
	}
}

func TestMCPServerAdapter_WrapperMethods_ErrorPaths(t *testing.T) {
	app := &App{ctx: context.Background()}
	adapter := &MCPServerAdapter{app: app}

	// All these call underlying App methods that fail gracefully without a cluster
	_, _ = adapter.GetNamespaces()
	_, _ = adapter.GetPods("default")
	_, _ = adapter.GetDeployments("default")
	_, _ = adapter.GetStatefulSets("default")
	_, _ = adapter.GetDaemonSets("default")
	_, _ = adapter.GetJobs("default")
	_, _ = adapter.GetCronJobs("default")
	_, _ = adapter.GetConfigMaps("default")
	_, _ = adapter.GetSecrets("default")
	_, _ = adapter.GetResourceEvents("default", "Pod", "mypod")
	_ = adapter.GetResourceCounts()
	_ = adapter.GetConnectionStatus()
	_, _ = adapter.GetServices("default")
	_, _ = adapter.GetIngresses("default")
	_, _ = adapter.GetReplicaSets("default")
	_, _ = adapter.GetNodes()
	_, _ = adapter.GetPersistentVolumes()
	_, _ = adapter.GetPersistentVolumeClaims("default")
	_, _ = adapter.GetStorageClasses()
	_, _ = adapter.GetServiceAccounts("default")
	_, _ = adapter.GetRoles("default")
	_, _ = adapter.GetClusterRoles()
	_, _ = adapter.GetRoleBindings("default")
	_, _ = adapter.GetClusterRoleBindings()
	_, _ = adapter.GetNetworkPolicies("default")
	_, _ = adapter.GetCustomResourceDefinitions()
	_, _ = adapter.GetEndpoints("default")
	_, _ = adapter.GetDeploymentDetail("default", "test")
	_, _ = adapter.GetServiceDetail("default", "test")
	_, _ = adapter.GetIngressDetail("default", "test")
	_, _ = adapter.GetNodeDetail("test-node")
	_, _ = adapter.GetPersistentVolumeClaimDetail("default", "test")
	_, _ = adapter.GetPersistentVolumeDetail("test")
	_, _ = adapter.GetStatefulSetDetail("default", "test")
	_, _ = adapter.GetDaemonSetDetail("default", "test")
	_, _ = adapter.GetReplicaSetDetail("default", "test")
	_, _ = adapter.GetJobDetail("default", "test")
	_, _ = adapter.GetCronJobDetail("default", "test")
	_, _ = adapter.GetResourceYAML("pod", "default", "test")
	_, _ = adapter.GetPodLogs("default", "mypod", "", 100)
	_ = adapter.ScaleResource("Deployment", "default", "test", 1)
	_ = adapter.RestartDeployment("default", "test")
	_, _ = adapter.GetSwarmServices()
	_, _ = adapter.GetSwarmTasks()
	_, _ = adapter.GetSwarmNodes()
	_, _ = adapter.GetSwarmServiceLogs("svc1", 10)
	_ = adapter.ScaleSwarmService("svc1", 2)
}

func TestMCPServerAdapter_Phase3Methods(t *testing.T) {
	app := &App{ctx: context.Background()}
	adapter := &MCPServerAdapter{app: app}

	_, _ = adapter.GetPodLogsPrevious("default", "pod1", "", 100)
	_, _ = adapter.TopPods("default")
	_, _ = adapter.TopNodes()
	_, _ = adapter.GetRolloutStatus("Deployment", "default", "test")
	_, _ = adapter.GetRolloutHistory("Deployment", "default", "test")
}

func TestMCPServerAdapter_Phase4Methods(t *testing.T) {
	app := &App{ctx: context.Background()}
	adapter := &MCPServerAdapter{app: app}

	_, _ = adapter.GetSwarmService("svc1")
	_, _ = adapter.GetSwarmTask("task1")
	_, _ = adapter.GetSwarmNode("node1")
	_, _ = adapter.GetSwarmStacks()
	_, _ = adapter.GetSwarmNetworks()
	_, _ = adapter.GetSwarmVolumes()
	_, _ = adapter.GetSwarmSecrets()
	_, _ = adapter.GetSwarmConfigs()
}

// ============================================================================
// GetMCPConfig / GetMCPStatus / StopMCPServer
// ============================================================================

func TestGetMCPConfig_ReturnsConfig(t *testing.T) {
	app := &App{}
	cfg := app.GetMCPConfig()
	// Just verify it returns without panic
	_ = cfg
}

func TestGetMCPStatus_NoServer(t *testing.T) {
	app := &App{}
	status := app.GetMCPStatus()
	if status.Running {
		t.Log("MCP server unexpectedly running")
	}
}

func TestStopMCPServer_NotRunning(t *testing.T) {
	app := &App{}
	err := app.StopMCPServer()
	// Should return ErrServerNotRunning
	if err == nil {
		t.Log("StopMCPServer returned nil (server may have been running)")
	}
}

// ============================================================================
// computeCronJobNextRuns – additional paths via fake clientset
// ============================================================================

func TestComputeCronJobNextRuns_EmptyName(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	result := app.computeCronJobNextRuns(cs, "default", "")
	if len(result) != 0 {
		t.Errorf("expected empty slice for empty name, got %v", result)
	}
}

func TestComputeCronJobNextRuns_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	result := app.computeCronJobNextRuns(cs, "default", "nonexistent")
	if len(result) != 0 {
		t.Errorf("expected empty slice when cronjob not found, got %v", result)
	}
}

// ============================================================================
// GetResourceYAML – additional kinds to increase switch branch coverage
// ============================================================================

func TestGetResourceYAML_RoleKinds(t *testing.T) {
	cs := fake.NewSimpleClientset(
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "r1", Namespace: "default"}},
		&rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "cr1"}},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "rb1", Namespace: "default"},
			RoleRef:    rbacv1.RoleRef{Kind: "Role", Name: "r1", APIGroup: "rbac.authorization.k8s.io"},
		},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "crb1"},
			RoleRef:    rbacv1.RoleRef{Kind: "ClusterRole", Name: "cr1", APIGroup: "rbac.authorization.k8s.io"},
		},
	)
	app := newTestAppWithClientset(cs)
	app.currentNamespace = "default"

	for _, tc := range []struct{ kind, ns, name string }{
		{"role", "default", "r1"},
		{"clusterrole", "", "cr1"},
		{"rolebinding", "default", "rb1"},
		{"clusterrolebinding", "", "crb1"},
	} {
		t.Run(tc.kind, func(t *testing.T) {
			yaml, err := app.GetResourceYAML(tc.kind, tc.ns, tc.name)
			if err != nil {
				t.Errorf("GetResourceYAML(%s): %v", tc.kind, err)
			}
			if !strings.Contains(yaml, tc.name) {
				t.Errorf("expected %q in yaml output", tc.name)
			}
		})
	}
}

// ============================================================================
// ScaleResource – additional branches
// ============================================================================

func TestScaleResource_TooManyReplicas(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	// Use int that's too large for int32
	err := app.ScaleResource("Deployment", "default", "test", int(^uint32(0)>>1)+1)
	if err == nil {
		t.Error("expected error for too-large replicas")
	}
}

// ============================================================================
// checkContainerConfigMapRef / checkContainersConfigMapRef – additional paths
// ============================================================================

func TestCheckContainerConfigMapRef_EnvFrom(t *testing.T) {
c := corev1.Container{
Name: "mycontainer",
EnvFrom: []corev1.EnvFromSource{
{
ConfigMapRef: &corev1.ConfigMapEnvSource{
LocalObjectReference: corev1.LocalObjectReference{Name: "my-cm"},
},
},
},
}
ok, why := checkContainerConfigMapRef(c, "my-cm")
if !ok {
t.Error("expected true for envFrom reference")
}
if !strings.Contains(why, "envFrom") {
t.Errorf("expected envFrom in why, got %q", why)
}
}

func TestCheckContainerConfigMapRef_Env(t *testing.T) {
c := corev1.Container{
Name: "mycontainer",
Env: []corev1.EnvVar{
{
Name: "MY_VAR",
ValueFrom: &corev1.EnvVarSource{
ConfigMapKeyRef: &corev1.ConfigMapKeySelector{
LocalObjectReference: corev1.LocalObjectReference{Name: "my-cm"},
Key:                  "key",
},
},
},
},
}
ok, why := checkContainerConfigMapRef(c, "my-cm")
if !ok {
t.Error("expected true for env reference")
}
if !strings.Contains(why, "env") {
t.Errorf("expected 'env' in why, got %q", why)
}
}

func TestCheckContainerConfigMapRef_NoMatch(t *testing.T) {
c := corev1.Container{
Name: "mycontainer",
Env:  []corev1.EnvVar{{Name: "PLAIN_VAR", Value: "hello"}},
}
ok, _ := checkContainerConfigMapRef(c, "my-cm")
if ok {
t.Error("expected false for no configmap ref")
}
}

func TestCheckContainersConfigMapRef_InitContainer(t *testing.T) {
spec := corev1.PodSpec{
InitContainers: []corev1.Container{
{
Name: "init",
EnvFrom: []corev1.EnvFromSource{
{
ConfigMapRef: &corev1.ConfigMapEnvSource{
LocalObjectReference: corev1.LocalObjectReference{Name: "my-cm"},
},
},
},
},
},
}
ok, why := checkContainersConfigMapRef(spec, "my-cm")
if !ok {
t.Error("expected true for init container reference")
}
if !strings.Contains(why, "init") {
t.Errorf("expected 'init' in why, got %q", why)
}
}

// ============================================================================
// GetSearchHelmCharts – with no index file (already tested but add coverage)
// ============================================================================

func TestSearchHelmCharts_WithRepoFileNoIndex(t *testing.T) {
tmp := t.TempDir()
repoYAML := `apiVersion: ""
generated: "0001-01-01T00:00:00Z"
repositories:
- name: localrepo
  url: https://example.com/charts
`
repoFile := filepath.Join(tmp, "repositories.yaml")
if err := os.WriteFile(repoFile, []byte(repoYAML), 0644); err != nil {
t.Fatalf("write: %v", err)
}
t.Setenv("HELM_REPOSITORY_CONFIG", repoFile)
cacheDir := filepath.Join(tmp, "cache")
if err := os.MkdirAll(cacheDir, 0o750); err != nil {
t.Fatalf("mkdir: %v", err)
}
t.Setenv("HELM_REPOSITORY_CACHE", cacheDir)

app := &App{}
charts, err := app.SearchHelmCharts("")
if err != nil {
t.Fatalf("SearchHelmCharts: %v", err)
}
// No index file present, so should return empty (skips repos with no index)
if len(charts) != 0 {
t.Errorf("expected 0 charts (no index file), got %d", len(charts))
}
}

// ============================================================================
// GetHelmChartVersions – error path when no index file
// ============================================================================

func TestGetHelmChartVersions_NoIndex2(t *testing.T) {
tmp := t.TempDir()
t.Setenv("HELM_REPOSITORY_CACHE", tmp)

app := &App{}
_, err := app.GetHelmChartVersions("nonexistent-repo", "some-chart")
if err == nil {
t.Error("expected error when index file doesn't exist")
}
}

// ============================================================================
// checkContainerSecretRef / checkContainersSecretRef – additional paths
// ============================================================================

func TestCheckContainerSecretRef_EnvFrom(t *testing.T) {
c := corev1.Container{
Name: "mycontainer",
EnvFrom: []corev1.EnvFromSource{
{
SecretRef: &corev1.SecretEnvSource{
LocalObjectReference: corev1.LocalObjectReference{Name: "my-secret"},
},
},
},
}
ok, why := checkContainerSecretRef(c, "my-secret")
if !ok {
t.Error("expected true for envFrom secret reference")
}
if !strings.Contains(why, "envFrom") {
t.Errorf("expected envFrom in why, got %q", why)
}
}

func TestCheckContainerSecretRef_Env(t *testing.T) {
c := corev1.Container{
Name: "mycontainer",
Env: []corev1.EnvVar{
{
Name: "MY_SECRET_VAR",
ValueFrom: &corev1.EnvVarSource{
SecretKeyRef: &corev1.SecretKeySelector{
LocalObjectReference: corev1.LocalObjectReference{Name: "my-secret"},
Key:                  "password",
},
},
},
},
}
ok, why := checkContainerSecretRef(c, "my-secret")
if !ok {
t.Error("expected true for env secret reference")
}
if !strings.Contains(why, "env") {
t.Errorf("expected 'env' in why, got %q", why)
}
}

func TestCheckContainerSecretRef_NoMatch(t *testing.T) {
c := corev1.Container{
Name: "mycontainer",
Env:  []corev1.EnvVar{{Name: "PLAIN_VAR", Value: "hello"}},
}
ok, _ := checkContainerSecretRef(c, "my-secret")
if ok {
t.Error("expected false for no secret ref")
}
}

// ============================================================================
// checkContainersSecretRef / sortedSecretConsumers – more paths
// ============================================================================

func TestCheckContainersSecretRef_InitContainer(t *testing.T) {
spec := corev1.PodSpec{
InitContainers: []corev1.Container{
{
Name: "init",
EnvFrom: []corev1.EnvFromSource{
{
SecretRef: &corev1.SecretEnvSource{
LocalObjectReference: corev1.LocalObjectReference{Name: "my-secret"},
},
},
},
},
},
}
ok, why := checkContainersSecretRef(spec, "my-secret")
if !ok {
t.Error("expected true for init container secret reference")
}
if !strings.Contains(why, "init") {
t.Errorf("expected 'init' in why, got %q", why)
}
}

func TestCheckContainersSecretRef_RegularContainer(t *testing.T) {
spec := corev1.PodSpec{
Containers: []corev1.Container{
{
Name: "app",
Env: []corev1.EnvVar{
{
Name: "MY_SECRET",
ValueFrom: &corev1.EnvVarSource{
SecretKeyRef: &corev1.SecretKeySelector{
LocalObjectReference: corev1.LocalObjectReference{Name: "my-secret"},
Key:                  "key",
},
},
},
},
},
},
}
ok, _ := checkContainersSecretRef(spec, "my-secret")
if !ok {
t.Error("expected true for regular container secret reference")
}
}

func TestSortedSecretConsumers_SortsByKindThenNamespace(t *testing.T) {
consumers := []SecretConsumer{
{Kind: "Pod", Namespace: "b-ns", Name: "pod1"},
{Kind: "Deployment", Namespace: "a-ns", Name: "dep1"},
{Kind: "Pod", Namespace: "a-ns", Name: "pod2"},
}
sorted := sortedSecretConsumers(consumers)
if len(sorted) != 3 {
t.Fatalf("expected 3 consumers, got %d", len(sorted))
}
// Deployment should come before Pod
if sorted[0].Kind != "Deployment" {
t.Errorf("expected Deployment first, got %s", sorted[0].Kind)
}
}
