package app

import (
	"fmt"
	"time"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NetworkPolicyInfo represents summary information about a Kubernetes network policy
type NetworkPolicyInfo struct {
	Name        string                     `json:"name"`
	Namespace   string                     `json:"namespace"`
	Age         string                     `json:"age"`
	PodSelector map[string]string          `json:"podSelector"`
	PolicyTypes []string                   `json:"policyTypes"`
	Ingress     []NetworkPolicyIngressRule `json:"ingress,omitempty"`
	Egress      []NetworkPolicyEgressRule  `json:"egress,omitempty"`
	Labels      map[string]string          `json:"labels"`
	Annotations map[string]string          `json:"annotations"`
	Raw         interface{}                `json:"raw,omitempty"`
}

// NetworkPolicyIngressRule represents an ingress rule
type NetworkPolicyIngressRule struct {
	Ports []NetworkPolicyPort `json:"ports,omitempty"`
	From  []NetworkPolicyPeer `json:"from,omitempty"`
}

// NetworkPolicyEgressRule represents an egress rule
type NetworkPolicyEgressRule struct {
	Ports []NetworkPolicyPort `json:"ports,omitempty"`
	To    []NetworkPolicyPeer `json:"to,omitempty"`
}

// NetworkPolicyPort represents a protocol and port
type NetworkPolicyPort struct {
	Protocol string `json:"protocol,omitempty"`
	Port     string `json:"port,omitempty"`
}

// NetworkPolicyPeer represents a peer (source or destination)
type NetworkPolicyPeer struct {
	PodSelector       map[string]string `json:"podSelector,omitempty"`
	NamespaceSelector map[string]string `json:"namespaceSelector,omitempty"`
	IPBlock           *IPBlockRule      `json:"ipBlock,omitempty"`
}

type IPBlockRule struct {
	CIDR   string   `json:"cidr"`
	Except []string `json:"except,omitempty"`
}

// GetNetworkPolicies returns all network policies in the specified namespace
func (a *App) GetNetworkPolicies(namespace string) ([]NetworkPolicyInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("missing required parameter: namespace")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	networkPolicies, err := clientset.NetworkingV1().NetworkPolicies(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]NetworkPolicyInfo, 0, len(networkPolicies.Items))

	for _, np := range networkPolicies.Items {
		info := buildNetworkPolicyInfo(&np, now)
		result = append(result, info)
	}

	return result, nil
}

// buildNetworkPolicyInfo constructs a NetworkPolicyInfo from a NetworkPolicy
func buildNetworkPolicyInfo(np *networkingv1.NetworkPolicy, now time.Time) NetworkPolicyInfo {
	age := "-"
	if !np.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(np.CreationTimestamp.Time))
	}

	// Extract pod selector
	podSelector := np.Spec.PodSelector.MatchLabels

	// Extract policy types
	policyTypes := make([]string, 0, len(np.Spec.PolicyTypes))
	for _, pt := range np.Spec.PolicyTypes {
		policyTypes = append(policyTypes, string(pt))
	}

	// Convert ingress rules
	ingress := make([]NetworkPolicyIngressRule, 0, len(np.Spec.Ingress))
	for _, rule := range np.Spec.Ingress {
		ingress = append(ingress, convertIngressRule(rule))
	}

	// Convert egress rules
	egress := make([]NetworkPolicyEgressRule, 0, len(np.Spec.Egress))
	for _, rule := range np.Spec.Egress {
		egress = append(egress, convertEgressRule(rule))
	}

	return NetworkPolicyInfo{
		Name:        np.Name,
		Namespace:   np.Namespace,
		Age:         age,
		PodSelector: podSelector,
		PolicyTypes: policyTypes,
		Ingress:     ingress,
		Egress:      egress,
		Labels:      np.Labels,
		Annotations: np.Annotations,
		Raw:         np,
	}
}

// convertIngressRule converts a NetworkPolicyIngressRule
func convertIngressRule(rule networkingv1.NetworkPolicyIngressRule) NetworkPolicyIngressRule {
	ports := make([]NetworkPolicyPort, 0, len(rule.Ports))
	for _, port := range rule.Ports {
		protocol := ""
		if port.Protocol != nil {
			protocol = string(*port.Protocol)
		}
		portStr := ""
		if port.Port != nil {
			portStr = port.Port.String()
		}
		ports = append(ports, NetworkPolicyPort{
			Protocol: protocol,
			Port:     portStr,
		})
	}

	from := make([]NetworkPolicyPeer, 0, len(rule.From))
	for _, peer := range rule.From {
		from = append(from, convertPeer(peer))
	}

	return NetworkPolicyIngressRule{
		Ports: ports,
		From:  from,
	}
}

// convertEgressRule converts a NetworkPolicyEgressRule
func convertEgressRule(rule networkingv1.NetworkPolicyEgressRule) NetworkPolicyEgressRule {
	ports := make([]NetworkPolicyPort, 0, len(rule.Ports))
	for _, port := range rule.Ports {
		protocol := ""
		if port.Protocol != nil {
			protocol = string(*port.Protocol)
		}
		portStr := ""
		if port.Port != nil {
			portStr = port.Port.String()
		}
		ports = append(ports, NetworkPolicyPort{
			Protocol: protocol,
			Port:     portStr,
		})
	}

	to := make([]NetworkPolicyPeer, 0, len(rule.To))
	for _, peer := range rule.To {
		to = append(to, convertPeer(peer))
	}

	return NetworkPolicyEgressRule{
		Ports: ports,
		To:    to,
	}
}

// convertPeer converts a NetworkPolicyPeer
func convertPeer(peer networkingv1.NetworkPolicyPeer) NetworkPolicyPeer {
	result := NetworkPolicyPeer{}
	if peer.PodSelector != nil {
		result.PodSelector = peer.PodSelector.MatchLabels
	}
	if peer.NamespaceSelector != nil {
		result.NamespaceSelector = peer.NamespaceSelector.MatchLabels
	}
	if peer.IPBlock != nil {
		result.IPBlock = &IPBlockRule{
			CIDR:   peer.IPBlock.CIDR,
			Except: peer.IPBlock.Except,
		}
	}
	return result
}

// GetNetworkPolicyDetail returns detailed information about a specific network policy
func (a *App) GetNetworkPolicyDetail(namespace, name string) (*NetworkPolicyInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("missing required parameter: namespace")
	}
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	np, err := clientset.NetworkingV1().NetworkPolicies(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildNetworkPolicyInfo(np, time.Now())
	return &info, nil
}
