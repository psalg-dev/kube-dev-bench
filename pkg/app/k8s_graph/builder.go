package k8s_graph

import (
	"context"
	"fmt"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

const (
	MaxDepth     = 3
	DefaultDepth = 2
)

// Builder constructs resource relationship graphs
type Builder struct {
	ctx       context.Context
	clientset kubernetes.Interface
}

// NewBuilder creates a new graph builder
func NewBuilder(ctx context.Context, clientset kubernetes.Interface) *Builder {
	return &Builder{
		ctx:       ctx,
		clientset: clientset,
	}
}

// BuildForResource builds a relationship graph centered on a specific resource
func (b *Builder) BuildForResource(namespace, kind, name string, depth int) (*ResourceGraph, error) {
	if depth < 1 {
		depth = DefaultDepth
	}
	if depth > MaxDepth {
		depth = MaxDepth
	}

	graph := &ResourceGraph{
		Nodes: []GraphNode{},
		Edges: []GraphEdge{},
	}

	// Create root node
	rootNode, err := b.createNode(namespace, kind, name)
	if err != nil {
		return nil, fmt.Errorf("failed to create root node: %w", err)
	}
	graph.AddNode(rootNode)

	// BFS expansion
	currentLevel := []GraphNode{rootNode}
	visited := make(map[string]bool)
	visited[rootNode.ID] = true

	for level := 0; level < depth; level++ {
		nextLevel := []GraphNode{}

		for _, node := range currentLevel {
			// Expand relationships for this node
			neighbors, edges, err := b.expandNode(node, graph)
			if err != nil {
				// Log error but continue with other nodes
				continue
			}

			// Add neighbors and edges to graph
			for _, neighbor := range neighbors {
				if !visited[neighbor.ID] {
					graph.AddNode(neighbor)
					visited[neighbor.ID] = true
					nextLevel = append(nextLevel, neighbor)
				}
			}

			for _, edge := range edges {
				graph.AddEdge(edge)
			}
		}

		currentLevel = nextLevel
		if len(currentLevel) == 0 {
			break // No more nodes to expand
		}
	}

	return graph, nil
}

// createNode creates a graph node for a resource
func (b *Builder) createNode(namespace, kind, name string) (GraphNode, error) {
	kind = strings.ToLower(kind)
	nodeID := NodeID(kind, namespace, name)

	node := GraphNode{
		ID:        nodeID,
		Kind:      kind,
		Name:      name,
		Namespace: namespace,
		Group:     KindToGroup(kind),
		Metadata:  make(map[string]string),
	}

	// Fetch resource to get status and metadata
	switch kind {
	case "pod":
		pod, err := b.clientset.CoreV1().Pods(namespace).Get(b.ctx, name, metav1.GetOptions{})
		if err != nil {
			return node, err
		}
		node.Status = string(pod.Status.Phase)
		node.Metadata["age"] = pod.CreationTimestamp.Time.String()
	case "deployment":
		deploy, err := b.clientset.AppsV1().Deployments(namespace).Get(b.ctx, name, metav1.GetOptions{})
		if err != nil {
			return node, err
		}
		node.Status = fmt.Sprintf("%d/%d", deploy.Status.ReadyReplicas, deploy.Status.Replicas)
		node.Metadata["age"] = deploy.CreationTimestamp.Time.String()
	case "service":
		svc, err := b.clientset.CoreV1().Services(namespace).Get(b.ctx, name, metav1.GetOptions{})
		if err != nil {
			return node, err
		}
		node.Status = string(svc.Spec.Type)
		node.Metadata["clusterIP"] = svc.Spec.ClusterIP
	case "configmap", "secret", "pvc", "ingress", "statefulset", "daemonset", "replicaset", "job", "cronjob":
		// Generic handling for other types
		node.Status = "Active"
	case "node":
		n, err := b.clientset.CoreV1().Nodes().Get(b.ctx, name, metav1.GetOptions{})
		if err != nil {
			return node, err
		}
		for _, cond := range n.Status.Conditions {
			if cond.Type == corev1.NodeReady {
				node.Status = string(cond.Status)
				break
			}
		}
	default:
		node.Status = "Unknown"
	}

	return node, nil
}

// expandNode expands relationships for a node
func (b *Builder) expandNode(node GraphNode, graph *ResourceGraph) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	switch node.Kind {
	case "deployment":
		n, e, err := b.expandDeployment(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "statefulset":
		n, e, err := b.expandStatefulSet(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "daemonset":
		n, e, err := b.expandDaemonSet(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "replicaset":
		n, e, err := b.expandReplicaSet(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "pod":
		n, e, err := b.expandPod(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "job":
		n, e, err := b.expandJob(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "cronjob":
		n, e, err := b.expandCronJob(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "service":
		n, e, err := b.expandService(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "ingress":
		n, e, err := b.expandIngress(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "configmap":
		n, e, err := b.expandConfigMap(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "secret":
		n, e, err := b.expandSecret(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "persistentvolumeclaim", "pvc":
		n, e, err := b.expandPVC(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "persistentvolume", "pv":
		n, e, err := b.expandPV(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "rolebinding":
		n, e, err := b.expandRoleBinding(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "clusterrolebinding":
		n, e, err := b.expandClusterRoleBinding(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "role":
		n, e, err := b.expandRole(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "clusterrole":
		n, e, err := b.expandClusterRole(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "node":
		n, e, err := b.expandNode_k8s(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	}

	return neighbors, edges, nil
}

// expandDeployment expands relationships for a Deployment
func (b *Builder) expandDeployment(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	deploy, err := b.clientset.AppsV1().Deployments(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Find owned ReplicaSets
	rsList, err := b.clientset.AppsV1().ReplicaSets(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, rs := range rsList.Items {
			if isOwnedBy(rs.OwnerReferences, "Deployment", node.Name) {
				rsNode, err := b.createNode(rs.Namespace, "replicaset", rs.Name)
				if err == nil {
					neighbors = append(neighbors, rsNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, rsNode.ID, EdgeTypeOwns),
						Source: node.ID,
						Target: rsNode.ID,
						Type:   EdgeTypeOwns,
						Label:  "owns",
					})
				}
			}
		}
	}

	// Extract ConfigMap/Secret refs from pod template
	podSpec := deploy.Spec.Template.Spec
	cmRefs, secretRefs := extractPodSpecRefs(podSpec)

	for _, cmName := range cmRefs {
		cmNode, err := b.createNode(node.Namespace, "configmap", cmName)
		if err == nil {
			neighbors = append(neighbors, cmNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, cmNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: cmNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	for _, secretName := range secretRefs {
		secretNode, err := b.createNode(node.Namespace, "secret", secretName)
		if err == nil {
			neighbors = append(neighbors, secretNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, secretNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: secretNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	// Find services that select this deployment's pods
	services, err := b.findSelectingServices(node.Namespace, deploy.Spec.Selector)
	if err == nil {
		for _, svc := range services {
			svcNode, err := b.createNode(svc.Namespace, "service", svc.Name)
			if err == nil {
				neighbors = append(neighbors, svcNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(svcNode.ID, node.ID, EdgeTypeSelects),
					Source: svcNode.ID,
					Target: node.ID,
					Type:   EdgeTypeSelects,
					Label:  "selects",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandStatefulSet expands relationships for a StatefulSet
func (b *Builder) expandStatefulSet(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	sts, err := b.clientset.AppsV1().StatefulSets(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Find owned Pods
	pods, err := b.clientset.CoreV1().Pods(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if isOwnedBy(pod.OwnerReferences, "StatefulSet", node.Name) {
				podNode, err := b.createNode(pod.Namespace, "pod", pod.Name)
				if err == nil {
					neighbors = append(neighbors, podNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, podNode.ID, EdgeTypeOwns),
						Source: node.ID,
						Target: podNode.ID,
						Type:   EdgeTypeOwns,
						Label:  "owns",
					})
				}
			}
		}
	}

	// Extract ConfigMap/Secret refs
	podSpec := sts.Spec.Template.Spec
	cmRefs, secretRefs := extractPodSpecRefs(podSpec)

	for _, cmName := range cmRefs {
		cmNode, err := b.createNode(node.Namespace, "configmap", cmName)
		if err == nil {
			neighbors = append(neighbors, cmNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, cmNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: cmNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	for _, secretName := range secretRefs {
		secretNode, err := b.createNode(node.Namespace, "secret", secretName)
		if err == nil {
			neighbors = append(neighbors, secretNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, secretNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: secretNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	// Find selecting services
	services, err := b.findSelectingServices(node.Namespace, sts.Spec.Selector)
	if err == nil {
		for _, svc := range services {
			svcNode, err := b.createNode(svc.Namespace, "service", svc.Name)
			if err == nil {
				neighbors = append(neighbors, svcNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(svcNode.ID, node.ID, EdgeTypeSelects),
					Source: svcNode.ID,
					Target: node.ID,
					Type:   EdgeTypeSelects,
					Label:  "selects",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandDaemonSet expands relationships for a DaemonSet
func (b *Builder) expandDaemonSet(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	ds, err := b.clientset.AppsV1().DaemonSets(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Find owned Pods
	pods, err := b.clientset.CoreV1().Pods(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if isOwnedBy(pod.OwnerReferences, "DaemonSet", node.Name) {
				podNode, err := b.createNode(pod.Namespace, "pod", pod.Name)
				if err == nil {
					neighbors = append(neighbors, podNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, podNode.ID, EdgeTypeOwns),
						Source: node.ID,
						Target: podNode.ID,
						Type:   EdgeTypeOwns,
						Label:  "owns",
					})
				}
			}
		}
	}

	// Extract ConfigMap/Secret refs
	podSpec := ds.Spec.Template.Spec
	cmRefs, secretRefs := extractPodSpecRefs(podSpec)

	for _, cmName := range cmRefs {
		cmNode, err := b.createNode(node.Namespace, "configmap", cmName)
		if err == nil {
			neighbors = append(neighbors, cmNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, cmNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: cmNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	for _, secretName := range secretRefs {
		secretNode, err := b.createNode(node.Namespace, "secret", secretName)
		if err == nil {
			neighbors = append(neighbors, secretNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, secretNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: secretNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	// Find selecting services
	services, err := b.findSelectingServices(node.Namespace, ds.Spec.Selector)
	if err == nil {
		for _, svc := range services {
			svcNode, err := b.createNode(svc.Namespace, "service", svc.Name)
			if err == nil {
				neighbors = append(neighbors, svcNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(svcNode.ID, node.ID, EdgeTypeSelects),
					Source: svcNode.ID,
					Target: node.ID,
					Type:   EdgeTypeSelects,
					Label:  "selects",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandReplicaSet expands relationships for a ReplicaSet
func (b *Builder) expandReplicaSet(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	rs, err := b.clientset.AppsV1().ReplicaSets(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Check for owner Deployment
	for _, owner := range rs.OwnerReferences {
		if owner.Kind == "Deployment" {
			deployNode, err := b.createNode(node.Namespace, "deployment", owner.Name)
			if err == nil {
				neighbors = append(neighbors, deployNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(deployNode.ID, node.ID, EdgeTypeOwns),
					Source: deployNode.ID,
					Target: node.ID,
					Type:   EdgeTypeOwns,
					Label:  "owns",
				})
			}
		}
	}

	// Find owned Pods
	pods, err := b.clientset.CoreV1().Pods(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if isOwnedBy(pod.OwnerReferences, "ReplicaSet", node.Name) {
				podNode, err := b.createNode(pod.Namespace, "pod", pod.Name)
				if err == nil {
					neighbors = append(neighbors, podNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, podNode.ID, EdgeTypeOwns),
						Source: node.ID,
						Target: podNode.ID,
						Type:   EdgeTypeOwns,
						Label:  "owns",
					})
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandPod expands relationships for a Pod
func (b *Builder) expandPod(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	pod, err := b.clientset.CoreV1().Pods(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Check for owner workload
	for _, owner := range pod.OwnerReferences {
		ownerKind := strings.ToLower(owner.Kind)
		ownerNode, err := b.createNode(node.Namespace, ownerKind, owner.Name)
		if err == nil {
			neighbors = append(neighbors, ownerNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(ownerNode.ID, node.ID, EdgeTypeOwns),
				Source: ownerNode.ID,
				Target: node.ID,
				Type:   EdgeTypeOwns,
				Label:  "owns",
			})
		}
	}

	// Node assignment
	if pod.Spec.NodeName != "" {
		nodeNode, err := b.createNode("", "node", pod.Spec.NodeName)
		if err == nil {
			neighbors = append(neighbors, nodeNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, nodeNode.ID, EdgeTypeRunsOn),
				Source: node.ID,
				Target: nodeNode.ID,
				Type:   EdgeTypeRunsOn,
				Label:  "runs on",
			})
		}
	}

	// Extract ConfigMap/Secret refs
	cmRefs, secretRefs := extractPodSpecRefs(pod.Spec)

	for _, cmName := range cmRefs {
		cmNode, err := b.createNode(node.Namespace, "configmap", cmName)
		if err == nil {
			neighbors = append(neighbors, cmNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, cmNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: cmNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	for _, secretName := range secretRefs {
		secretNode, err := b.createNode(node.Namespace, "secret", secretName)
		if err == nil {
			neighbors = append(neighbors, secretNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, secretNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: secretNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	// Find services that select this pod
	services, err := b.findServicesSelectingPod(pod)
	if err == nil {
		for _, svc := range services {
			svcNode, err := b.createNode(svc.Namespace, "service", svc.Name)
			if err == nil {
				neighbors = append(neighbors, svcNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(svcNode.ID, node.ID, EdgeTypeSelects),
					Source: svcNode.ID,
					Target: node.ID,
					Type:   EdgeTypeSelects,
					Label:  "selects",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandJob expands relationships for a Job
func (b *Builder) expandJob(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	job, err := b.clientset.BatchV1().Jobs(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Check for owner CronJob
	for _, owner := range job.OwnerReferences {
		if owner.Kind == "CronJob" {
			cronJobNode, err := b.createNode(node.Namespace, "cronjob", owner.Name)
			if err == nil {
				neighbors = append(neighbors, cronJobNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(cronJobNode.ID, node.ID, EdgeTypeOwns),
					Source: cronJobNode.ID,
					Target: node.ID,
					Type:   EdgeTypeOwns,
					Label:  "owns",
				})
			}
		}
	}

	// Find owned Pods
	pods, err := b.clientset.CoreV1().Pods(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if isOwnedBy(pod.OwnerReferences, "Job", node.Name) {
				podNode, err := b.createNode(pod.Namespace, "pod", pod.Name)
				if err == nil {
					neighbors = append(neighbors, podNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, podNode.ID, EdgeTypeOwns),
						Source: node.ID,
						Target: podNode.ID,
						Type:   EdgeTypeOwns,
						Label:  "owns",
					})
				}
			}
		}
	}

	// Extract ConfigMap/Secret refs
	podSpec := job.Spec.Template.Spec
	cmRefs, secretRefs := extractPodSpecRefs(podSpec)

	for _, cmName := range cmRefs {
		cmNode, err := b.createNode(node.Namespace, "configmap", cmName)
		if err == nil {
			neighbors = append(neighbors, cmNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, cmNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: cmNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	for _, secretName := range secretRefs {
		secretNode, err := b.createNode(node.Namespace, "secret", secretName)
		if err == nil {
			neighbors = append(neighbors, secretNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, secretNode.ID, EdgeTypeMounts),
				Source: node.ID,
				Target: secretNode.ID,
				Type:   EdgeTypeMounts,
				Label:  "mounts",
			})
		}
	}

	return neighbors, edges, nil
}

// expandCronJob expands relationships for a CronJob
func (b *Builder) expandCronJob(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Find owned Jobs
	jobs, err := b.clientset.BatchV1().Jobs(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, job := range jobs.Items {
			if isOwnedBy(job.OwnerReferences, "CronJob", node.Name) {
				jobNode, err := b.createNode(job.Namespace, "job", job.Name)
				if err == nil {
					neighbors = append(neighbors, jobNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, jobNode.ID, EdgeTypeOwns),
						Source: node.ID,
						Target: jobNode.ID,
						Type:   EdgeTypeOwns,
						Label:  "owns",
					})
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandService expands relationships for a Service
func (b *Builder) expandService(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	svc, err := b.clientset.CoreV1().Services(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Find selected Pods
	if len(svc.Spec.Selector) > 0 {
		selector := labels.SelectorFromSet(svc.Spec.Selector)
		pods, err := b.clientset.CoreV1().Pods(node.Namespace).List(b.ctx, metav1.ListOptions{
			LabelSelector: selector.String(),
		})
		if err == nil {
			for _, pod := range pods.Items {
				podNode, err := b.createNode(pod.Namespace, "pod", pod.Name)
				if err == nil {
					neighbors = append(neighbors, podNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, podNode.ID, EdgeTypeSelects),
						Source: node.ID,
						Target: podNode.ID,
						Type:   EdgeTypeSelects,
						Label:  "selects",
					})
				}
			}
		}
	}

	// Find routing Ingresses
	ingresses, err := b.clientset.NetworkingV1().Ingresses(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, ing := range ingresses.Items {
			routesToService := false
			for _, rule := range ing.Spec.Rules {
				if rule.HTTP != nil {
					for _, path := range rule.HTTP.Paths {
						if path.Backend.Service != nil && path.Backend.Service.Name == node.Name {
							routesToService = true
							break
						}
					}
				}
			}
			if routesToService {
				ingNode, err := b.createNode(ing.Namespace, "ingress", ing.Name)
				if err == nil {
					neighbors = append(neighbors, ingNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(ingNode.ID, node.ID, EdgeTypeRoutesTo),
						Source: ingNode.ID,
						Target: node.ID,
						Type:   EdgeTypeRoutesTo,
						Label:  "routes to",
					})
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandIngress expands relationships for an Ingress
func (b *Builder) expandIngress(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	ing, err := b.clientset.NetworkingV1().Ingresses(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Extract backend Services
	serviceNames := make(map[string]bool)
	for _, rule := range ing.Spec.Rules {
		if rule.HTTP != nil {
			for _, path := range rule.HTTP.Paths {
				if path.Backend.Service != nil {
					serviceNames[path.Backend.Service.Name] = true
				}
			}
		}
	}

	for svcName := range serviceNames {
		svcNode, err := b.createNode(node.Namespace, "service", svcName)
		if err == nil {
			neighbors = append(neighbors, svcNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, svcNode.ID, EdgeTypeRoutesTo),
				Source: node.ID,
				Target: svcNode.ID,
				Type:   EdgeTypeRoutesTo,
				Label:  "routes to",
			})
		}
	}

	// Extract TLS Secrets
	for _, tls := range ing.Spec.TLS {
		if tls.SecretName != "" {
			secretNode, err := b.createNode(node.Namespace, "secret", tls.SecretName)
			if err == nil {
				neighbors = append(neighbors, secretNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(node.ID, secretNode.ID, EdgeTypeMounts),
					Source: node.ID,
					Target: secretNode.ID,
					Type:   EdgeTypeMounts,
					Label:  "uses TLS",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandConfigMap expands relationships for a ConfigMap
func (b *Builder) expandConfigMap(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Find consuming workloads (Pods, Deployments, StatefulSets, DaemonSets, Jobs, CronJobs)
	consumers, err := b.findConfigMapConsumers(node.Namespace, node.Name)
	if err == nil {
		for _, consumer := range consumers {
			consumerNode, err := b.createNode(consumer.Namespace, consumer.Kind, consumer.Name)
			if err == nil {
				neighbors = append(neighbors, consumerNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(consumerNode.ID, node.ID, EdgeTypeMounts),
					Source: consumerNode.ID,
					Target: node.ID,
					Type:   EdgeTypeMounts,
					Label:  "mounts",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandSecret expands relationships for a Secret
func (b *Builder) expandSecret(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Find consuming workloads
	consumers, err := b.findSecretConsumers(node.Namespace, node.Name)
	if err == nil {
		for _, consumer := range consumers {
			consumerNode, err := b.createNode(consumer.Namespace, consumer.Kind, consumer.Name)
			if err == nil {
				neighbors = append(neighbors, consumerNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(consumerNode.ID, node.ID, EdgeTypeMounts),
					Source: consumerNode.ID,
					Target: node.ID,
					Type:   EdgeTypeMounts,
					Label:  "mounts",
				})
			}
		}
	}

	// Find TLS-referencing Ingresses
	ingresses, err := b.clientset.NetworkingV1().Ingresses(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, ing := range ingresses.Items {
			usesTLS := false
			for _, tls := range ing.Spec.TLS {
				if tls.SecretName == node.Name {
					usesTLS = true
					break
				}
			}
			if usesTLS {
				ingNode, err := b.createNode(ing.Namespace, "ingress", ing.Name)
				if err == nil {
					neighbors = append(neighbors, ingNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(ingNode.ID, node.ID, EdgeTypeMounts),
						Source: ingNode.ID,
						Target: node.ID,
						Type:   EdgeTypeMounts,
						Label:  "uses TLS",
					})
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandPVC expands relationships for a PVC
func (b *Builder) expandPVC(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	pvc, err := b.clientset.CoreV1().PersistentVolumeClaims(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Bound PV
	if pvc.Spec.VolumeName != "" {
		pvNode, err := b.createNode("", "persistentvolume", pvc.Spec.VolumeName)
		if err == nil {
			neighbors = append(neighbors, pvNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, pvNode.ID, EdgeTypeBoundTo),
				Source: node.ID,
				Target: pvNode.ID,
				Type:   EdgeTypeBoundTo,
				Label:  "bound to",
			})
		}
	}

	// StorageClass
	if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName != "" {
		scNode, err := b.createNode("", "storageclass", *pvc.Spec.StorageClassName)
		if err == nil {
			neighbors = append(neighbors, scNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(scNode.ID, node.ID, EdgeTypeProvides),
				Source: scNode.ID,
				Target: node.ID,
				Type:   EdgeTypeProvides,
				Label:  "provides",
			})
		}
	}

	// Find mounting Pods
	consumers, err := b.findPVCConsumers(node.Namespace, node.Name)
	if err == nil {
		for _, consumer := range consumers {
			consumerNode, err := b.createNode(consumer.Namespace, consumer.Kind, consumer.Name)
			if err == nil {
				neighbors = append(neighbors, consumerNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(consumerNode.ID, node.ID, EdgeTypeMounts),
					Source: consumerNode.ID,
					Target: node.ID,
					Type:   EdgeTypeMounts,
					Label:  "mounts",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandPV expands relationships for a PV
func (b *Builder) expandPV(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	pv, err := b.clientset.CoreV1().PersistentVolumes().Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Bound PVC
	if pv.Spec.ClaimRef != nil {
		pvcNode, err := b.createNode(pv.Spec.ClaimRef.Namespace, "persistentvolumeclaim", pv.Spec.ClaimRef.Name)
		if err == nil {
			neighbors = append(neighbors, pvcNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(pvcNode.ID, node.ID, EdgeTypeBoundTo),
				Source: pvcNode.ID,
				Target: node.ID,
				Type:   EdgeTypeBoundTo,
				Label:  "bound to",
			})
		}
	}

	// StorageClass
	if pv.Spec.StorageClassName != "" {
		scNode, err := b.createNode("", "storageclass", pv.Spec.StorageClassName)
		if err == nil {
			neighbors = append(neighbors, scNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(scNode.ID, node.ID, EdgeTypeProvides),
				Source: scNode.ID,
				Target: node.ID,
				Type:   EdgeTypeProvides,
				Label:  "provides",
			})
		}
	}

	return neighbors, edges, nil
}

// expandRoleBinding expands relationships for a RoleBinding
func (b *Builder) expandRoleBinding(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	rb, err := b.clientset.RbacV1().RoleBindings(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Referenced Role
	roleNode, err := b.createNode(node.Namespace, strings.ToLower(rb.RoleRef.Kind), rb.RoleRef.Name)
	if err == nil {
		neighbors = append(neighbors, roleNode)
		edges = append(edges, GraphEdge{
			ID:     EdgeID(node.ID, roleNode.ID, EdgeTypeBinds),
			Source: node.ID,
			Target: roleNode.ID,
			Type:   EdgeTypeBinds,
			Label:  "binds to",
		})
	}

	// Subjects (ServiceAccounts, Users, Groups)
	for _, subject := range rb.Subjects {
		if subject.Kind == "ServiceAccount" {
			saNode, err := b.createNode(subject.Namespace, "serviceaccount", subject.Name)
			if err == nil {
				neighbors = append(neighbors, saNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(node.ID, saNode.ID, EdgeTypeBinds),
					Source: node.ID,
					Target: saNode.ID,
					Type:   EdgeTypeBinds,
					Label:  "grants to",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandClusterRoleBinding expands relationships for a ClusterRoleBinding
func (b *Builder) expandClusterRoleBinding(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	crb, err := b.clientset.RbacV1().ClusterRoleBindings().Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Referenced ClusterRole
	roleNode, err := b.createNode("", strings.ToLower(crb.RoleRef.Kind), crb.RoleRef.Name)
	if err == nil {
		neighbors = append(neighbors, roleNode)
		edges = append(edges, GraphEdge{
			ID:     EdgeID(node.ID, roleNode.ID, EdgeTypeBinds),
			Source: node.ID,
			Target: roleNode.ID,
			Type:   EdgeTypeBinds,
			Label:  "binds to",
		})
	}

	// Subjects
	for _, subject := range crb.Subjects {
		if subject.Kind == "ServiceAccount" {
			saNode, err := b.createNode(subject.Namespace, "serviceaccount", subject.Name)
			if err == nil {
				neighbors = append(neighbors, saNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(node.ID, saNode.ID, EdgeTypeBinds),
					Source: node.ID,
					Target: saNode.ID,
					Type:   EdgeTypeBinds,
					Label:  "grants to",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// expandRole expands relationships for a Role
func (b *Builder) expandRole(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Find referencing RoleBindings
	rbs, err := b.clientset.RbacV1().RoleBindings(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, rb := range rbs.Items {
			if rb.RoleRef.Kind == "Role" && rb.RoleRef.Name == node.Name {
				rbNode, err := b.createNode(rb.Namespace, "rolebinding", rb.Name)
				if err == nil {
					neighbors = append(neighbors, rbNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(rbNode.ID, node.ID, EdgeTypeBinds),
						Source: rbNode.ID,
						Target: node.ID,
						Type:   EdgeTypeBinds,
						Label:  "binds to",
					})
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandClusterRole expands relationships for a ClusterRole
func (b *Builder) expandClusterRole(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Find referencing ClusterRoleBindings
	crbs, err := b.clientset.RbacV1().ClusterRoleBindings().List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, crb := range crbs.Items {
			if crb.RoleRef.Kind == "ClusterRole" && crb.RoleRef.Name == node.Name {
				crbNode, err := b.createNode("", "clusterrolebinding", crb.Name)
				if err == nil {
					neighbors = append(neighbors, crbNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(crbNode.ID, node.ID, EdgeTypeBinds),
						Source: crbNode.ID,
						Target: node.ID,
						Type:   EdgeTypeBinds,
						Label:  "binds to",
					})
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandNode_k8s expands relationships for a Node (avoid name collision with GraphNode)
func (b *Builder) expandNode_k8s(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Find Pods running on this node
	pods, err := b.clientset.CoreV1().Pods("").List(b.ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s", node.Name),
	})
	if err == nil {
		for _, pod := range pods.Items {
			podNode, err := b.createNode(pod.Namespace, "pod", pod.Name)
			if err == nil {
				neighbors = append(neighbors, podNode)
				edges = append(edges, GraphEdge{
					ID:     EdgeID(podNode.ID, node.ID, EdgeTypeRunsOn),
					Source: podNode.ID,
					Target: node.ID,
					Type:   EdgeTypeRunsOn,
					Label:  "runs on",
				})
			}
		}
	}

	return neighbors, edges, nil
}

// Helper functions

func isOwnedBy(refs []metav1.OwnerReference, kind, name string) bool {
	for _, ref := range refs {
		if ref.Kind == kind && ref.Name == name {
			return true
		}
	}
	return false
}

// extractPodSpecRefs extracts ConfigMap and Secret references from a PodSpec
func extractPodSpecRefs(spec corev1.PodSpec) ([]string, []string) {
	configMaps := make(map[string]bool)
	secrets := make(map[string]bool)

	// Volumes
	for _, vol := range spec.Volumes {
		if vol.ConfigMap != nil {
			configMaps[vol.ConfigMap.Name] = true
		}
		if vol.Secret != nil {
			secrets[vol.Secret.SecretName] = true
		}
	}

	// Containers (init + regular)
	allContainers := append(spec.InitContainers, spec.Containers...)
	for _, c := range allContainers {
		// EnvFrom
		for _, ef := range c.EnvFrom {
			if ef.ConfigMapRef != nil {
				configMaps[ef.ConfigMapRef.Name] = true
			}
			if ef.SecretRef != nil {
				secrets[ef.SecretRef.Name] = true
			}
		}
		// Env
		for _, e := range c.Env {
			if e.ValueFrom != nil {
				if e.ValueFrom.ConfigMapKeyRef != nil {
					configMaps[e.ValueFrom.ConfigMapKeyRef.Name] = true
				}
				if e.ValueFrom.SecretKeyRef != nil {
					secrets[e.ValueFrom.SecretKeyRef.Name] = true
				}
			}
		}
	}

	// ImagePullSecrets
	for _, ips := range spec.ImagePullSecrets {
		secrets[ips.Name] = true
	}

	cmList := make([]string, 0, len(configMaps))
	for cm := range configMaps {
		cmList = append(cmList, cm)
	}

	secretList := make([]string, 0, len(secrets))
	for s := range secrets {
		secretList = append(secretList, s)
	}

	return cmList, secretList
}

// findSelectingServices finds services that select pods matching the given selector
func (b *Builder) findSelectingServices(namespace string, selector *metav1.LabelSelector) ([]corev1.Service, error) {
	var services []corev1.Service

	if selector == nil {
		return services, nil
	}

	svcList, err := b.clientset.CoreV1().Services(namespace).List(b.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	selectorLabels := selector.MatchLabels
	if len(selectorLabels) == 0 {
		return services, nil
	}

	for _, svc := range svcList.Items {
		if len(svc.Spec.Selector) == 0 {
			continue
		}

		// Check if service selector matches the workload's selector
		matches := true
		for key, value := range svc.Spec.Selector {
			if selectorLabels[key] != value {
				matches = false
				break
			}
		}
		if matches {
			services = append(services, svc)
		}
	}

	return services, nil
}

// findServicesSelectingPod finds services that select a specific pod
func (b *Builder) findServicesSelectingPod(pod *corev1.Pod) ([]corev1.Service, error) {
	var services []corev1.Service

	svcList, err := b.clientset.CoreV1().Services(pod.Namespace).List(b.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, svc := range svcList.Items {
		if len(svc.Spec.Selector) == 0 {
			continue
		}

		selector := labels.SelectorFromSet(svc.Spec.Selector)
		if selector.Matches(labels.Set(pod.Labels)) {
			services = append(services, svc)
		}
	}

	return services, nil
}

// Consumer types
type Consumer struct {
	Kind      string
	Name      string
	Namespace string
}

// findConfigMapConsumers finds workloads that consume a ConfigMap
func (b *Builder) findConfigMapConsumers(namespace, configMapName string) ([]Consumer, error) {
	consumers := []Consumer{}

	// Scan Pods
	pods, err := b.clientset.CoreV1().Pods(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if podSpecUsesConfigMap(pod.Spec, configMapName) {
				consumers = append(consumers, Consumer{Kind: "pod", Name: pod.Name, Namespace: pod.Namespace})
			}
		}
	}

	// Scan Deployments
	deploys, err := b.clientset.AppsV1().Deployments(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, deploy := range deploys.Items {
			if podSpecUsesConfigMap(deploy.Spec.Template.Spec, configMapName) {
				consumers = append(consumers, Consumer{Kind: "deployment", Name: deploy.Name, Namespace: deploy.Namespace})
			}
		}
	}

	// Scan StatefulSets
	stsList, err := b.clientset.AppsV1().StatefulSets(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, sts := range stsList.Items {
			if podSpecUsesConfigMap(sts.Spec.Template.Spec, configMapName) {
				consumers = append(consumers, Consumer{Kind: "statefulset", Name: sts.Name, Namespace: sts.Namespace})
			}
		}
	}

	// Scan DaemonSets
	dsList, err := b.clientset.AppsV1().DaemonSets(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, ds := range dsList.Items {
			if podSpecUsesConfigMap(ds.Spec.Template.Spec, configMapName) {
				consumers = append(consumers, Consumer{Kind: "daemonset", Name: ds.Name, Namespace: ds.Namespace})
			}
		}
	}

	// Scan Jobs
	jobs, err := b.clientset.BatchV1().Jobs(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, job := range jobs.Items {
			if podSpecUsesConfigMap(job.Spec.Template.Spec, configMapName) {
				consumers = append(consumers, Consumer{Kind: "job", Name: job.Name, Namespace: job.Namespace})
			}
		}
	}

	// Scan CronJobs
	cronJobs, err := b.clientset.BatchV1().CronJobs(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, cj := range cronJobs.Items {
			if podSpecUsesConfigMap(cj.Spec.JobTemplate.Spec.Template.Spec, configMapName) {
				consumers = append(consumers, Consumer{Kind: "cronjob", Name: cj.Name, Namespace: cj.Namespace})
			}
		}
	}

	return consumers, nil
}

func podSpecUsesConfigMap(spec corev1.PodSpec, configMapName string) bool {
	// Check volumes
	for _, vol := range spec.Volumes {
		if vol.ConfigMap != nil && vol.ConfigMap.Name == configMapName {
			return true
		}
	}

	// Check containers
	allContainers := append(spec.InitContainers, spec.Containers...)
	for _, c := range allContainers {
		for _, ef := range c.EnvFrom {
			if ef.ConfigMapRef != nil && ef.ConfigMapRef.Name == configMapName {
				return true
			}
		}
		for _, e := range c.Env {
			if e.ValueFrom != nil && e.ValueFrom.ConfigMapKeyRef != nil && e.ValueFrom.ConfigMapKeyRef.Name == configMapName {
				return true
			}
		}
	}

	return false
}

// findSecretConsumers finds workloads that consume a Secret
func (b *Builder) findSecretConsumers(namespace, secretName string) ([]Consumer, error) {
	consumers := []Consumer{}

	// Scan Pods
	pods, err := b.clientset.CoreV1().Pods(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if podSpecUsesSecret(pod.Spec, secretName) {
				consumers = append(consumers, Consumer{Kind: "pod", Name: pod.Name, Namespace: pod.Namespace})
			}
		}
	}

	// Scan Deployments
	deploys, err := b.clientset.AppsV1().Deployments(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, deploy := range deploys.Items {
			if podSpecUsesSecret(deploy.Spec.Template.Spec, secretName) {
				consumers = append(consumers, Consumer{Kind: "deployment", Name: deploy.Name, Namespace: deploy.Namespace})
			}
		}
	}

	// Scan StatefulSets
	stsList, err := b.clientset.AppsV1().StatefulSets(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, sts := range stsList.Items {
			if podSpecUsesSecret(sts.Spec.Template.Spec, secretName) {
				consumers = append(consumers, Consumer{Kind: "statefulset", Name: sts.Name, Namespace: sts.Namespace})
			}
		}
	}

	// Scan DaemonSets
	dsList, err := b.clientset.AppsV1().DaemonSets(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, ds := range dsList.Items {
			if podSpecUsesSecret(ds.Spec.Template.Spec, secretName) {
				consumers = append(consumers, Consumer{Kind: "daemonset", Name: ds.Name, Namespace: ds.Namespace})
			}
		}
	}

	// Scan Jobs
	jobs, err := b.clientset.BatchV1().Jobs(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, job := range jobs.Items {
			if podSpecUsesSecret(job.Spec.Template.Spec, secretName) {
				consumers = append(consumers, Consumer{Kind: "job", Name: job.Name, Namespace: job.Namespace})
			}
		}
	}

	// Scan CronJobs
	cronJobs, err := b.clientset.BatchV1().CronJobs(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, cj := range cronJobs.Items {
			if podSpecUsesSecret(cj.Spec.JobTemplate.Spec.Template.Spec, secretName) {
				consumers = append(consumers, Consumer{Kind: "cronjob", Name: cj.Name, Namespace: cj.Namespace})
			}
		}
	}

	return consumers, nil
}

func podSpecUsesSecret(spec corev1.PodSpec, secretName string) bool {
	// Check volumes
	for _, vol := range spec.Volumes {
		if vol.Secret != nil && vol.Secret.SecretName == secretName {
			return true
		}
	}

	// Check containers
	allContainers := append(spec.InitContainers, spec.Containers...)
	for _, c := range allContainers {
		for _, ef := range c.EnvFrom {
			if ef.SecretRef != nil && ef.SecretRef.Name == secretName {
				return true
			}
		}
		for _, e := range c.Env {
			if e.ValueFrom != nil && e.ValueFrom.SecretKeyRef != nil && e.ValueFrom.SecretKeyRef.Name == secretName {
				return true
			}
		}
	}

	// Check imagePullSecrets
	for _, ips := range spec.ImagePullSecrets {
		if ips.Name == secretName {
			return true
		}
	}

	return false
}

// findPVCConsumers finds workloads that mount a PVC
func (b *Builder) findPVCConsumers(namespace, pvcName string) ([]Consumer, error) {
	consumers := []Consumer{}

	// Scan Pods
	pods, err := b.clientset.CoreV1().Pods(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if podSpecUsesPVC(pod.Spec, pvcName) {
				consumers = append(consumers, Consumer{Kind: "pod", Name: pod.Name, Namespace: pod.Namespace})
			}
		}
	}

	// Scan Deployments
	deploys, err := b.clientset.AppsV1().Deployments(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, deploy := range deploys.Items {
			if podSpecUsesPVC(deploy.Spec.Template.Spec, pvcName) {
				consumers = append(consumers, Consumer{Kind: "deployment", Name: deploy.Name, Namespace: deploy.Namespace})
			}
		}
	}

	// Scan StatefulSets
	stsList, err := b.clientset.AppsV1().StatefulSets(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, sts := range stsList.Items {
			if podSpecUsesPVC(sts.Spec.Template.Spec, pvcName) {
				consumers = append(consumers, Consumer{Kind: "statefulset", Name: sts.Name, Namespace: sts.Namespace})
			}
		}
	}

	// Scan DaemonSets
	dsList, err := b.clientset.AppsV1().DaemonSets(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, ds := range dsList.Items {
			if podSpecUsesPVC(ds.Spec.Template.Spec, pvcName) {
				consumers = append(consumers, Consumer{Kind: "daemonset", Name: ds.Name, Namespace: ds.Namespace})
			}
		}
	}

	return consumers, nil
}

func podSpecUsesPVC(spec corev1.PodSpec, pvcName string) bool {
	for _, vol := range spec.Volumes {
		if vol.PersistentVolumeClaim != nil && vol.PersistentVolumeClaim.ClaimName == pvcName {
			return true
		}
	}
	return false
}
