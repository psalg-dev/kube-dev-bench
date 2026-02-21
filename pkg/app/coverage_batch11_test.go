package app

// coverage_batch11_test.go – Comprehensive coverage for remaining uncovered blocks.
// Targets:
//  1. holmes_context.go  – getK8s errors + nil-ctx safety + data-dependent branches
//  2. ingress_tls_expiry – parseCertificateExpiry branches
//  3. informer_manager.go – normalizeNamespaces already-started guard
//  4. monitor_actions.go  – enrichMonitorInfo error, ScanClusterHealth, getResourceContext
//  5. monitor.go          – checkContainerStatus terminated branch
//  6. events.go           – convertEventsV1Event Series branch
//  7. Various resource handlers – getK8s/getClient errors

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"strings"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	fake "k8s.io/client-go/kubernetes/fake"
)

// ─────────────────────────────────────────────────────────────────────────────
// helper: App with ctx==nil but working testClientset
// Covers "ctx = context.Background()" nil-safety guards in holmes_context.go
// ─────────────────────────────────────────────────────────────────────────────

func nilCtxApp() *App {
	return &App{
		ctx:           nil,
		testClientset: fake.NewSimpleClientset(),
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// holmes_context.go – getK8s error for every context function
// ─────────────────────────────────────────────────────────────────────────────

func TestGetPodContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getPodContext("default", "pod1")
}

func TestGetPodContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getPodContext("default", "pod1")
}

func TestGetDeploymentContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getDeploymentContext("default", "dep1")
}

func TestGetDeploymentContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getDeploymentContext("default", "dep1")
}

func TestGetStatefulSetContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getStatefulSetContext("default", "ss1")
}

func TestGetStatefulSetContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getStatefulSetContext("default", "ss1")
}

func TestGetDaemonSetContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getDaemonSetContext("default", "ds1")
}

func TestGetDaemonSetContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getDaemonSetContext("default", "ds1")
}

func TestGetServiceContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getServiceContext("default", "svc1")
}

func TestGetServiceContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getServiceContext("default", "svc1")
}

func TestGetJobContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getJobContext("default", "job1")
}

func TestGetJobContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getJobContext("default", "job1")
}

func TestGetIngressContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getIngressContext("default", "ing1")
}

func TestGetIngressContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getIngressContext("default", "ing1")
}

func TestGetConfigMapContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getConfigMapContext("default", "cm1")
}

func TestGetConfigMapContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getConfigMapContext("default", "cm1")
}

func TestGetSecretContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getSecretContext("default", "sec1")
}

func TestGetSecretContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getSecretContext("default", "sec1")
}

func TestGetPersistentVolumeContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getPersistentVolumeContext("pv1")
}

func TestGetPersistentVolumeContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getPersistentVolumeContext("pv1")
}

// TestGetPersistentVolumeContext_WithData covers data-dependent branches:
// StorageClassName, ClaimRef, Capacity, Status.Message
func TestGetPersistentVolumeContext_WithData(t *testing.T) {
	pv := &corev1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "pv-data"},
		Spec: corev1.PersistentVolumeSpec{
			StorageClassName: "fast",
			Capacity: corev1.ResourceList{
				"storage": resource.MustParse("10Gi"),
			},
			ClaimRef:    &corev1.ObjectReference{Name: "my-pvc", Namespace: "default"},
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
		},
		Status: corev1.PersistentVolumeStatus{
			Phase:   corev1.VolumeBound,
			Message: "volume is healthy",
		},
	}
	cs := fake.NewSimpleClientset(pv)
	app := &App{ctx: context.Background(), testClientset: cs}
	result, err := app.getPersistentVolumeContext("pv-data")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == "" {
		t.Error("expected non-empty PV context")
	}
}

func TestGetPersistentVolumeClaimContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getPersistentVolumeClaimContext("default", "pvc1")
}

func TestGetPersistentVolumeClaimContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getPersistentVolumeClaimContext("default", "pvc1")
}

// TestGetPersistentVolumeClaimContext_WithData covers PVC-specific data branches.
func TestGetPersistentVolumeClaimContext_WithData(t *testing.T) {
	sc := "fast"
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "pvc-data", Namespace: "default"},
		Spec: corev1.PersistentVolumeClaimSpec{
			StorageClassName: &sc,
			VolumeName:       "my-pv",
			AccessModes:      []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
		},
		Status: corev1.PersistentVolumeClaimStatus{
			Phase: corev1.ClaimBound,
			Capacity: corev1.ResourceList{
				"storage": resource.MustParse("5Gi"),
			},
		},
	}
	cs := fake.NewSimpleClientset(pvc)
	app := &App{ctx: context.Background(), testClientset: cs, currentNamespace: "default"}
	result, err := app.getPersistentVolumeClaimContext("default", "pvc-data")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_ = result
}

// TestGetPVCContext_AppendRecentEvents exercises the appendRecentEvents path
// by providing a PVC with a matching Event in the fake clientset.
func TestGetPVCContext_AppendRecentEvents(t *testing.T) {
	sc := "standard"
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "pvc-ev", Namespace: "default"},
		Spec: corev1.PersistentVolumeClaimSpec{
			StorageClassName: &sc,
			AccessModes:      []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
		},
		Status: corev1.PersistentVolumeClaimStatus{Phase: corev1.ClaimPending},
	}
	evt := &corev1.Event{
		ObjectMeta:     metav1.ObjectMeta{Name: "pvc-event-1", Namespace: "default"},
		InvolvedObject: corev1.ObjectReference{Name: "pvc-ev", Kind: "PersistentVolumeClaim"},
		Reason:         "Provisioning",
		Message:        "waiting for provisioner",
		Type:           "Normal",
		LastTimestamp:  metav1.Time{Time: time.Now()},
	}
	cs := fake.NewSimpleClientset(pvc, evt)
	app := &App{ctx: context.Background(), testClientset: cs, currentNamespace: "default"}
	_, _ = app.getPersistentVolumeClaimContext("default", "pvc-ev")
}

func TestGetNodeContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getNodeContext("node1")
}

func TestGetNodeContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getNodeContext("node1")
}

// TestGetNodeContext_WithTaintsAndAllocatable covers:
// – Taints section (825.24,827.4 and 828.25,830.4)
// – Allocatable CPU, Memory, Pods branches (840-850)
func TestGetNodeContext_WithTaintsAndAllocatable(t *testing.T) {
	node := &corev1.Node{
		ObjectMeta: metav1.ObjectMeta{Name: "rich-node"},
		Spec: corev1.NodeSpec{
			Taints: []corev1.Taint{
				{Key: "dedicated", Value: "gpu", Effect: corev1.TaintEffectNoSchedule},
			},
		},
		Status: corev1.NodeStatus{
			Allocatable: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("4"),
				corev1.ResourceMemory: resource.MustParse("8Gi"),
				corev1.ResourcePods:   resource.MustParse("110"),
			},
			NodeInfo: corev1.NodeSystemInfo{
				KernelVersion: "5.15.0",
				OSImage:       "Ubuntu 22.04",
			},
		},
	}
	cs := fake.NewSimpleClientset(node)
	app := &App{ctx: context.Background(), testClientset: cs}
	result, err := app.getNodeContext("rich-node")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == "" {
		t.Error("expected non-empty node context")
	}
}

func TestGetHPAContext_GetK8sError(t *testing.T) {
	_, _ = newAppNoCtx().getHPAContext("default", "hpa1")
}

func TestGetHPAContext_NilCtx(t *testing.T) {
	_, _ = nilCtxApp().getHPAContext("default", "hpa1")
}

// TestGetHPAContext_NotFound uses a valid clientset so getK8s succeeds but HPA is absent.
func TestGetHPAContext_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.getHPAContext("default", "nonexistent-hpa")
	if err == nil {
		t.Error("expected not-found error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional context functions with data for extra branch coverage
// ─────────────────────────────────────────────────────────────────────────────

func TestGetConfigMapContext_WithData(t *testing.T) {
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "my-cm", Namespace: "default"},
		Data:       map[string]string{"key1": "value1", "key2": "value2"},
	}
	cs := fake.NewSimpleClientset(cm)
	app := &App{ctx: context.Background(), testClientset: cs}
	result, err := app.getConfigMapContext("default", "my-cm")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == "" {
		t.Error("expected non-empty CM context")
	}
}

func TestGetSecretContext_WithData(t *testing.T) {
	sec := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "my-secret", Namespace: "default"},
		Type:       corev1.SecretTypeOpaque,
		Data:       map[string][]byte{"password": []byte("s3cr3t")},
	}
	cs := fake.NewSimpleClientset(sec)
	app := &App{ctx: context.Background(), testClientset: cs}
	result, err := app.getSecretContext("default", "my-secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == "" {
		t.Error("expected non-empty secret context")
	}
}

func TestGetServiceContext_WithService(t *testing.T) {
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "my-svc", Namespace: "default"},
		Spec: corev1.ServiceSpec{
			Type:      corev1.ServiceTypeClusterIP,
			ClusterIP: "10.0.0.1",
			Ports:     []corev1.ServicePort{{Name: "http", Port: 80}},
		},
	}
	cs := fake.NewSimpleClientset(svc)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, _ = app.getServiceContext("default", "my-svc")
}

func TestGetJobContext_WithJob(t *testing.T) {
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "my-job", Namespace: "default"},
		Status: batchv1.JobStatus{
			Active:    1,
			Succeeded: 0,
			Failed:    0,
		},
	}
	cs := fake.NewSimpleClientset(job)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, _ = app.getJobContext("default", "my-job")
}

func TestGetCronJobContext_WithData(t *testing.T) {
	suspend := false
	cj := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "my-cj", Namespace: "default"},
		Spec: batchv1.CronJobSpec{
			Schedule: "*/5 * * * *",
			Suspend:  &suspend,
		},
	}
	cs := fake.NewSimpleClientset(cj)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, _ = app.getCronJobContext("default", "my-cj")
}

func TestGetDaemonSetContext_WithData(t *testing.T) {
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "my-ds", Namespace: "default"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "daemon"}},
		},
	}
	cs := fake.NewSimpleClientset(ds)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, _ = app.getDaemonSetContext("default", "my-ds")
}

func TestGetIngressContext_WithIngress(t *testing.T) {
	ing := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{Name: "test-ing", Namespace: "default"},
		Spec: networkingv1.IngressSpec{
			Rules: []networkingv1.IngressRule{{Host: "example.com"}},
			TLS:   []networkingv1.IngressTLS{{Hosts: []string{"example.com"}, SecretName: "tls-secret"}},
		},
	}
	cs := fake.NewSimpleClientset(ing)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, _ = app.getIngressContext("default", "test-ing")
}

// ─────────────────────────────────────────────────────────────────────────────
// writeIngressTLSContext – exercise the TLS section write
// ─────────────────────────────────────────────────────────────────────────────

func TestWriteIngressTLSContext_WithTLS(t *testing.T) {
	var sb strings.Builder
	tlsConfigs := []networkingv1.IngressTLS{
		{Hosts: []string{"example.com"}, SecretName: "tls-secret"},
	}
	writeIngressTLSContext(&sb, tlsConfigs)
	if sb.Len() == 0 {
		t.Error("expected non-empty TLS context output")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// ingress_tls_expiry.go
// ─────────────────────────────────────────────────────────────────────────────

// TestParseCertificateExpiry_Empty covers the "break" and "no certificate found" paths.
func TestParseCertificateExpiry_Empty(t *testing.T) {
	nb, na, days, errMsg := parseCertificateExpiry([]byte{}, time.Now())
	if nb != "-" || na != "-" || days != 0 || errMsg != "no certificate found" {
		t.Errorf("unexpected result for empty input: nb=%q na=%q days=%d err=%q", nb, na, days, errMsg)
	}
}

// TestParseCertificateExpiry_NonPEM covers same break+no-cert via non-PEM data.
func TestParseCertificateExpiry_NonPEM(t *testing.T) {
	nb, na, _, errMsg := parseCertificateExpiry([]byte("not pem data"), time.Now())
	if nb != "-" || na != "-" || errMsg != "no certificate found" {
		t.Errorf("unexpected: nb=%q na=%q err=%q", nb, na, errMsg)
	}
}

// TestParseCertificateExpiry_InvalidCertBlock covers x509.ParseCertificate error.
func TestParseCertificateExpiry_InvalidCertBlock(t *testing.T) {
	block := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: []byte("invalid-der")})
	_, _, _, errMsg := parseCertificateExpiry(block, time.Now())
	if errMsg == "" {
		t.Error("expected parse error for invalid DER content")
	}
}

// TestParseCertificateExpiry_ValidCert covers the success path.
func TestParseCertificateExpiry_ValidCert(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "test"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(48 * time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create cert: %v", err)
	}
	pemBlock := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	nb, na, days, errMsg := parseCertificateExpiry(pemBlock, time.Now())
	if nb == "-" || na == "-" || days < 0 || errMsg != "" {
		t.Errorf("unexpected cert parse: nb=%q na=%q days=%d err=%q", nb, na, days, errMsg)
	}
}

// TestGetIngressTLSSummary_GetK8sError covers getKubernetesInterface error.
func TestGetIngressTLSSummary_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetIngressTLSSummary("default", "my-ingress")
	if err == nil {
		t.Error("expected error when no K8s context")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// informer_manager.go
// ─────────────────────────────────────────────────────────────────────────────

// TestNormalizeNamespaces_EmptyStringFiltered covers the "continue" branch.
func TestNormalizeNamespaces_EmptyStringFiltered(t *testing.T) {
	result := normalizeNamespaces([]string{"", "default", "", "kube-system"})
	if len(result) != 2 {
		t.Errorf("expected 2 namespaces, got %d: %v", len(result), result)
	}
}

// TestInformerManagerStart_AlreadyStarted covers the early-return when already started.
func TestInformerManagerStart_AlreadyStarted(t *testing.T) {
	im := &InformerManager{started: true}
	err := im.Start()
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// monitor_actions.go
// ─────────────────────────────────────────────────────────────────────────────

// TestEnrichMonitorInfo_LoadError covers the error branch that iterates Warnings/Errors.
func TestEnrichMonitorInfo_LoadError(t *testing.T) {
	dir := t.TempDir()
	badFile := dir + "/issues.json"
	if err := os.WriteFile(badFile, []byte("{invalid json!!}"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}
	t.Setenv("KDB_MONITOR_ISSUES_PATH", badFile)

	app := &App{}
	info := MonitorInfo{
		Warnings: []MonitorIssue{{Name: "pod1", Namespace: "default", Resource: "Pod", Reason: "Test"}},
		Errors:   []MonitorIssue{{Name: "dep1", Namespace: "default", Resource: "Deployment", Reason: "Fail"}},
	}
	result := app.enrichMonitorInfo(info)
	if len(result.Warnings) == 0 || result.Warnings[0].IssueID == "" {
		t.Error("expected warning IssueID to be generated on load error")
	}
	if len(result.Errors) == 0 || result.Errors[0].IssueID == "" {
		t.Error("expected error IssueID to be generated on load error")
	}
}

// TestScanClusterHealth_GetK8sError covers getKubernetesInterface error.
func TestScanClusterHealth_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().ScanClusterHealth()
	if err == nil {
		t.Error("expected error from ScanClusterHealth with no K8s context")
	}
}

// TestGetResourceContextMonitor_PodSuccess covers "return ctx" branch for pod.
func TestGetResourceContextMonitor_PodSuccess(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
		Status:     corev1.PodStatus{Phase: corev1.PodRunning},
	}
	cs := fake.NewSimpleClientset(pod)
	app := &App{ctx: context.Background(), testClientset: cs}
	ctxStr := app.getResourceContext("pod", "default", "test-pod")
	_ = ctxStr
}

// TestGetResourceContextMonitor_DeploymentSuccess covers "return ctx" for deployment.
func TestGetResourceContextMonitor_DeploymentSuccess(t *testing.T) {
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "test-dep", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
		},
	}
	cs := fake.NewSimpleClientset(dep)
	app := &App{ctx: context.Background(), testClientset: cs}
	_ = app.getResourceContext("deployment", "default", "test-dep")
}

// TestGetResourceContextMonitor_StatefulSetSuccess covers "return ctx" for statefulset.
func TestGetResourceContextMonitor_StatefulSetSuccess(t *testing.T) {
	ss := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "test-ss", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ss"}},
		},
	}
	cs := fake.NewSimpleClientset(ss)
	app := &App{ctx: context.Background(), testClientset: cs}
	_ = app.getResourceContext("statefulset", "default", "test-ss")
}

// TestGetResourceContextMonitor_DaemonSetSuccess covers "return ctx" for daemonset.
func TestGetResourceContextMonitor_DaemonSetSuccess(t *testing.T) {
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "default"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ds"}},
		},
	}
	cs := fake.NewSimpleClientset(ds)
	app := &App{ctx: context.Background(), testClientset: cs}
	_ = app.getResourceContext("daemonset", "default", "test-ds")
}

// TestPersistIssueAnalysis_LoadError covers loadPersistedIssues error path.
func TestPersistIssueAnalysis_LoadError(t *testing.T) {
	dir := t.TempDir()
	badFile := dir + "/issues.json"
	if err := os.WriteFile(badFile, []byte("{bad json}"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}
	t.Setenv("KDB_MONITOR_ISSUES_PATH", badFile)

	app := &App{}
	issue := &MonitorIssue{IssueID: "test-id", HolmesAnalysis: "some analysis"}
	err := app.persistIssueAnalysis(issue)
	if err == nil {
		t.Error("expected error when loadPersistedIssues fails")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// monitor.go – checkContainerStatus terminated branch
// ─────────────────────────────────────────────────────────────────────────────

// TestCheckContainerStatus_TerminatedNonZeroExit covers the terminated + non-zero exit path.
func TestCheckContainerStatus_TerminatedNonZeroExit(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "crash-pod", Namespace: "default"},
	}
	ctx := newPodIssueContext("default", pod)
	cs := corev1.ContainerStatus{
		Name: "app",
		State: corev1.ContainerState{
			Terminated: &corev1.ContainerStateTerminated{
				ExitCode: 1,
				Reason:   "Error",
			},
		},
	}
	issues := checkContainerStatus(ctx, cs, false)
	found := false
	for _, i := range issues {
		if i.Type == "error" {
			found = true
		}
	}
	if !found {
		t.Error("expected error issue for terminated container with non-zero exit code")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// events.go – convertEventsV1Event Series branch
// ─────────────────────────────────────────────────────────────────────────────

// TestConvertEventsV1Event_WithSeries covers the "e.Series != nil" branch.
func TestConvertEventsV1Event_WithSeries(t *testing.T) {
	now := metav1.NewMicroTime(time.Now())
	e := eventsv1.Event{
		ObjectMeta:  metav1.ObjectMeta{Name: "evt1", Namespace: "default"},
		Series:      &eventsv1.EventSeries{Count: 5, LastObservedTime: now},
		Type:        "Warning",
		Reason:      "Backoff",
		Note:        "Back-off restarting failed container",
		EventTime:   now,
		ReportingController: "kubelet",
	}
	info := convertEventsV1Event(e)
	if info.Count != 5 {
		t.Errorf("expected count=5 from Series, got %d", info.Count)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// pod_details.go – getClient errors
// ─────────────────────────────────────────────────────────────────────────────

func TestGetPodDetailInNamespace_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetPodDetailInNamespace("default", "pod1")
	if err == nil {
		t.Error("expected error")
	}
}

func TestGetPodSummary_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetPodSummary("pod1")
	if err == nil {
		t.Error("expected error")
	}
}

func TestGetPodContainerPorts_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetPodContainerPorts("pod1")
	if err == nil {
		t.Error("expected error")
	}
}

func TestGetPodMounts_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetPodMounts("pod1")
	if err == nil {
		t.Error("expected error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// nodes.go
// ─────────────────────────────────────────────────────────────────────────────

func TestGetNodeDetail_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetNodeDetail("node1")
	if err == nil {
		t.Error("expected error")
	}
}

func TestGetPodsOnNode_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetPodsOnNode("node1")
	if err == nil {
		t.Error("expected error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// ingresses.go
// ─────────────────────────────────────────────────────────────────────────────

func TestGetIngresses_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetIngresses("default")
	if err == nil {
		t.Error("expected error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// horizontalpodautoscalers.go
// ─────────────────────────────────────────────────────────────────────────────

func TestGetHPAs_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetHorizontalPodAutoscalers("default")
	if err == nil {
		t.Error("expected error")
	}
}

func TestGetHPADetail_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetHorizontalPodAutoscalerDetail("default", "hpa1")
	if err == nil {
		t.Error("expected error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// serviceaccounts.go
// ─────────────────────────────────────────────────────────────────────────────

func TestGetServiceAccounts_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetServiceAccounts("default")
	if err == nil {
		t.Error("expected error")
	}
}

func TestGetServiceAccountDetail_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetServiceAccountDetail("default", "sa1")
	if err == nil {
		t.Error("expected error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// k8s_diagnostics.go
// ─────────────────────────────────────────────────────────────────────────────

func TestGetPodLogsPrevious_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetPodLogsPrevious("default", "pod1", "container1", 100)
	if err == nil {
		t.Error("expected error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// tab_counts.go
// ─────────────────────────────────────────────────────────────────────────────

func TestGetAllTabCounts_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetAllTabCounts("default", "Pod", "pod1")
	_ = err
}

func TestGetResourceEventsCount_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetResourceEventsCount("default", "Pod", "pod1")
	_ = err
}

func TestGetPodsCountForResource_GetK8sError(t *testing.T) {
	_, err := newAppNoCtx().GetPodsCountForResource("default", "Deployment", "dep1")
	_ = err
}

// ─────────────────────────────────────────────────────────────────────────────
// config.go – loadConfig with directory (non-NotExist error)
// ─────────────────────────────────────────────────────────────────────────────

// TestLoadConfig_DirAsPath covers the "return err" branch when configPath is a directory.
func TestLoadConfig_DirAsPath(t *testing.T) {
	dir := t.TempDir()
	app := &App{configPath: dir}
	err := app.loadConfig()
	if err == nil {
		t.Error("expected error when configPath is a directory")
	}
}
