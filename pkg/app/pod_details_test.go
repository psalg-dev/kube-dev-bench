package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for shEscape function
func TestShEscape_Empty(t *testing.T) {
	result := shEscape("")
	if result != "" {
		t.Errorf("shEscape(\"\") = %q, want %q", result, "")
	}
}

func TestShEscape_NoSpecialChars(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"simple", "simple"},
		{"path/to/file", "path/to/file"},
		{"file.txt", "file.txt"},
		{"abc123", "abc123"},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			result := shEscape(tc.input)
			if result != tc.expected {
				t.Errorf("shEscape(%q) = %q, want %q", tc.input, result, tc.expected)
			}
		})
	}
}

func TestShEscape_WithSpecialChars(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"space", "hello world", "'hello world'"},
		{"single quote", "it's", "'it'\\''s'"},
		{"backtick", "cmd`echo`", "'cmd`echo`'"},
		{"double quote", "say \"hello\"", "'say \"hello\"'"},
		{"dollar", "var $HOME", "'var $HOME'"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := shEscape(tc.input)
			if result != tc.expected {
				t.Errorf("shEscape(%q) = %q, want %q", tc.input, result, tc.expected)
			}
		})
	}
}

func TestBuildInitContainerInfo_NoInitContainers(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-pod",
			Namespace: "default",
		},
		Spec: corev1.PodSpec{
			InitContainers: []corev1.Container{},
		},
	}

	result := buildInitContainerInfo(pod)
	if result != nil {
		t.Errorf("expected nil for pod with no init containers, got %v", result)
	}
}

func TestBuildInitContainerInfo_WithInitContainers(t *testing.T) {
	exitCode := int32(0)
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-pod",
			Namespace: "default",
		},
		Spec: corev1.PodSpec{
			InitContainers: []corev1.Container{
				{
					Name:  "init-config",
					Image: "busybox:1.28",
				},
				{
					Name:  "init-network",
					Image: "alpine:3.12",
				},
			},
		},
		Status: corev1.PodStatus{
			InitContainerStatuses: []corev1.ContainerStatus{
				{
					Name:         "init-config",
					Ready:        true,
					RestartCount: 0,
					State: corev1.ContainerState{
						Terminated: &corev1.ContainerStateTerminated{
							ExitCode: exitCode,
							Reason:   "Completed",
						},
					},
				},
				{
					Name:         "init-network",
					Ready:        false,
					RestartCount: 1,
					State: corev1.ContainerState{
						Running: &corev1.ContainerStateRunning{},
					},
				},
			},
		},
	}

	result := buildInitContainerInfo(pod)

	if len(result) != 2 {
		t.Fatalf("expected 2 init containers, got %d", len(result))
	}

	// Check first init container (terminated)
	if result[0].Name != "init-config" {
		t.Errorf("expected name 'init-config', got %s", result[0].Name)
	}
	if result[0].Image != "busybox:1.28" {
		t.Errorf("expected image 'busybox:1.28', got %s", result[0].Image)
	}
	if result[0].State != "Terminated" {
		t.Errorf("expected state 'Terminated', got %s", result[0].State)
	}
	if result[0].StateReason != "Completed" {
		t.Errorf("expected reason 'Completed', got %s", result[0].StateReason)
	}
	if result[0].ExitCode == nil || *result[0].ExitCode != 0 {
		t.Errorf("expected exit code 0, got %v", result[0].ExitCode)
	}

	// Check second init container (running)
	if result[1].Name != "init-network" {
		t.Errorf("expected name 'init-network', got %s", result[1].Name)
	}
	if result[1].State != "Running" {
		t.Errorf("expected state 'Running', got %s", result[1].State)
	}
	if result[1].RestartCount != 1 {
		t.Errorf("expected restart count 1, got %d", result[1].RestartCount)
	}
}

func TestBuildInitContainerInfo_WaitingState(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-pod",
			Namespace: "default",
		},
		Spec: corev1.PodSpec{
			InitContainers: []corev1.Container{
				{
					Name:  "init-wait",
					Image: "busybox",
				},
			},
		},
		Status: corev1.PodStatus{
			InitContainerStatuses: []corev1.ContainerStatus{
				{
					Name:  "init-wait",
					Ready: false,
					State: corev1.ContainerState{
						Waiting: &corev1.ContainerStateWaiting{
							Reason:  "ImagePullBackOff",
							Message: "Back-off pulling image",
						},
					},
				},
			},
		},
	}

	result := buildInitContainerInfo(pod)

	if len(result) != 1 {
		t.Fatalf("expected 1 init container, got %d", len(result))
	}

	if result[0].State != "Waiting" {
		t.Errorf("expected state 'Waiting', got %s", result[0].State)
	}
	if result[0].StateReason != "ImagePullBackOff" {
		t.Errorf("expected reason 'ImagePullBackOff', got %s", result[0].StateReason)
	}
	if result[0].StateMessage != "Back-off pulling image" {
		t.Errorf("expected message 'Back-off pulling image', got %s", result[0].StateMessage)
	}
}

func TestBuildInitContainerInfo_NoStatusYet(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-pod",
			Namespace: "default",
		},
		Spec: corev1.PodSpec{
			InitContainers: []corev1.Container{
				{
					Name:  "init-pending",
					Image: "busybox",
				},
			},
		},
		Status: corev1.PodStatus{
			InitContainerStatuses: []corev1.ContainerStatus{},
		},
	}

	result := buildInitContainerInfo(pod)

	if len(result) != 1 {
		t.Fatalf("expected 1 init container, got %d", len(result))
	}

	if result[0].State != "Pending" {
		t.Errorf("expected state 'Pending', got %s", result[0].State)
	}
	if result[0].StateReason != "ContainerNotStarted" {
		t.Errorf("expected reason 'ContainerNotStarted', got %s", result[0].StateReason)
	}
}

func TestGetPodSummary_Success(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-pod",
				Namespace: "default",
				Labels: map[string]string{
					"app": "test",
				},
			},
			Spec: corev1.PodSpec{
				Containers: []corev1.Container{
					{
						Name:  "main",
						Image: "nginx:latest",
						Ports: []corev1.ContainerPort{
							{ContainerPort: 80},
							{ContainerPort: 443},
						},
					},
				},
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset, currentNamespace: "default"}

	summary, err := app.GetPodSummary("test-pod")
	if err != nil {
		t.Fatalf("GetPodSummary failed: %v", err)
	}

	if summary.Name != "test-pod" {
		t.Errorf("expected name 'test-pod', got %s", summary.Name)
	}
	if summary.Namespace != "default" {
		t.Errorf("expected namespace 'default', got %s", summary.Namespace)
	}
	if summary.Status != "Running" {
		t.Errorf("expected status 'Running', got %s", summary.Status)
	}
	if len(summary.Ports) != 2 {
		t.Errorf("expected 2 ports, got %d", len(summary.Ports))
	}
}

func TestGetPodSummary_NoNamespace(t *testing.T) {
	app := &App{ctx: context.Background(), currentNamespace: ""}

	_, err := app.GetPodSummary("test-pod")
	if err == nil {
		t.Fatal("expected error for no namespace selected")
	}
}

// Tests for defaultShortTimeout function
func TestDefaultShortTimeout(t *testing.T) {
	timeout := defaultShortTimeout()
	if timeout.Seconds() != 5 {
		t.Errorf("defaultShortTimeout() = %v, want 5s", timeout)
	}
}

// Tests for GetPodYAML
func TestGetPodYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-pod",
			Namespace: "default",
			Labels:    map[string]string{"app": "test"},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{{Name: "main", Image: "nginx"}},
		},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	yaml, err := app.GetPodYAML("test-pod")
	if err != nil {
		t.Fatalf("GetPodYAML failed: %v", err)
	}

	if yaml == "" {
		t.Error("expected non-empty YAML")
	}

	// Should contain pod name
	if len(yaml) < 10 {
		t.Error("expected longer YAML output")
	}
}

func TestGetPodYAML_NoNamespace(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		currentNamespace: "",
	}

	_, err := app.GetPodYAML("test-pod")
	if err == nil {
		t.Error("expected error when no namespace selected")
	}
}

// Tests for GetPodContainers
func TestGetPodContainers(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{Name: "main", Image: "nginx"},
				{Name: "sidecar", Image: "busybox"},
			},
		},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	containers, err := app.GetPodContainers("test-pod")
	if err != nil {
		t.Fatalf("GetPodContainers failed: %v", err)
	}

	if len(containers) != 2 {
		t.Errorf("expected 2 containers, got %d", len(containers))
	}
}

// Tests for GetPodSummary
func TestGetPodSummary(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-pod",
			Namespace: "default",
			Labels:    map[string]string{"app": "test"},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:  "main",
					Image: "nginx",
					Ports: []corev1.ContainerPort{{ContainerPort: 80}, {ContainerPort: 443}},
				},
			},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	summary, err := app.GetPodSummary("test-pod")
	if err != nil {
		t.Fatalf("GetPodSummary failed: %v", err)
	}

	if summary.Name != "test-pod" {
		t.Errorf("expected name 'test-pod', got %q", summary.Name)
	}
	if summary.Status != "Running" {
		t.Errorf("expected status 'Running', got %q", summary.Status)
	}
	if len(summary.Ports) != 2 {
		t.Errorf("expected 2 ports, got %d", len(summary.Ports))
	}
}

// Tests for GetPodContainerPorts
func TestGetPodContainerPorts(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:  "main",
					Image: "nginx",
					Ports: []corev1.ContainerPort{
						{ContainerPort: 80},
						{ContainerPort: 443},
					},
				},
				{
					Name:  "sidecar",
					Image: "envoy",
					Ports: []corev1.ContainerPort{
						{ContainerPort: 8080},
					},
				},
			},
		},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	ports, err := app.GetPodContainerPorts("test-pod")
	if err != nil {
		t.Fatalf("GetPodContainerPorts failed: %v", err)
	}

	if len(ports) != 3 {
		t.Errorf("expected 3 ports, got %d", len(ports))
	}
}

// Tests for GetPodMounts
func TestGetPodMounts(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
		Spec: corev1.PodSpec{
			InitContainers: []corev1.Container{
				{
					Name:  "init",
					Image: "busybox",
					VolumeMounts: []corev1.VolumeMount{
						{Name: "scratch", MountPath: "/scratch"},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:  "main",
					Image: "nginx",
					VolumeMounts: []corev1.VolumeMount{
						{Name: "config", MountPath: "/etc/config", ReadOnly: true},
						{Name: "secret", MountPath: "/etc/secret", SubPath: "subdir"},
						{Name: "pvc", MountPath: "/data"},
						{Name: "hostpath", MountPath: "/host"},
						{Name: "scratch", MountPath: "/tmp"},
						{Name: "projected", MountPath: "/etc/projected"},
						{Name: "downward", MountPath: "/etc/podinfo"},
						{Name: "csi", MountPath: "/csi"},
						{Name: "other", MountPath: "/other"},
					},
				},
			},
			Volumes: []corev1.Volume{
				{
					Name: "config",
					VolumeSource: corev1.VolumeSource{
						ConfigMap: &corev1.ConfigMapVolumeSource{
							LocalObjectReference: corev1.LocalObjectReference{Name: "my-config"},
						},
					},
				},
				{
					Name: "secret",
					VolumeSource: corev1.VolumeSource{
						Secret: &corev1.SecretVolumeSource{SecretName: "my-secret"},
					},
				},
				{
					Name: "pvc",
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
							ClaimName: "my-pvc",
						},
					},
				},
				{
					Name: "hostpath",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{Path: "/var/log"},
					},
				},
				{
					Name: "scratch",
					VolumeSource: corev1.VolumeSource{
						EmptyDir: &corev1.EmptyDirVolumeSource{},
					},
				},
				{
					Name: "projected",
					VolumeSource: corev1.VolumeSource{
						Projected: &corev1.ProjectedVolumeSource{
							Sources: []corev1.VolumeProjection{
								{
									Secret: &corev1.SecretProjection{
										LocalObjectReference: corev1.LocalObjectReference{Name: "proj-secret"},
									},
								},
								{
									ConfigMap: &corev1.ConfigMapProjection{
										LocalObjectReference: corev1.LocalObjectReference{Name: "proj-config"},
									},
								},
							},
						},
					},
				},
				{
					Name: "downward",
					VolumeSource: corev1.VolumeSource{
						DownwardAPI: &corev1.DownwardAPIVolumeSource{},
					},
				},
				{
					Name: "csi",
					VolumeSource: corev1.VolumeSource{
						CSI: &corev1.CSIVolumeSource{
							Driver: "csi.example.com",
						},
					},
				},
				{
					Name: "other",
					VolumeSource: corev1.VolumeSource{
						// A volume type not explicitly handled
						GitRepo: &corev1.GitRepoVolumeSource{
							Repository: "https://github.com/example/repo",
						},
					},
				},
			},
		},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	mounts, err := app.GetPodMounts("test-pod")
	if err != nil {
		t.Fatalf("GetPodMounts failed: %v", err)
	}

	if len(mounts.Volumes) != 9 {
		t.Errorf("expected 9 volumes, got %d", len(mounts.Volumes))
	}

	// Verify all volume types are correctly identified
	volumeTypes := map[string]string{}
	for _, v := range mounts.Volumes {
		volumeTypes[v.Name] = v.Type
	}

	expectedTypes := map[string]string{
		"config":    "ConfigMap",
		"secret":    "Secret",
		"pvc":       "PVC",
		"hostpath":  "HostPath",
		"scratch":   "EmptyDir",
		"projected": "Projected",
		"downward":  "DownwardAPI",
		"csi":       "CSI",
		"other":     "Other",
	}

	for name, expectedType := range expectedTypes {
		if volumeTypes[name] != expectedType {
			t.Errorf("volume %s: expected type %s, got %s", name, expectedType, volumeTypes[name])
		}
	}

	// Verify containers (should have 2: init + main)
	if len(mounts.Containers) != 2 {
		t.Errorf("expected 2 containers, got %d", len(mounts.Containers))
	}

	// Verify init container is marked correctly
	if len(mounts.Containers) > 0 && !mounts.Containers[0].IsInit {
		t.Error("expected first container to be init container")
	}

	// Verify main container has all mounts
	if len(mounts.Containers) > 1 {
		mainContainer := mounts.Containers[1]
		if mainContainer.Container != "main" {
			t.Errorf("expected main container, got %s", mainContainer.Container)
		}
		if len(mainContainer.Mounts) != 9 {
			t.Errorf("expected 9 mounts in main container, got %d", len(mainContainer.Mounts))
		}
	}

	// Verify mount details (ReadOnly, SubPath)
	for _, c := range mounts.Containers {
		if c.Container == "main" {
			for _, m := range c.Mounts {
				if m.Name == "config" && !m.ReadOnly {
					t.Error("expected config mount to be ReadOnly")
				}
				if m.Name == "secret" && m.SubPath != "subdir" {
					t.Errorf("expected secret mount SubPath 'subdir', got %q", m.SubPath)
				}
			}
		}
	}
}
