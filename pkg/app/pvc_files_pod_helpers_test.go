package app

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
)

// ---------------------------------------------------------------------------
// TestIsPodReady – tests for isPodReady helper (pure, uses corev1 structs)
// ---------------------------------------------------------------------------

func TestIsPodReady(t *testing.T) {
	tests := []struct {
		name     string
		pod      corev1.Pod
		wantReady bool
	}{
		{
			name: "running pod with ready container",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase: corev1.PodRunning,
					ContainerStatuses: []corev1.ContainerStatus{
						{Ready: true},
					},
				},
			},
			wantReady: true,
		},
		{
			name: "running pod with no ready containers",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase: corev1.PodRunning,
					ContainerStatuses: []corev1.ContainerStatus{
						{Ready: false},
					},
				},
			},
			wantReady: false,
		},
		{
			name: "pending pod with ready container",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase: corev1.PodPending,
					ContainerStatuses: []corev1.ContainerStatus{
						{Ready: true},
					},
				},
			},
			wantReady: false,
		},
		{
			name: "running pod with no container statuses",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase:             corev1.PodRunning,
					ContainerStatuses: []corev1.ContainerStatus{},
				},
			},
			wantReady: false,
		},
		{
			name: "failed pod",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase: corev1.PodFailed,
					ContainerStatuses: []corev1.ContainerStatus{
						{Ready: true},
					},
				},
			},
			wantReady: false,
		},
		{
			name: "running pod with multiple containers, one ready",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase: corev1.PodRunning,
					ContainerStatuses: []corev1.ContainerStatus{
						{Ready: false},
						{Ready: true},
						{Ready: false},
					},
				},
			},
			wantReady: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isPodReady(&tc.pod)
			if got != tc.wantReady {
				t.Errorf("isPodReady()=%v, want %v", got, tc.wantReady)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestGetVolumeNamesForPVC – pure helper
// ---------------------------------------------------------------------------

func TestGetVolumeNamesForPVC(t *testing.T) {
	t.Run("single matching pvc volume", func(t *testing.T) {
		pod := corev1.Pod{
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{
					{
						Name: "data-vol",
						VolumeSource: corev1.VolumeSource{
							PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
								ClaimName: "my-pvc",
							},
						},
					},
				},
			},
		}
		result := getVolumeNamesForPVC(&pod, "my-pvc")
		if !result["data-vol"] {
			t.Errorf("expected 'data-vol' in result, got %v", result)
		}
		if len(result) != 1 {
			t.Errorf("expected 1 entry, got %d", len(result))
		}
	})

	t.Run("no matching volumes", func(t *testing.T) {
		pod := corev1.Pod{
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{
					{
						Name: "other-vol",
						VolumeSource: corev1.VolumeSource{
							PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
								ClaimName: "other-pvc",
							},
						},
					},
				},
			},
		}
		result := getVolumeNamesForPVC(&pod, "my-pvc")
		if len(result) != 0 {
			t.Errorf("expected 0 entries, got %d: %v", len(result), result)
		}
	})

	t.Run("multiple volumes, one matches", func(t *testing.T) {
		pod := corev1.Pod{
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{
					{
						Name: "config",
						VolumeSource: corev1.VolumeSource{
							PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
								ClaimName: "config-pvc",
							},
						},
					},
					{
						Name: "data",
						VolumeSource: corev1.VolumeSource{
							PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
								ClaimName: "data-pvc",
							},
						},
					},
				},
			},
		}
		result := getVolumeNamesForPVC(&pod, "data-pvc")
		if !result["data"] {
			t.Errorf("expected 'data' in result")
		}
		if result["config"] {
			t.Errorf("'config' should not be in result")
		}
	})

	t.Run("volume without pvc source", func(t *testing.T) {
		pod := corev1.Pod{
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{
					{
						Name:         "emptydir",
						VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
					},
				},
			},
		}
		result := getVolumeNamesForPVC(&pod, "my-pvc")
		if len(result) != 0 {
			t.Errorf("expected 0 entries for non-PVC volume, got %d", len(result))
		}
	})

	t.Run("empty volumes list", func(t *testing.T) {
		pod := corev1.Pod{Spec: corev1.PodSpec{Volumes: nil}}
		result := getVolumeNamesForPVC(&pod, "my-pvc")
		if len(result) != 0 {
			t.Errorf("expected 0 entries for pod with no volumes, got %d", len(result))
		}
	})
}

// ---------------------------------------------------------------------------
// TestFindContainerMountingVolume – pure helper
// ---------------------------------------------------------------------------

func TestFindContainerMountingVolume(t *testing.T) {
	t.Run("container mounts target volume", func(t *testing.T) {
		pod := corev1.Pod{
			Spec: corev1.PodSpec{
				Containers: []corev1.Container{
					{
						Name: "app",
						VolumeMounts: []corev1.VolumeMount{
							{Name: "data-vol", MountPath: "/mnt/data", SubPath: "sub"},
						},
					},
				},
			},
		}
		volNames := map[string]bool{"data-vol": true}
		cName, mPath, sPath, found := findContainerMountingVolume(&pod, volNames)
		if !found {
			t.Fatal("expected found=true")
		}
		if cName != "app" {
			t.Errorf("containerName=%q, want 'app'", cName)
		}
		if mPath != "/mnt/data" {
			t.Errorf("mountPath=%q, want '/mnt/data'", mPath)
		}
		if sPath != "sub" {
			t.Errorf("subPath=%q, want 'sub'", sPath)
		}
	})

	t.Run("no container mounts target volume", func(t *testing.T) {
		pod := corev1.Pod{
			Spec: corev1.PodSpec{
				Containers: []corev1.Container{
					{
						Name: "app",
						VolumeMounts: []corev1.VolumeMount{
							{Name: "other-vol", MountPath: "/mnt/other"},
						},
					},
				},
			},
		}
		volNames := map[string]bool{"data-vol": true}
		_, _, _, found := findContainerMountingVolume(&pod, volNames)
		if found {
			t.Error("expected found=false when no container mounts target volume")
		}
	})

	t.Run("multiple containers, second matches", func(t *testing.T) {
		pod := corev1.Pod{
			Spec: corev1.PodSpec{
				Containers: []corev1.Container{
					{
						Name:         "sidecar",
						VolumeMounts: []corev1.VolumeMount{{Name: "log-vol", MountPath: "/var/log"}},
					},
					{
						Name:         "main",
						VolumeMounts: []corev1.VolumeMount{{Name: "pvc-vol", MountPath: "/data"}},
					},
				},
			},
		}
		volNames := map[string]bool{"pvc-vol": true}
		cName, mPath, _, found := findContainerMountingVolume(&pod, volNames)
		if !found {
			t.Fatal("expected found=true")
		}
		if cName != "main" {
			t.Errorf("containerName=%q, want 'main'", cName)
		}
		if mPath != "/data" {
			t.Errorf("mountPath=%q, want '/data'", mPath)
		}
	})

	t.Run("empty containers list", func(t *testing.T) {
		pod := corev1.Pod{Spec: corev1.PodSpec{Containers: nil}}
		volNames := map[string]bool{"data-vol": true}
		_, _, _, found := findContainerMountingVolume(&pod, volNames)
		if found {
			t.Error("expected found=false for pod with no containers")
		}
	})
}
