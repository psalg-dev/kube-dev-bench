package app

import (
	"fmt"
	"time"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

// RoleInfo represents summary information about a Kubernetes role
type RoleInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace,omitempty"`
	Age         string            `json:"age"`
	Rules       []PolicyRule      `json:"rules"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Raw         interface{}       `json:"raw,omitempty"`
}

// PolicyRule represents a single RBAC policy rule
type PolicyRule struct {
	APIGroups     []string `json:"apiGroups"`
	Resources     []string `json:"resources"`
	Verbs         []string `json:"verbs"`
	ResourceNames []string `json:"resourceNames,omitempty"`
}

// GetRoles returns all roles in the specified namespace
func (a *App) GetRoles(namespace string) ([]RoleInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("missing required parameter: namespace")
	}

	if factory, ok := a.getInformerNamespaceFactory(namespace); ok {
		roles, err := factory.Rbac().V1().Roles().Lister().Roles(namespace).List(labels.Everything())
		if err == nil {
			now := time.Now()
			result := make([]RoleInfo, 0, len(roles))
			for _, role := range roles {
				result = append(result, buildRoleInfo(role, now))
			}
			return result, nil
		}
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	roles, err := clientset.RbacV1().Roles(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]RoleInfo, 0, len(roles.Items))

	for _, role := range roles.Items {
		info := buildRoleInfo(&role, now)
		result = append(result, info)
	}

	return result, nil
}

// GetClusterRoles returns all cluster roles
func (a *App) GetClusterRoles() ([]RoleInfo, error) {
	if factory, ok := a.getInformerClusterFactory(); ok {
		clusterRoles, err := factory.Rbac().V1().ClusterRoles().Lister().List(labels.Everything())
		if err == nil {
			now := time.Now()
			result := make([]RoleInfo, 0, len(clusterRoles))
			for _, clusterRole := range clusterRoles {
				result = append(result, buildClusterRoleInfo(clusterRole, now))
			}
			return result, nil
		}
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	clusterRoles, err := clientset.RbacV1().ClusterRoles().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]RoleInfo, 0, len(clusterRoles.Items))

	for _, clusterRole := range clusterRoles.Items {
		info := buildClusterRoleInfo(&clusterRole, now)
		result = append(result, info)
	}

	return result, nil
}

// buildRoleInfo constructs a RoleInfo from a Role
func buildRoleInfo(role *rbacv1.Role, now time.Time) RoleInfo {
	age := "-"
	if !role.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(role.CreationTimestamp.Time))
	}

	// Convert rules
	rules := make([]PolicyRule, 0, len(role.Rules))
	for _, rule := range role.Rules {
		rules = append(rules, PolicyRule{
			APIGroups:     rule.APIGroups,
			Resources:     rule.Resources,
			Verbs:         rule.Verbs,
			ResourceNames: rule.ResourceNames,
		})
	}

	return RoleInfo{
		Name:        role.Name,
		Namespace:   role.Namespace,
		Age:         age,
		Rules:       rules,
		Labels:      role.Labels,
		Annotations: role.Annotations,
		Raw:         role,
	}
}

// buildClusterRoleInfo constructs a RoleInfo from a ClusterRole
func buildClusterRoleInfo(clusterRole *rbacv1.ClusterRole, now time.Time) RoleInfo {
	age := "-"
	if !clusterRole.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(clusterRole.CreationTimestamp.Time))
	}

	// Convert rules
	rules := make([]PolicyRule, 0, len(clusterRole.Rules))
	for _, rule := range clusterRole.Rules {
		rules = append(rules, PolicyRule{
			APIGroups:     rule.APIGroups,
			Resources:     rule.Resources,
			Verbs:         rule.Verbs,
			ResourceNames: rule.ResourceNames,
		})
	}

	return RoleInfo{
		Name:        clusterRole.Name,
		Age:         age,
		Rules:       rules,
		Labels:      clusterRole.Labels,
		Annotations: clusterRole.Annotations,
		Raw:         clusterRole,
	}
}

// GetRoleDetail returns detailed information about a specific role
func (a *App) GetRoleDetail(namespace, name string) (*RoleInfo, error) {
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

	role, err := clientset.RbacV1().Roles(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildRoleInfo(role, time.Now())
	return &info, nil
}

// GetClusterRoleDetail returns detailed information about a specific cluster role
func (a *App) GetClusterRoleDetail(name string) (*RoleInfo, error) {
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	clusterRole, err := clientset.RbacV1().ClusterRoles().Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildClusterRoleInfo(clusterRole, time.Now())
	return &info, nil
}
