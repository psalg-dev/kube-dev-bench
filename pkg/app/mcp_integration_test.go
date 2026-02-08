package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

// Step 1: Getter coverage for MCPServerAdapter
func TestMCPAdapter_Getters_Basic(t *testing.T) {
	tmpCfg := filepath.Join(os.TempDir(), "kdb-test-kubeconfig")

	app := &App{
		ctx:                 context.Background(),
		currentKubeContext:  "kind-kind",
		currentNamespace:    "default",
		preferredNamespaces: []string{"default", "kube-system"},
		kubeConfig:          tmpCfg,
		proxyAuthType:       "none",
		proxyURL:            "",
	}
	adapter := &MCPServerAdapter{app: app}

	if got := adapter.GetCurrentContext(); got != "kind-kind" {
		t.Fatalf("GetCurrentContext = %q, want %q", got, "kind-kind")
	}
	if got := adapter.GetCurrentNamespace(); got != "default" {
		t.Fatalf("GetCurrentNamespace = %q, want %q", got, "default")
	}
	if got := adapter.GetKubeConfigPath(); got != tmpCfg {
		t.Fatalf("GetKubeConfigPath = %q, want %q", got, tmpCfg)
	}

	status := adapter.GetConnectionStatus()
	if v, ok := status["connected"].(bool); !ok || !v {
		t.Fatalf("GetConnectionStatus.connected = %v (ok=%v), want true", status["connected"], ok)
	}
	if v, ok := status["isInsecure"].(bool); !ok || v {
		t.Fatalf("GetConnectionStatus.isInsecure = %v (ok=%v), want false", status["isInsecure"], ok)
	}
}

func TestMCPAdapter_PreferredNamespaces_IsCopy(t *testing.T) {
	app := &App{preferredNamespaces: []string{"a", "b"}}
	adapter := &MCPServerAdapter{app: app}

	got := adapter.GetPreferredNamespaces()
	if len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Fatalf("GetPreferredNamespaces = %v, want [a b]", got)
	}
	got[0] = "mutated"
	if app.preferredNamespaces[0] != "a" {
		t.Fatalf("preferredNamespaces mutated via getter copy, have %v", app.preferredNamespaces)
	}
}

// Step 2: Resource list passthroughs
func TestMCPAdapter_ResourceLists_Passthrough(t *testing.T) {
	ns := "ns1"

	t.Run("pods", func(t *testing.T) {
		cs := fake.NewSimpleClientset()
		_, _ = cs.CoreV1().Pods(ns).Create(context.Background(), &v1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: ns},
			Status:     v1.PodStatus{Phase: v1.PodRunning},
		}, metav1.CreateOptions{})
		app := newTestAppWithClientset(cs)
		adapter := &MCPServerAdapter{app: app}
		got, err := adapter.GetPods(ns)
		if err != nil {
			t.Fatalf("GetPods error: %v", err)
		}
		pods := got.([]PodInfo)
		if len(pods) != 1 || pods[0].Name != "p1" {
			t.Fatalf("GetPods => %+v, want single pod 'p1'", pods)
		}
	})

	t.Run("deployments", func(t *testing.T) {
		cs := fake.NewSimpleClientset()
		_, _ = cs.AppsV1().Deployments(ns).Create(context.Background(), &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "d1", Namespace: ns},
		}, metav1.CreateOptions{})
		app := newTestAppWithClientset(cs)
		adapter := &MCPServerAdapter{app: app}
		got, err := adapter.GetDeployments(ns)
		if err != nil {
			t.Fatalf("GetDeployments error: %v", err)
		}
		list := got.([]DeploymentInfo)
		if len(list) != 1 || list[0].Name != "d1" {
			t.Fatalf("GetDeployments => %+v, want single 'd1'", list)
		}
	})

	t.Run("statefulsets", func(t *testing.T) {
		cs := fake.NewSimpleClientset()
		_, _ = cs.AppsV1().StatefulSets(ns).Create(context.Background(), &appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "s1", Namespace: ns},
		}, metav1.CreateOptions{})
		app := newTestAppWithClientset(cs)
		adapter := &MCPServerAdapter{app: app}
		got, err := adapter.GetStatefulSets(ns)
		if err != nil {
			t.Fatalf("GetStatefulSets error: %v", err)
		}
		list := got.([]StatefulSetInfo)
		if len(list) != 1 || list[0].Name != "s1" {
			t.Fatalf("GetStatefulSets => %+v, want single 's1'", list)
		}
	})

	t.Run("daemonsets", func(t *testing.T) {
		cs := fake.NewSimpleClientset()
		_, _ = cs.AppsV1().DaemonSets(ns).Create(context.Background(), &appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "ds1", Namespace: ns},
		}, metav1.CreateOptions{})
		app := newTestAppWithClientset(cs)
		adapter := &MCPServerAdapter{app: app}
		got, err := adapter.GetDaemonSets(ns)
		if err != nil {
			t.Fatalf("GetDaemonSets error: %v", err)
		}
		list := got.([]DaemonSetInfo)
		if len(list) != 1 || list[0].Name != "ds1" {
			t.Fatalf("GetDaemonSets => %+v, want single 'ds1'", list)
		}
	})

	t.Run("configmaps", func(t *testing.T) {
		cs := fake.NewSimpleClientset()
		_, _ = cs.CoreV1().ConfigMaps(ns).Create(context.Background(), &v1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: "cm1", Namespace: ns},
			Data:       map[string]string{"k": "v"},
		}, metav1.CreateOptions{})
		app := newTestAppWithClientset(cs)
		adapter := &MCPServerAdapter{app: app}
		got, err := adapter.GetConfigMaps(ns)
		if err != nil {
			t.Fatalf("GetConfigMaps error: %v", err)
		}
		list := got.([]ConfigMapInfo)
		if len(list) != 1 || list[0].Name != "cm1" {
			t.Fatalf("GetConfigMaps => %+v, want single 'cm1'", list)
		}
	})

	t.Run("secrets", func(t *testing.T) {
		cs := fake.NewSimpleClientset()
		_, _ = cs.CoreV1().Secrets(ns).Create(context.Background(), &v1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: "sec1", Namespace: ns},
			Data:       map[string][]byte{"a": []byte("b")},
		}, metav1.CreateOptions{})
		app := newTestAppWithClientset(cs)
		adapter := &MCPServerAdapter{app: app}
		got, err := adapter.GetSecrets(ns)
		if err != nil {
			t.Fatalf("GetSecrets error: %v", err)
		}
		list := got.([]map[string]interface{})
		if len(list) != 1 || list[0]["name"].(string) != "sec1" {
			t.Fatalf("GetSecrets => %+v, want single 'sec1'", list)
		}
	})
}

func TestMCPAdapter_ResourceLists_ErrorPropagation(t *testing.T) {
	cs := fake.NewSimpleClientset()
	cs.PrependReactor("list", "deployments", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated list error")
	})
	app := newTestAppWithClientset(cs)
	adapter := &MCPServerAdapter{app: app}
	_, err := adapter.GetDeployments("ns1")
	if err == nil || !strings.Contains(err.Error(), "simulated list error") {
		t.Fatalf("expected propagated list error, got %v", err)
	}
}

// Step 3: Wrappers that rely on non-fake clients (error paths or alternate injection)
func TestMCPAdapter_GetJobs_ErrorWithoutContext(t *testing.T) {
	app := &App{}
	adapter := &MCPServerAdapter{app: app}
	_, err := adapter.GetJobs("default")
	if err == nil {
		t.Fatal("expected error from GetJobs when no kube context is configured")
	}
}

func TestMCPAdapter_GetPodDetail_UsesCurrentNamespace(t *testing.T) {
	ns := "ns1"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().Pods(ns).Create(context.Background(), &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns
	adapter := &MCPServerAdapter{app: app}

	got, err := adapter.GetPodDetail("ignored-ns", "pod1")
	if err != nil {
		t.Fatalf("GetPodDetail error: %v", err)
	}
	sum := got.(PodSummary)
	if sum.Name != "pod1" || sum.Namespace != ns {
		t.Fatalf("GetPodDetail => %+v, want Name=pod1 Namespace=%s", sum, ns)
	}
}

func TestMCPAdapter_GetResourceYAML_ConfigMap(t *testing.T) {
	ns := "ns1"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().ConfigMaps(ns).Create(context.Background(), &v1.ConfigMap{
		TypeMeta: metav1.TypeMeta{Kind: "ConfigMap", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "cm1", Namespace: ns},
		Data:       map[string]string{"k": "v"},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	adapter := &MCPServerAdapter{app: app}

	yaml, err := adapter.GetResourceYAML("ConfigMap", ns, "cm1")
	if err != nil {
		t.Fatalf("GetResourceYAML error: %v", err)
	}
	if !strings.Contains(yaml, "kind: ConfigMap") || !strings.Contains(yaml, "name: cm1") {
		t.Fatalf("unexpected YAML output: %s", yaml)
	}
}

func TestMCPAdapter_GetPodLogs_UsesTestFetcher(t *testing.T) {
	app := &App{}
	app.testPodLogsFetcher = func(namespace, podName, containerName string, lines int) (string, error) {
		return "line1\nline2", nil
	}
	adapter := &MCPServerAdapter{app: app}

	logs, err := adapter.GetPodLogs("ns", "pod", "c", 50)
	if err != nil {
		t.Fatalf("GetPodLogs error: %v", err)
	}
	if logs != "line1\nline2" {
		t.Fatalf("GetPodLogs => %q, want %q", logs, "line1\nline2")
	}
}
