package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetNetworkPolicies_ReturnsNetworkPolicies(t *testing.T) {
	ctx := context.Background()

	protocol := corev1.ProtocolTCP
	port := intstr.FromInt(80)

	clientset := fake.NewSimpleClientset(
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "allow-web",
				Namespace: "default",
				Labels: map[string]string{
					"app": "web",
				},
				Annotations: map[string]string{
					"description": "allow web traffic",
				},
			},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{
					MatchLabels: map[string]string{
						"app": "web",
					},
				},
				PolicyTypes: []networkingv1.PolicyType{
					networkingv1.PolicyTypeIngress,
					networkingv1.PolicyTypeEgress,
				},
				Ingress: []networkingv1.NetworkPolicyIngressRule{
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: &protocol,
								Port:     &port,
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"role": "frontend",
									},
								},
							},
						},
					},
				},
			},
		},
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "deny-all",
				Namespace: "default",
			},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{},
				PolicyTypes: []networkingv1.PolicyType{
					networkingv1.PolicyTypeIngress,
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	networkPolicies, err := app.GetNetworkPolicies("default")
	if err != nil {
		t.Fatalf("GetNetworkPolicies failed: %v", err)
	}

	if len(networkPolicies) != 2 {
		t.Fatalf("expected 2 network policies, got %d", len(networkPolicies))
	}

	// Verify first network policy details
	if networkPolicies[0].Name != "allow-web" {
		t.Errorf("expected network policy name 'allow-web', got '%s'", networkPolicies[0].Name)
	}
	if networkPolicies[0].Namespace != "default" {
		t.Errorf("expected namespace 'default', got '%s'", networkPolicies[0].Namespace)
	}
	if len(networkPolicies[0].PolicyTypes) != 2 {
		t.Errorf("expected 2 policy types, got %d", len(networkPolicies[0].PolicyTypes))
	}
	if len(networkPolicies[0].Ingress) != 1 {
		t.Errorf("expected 1 ingress rule, got %d", len(networkPolicies[0].Ingress))
	}
}

func TestGetNetworkPolicies_NoNetworkPolicies(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	networkPolicies, err := app.GetNetworkPolicies("default")
	if err != nil {
		t.Fatalf("GetNetworkPolicies failed: %v", err)
	}

	if len(networkPolicies) != 0 {
		t.Errorf("expected 0 network policies, got %d", len(networkPolicies))
	}
}

func TestGetNetworkPolicies_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetNetworkPolicies("")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetNetworkPolicyDetail_ReturnsNetworkPolicy(t *testing.T) {
	ctx := context.Background()

	protocol := corev1.ProtocolTCP
	port := intstr.FromInt(443)

	clientset := fake.NewSimpleClientset(
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "allow-web",
				Namespace: "default",
			},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{
					MatchLabels: map[string]string{
						"app": "web",
					},
				},
				PolicyTypes: []networkingv1.PolicyType{
					networkingv1.PolicyTypeIngress,
				},
				Ingress: []networkingv1.NetworkPolicyIngressRule{
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: &protocol,
								Port:     &port,
							},
						},
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	np, err := app.GetNetworkPolicyDetail("default", "allow-web")
	if err != nil {
		t.Fatalf("GetNetworkPolicyDetail failed: %v", err)
	}

	if np.Name != "allow-web" {
		t.Errorf("expected network policy name 'allow-web', got '%s'", np.Name)
	}
	if len(np.Ingress) != 1 {
		t.Errorf("expected 1 ingress rule, got %d", len(np.Ingress))
	}
	if len(np.Ingress[0].Ports) != 1 {
		t.Errorf("expected 1 port, got %d", len(np.Ingress[0].Ports))
	}
	if np.Ingress[0].Ports[0].Port != "443" {
		t.Errorf("expected port '443', got '%s'", np.Ingress[0].Ports[0].Port)
	}
}

func TestGetNetworkPolicyDetail_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetNetworkPolicyDetail("", "allow-web")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetNetworkPolicyDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetNetworkPolicyDetail("default", "")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestBuildNetworkPolicyInfo_WithEgress(t *testing.T) {
	protocol := corev1.ProtocolUDP
	port := intstr.FromInt(53)

	np := &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "allow-dns",
			Namespace: "default",
		},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{},
			PolicyTypes: []networkingv1.PolicyType{
				networkingv1.PolicyTypeEgress,
			},
			Egress: []networkingv1.NetworkPolicyEgressRule{
				{
					Ports: []networkingv1.NetworkPolicyPort{
						{
							Protocol: &protocol,
							Port:     &port,
						},
					},
					To: []networkingv1.NetworkPolicyPeer{
						{
							NamespaceSelector: &metav1.LabelSelector{
								MatchLabels: map[string]string{
									"name": "kube-system",
								},
							},
						},
						{
							IPBlock: &networkingv1.IPBlock{CIDR: "10.0.0.0/8", Except: []string{"10.96.0.0/12"}},
						},
					},
				},
			},
		},
	}

	info := buildNetworkPolicyInfo(np, metav1.Now().Time)

	if len(info.Egress) != 1 {
		t.Errorf("expected 1 egress rule, got %d", len(info.Egress))
	}
	if len(info.Egress[0].To) != 2 {
		t.Errorf("expected 2 destination peers, got %d", len(info.Egress[0].To))
	}
	if info.Egress[0].Ports[0].Protocol != "UDP" {
		t.Errorf("expected protocol 'UDP', got '%s'", info.Egress[0].Ports[0].Protocol)
	}
	if info.Egress[0].To[1].IPBlock == nil {
		t.Fatalf("expected second egress peer to include IPBlock")
	}
	if info.Egress[0].To[1].IPBlock.CIDR != "10.0.0.0/8" {
		t.Errorf("expected CIDR '10.0.0.0/8', got %q", info.Egress[0].To[1].IPBlock.CIDR)
	}
}
