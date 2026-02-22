package app

import (
	"context"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestConvertCoreV1Event_FallbackTimesAndSource(t *testing.T) {
	e := corev1.Event{
		Type:   "Warning",
		Reason: "BackOff",
		Message: "restart",
		Source: corev1.EventSource{Component: "kubelet", Host: "node1"},
		EventTime: metav1.MicroTime{Time: time.Now()},
	}
	info := convertCoreV1Event(e)
	if info.Source != "kubelet/node1" {
		t.Fatalf("source = %q, want kubelet/node1", info.Source)
	}
	if info.LastTimestamp == "" || info.FirstTimestamp == "" {
		t.Fatal("timestamps should be set from EventTime when Last/First are zero")
	}
}

func TestConvertEventsV1Event_SeriesCountAndSource(t *testing.T) {
	e := eventsv1.Event{
		Type:   "Normal",
		Reason: "Created",
		Note:   "obj",
		DeprecatedSource: corev1.EventSource{Component: "controller", Host: "node2"},
		Series:  &eventsv1.EventSeries{Count: 3},
		EventTime: metav1.MicroTime{Time: time.Now()},
	}
	info := convertEventsV1Event(e)
	if info.Count != 3 || info.Source != "controller/node2" {
		t.Fatalf("unexpected info: %+v", info)
	}
}

func TestSortEventsByTime_Descending(t *testing.T) {
	now := time.Now()
	a := EventInfo{LastTimestamp: formatEventTime(now.Add(-1 * time.Hour))}
	b := EventInfo{LastTimestamp: formatEventTime(now)}
	list := []EventInfo{a, b}
	sortEventsByTime(list)
	if list[0].LastTimestamp != b.LastTimestamp {
		t.Fatalf("expected newest first, got %+v", list)
	}
}

func TestCollectAndSortEvents_FromBothApis(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(
		&corev1.Event{
			ObjectMeta: metav1.ObjectMeta{Name: "e1", Namespace: ns},
			InvolvedObject: corev1.ObjectReference{Kind: "Pod", Name: "p1"},
			Reason: "Started",
			Message: "pod",
		},
		&eventsv1.Event{
			ObjectMeta: metav1.ObjectMeta{Name: "e2", Namespace: ns},
			Regarding:  corev1.ObjectReference{Kind: "Pod", Name: "p1"},
			Type:       "Normal",
			Reason:     "Pulled",
			Note:       "image",
		},
	)
	app := &App{ctx: context.Background(), testClientset: cs}
	matcher := func(name, kind string) bool { return true }
	res := app.collectAndSortEvents(cs, ns, matcher)
	if len(res) != 2 {
		t.Fatalf("expected 2 events collected, got %d", len(res))
	}
}
