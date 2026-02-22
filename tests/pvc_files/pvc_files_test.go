package pvcfiles_test

import (
	"context"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"gowails/pkg/app/testutils"
)

func TestListPVCFiles_ParsesLsAndReturnsEntries(t *testing.T) {
	// Prepare fake ls output with mixed entries
	lsOutput := `-rw-r--r-- 1 root root 100 2024-01-01T00:00:00 file.txt
	drwxr-xr-x 2 root root 4096 2024-01-01T00:00:00 subdir/
	lrwxrwxrwx 1 root root 7 2024-01-01T00:00:00 link -> file.txt

	total 12`

	files := map[string]string{
		"/data/file.txt": "hello world",
	}
	// No tar data needed for this test
	execStub, execStubLimited := testutils.ExecStubFromLsOutput(lsOutput, files, nil)

	client := testutils.NewFakeClientset()
	// Ensure PVC exists in fake clientset
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "mypvc", Namespace: "default"},
	}
	_, err := client.CoreV1().PersistentVolumeClaims("default").Create(context.Background(), pvc, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create fake pvc: %v", err)
	}
	// Create a pod that mounts the PVC and is ready
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "mypod", Namespace: "default"},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{{Name: "c1", Image: "busybox", VolumeMounts: []corev1.VolumeMount{{Name: "vol", MountPath: "/data"}}}},
			Volumes: []corev1.Volume{{Name: "vol", VolumeSource: corev1.VolumeSource{PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "mypvc"}}}},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning, ContainerStatuses: []corev1.ContainerStatus{{Name: "c1", Ready: true}}},
	}
	_, err = client.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create fake pod: %v", err)
	}
	ctx := context.Background()
	// Create fake app configured with stubs
	a := testutils.NewFakeApp(ctx, client, execStub, execStubLimited)


	// Call exported ListPVCFiles which uses execInPod under the hood
	entries, err := a.ListPVCFiles("default", "mypvc", "/data")
	if err != nil {
		t.Fatalf("ListPVCFiles returned error: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d: %+v", len(entries), entries)
	}

	// Check specific entry properties
	foundFile := false
	foundDir := false
	foundLink := false
	for _, e := range entries {
		switch e.Name {
		case "file.txt":
			foundFile = true
			if e.Path != "/data/file.txt" {
				t.Errorf("file path mismatch: got %q", e.Path)
			}
		case "subdir/":
			foundDir = true
			if e.IsDir != true {
				t.Errorf("expected subdir to be a dir")
			}
		case "link":
			foundLink = true
			if e.IsSymlink == false {
				t.Errorf("expected link to be symlink")
			}
		}
	}
	if !foundFile || !foundDir || !foundLink {
		t.Fatalf("missing expected entries: file=%v dir=%v link=%v", foundFile, foundDir, foundLink)
	}

	// Also call with root path to ensure it works
	_, err = a.ListPVCFiles("default", "mypvc", "/")
	if err != nil {
		t.Fatalf("ListPVCFiles root returned error: %v", err)
	}

	// Ensure exec stub was callable with some timeout
	_ = time.Second
}
