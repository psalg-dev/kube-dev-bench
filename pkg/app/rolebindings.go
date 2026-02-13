package app

import (
	"fmt"
	"time"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// RoleBindingInfo represents summary information about a Kubernetes role binding
type RoleBindingInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace,omitempty"`
	Age         string            `json:"age"`
	RoleRef     RoleRef           `json:"roleRef"`
	Subjects    []Subject         `json:"subjects"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Raw         interface{}       `json:"raw,omitempty"`
}

// RoleRef represents a reference to a role
type RoleRef struct {
	Kind     string `json:"kind"`
	Name     string `json:"name"`
	APIGroup string `json:"apiGroup"`
}

// Subject represents a subject (user, group, or service account) bound to a role
type Subject struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
	APIGroup  string `json:"apiGroup,omitempty"`
}

// GetRoleBindings returns all role bindings in the specified namespace
func (a *App) GetRoleBindings(namespace string) ([]RoleBindingInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("missing required parameter: namespace")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	roleBindings, err := clientset.RbacV1().RoleBindings(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]RoleBindingInfo, 0, len(roleBindings.Items))

	for _, rb := range roleBindings.Items {
		info := buildRoleBindingInfo(&rb, now)
		result = append(result, info)
	}

	return result, nil
}

// GetClusterRoleBindings returns all cluster role bindings
func (a *App) GetClusterRoleBindings() ([]RoleBindingInfo, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	clusterRoleBindings, err := clientset.RbacV1().ClusterRoleBindings().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]RoleBindingInfo, 0, len(clusterRoleBindings.Items))

	for _, crb := range clusterRoleBindings.Items {
		info := buildClusterRoleBindingInfo(&crb, now)
		result = append(result, info)
	}

	return result, nil
}

// buildRoleBindingInfo constructs a RoleBindingInfo from a RoleBinding
func buildRoleBindingInfo(rb *rbacv1.RoleBinding, now time.Time) RoleBindingInfo {
	age := "-"
	if !rb.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(rb.CreationTimestamp.Time))
	}

	// Convert subjects
	subjects := make([]Subject, 0, len(rb.Subjects))
	for _, subject := range rb.Subjects {
		subjects = append(subjects, Subject{
			Kind:      subject.Kind,
			Name:      subject.Name,
			Namespace: subject.Namespace,
			APIGroup:  subject.APIGroup,
		})
	}

	return RoleBindingInfo{
		Name:      rb.Name,
		Namespace: rb.Namespace,
		Age:       age,
		RoleRef: RoleRef{
			Kind:     rb.RoleRef.Kind,
			Name:     rb.RoleRef.Name,
			APIGroup: rb.RoleRef.APIGroup,
		},
		Subjects:    subjects,
		Labels:      rb.Labels,
		Annotations: rb.Annotations,
		Raw:         rb,
	}
}

// buildClusterRoleBindingInfo constructs a RoleBindingInfo from a ClusterRoleBinding
func buildClusterRoleBindingInfo(crb *rbacv1.ClusterRoleBinding, now time.Time) RoleBindingInfo {
	age := "-"
	if !crb.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(crb.CreationTimestamp.Time))
	}

	// Convert subjects
	subjects := make([]Subject, 0, len(crb.Subjects))
	for _, subject := range crb.Subjects {
		subjects = append(subjects, Subject{
			Kind:      subject.Kind,
			Name:      subject.Name,
			Namespace: subject.Namespace,
			APIGroup:  subject.APIGroup,
		})
	}

	return RoleBindingInfo{
		Name: crb.Name,
		Age:  age,
		RoleRef: RoleRef{
			Kind:     crb.RoleRef.Kind,
			Name:     crb.RoleRef.Name,
			APIGroup: crb.RoleRef.APIGroup,
		},
		Subjects:    subjects,
		Labels:      crb.Labels,
		Annotations: crb.Annotations,
		Raw:         crb,
	}
}

// GetRoleBindingDetail returns detailed information about a specific role binding
func (a *App) GetRoleBindingDetail(namespace, name string) (*RoleBindingInfo, error) {
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

	rb, err := clientset.RbacV1().RoleBindings(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildRoleBindingInfo(rb, time.Now())
	return &info, nil
}

// GetClusterRoleBindingDetail returns detailed information about a specific cluster role binding
func (a *App) GetClusterRoleBindingDetail(name string) (*RoleBindingInfo, error) {
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	crb, err := clientset.RbacV1().ClusterRoleBindings().Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildClusterRoleBindingInfo(crb, time.Now())
	return &info, nil
}

// GetRoleBindingSubjects returns the Subjects slice from a RoleBinding in order
func (a *App) GetRoleBindingSubjects(namespace, name string) ([]Subject, error) {
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
	rb, err := clientset.RbacV1().RoleBindings(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	subjects := make([]Subject, 0, len(rb.Subjects))
	for _, s := range rb.Subjects {
		subjects = append(subjects, Subject{
			Kind:      s.Kind,
			Name:      s.Name,
			Namespace: s.Namespace,
			APIGroup:  s.APIGroup,
		})
	}
	return subjects, nil
}

// GetClusterRoleBindingSubjects returns the Subjects slice from a ClusterRoleBinding in order
func (a *App) GetClusterRoleBindingSubjects(name string) ([]Subject, error) {
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}
	crb, err := clientset.RbacV1().ClusterRoleBindings().Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	subjects := make([]Subject, 0, len(crb.Subjects))
	for _, s := range crb.Subjects {
		subjects = append(subjects, Subject{
			Kind:      s.Kind,
			Name:      s.Name,
			Namespace: s.Namespace,
			APIGroup:  s.APIGroup,
		})
	}
	return subjects, nil
}
