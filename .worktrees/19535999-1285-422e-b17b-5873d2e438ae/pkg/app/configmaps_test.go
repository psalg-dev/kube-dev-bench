package app

import (
	"context"
	"fmt"
	"testing"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

// Tests for GetConfigMaps function
func TestGetConfigMaps(t *testing.T) {
	tests := []struct {
		name       string
		namespace  string
		configMaps []v1.ConfigMap
		expected   int
	}{
		{
			name:       "empty namespace",
			namespace:  "default",
			configMaps: []v1.ConfigMap{},
			expected:   0,
		},
		{
			name:      "single configmap",
			namespace: "default",
			configMaps: []v1.ConfigMap{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "my-config",
						Namespace: "default",
						Labels:    map[string]string{"app": "myapp"},
					},
					Data: map[string]string{
						"key1": "value1",
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple configmaps",
			namespace: "default",
			configMaps: []v1.ConfigMap{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "config1", Namespace: "default"},
					Data:       map[string]string{"key1": "value1"},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "config2", Namespace: "default"},
					Data:       map[string]string{"key2": "value2"},
				},
			},
			expected: 2,
		},
		{
			name:      "configmaps in different namespaces",
			namespace: "target-ns",
			configMaps: []v1.ConfigMap{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "config1", Namespace: "target-ns"},
					Data:       map[string]string{"key1": "value1"},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "config2", Namespace: "other-ns"},
					Data:       map[string]string{"key2": "value2"},
				},
			},
			expected: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			for _, cm := range tc.configMaps {
				_, err := clientset.CoreV1().ConfigMaps(cm.Namespace).Create(
					context.Background(), &cm, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create configmap: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetConfigMaps(tc.namespace)
			if err != nil {
				t.Fatalf("GetConfigMaps failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetConfigMaps(%q) returned %d configmaps, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestGetConfigMaps_Details(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	cm := &v1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "app-config",
			Namespace: "default",
			Labels:    map[string]string{"app": "myapp", "env": "prod"},
		},
		Data: map[string]string{
			"config.json":    `{"key":"value"}`,
			"settings.yaml":  "setting: value",
			"database.props": "host=localhost",
		},
		BinaryData: map[string][]byte{
			"binary.dat": []byte{0x01, 0x02, 0x03},
		},
	}

	_, err := clientset.CoreV1().ConfigMaps("default").Create(
		context.Background(), cm, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create configmap: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetConfigMaps("default")
	if err != nil {
		t.Fatalf("GetConfigMaps failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 configmap, got %d", len(result))
	}

	c := result[0]
	if c.Name != "app-config" {
		t.Errorf("expected name 'app-config', got %q", c.Name)
	}
	if c.Namespace != "default" {
		t.Errorf("expected namespace 'default', got %q", c.Namespace)
	}
	// 3 data keys + 1 binary data key = 4 keys total
	if c.Keys != 4 {
		t.Errorf("expected 4 keys, got %d", c.Keys)
	}
	// Check labels
	if c.Labels["app"] != "myapp" {
		t.Errorf("expected label app=myapp, got %q", c.Labels["app"])
	}
	if c.Labels["env"] != "prod" {
		t.Errorf("expected label env=prod, got %q", c.Labels["env"])
	}
}

func TestGetConfigMaps_EmptyConfigMap(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	cm := &v1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "empty-config",
			Namespace: "default",
		},
		// No Data or BinaryData
	}

	_, err := clientset.CoreV1().ConfigMaps("default").Create(
		context.Background(), cm, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create configmap: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetConfigMaps("default")
	if err != nil {
		t.Fatalf("GetConfigMaps failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 configmap, got %d", len(result))
	}

	if result[0].Keys != 0 {
		t.Errorf("expected 0 keys for empty configmap, got %d", result[0].Keys)
	}
}

func TestGetConfigMaps_ListError(t *testing.T) {
	cs := fake.NewSimpleClientset()
	cs.PrependReactor("list", "configmaps", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated list error")
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	result, err := app.GetConfigMaps("default")
	if err == nil {
		t.Fatal("expected error from GetConfigMaps when list fails")
	}
	if result != nil && len(result) != 0 {
		t.Errorf("expected empty result on list error, got %d", len(result))
	}
}
