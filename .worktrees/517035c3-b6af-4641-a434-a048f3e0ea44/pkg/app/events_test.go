package app

import (
	"context"
	"testing"
	"time"

	v1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetPodEvents function
func TestGetPodEvents(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	now := time.Now()

	// Create events for a pod
	events := []v1.Event{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "event-1",
				Namespace: "default",
			},
			InvolvedObject: v1.ObjectReference{
				Name:      "test-pod",
				Namespace: "default",
				Kind:      "Pod",
			},
			Type:           "Normal",
			Reason:         "Scheduled",
			Message:        "Successfully assigned pod to node",
			Count:          1,
			FirstTimestamp: metav1.NewTime(now.Add(-5 * time.Minute)),
			LastTimestamp:  metav1.NewTime(now.Add(-5 * time.Minute)),
			Source: v1.EventSource{
				Component: "scheduler",
				Host:      "kube-scheduler",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "event-2",
				Namespace: "default",
			},
			InvolvedObject: v1.ObjectReference{
				Name:      "test-pod",
				Namespace: "default",
				Kind:      "Pod",
			},
			Type:           "Normal",
			Reason:         "Pulling",
			Message:        "Pulling image",
			Count:          1,
			FirstTimestamp: metav1.NewTime(now.Add(-4 * time.Minute)),
			LastTimestamp:  metav1.NewTime(now.Add(-4 * time.Minute)),
			Source: v1.EventSource{
				Component: "kubelet",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "event-other-pod",
				Namespace: "default",
			},
			InvolvedObject: v1.ObjectReference{
				Name:      "other-pod",
				Namespace: "default",
				Kind:      "Pod",
			},
			Type:    "Warning",
			Reason:  "Failed",
			Message: "Container failed",
		},
	}

	for _, e := range events {
		_, err := clientset.CoreV1().Events("default").Create(
			context.Background(), &e, metav1.CreateOptions{})
		if err != nil {
			t.Fatalf("failed to create event: %v", err)
		}
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetPodEvents("default", "test-pod")
	if err != nil {
		t.Fatalf("GetPodEvents failed: %v", err)
	}

	// Should only get events for test-pod (2 events)
	if len(result) != 2 {
		t.Errorf("expected 2 events for test-pod, got %d", len(result))
	}
}

func TestGetPodEvents_NoEvents(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetPodEvents("default", "nonexistent-pod")
	if err != nil {
		t.Fatalf("GetPodEvents failed: %v", err)
	}

	if len(result) != 0 {
		t.Errorf("expected 0 events, got %d", len(result))
	}
}

func TestGetPodEvents_UsesCurrentNamespace(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	// Create an event in my-namespace
	event := &v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "event-1",
			Namespace: "my-namespace",
		},
		InvolvedObject: v1.ObjectReference{
			Name:      "test-pod",
			Namespace: "my-namespace",
			Kind:      "Pod",
		},
		Type:    "Normal",
		Reason:  "Started",
		Message: "Container started",
	}

	_, err := clientset.CoreV1().Events("my-namespace").Create(
		context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "my-namespace",
	}

	// Pass empty namespace - should use currentNamespace
	result, err := app.GetPodEvents("", "test-pod")
	if err != nil {
		t.Fatalf("GetPodEvents failed: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 event using current namespace, got %d", len(result))
	}
}

func TestGetPodEvents_NoNamespaceSelected(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		testClientset:    fake.NewSimpleClientset(),
		currentNamespace: "",
	}

	_, err := app.GetPodEvents("", "test-pod")
	if err == nil {
		t.Error("expected error for no namespace selected")
	}
}

func TestGetPodEvents_EventDetails(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	now := time.Now()
	event := &v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "event-1",
			Namespace: "default",
		},
		InvolvedObject: v1.ObjectReference{
			Name:      "test-pod",
			Namespace: "default",
			Kind:      "Pod",
		},
		Type:           "Warning",
		Reason:         "Unhealthy",
		Message:        "Liveness probe failed: connection refused",
		Count:          5,
		FirstTimestamp: metav1.NewTime(now.Add(-10 * time.Minute)),
		LastTimestamp:  metav1.NewTime(now),
		Source: v1.EventSource{
			Component: "kubelet",
			Host:      "node-1",
		},
	}

	_, err := clientset.CoreV1().Events("default").Create(
		context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetPodEvents("default", "test-pod")
	if err != nil {
		t.Fatalf("GetPodEvents failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 event, got %d", len(result))
	}

	e := result[0]
	if e.Type != "Warning" {
		t.Errorf("expected type 'Warning', got %q", e.Type)
	}
	if e.Reason != "Unhealthy" {
		t.Errorf("expected reason 'Unhealthy', got %q", e.Reason)
	}
	if e.Message != "Liveness probe failed: connection refused" {
		t.Errorf("expected message 'Liveness probe failed: connection refused', got %q", e.Message)
	}
	if e.Count != 5 {
		t.Errorf("expected count 5, got %d", e.Count)
	}
	if e.Source != "kubelet/node-1" {
		t.Errorf("expected source 'kubelet/node-1', got %q", e.Source)
	}
}

// Tests for GetResourceEvents function
func TestGetResourceEvents(t *testing.T) {
	tests := []struct {
		name          string
		namespace     string
		kind          string
		resourceName  string
		events        []v1.Event
		expectedCount int
	}{
		{
			name:         "deployment events",
			namespace:    "default",
			kind:         "Deployment",
			resourceName: "my-deployment",
			events: []v1.Event{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "deploy-event-1", Namespace: "default"},
					InvolvedObject: v1.ObjectReference{
						Name: "my-deployment", Namespace: "default", Kind: "Deployment",
					},
					Type:    "Normal",
					Reason:  "ScalingReplicaSet",
					Message: "Scaled up replica set",
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "deploy-event-2", Namespace: "default"},
					InvolvedObject: v1.ObjectReference{
						Name: "other-deployment", Namespace: "default", Kind: "Deployment",
					},
					Type:   "Normal",
					Reason: "ScalingReplicaSet",
				},
			},
			expectedCount: 1,
		},
		{
			name:         "job events",
			namespace:    "default",
			kind:         "Job",
			resourceName: "my-job",
			events: []v1.Event{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "job-event-1", Namespace: "default"},
					InvolvedObject: v1.ObjectReference{
						Name: "my-job", Namespace: "default", Kind: "Job",
					},
					Type:    "Normal",
					Reason:  "Completed",
					Message: "Job completed",
				},
			},
			expectedCount: 1,
		},
		{
			name:          "no events",
			namespace:     "default",
			kind:          "ConfigMap",
			resourceName:  "my-configmap",
			events:        []v1.Event{},
			expectedCount: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()

			for _, e := range tc.events {
				_, err := clientset.CoreV1().Events(e.Namespace).Create(
					context.Background(), &e, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create event: %v", err)
				}
			}

			app := &App{
				ctx:              context.Background(),
				testClientset:    clientset,
				currentNamespace: tc.namespace,
			}

			result, err := app.GetResourceEvents(tc.namespace, tc.kind, tc.resourceName)
			if err != nil {
				t.Fatalf("GetResourceEvents failed: %v", err)
			}

			if len(result) != tc.expectedCount {
				t.Errorf("expected %d events, got %d", tc.expectedCount, len(result))
			}
		})
	}
}

// Tests for GetPodEventsLegacy function
func TestGetPodEventsLegacy(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	now := time.Now()
	event := &v1.Event{
		ObjectMeta: metav1.ObjectMeta{Name: "legacy-event", Namespace: "default"},
		InvolvedObject: v1.ObjectReference{
			Name: "legacy-pod", Namespace: "default", Kind: "Pod",
		},
		Type:           "Normal",
		Reason:         "Scheduled",
		Message:        "Successfully scheduled",
		FirstTimestamp: metav1.NewTime(now),
		LastTimestamp:  metav1.NewTime(now),
	}
	_, err := clientset.CoreV1().Events("default").Create(context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetPodEventsLegacy("legacy-pod")
	if err != nil {
		t.Fatalf("GetPodEventsLegacy failed: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 event, got %d", len(result))
	}
}

func TestGetPodEvents_EventsV1API(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	now := time.Now()

	// Create an EventsV1 style event
	event := &eventsv1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "eventsv1-event-1",
			Namespace: "default",
		},
		Regarding: v1.ObjectReference{
			Name:      "test-pod",
			Namespace: "default",
			Kind:      "Pod",
		},
		Type:   "Normal",
		Reason: "Pulling",
		Note:   "Pulling image nginx:latest",
		EventTime: metav1.MicroTime{
			Time: now,
		},
		DeprecatedFirstTimestamp: metav1.NewTime(now.Add(-5 * time.Minute)),
		DeprecatedLastTimestamp:  metav1.NewTime(now),
		DeprecatedCount:          3,
		DeprecatedSource: v1.EventSource{
			Component: "kubelet",
			Host:      "node-1",
		},
		ReportingController: "kubelet",
		ReportingInstance:   "node-1",
	}

	_, err := clientset.EventsV1().Events("default").Create(
		context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create EventsV1 event: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetPodEvents("default", "test-pod")
	if err != nil {
		t.Fatalf("GetPodEvents failed: %v", err)
	}

	// Should get the EventsV1 event
	if len(result) != 1 {
		t.Errorf("expected 1 EventsV1 event, got %d", len(result))
	}

	if result[0].Reason != "Pulling" {
		t.Errorf("expected Reason 'Pulling', got %q", result[0].Reason)
	}
	if result[0].Message != "Pulling image nginx:latest" {
		t.Errorf("expected Note message, got %q", result[0].Message)
	}
	if result[0].Count != 3 {
		t.Errorf("expected Count 3, got %d", result[0].Count)
	}
}

func TestGetPodEvents_EventsV1WithSeries(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	now := time.Now()

	// Create an EventsV1 event with Series
	event := &eventsv1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "eventsv1-series-event",
			Namespace: "default",
		},
		Regarding: v1.ObjectReference{
			Name:      "test-pod",
			Namespace: "default",
			Kind:      "Pod",
		},
		Type:   "Warning",
		Reason: "Unhealthy",
		Note:   "Liveness probe failed",
		EventTime: metav1.MicroTime{
			Time: now,
		},
		Series: &eventsv1.EventSeries{
			Count:            10,
			LastObservedTime: metav1.MicroTime{Time: now},
		},
		ReportingController: "kubelet",
	}

	_, err := clientset.EventsV1().Events("default").Create(
		context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create EventsV1 event with series: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetPodEvents("default", "test-pod")
	if err != nil {
		t.Fatalf("GetPodEvents failed: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 event, got %d", len(result))
	}

	// When Series is present, Count should come from Series.Count
	if result[0].Count != 10 {
		t.Errorf("expected Count from Series (10), got %d", result[0].Count)
	}
}

// Tests for GetResourceEvents
func TestGetResourceEvents_Deployment(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	now := time.Now()

	// Create a deployment event
	event := &v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "deploy-event-1",
			Namespace: "default",
		},
		InvolvedObject: v1.ObjectReference{
			Name:      "my-deployment",
			Namespace: "default",
			Kind:      "Deployment",
		},
		Type:           "Normal",
		Reason:         "ScalingReplicaSet",
		Message:        "Scaled up replica set to 3",
		Count:          1,
		FirstTimestamp: metav1.NewTime(now.Add(-5 * time.Minute)),
		LastTimestamp:  metav1.NewTime(now),
		Source: v1.EventSource{
			Component: "deployment-controller",
		},
	}

	_, err := clientset.CoreV1().Events("default").Create(context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetResourceEvents("default", "Deployment", "my-deployment")
	if err != nil {
		t.Fatalf("GetResourceEvents failed: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 event, got %d", len(result))
	}
	if result[0].Reason != "ScalingReplicaSet" {
		t.Errorf("expected Reason 'ScalingReplicaSet', got %q", result[0].Reason)
	}
}

func TestGetResourceEvents_PersistentVolume(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	now := time.Now()

	// Create a PV event (cluster-scoped - no namespace)
	event := &v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "pv-event-1",
			Namespace: "", // cluster-scoped events might be in default namespace
		},
		InvolvedObject: v1.ObjectReference{
			Name: "my-pv",
			Kind: "PersistentVolume",
		},
		Type:           "Normal",
		Reason:         "Provisioned",
		Message:        "Volume provisioned successfully",
		FirstTimestamp: metav1.NewTime(now),
		LastTimestamp:  metav1.NewTime(now),
	}

	// Events for cluster-scoped resources are typically in the default namespace
	_, err := clientset.CoreV1().Events("").Create(context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	// PersistentVolume is cluster-scoped, namespace should be ignored
	result, err := app.GetResourceEvents("", "PersistentVolume", "my-pv")
	if err != nil {
		t.Fatalf("GetResourceEvents failed: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 event for PV, got %d", len(result))
	}
}

func TestGetResourceEvents_UsesCurrentNamespace(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	event := &v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "cm-event",
			Namespace: "my-namespace",
		},
		InvolvedObject: v1.ObjectReference{
			Name:      "my-config",
			Namespace: "my-namespace",
			Kind:      "ConfigMap",
		},
		Type:    "Normal",
		Reason:  "Updated",
		Message: "ConfigMap updated",
	}

	_, err := clientset.CoreV1().Events("my-namespace").Create(context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "my-namespace",
	}

	// Empty namespace should use currentNamespace
	result, err := app.GetResourceEvents("", "ConfigMap", "my-config")
	if err != nil {
		t.Fatalf("GetResourceEvents failed: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 event, got %d", len(result))
	}
}

func TestGetResourceEvents_NoNamespaceSelected(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		testClientset:    fake.NewSimpleClientset(),
		currentNamespace: "",
	}

	_, err := app.GetResourceEvents("", "Deployment", "test")
	if err == nil {
		t.Error("expected error for no namespace selected")
	}
}

func TestGetResourceEvents_EventsV1API(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	now := time.Now()

	event := &eventsv1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "job-event-v1",
			Namespace: "default",
		},
		Regarding: v1.ObjectReference{
			Name:      "my-job",
			Namespace: "default",
			Kind:      "Job",
		},
		Type:   "Normal",
		Reason: "Completed",
		Note:   "Job completed successfully",
		EventTime: metav1.MicroTime{
			Time: now,
		},
		DeprecatedCount:     1,
		ReportingController: "job-controller",
	}

	_, err := clientset.EventsV1().Events("default").Create(context.Background(), event, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create EventsV1 event: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetResourceEvents("default", "Job", "my-job")
	if err != nil {
		t.Fatalf("GetResourceEvents failed: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 EventsV1 event, got %d", len(result))
	}
	if result[0].Message != "Job completed successfully" {
		t.Errorf("expected Note message, got %q", result[0].Message)
	}
}

// Tests for parseEventTime function
func TestParseEventTime(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantZero bool
	}{
		{
			name:     "empty string",
			input:    "",
			wantZero: true,
		},
		{
			name:     "RFC3339Nano format",
			input:    "2024-01-15T10:30:45.123456789Z",
			wantZero: false,
		},
		{
			name:     "RFC3339 format",
			input:    "2024-01-15T10:30:45Z",
			wantZero: false,
		},
		{
			name:     "invalid format",
			input:    "not a time",
			wantZero: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseEventTime(tt.input)
			if tt.wantZero {
				if !result.IsZero() {
					t.Errorf("expected zero time, got %v", result)
				}
			} else {
				if result.IsZero() {
					t.Errorf("expected non-zero time, got zero")
				}
			}
		})
	}
}

// Tests for formatEventTime function
func TestFormatEventTime(t *testing.T) {
	tests := []struct {
		name     string
		input    time.Time
		expected string
	}{
		{
			name:     "zero time",
			input:    time.Time{},
			expected: "",
		},
		{
			name:     "valid time",
			input:    time.Date(2024, 1, 15, 10, 30, 45, 123456789, time.UTC),
			expected: "2024-01-15T10:30:45.123456789Z",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatEventTime(tt.input)
			if result != tt.expected {
				t.Errorf("formatEventTime() = %q, want %q", result, tt.expected)
			}
		})
	}
}
