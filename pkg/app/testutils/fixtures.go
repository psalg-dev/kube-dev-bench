package testutils

import (
	"io/ioutil"
	"os"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// MakePod constructs a simple Pod object with a single container for tests.
func MakePod(namespace, name, containerName string) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			CreationTimestamp: metav1.Time{Time: time.Now().Add(-time.Minute)},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{{
				Name:  containerName,
				Image: "busybox",
			}},
		},
		Status: corev1.PodStatus{},
	}
}

// MakePVC constructs a minimal PersistentVolumeClaim for tests.
func MakePVC(namespace, name string) *corev1.PersistentVolumeClaim {
	return &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: corev1.PersistentVolumeClaimSpec{},
	}
}

// MakeConfigMap constructs a ConfigMap with provided data.
func MakeConfigMap(namespace, name string, data map[string]string) *corev1.ConfigMap {
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Data: data,
	}
}

// TempDir creates a temporary directory and returns the path and a cleanup func.
func TempDir(prefix string) (string, func(), error) {
	d, err := ioutil.TempDir("", prefix)
	if err != nil {
		return "", nil, err
	}
	cleanup := func() {
		_ = os.RemoveAll(d)
	}
	return d, cleanup, nil
}
