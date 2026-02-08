package app

import (
	"context"
	"strings"
	"testing"
)

func TestValidatePortForwardParams_FallbackAndErrors(t *testing.T) {
	app := &App{currentNamespace: "ns1"}
	ns, err := app.validatePortForwardParams("", "pod1", 8080, 80)
	if err != nil || ns != "ns1" {
		t.Fatalf("expected fallback namespace ns1, got ns=%q err=%v", ns, err)
	}
	if _, err := app.validatePortForwardParams("", "", 8080, 80); err == nil {
		t.Fatal("expected error for missing pod name")
	}
	if _, err := app.validatePortForwardParams("ns", "pod", 0, 80); err == nil {
		t.Fatal("expected error for invalid ports")
	}
	ns2, err := app.validatePortForwardParams("ns2", "pod", 8080, 80)
	if err != nil || ns2 != "ns2" {
		t.Fatalf("expected explicit namespace ns2, got ns=%q err=%v", ns2, err)
	}
}

func TestBuildKubectlCmd_ArgsContainExpectedFlags(t *testing.T) {
	tmpCfg := "C:/tmp/kubeconfig.yaml"
	app := &App{currentKubeContext: "kind-kind", kubeConfig: tmpCfg}
	cmd := app.buildKubectlCmd(context.Background(), "ns1", "pod1", 8080, 80)
	if !(strings.HasSuffix(cmd.Path, "kubectl") || strings.HasSuffix(cmd.Path, "kubectl.exe")) {
		t.Fatalf("unexpected kubectl path: %s", cmd.Path)
	}
	args := strings.Join(cmd.Args, " ")
	for _, want := range []string{"--kubeconfig " + tmpCfg, "--context kind-kind", "-n ns1", "port-forward", "pod/pod1", "8080:80"} {
		if !strings.Contains(args, want) {
			t.Fatalf("args missing %q: %s", want, args)
		}
	}
}

func TestCheckForwardingReady_MatchesVariants(t *testing.T) {
	ports := []string{"127.0.0.1", "[::1]", "localhost", "0.0.0.0"}
	for _, host := range ports {
		line := "Forwarding from " + host + ":8080"
		if !checkForwardingReady(line, 8080) {
			t.Fatalf("expected ready for %q", line)
		}
	}
	if checkForwardingReady("starting port-forward", 8080) {
		t.Fatal("unexpected ready match for non-ready line")
	}
}

func TestListAndFindPortForwards(t *testing.T) {
	disableWailsEvents = true
	defer func() { disableWailsEvents = false }()

	key1 := "ns1/p1:8080:80"
	key2 := "ns2/p2:3000:3000"
	portForwardSessions.Store(key1, &PortForwardSession{})
	portForwardSessions.Store(key2, &PortForwardSession{})

	app := &App{}
	list, err := app.ListPortForwards()
	if err != nil {
		t.Fatalf("ListPortForwards error: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(list))
	}
	found := findPortForwardSessionKey("ns1", "p1", 8080)
	if found != key1 {
		t.Fatalf("findPortForwardSessionKey => %q, want %q", found, key1)
	}

	portForwardSessions.Delete(key1)
	portForwardSessions.Delete(key2)
}

func TestStopPortForward_RemovesAndCancels(t *testing.T) {
	disableWailsEvents = true
	defer func() { disableWailsEvents = false }()

	called := false
	key := "ns1/p1:8080:80"
	portForwardSessions.Store(key, &PortForwardSession{Cancel: func() { called = true }})

	app := &App{currentNamespace: "ns1"}
	if err := app.StopPortForward("ns1", "p1", 8080); err != nil {
		t.Fatalf("StopPortForward error: %v", err)
	}
	if _, ok := portForwardSessions.Load(key); ok {
		t.Fatal("session not removed")
	}
	if !called {
		t.Fatal("cancel not invoked")
	}
	if err := app.StopPortForward("ns1", "p1", 8080); err == nil {
		t.Fatal("expected error when session no longer exists")
	}
}
