package k8s_graph

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
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

// BuildForNamespace builds a relationship graph for all resources in a namespace.
func (b *Builder) BuildForNamespace(namespace string, depth int) (*ResourceGraph, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
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

	type resourceSeed struct {
		kind      string
		namespace string
		name      string
	}

	seeds := make([]resourceSeed, 0, 128)
	var seedsMu sync.Mutex
	addSeeds := func(kind string, names []string) {
		if len(names) == 0 {
			return
		}
		seedsMu.Lock()
		defer seedsMu.Unlock()
		for _, name := range names {
			seeds = append(seeds, resourceSeed{kind: kind, namespace: namespace, name: name})
		}
	}

	fetchGroup, _ := errgroup.WithContext(b.ctx)

	fetchGroup.Go(func() error {
		pods, err := b.clientset.CoreV1().Pods(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(pods.Items))
		for _, pod := range pods.Items {
			names = append(names, pod.Name)
		}
		addSeeds("pod", names)
		return nil
	})

	fetchGroup.Go(func() error {
		deployments, err := b.clientset.AppsV1().Deployments(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(deployments.Items))
		for _, deploy := range deployments.Items {
			names = append(names, deploy.Name)
		}
		addSeeds("deployment", names)
		return nil
	})

	fetchGroup.Go(func() error {
		statefulSets, err := b.clientset.AppsV1().StatefulSets(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(statefulSets.Items))
		for _, sts := range statefulSets.Items {
			names = append(names, sts.Name)
		}
		addSeeds("statefulset", names)
		return nil
	})

	fetchGroup.Go(func() error {
		daemonSets, err := b.clientset.AppsV1().DaemonSets(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(daemonSets.Items))
		for _, ds := range daemonSets.Items {
			names = append(names, ds.Name)
		}
		addSeeds("daemonset", names)
		return nil
	})

	fetchGroup.Go(func() error {
		replicaSets, err := b.clientset.AppsV1().ReplicaSets(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(replicaSets.Items))
		for _, rs := range replicaSets.Items {
			names = append(names, rs.Name)
		}
		addSeeds("replicaset", names)
		return nil
	})

	fetchGroup.Go(func() error {
		jobs, err := b.clientset.BatchV1().Jobs(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(jobs.Items))
		for _, job := range jobs.Items {
			names = append(names, job.Name)
		}
		addSeeds("job", names)
		return nil
	})

	fetchGroup.Go(func() error {
		cronJobs, err := b.clientset.BatchV1().CronJobs(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(cronJobs.Items))
		for _, cronJob := range cronJobs.Items {
			names = append(names, cronJob.Name)
		}
		addSeeds("cronjob", names)
		return nil
	})

	fetchGroup.Go(func() error {
		hpas, err := b.clientset.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(hpas.Items))
		for _, hpa := range hpas.Items {
			names = append(names, hpa.Name)
		}
		addSeeds("horizontalpodautoscaler", names)
		return nil
	})

	fetchGroup.Go(func() error {
		services, err := b.clientset.CoreV1().Services(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(services.Items))
		for _, svc := range services.Items {
			names = append(names, svc.Name)
		}
		addSeeds("service", names)
		return nil
	})

	fetchGroup.Go(func() error {
		ingresses, err := b.clientset.NetworkingV1().Ingresses(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(ingresses.Items))
		for _, ing := range ingresses.Items {
			names = append(names, ing.Name)
		}
		addSeeds("ingress", names)
		return nil
	})

	fetchGroup.Go(func() error {
		configMaps, err := b.clientset.CoreV1().ConfigMaps(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(configMaps.Items))
		for _, cm := range configMaps.Items {
			names = append(names, cm.Name)
		}
		addSeeds("configmap", names)
		return nil
	})

	fetchGroup.Go(func() error {
		secrets, err := b.clientset.CoreV1().Secrets(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(secrets.Items))
		for _, secret := range secrets.Items {
			names = append(names, secret.Name)
		}
		addSeeds("secret", names)
		return nil
	})

	fetchGroup.Go(func() error {
		pvcs, err := b.clientset.CoreV1().PersistentVolumeClaims(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(pvcs.Items))
		for _, pvc := range pvcs.Items {
			names = append(names, pvc.Name)
		}
		addSeeds("persistentvolumeclaim", names)
		return nil
	})

	fetchGroup.Go(func() error {
		roles, err := b.clientset.RbacV1().Roles(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(roles.Items))
		for _, role := range roles.Items {
			names = append(names, role.Name)
		}
		addSeeds("role", names)
		return nil
	})

	fetchGroup.Go(func() error {
		roleBindings, err := b.clientset.RbacV1().RoleBindings(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(roleBindings.Items))
		for _, rb := range roleBindings.Items {
			names = append(names, rb.Name)
		}
		addSeeds("rolebinding", names)
		return nil
	})

	fetchGroup.Go(func() error {
		serviceAccounts, err := b.clientset.CoreV1().ServiceAccounts(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(serviceAccounts.Items))
		for _, sa := range serviceAccounts.Items {
			names = append(names, sa.Name)
		}
		addSeeds("serviceaccount", names)
		return nil
	})

	fetchGroup.Go(func() error {
		networkPolicies, err := b.clientset.NetworkingV1().NetworkPolicies(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(networkPolicies.Items))
		for _, np := range networkPolicies.Items {
			names = append(names, np.Name)
		}
		addSeeds("networkpolicy", names)
		return nil
	})

	fetchGroup.Go(func() error {
		endpoints, err := b.clientset.CoreV1().Endpoints(namespace).List(b.ctx, metav1.ListOptions{})
		if err != nil {
			return nil
		}
		names := make([]string, 0, len(endpoints.Items))
		for _, ep := range endpoints.Items {
			names = append(names, ep.Name)
		}
		addSeeds("endpoints", names)
		return nil
	})

	_ = fetchGroup.Wait()

	for _, seed := range seeds {
		node, err := b.createNode(seed.namespace, seed.kind, seed.name)
		if err != nil {
			node = fallbackNode(seed.kind, seed.namespace, seed.name)
		}
		graph.AddNode(node)
	}

	currentLevel := make([]GraphNode, 0, len(graph.Nodes))
	visited := make(map[string]bool)
	for _, node := range graph.Nodes {
		currentLevel = append(currentLevel, node)
		visited[node.ID] = true
	}

	includeNode := func(node GraphNode) bool {
		return node.Namespace == "" || node.Namespace == namespace
	}

	for level := 0; level < depth; level++ {
		nextLevel := []GraphNode{}
		for _, node := range currentLevel {
			neighbors, edges, err := b.expandNode(node, graph)
			if err != nil {
				continue
			}

			for _, neighbor := range neighbors {
				if !includeNode(neighbor) {
					continue
				}
				if !visited[neighbor.ID] {
					graph.AddNode(neighbor)
					visited[neighbor.ID] = true
					nextLevel = append(nextLevel, neighbor)
				}
			}

			for _, edge := range edges {
				if graph.HasNode(edge.Source) && graph.HasNode(edge.Target) {
					graph.AddEdge(edge)
				}
			}
		}
		currentLevel = nextLevel
		if len(currentLevel) == 0 {
			break
		}
	}

	return graph, nil
}

// BuildStorageGraph builds a storage-focused relationship graph for a namespace.
func (b *Builder) BuildStorageGraph(namespace string, depth int) (*ResourceGraph, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
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

	mergeSubgraph := func(sub *ResourceGraph) {
		if sub == nil {
			return
		}
		for _, node := range sub.Nodes {
			if node.Namespace == "" || node.Namespace == namespace {
				graph.AddNode(node)
			}
		}
		for _, edge := range sub.Edges {
			if graph.HasNode(edge.Source) && graph.HasNode(edge.Target) {
				graph.AddEdge(edge)
			}
		}
	}

	pvcs, err := b.clientset.CoreV1().PersistentVolumeClaims(namespace).List(b.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var graphMu sync.Mutex
	buildGroup, _ := errgroup.WithContext(b.ctx)
	for _, pvc := range pvcs.Items {
		pvcName := pvc.Name
		buildGroup.Go(func() error {
			sub, buildErr := b.BuildForResource(namespace, "persistentvolumeclaim", pvcName, depth)
			if buildErr != nil {
				return nil
			}
			graphMu.Lock()
			mergeSubgraph(sub)
			graphMu.Unlock()
			return nil
		})
	}

	_ = buildGroup.Wait()

	return graph, nil
}

// BuildNetworkPolicyGraph builds a network-policy-focused graph for a namespace.
func (b *Builder) BuildNetworkPolicyGraph(namespace string) (*ResourceGraph, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}

	graph := &ResourceGraph{
		Nodes: []GraphNode{},
		Edges: []GraphEdge{},
	}

	networkPolicies, err := b.clientset.NetworkingV1().NetworkPolicies(namespace).List(b.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, policy := range networkPolicies.Items {
		policyNode, nodeErr := b.createNode(policy.Namespace, "networkpolicy", policy.Name)
		if nodeErr != nil {
			policyNode = fallbackNode("networkpolicy", policy.Namespace, policy.Name)
		}
		graph.AddNode(policyNode)

		targetPods, targetErr := b.resolvePolicyTargetPods(policy)
		if targetErr != nil {
			continue
		}

		for _, podNode := range targetPods {
			graph.AddNode(podNode)
			graph.AddEdge(GraphEdge{
				ID:     EdgeID(policyNode.ID, podNode.ID, EdgeTypeNetworkPolicy),
				Source: policyNode.ID,
				Target: podNode.ID,
				Type:   EdgeTypeNetworkPolicy,
				Label:  "targets",
			})
		}

		for _, ingressRule := range policy.Spec.Ingress {
			sources, sourceErr := b.resolveIngressSources(policy.Namespace, ingressRule)
			if sourceErr != nil {
				continue
			}

			label := formatPolicyPortsLabel("ingress", ingressRule.Ports)
			for _, sourceNode := range sources {
				graph.AddNode(sourceNode)
				for _, targetNode := range targetPods {
					graph.AddEdge(GraphEdge{
						ID:     EdgeID(sourceNode.ID, targetNode.ID, EdgeTypeNPIngress),
						Source: sourceNode.ID,
						Target: targetNode.ID,
						Type:   EdgeTypeNPIngress,
						Label:  label,
					})
				}
			}
		}

		for _, egressRule := range policy.Spec.Egress {
			destinations, destErr := b.resolveEgressDestinations(policy.Namespace, egressRule)
			if destErr != nil {
				continue
			}

			label := formatPolicyPortsLabel("egress", egressRule.Ports)
			for _, targetNode := range targetPods {
				for _, destNode := range destinations {
					graph.AddNode(destNode)
					graph.AddEdge(GraphEdge{
						ID:     EdgeID(targetNode.ID, destNode.ID, EdgeTypeNPEgress),
						Source: targetNode.ID,
						Target: destNode.ID,
						Type:   EdgeTypeNPEgress,
						Label:  label,
					})
				}
			}
		}
	}

	return graph, nil
}

// BuildRBACGraph builds an RBAC-focused relationship graph for a namespace.
func (b *Builder) BuildRBACGraph(namespace string) (*ResourceGraph, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}

	graph := &ResourceGraph{
		Nodes: []GraphNode{},
		Edges: []GraphEdge{},
	}

	addNode := func(node GraphNode, err error, fallbackKind, fallbackNamespace, fallbackName string) GraphNode {
		if err != nil {
			node = fallbackNode(fallbackKind, fallbackNamespace, fallbackName)
		}
		graph.AddNode(node)
		return node
	}

	addSubjectToBinding := func(subject rbacv1.Subject, bindingNode GraphNode) {
		subjectKind := strings.ToLower(subject.Kind)
		subjectNamespace := subject.Namespace
		if subjectKind == "serviceaccount" {
			if subjectNamespace == "" {
				subjectNamespace = namespace
			}
			saNode, err := b.createNode(subjectNamespace, "serviceaccount", subject.Name)
			saNode = addNode(saNode, err, "serviceaccount", subjectNamespace, subject.Name)
			graph.AddEdge(GraphEdge{
				ID:     EdgeID(saNode.ID, bindingNode.ID, EdgeTypeBinds),
				Source: saNode.ID,
				Target: bindingNode.ID,
				Type:   EdgeTypeBinds,
				Label:  "subject",
			})
			return
		}

		subjectNode := createRBACSubjectNode(subject)
		graph.AddNode(subjectNode)
		graph.AddEdge(GraphEdge{
			ID:     EdgeID(subjectNode.ID, bindingNode.ID, EdgeTypeBinds),
			Source: subjectNode.ID,
			Target: bindingNode.ID,
			Type:   EdgeTypeBinds,
			Label:  "subject",
		})
	}

	serviceAccounts, err := b.clientset.CoreV1().ServiceAccounts(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, sa := range serviceAccounts.Items {
			saNode, nodeErr := b.createNode(sa.Namespace, "serviceaccount", sa.Name)
			addNode(saNode, nodeErr, "serviceaccount", sa.Namespace, sa.Name)
		}
	}

	pods, err := b.clientset.CoreV1().Pods(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			podNode, podErr := b.createNode(pod.Namespace, "pod", pod.Name)
			podNode = addNode(podNode, podErr, "pod", pod.Namespace, pod.Name)

			saName := pod.Spec.ServiceAccountName
			if saName == "" {
				saName = "default"
			}
			saNode, saErr := b.createNode(namespace, "serviceaccount", saName)
			saNode = addNode(saNode, saErr, "serviceaccount", namespace, saName)
			graph.AddEdge(GraphEdge{
				ID:     EdgeID(podNode.ID, saNode.ID, EdgeTypeBinds),
				Source: podNode.ID,
				Target: saNode.ID,
				Type:   EdgeTypeBinds,
				Label:  "uses",
			})
		}
	}

	roleBindings, err := b.clientset.RbacV1().RoleBindings(namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, rb := range roleBindings.Items {
			rbNode, rbErr := b.createNode(rb.Namespace, "rolebinding", rb.Name)
			rbNode = addNode(rbNode, rbErr, "rolebinding", rb.Namespace, rb.Name)

			roleKind := strings.ToLower(rb.RoleRef.Kind)
			roleNamespace := namespace
			if roleKind == "clusterrole" {
				roleNamespace = ""
			}
			roleNode, roleErr := b.createNode(roleNamespace, roleKind, rb.RoleRef.Name)
			roleNode = addNode(roleNode, roleErr, roleKind, roleNamespace, rb.RoleRef.Name)

			graph.AddEdge(GraphEdge{
				ID:     EdgeID(rbNode.ID, roleNode.ID, EdgeTypeBinds),
				Source: rbNode.ID,
				Target: roleNode.ID,
				Type:   EdgeTypeBinds,
				Label:  "binds to",
			})

			for _, subject := range rb.Subjects {
				addSubjectToBinding(subject, rbNode)
			}
		}
	}

	clusterRoleBindings, err := b.clientset.RbacV1().ClusterRoleBindings().List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, crb := range clusterRoleBindings.Items {
			includeBinding := false
			for _, subject := range crb.Subjects {
				subjectKind := strings.ToLower(subject.Kind)
				if subjectKind == "serviceaccount" {
					if subject.Namespace == namespace {
						includeBinding = true
						break
					}
					continue
				}
				if subjectKind == "user" || subjectKind == "group" {
					includeBinding = true
					break
				}
			}
			if !includeBinding {
				continue
			}

			crbNode, crbErr := b.createNode("", "clusterrolebinding", crb.Name)
			crbNode = addNode(crbNode, crbErr, "clusterrolebinding", "", crb.Name)

			roleNode, roleErr := b.createNode("", "clusterrole", crb.RoleRef.Name)
			roleNode = addNode(roleNode, roleErr, "clusterrole", "", crb.RoleRef.Name)

			graph.AddEdge(GraphEdge{
				ID:     EdgeID(crbNode.ID, roleNode.ID, EdgeTypeBinds),
				Source: crbNode.ID,
				Target: roleNode.ID,
				Type:   EdgeTypeBinds,
				Label:  "binds to",
			})

			for _, subject := range crb.Subjects {
				addSubjectToBinding(subject, crbNode)
			}
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

	node.Metadata["fullName"] = name

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
	case "role":
		role, err := b.clientset.RbacV1().Roles(namespace).Get(b.ctx, name, metav1.GetOptions{})
		if err != nil {
			return node, err
		}
		node.Status = "Active"
		node.Metadata["rules"] = summarizePolicyRules(role.Rules)
	case "clusterrole":
		clusterRole, err := b.clientset.RbacV1().ClusterRoles().Get(b.ctx, name, metav1.GetOptions{})
		if err != nil {
			return node, err
		}
		node.Status = "Active"
		node.Metadata["rules"] = summarizePolicyRules(clusterRole.Rules)
	case "horizontalpodautoscaler", "hpa":
		hpa, err := b.clientset.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(b.ctx, name, metav1.GetOptions{})
		if err != nil {
			return node, err
		}
		node.Kind = "horizontalpodautoscaler"
		node.ID = NodeID(node.Kind, namespace, name)
		node.Status = fmt.Sprintf("%d/%d", hpa.Status.CurrentReplicas, hpa.Status.DesiredReplicas)
		node.Metadata["targetKind"] = hpa.Spec.ScaleTargetRef.Kind
		node.Metadata["targetName"] = hpa.Spec.ScaleTargetRef.Name
		node.Metadata["fullName"] = name
		node.Metadata["age"] = hpa.CreationTimestamp.Time.String()
	case "configmap", "secret", "pvc", "ingress", "statefulset", "daemonset", "replicaset", "job", "cronjob",
		"serviceaccount", "networkpolicy", "persistentvolumeclaim", "persistentvolume", "endpoints",
		"rolebinding", "clusterrolebinding", "storageclass":
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

func fallbackNode(kind, namespace, name string) GraphNode {
	return GraphNode{
		ID:        NodeID(kind, namespace, name),
		Kind:      strings.ToLower(kind),
		Name:      name,
		Namespace: namespace,
		Group:     KindToGroup(kind),
		Status:    "Unknown",
		Metadata: map[string]string{
			"fullName": name,
		},
	}
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
	case "horizontalpodautoscaler", "hpa":
		n, e, err := b.expandHPA(node)
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
	case "serviceaccount":
		n, e, err := b.expandServiceAccount(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "networkpolicy":
		n, e, err := b.expandNetworkPolicy(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "storageclass":
		n, e, err := b.expandStorageClass(node)
		if err == nil {
			neighbors = append(neighbors, n...)
			edges = append(edges, e...)
		}
	case "endpoints":
		n, e, err := b.expandEndpoints(node)
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

	b.appendHPATargetingWorkload(node, &neighbors, &edges)

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

	b.appendHPATargetingWorkload(node, &neighbors, &edges)

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

	b.appendHPATargetingWorkload(node, &neighbors, &edges)

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

	b.appendHPATargetingWorkload(node, &neighbors, &edges)

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

	saName := pod.Spec.ServiceAccountName
	if saName == "" {
		saName = "default"
	}
	saNode, err := b.createNode(node.Namespace, "serviceaccount", saName)
	if err == nil {
		neighbors = append(neighbors, saNode)
		edges = append(edges, GraphEdge{
			ID:     EdgeID(node.ID, saNode.ID, EdgeTypeBinds),
			Source: node.ID,
			Target: saNode.ID,
			Type:   EdgeTypeBinds,
			Label:  "uses",
		})
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

	b.appendHPATargetingWorkload(node, &neighbors, &edges)

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

	b.appendHPATargetingWorkload(node, &neighbors, &edges)

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

	// Find Endpoints for this Service
	ep, err := b.clientset.CoreV1().Endpoints(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err == nil {
		epNode, err := b.createNode(ep.Namespace, "endpoints", ep.Name)
		if err == nil {
			neighbors = append(neighbors, epNode)
			edges = append(edges, GraphEdge{
				ID:     EdgeID(node.ID, epNode.ID, EdgeTypeOwns),
				Source: node.ID,
				Target: epNode.ID,
				Type:   EdgeTypeOwns,
				Label:  "owns",
			})
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

// expandServiceAccount expands relationships for a ServiceAccount
func (b *Builder) expandServiceAccount(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Find Pods using this ServiceAccount
	pods, err := b.clientset.CoreV1().Pods(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			saName := pod.Spec.ServiceAccountName
			if saName == "" {
				saName = "default"
			}
			if saName == node.Name {
				podNode, err := b.createNode(pod.Namespace, "pod", pod.Name)
				if err == nil {
					neighbors = append(neighbors, podNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, podNode.ID, EdgeTypeBinds),
						Source: node.ID,
						Target: podNode.ID,
						Type:   EdgeTypeBinds,
						Label:  "used by",
					})
				}
			}
		}
	}

	// Find RoleBindings that reference this ServiceAccount as a subject
	rbs, err := b.clientset.RbacV1().RoleBindings(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, rb := range rbs.Items {
			for _, subject := range rb.Subjects {
				if subject.Kind == "ServiceAccount" && subject.Name == node.Name &&
					(subject.Namespace == "" || subject.Namespace == node.Namespace) {
					rbNode, err := b.createNode(rb.Namespace, "rolebinding", rb.Name)
					if err == nil {
						neighbors = append(neighbors, rbNode)
						edges = append(edges, GraphEdge{
							ID:     EdgeID(rbNode.ID, node.ID, EdgeTypeBinds),
							Source: rbNode.ID,
							Target: node.ID,
							Type:   EdgeTypeBinds,
							Label:  "grants to",
						})
					}
					break
				}
			}
		}
	}

	// Find ClusterRoleBindings that reference this ServiceAccount as a subject
	crbs, err := b.clientset.RbacV1().ClusterRoleBindings().List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, crb := range crbs.Items {
			for _, subject := range crb.Subjects {
				if subject.Kind == "ServiceAccount" && subject.Name == node.Name &&
					(subject.Namespace == "" || subject.Namespace == node.Namespace) {
					crbNode, err := b.createNode("", "clusterrolebinding", crb.Name)
					if err == nil {
						neighbors = append(neighbors, crbNode)
						edges = append(edges, GraphEdge{
							ID:     EdgeID(crbNode.ID, node.ID, EdgeTypeBinds),
							Source: crbNode.ID,
							Target: node.ID,
							Type:   EdgeTypeBinds,
							Label:  "grants to",
						})
					}
					break
				}
			}
		}
	}

	// Find Secrets associated with this ServiceAccount (token secrets)
	secrets, err := b.clientset.CoreV1().Secrets(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, secret := range secrets.Items {
			if secret.Type == "kubernetes.io/service-account-token" {
				if saRef, ok := secret.Annotations["kubernetes.io/service-account.name"]; ok && saRef == node.Name {
					secretNode, err := b.createNode(secret.Namespace, "secret", secret.Name)
					if err == nil {
						neighbors = append(neighbors, secretNode)
						edges = append(edges, GraphEdge{
							ID:     EdgeID(node.ID, secretNode.ID, EdgeTypeMounts),
							Source: node.ID,
							Target: secretNode.ID,
							Type:   EdgeTypeMounts,
							Label:  "token",
						})
					}
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandNetworkPolicy expands relationships for a NetworkPolicy
func (b *Builder) expandNetworkPolicy(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	np, err := b.clientset.NetworkingV1().NetworkPolicies(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	// Find pods matching the podSelector
	if len(np.Spec.PodSelector.MatchLabels) > 0 {
		selector := labels.SelectorFromSet(np.Spec.PodSelector.MatchLabels)
		pods, err := b.clientset.CoreV1().Pods(node.Namespace).List(b.ctx, metav1.ListOptions{
			LabelSelector: selector.String(),
		})
		if err == nil {
			for _, pod := range pods.Items {
				podNode, err := b.createNode(pod.Namespace, "pod", pod.Name)
				if err == nil {
					neighbors = append(neighbors, podNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, podNode.ID, EdgeTypeNetworkPolicy),
						Source: node.ID,
						Target: podNode.ID,
						Type:   EdgeTypeNetworkPolicy,
						Label:  "targets",
					})
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandStorageClass expands relationships for a StorageClass
func (b *Builder) expandStorageClass(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Find PVCs using this StorageClass
	pvcs, err := b.clientset.CoreV1().PersistentVolumeClaims("").List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pvc := range pvcs.Items {
			if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName == node.Name {
				pvcNode, err := b.createNode(pvc.Namespace, "persistentvolumeclaim", pvc.Name)
				if err == nil {
					neighbors = append(neighbors, pvcNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, pvcNode.ID, EdgeTypeProvides),
						Source: node.ID,
						Target: pvcNode.ID,
						Type:   EdgeTypeProvides,
						Label:  "provides",
					})
				}
			}
		}
	}

	// Find PVs using this StorageClass
	pvs, err := b.clientset.CoreV1().PersistentVolumes().List(b.ctx, metav1.ListOptions{})
	if err == nil {
		for _, pv := range pvs.Items {
			if pv.Spec.StorageClassName == node.Name {
				pvNode, err := b.createNode("", "persistentvolume", pv.Name)
				if err == nil {
					neighbors = append(neighbors, pvNode)
					edges = append(edges, GraphEdge{
						ID:     EdgeID(node.ID, pvNode.ID, EdgeTypeProvides),
						Source: node.ID,
						Target: pvNode.ID,
						Type:   EdgeTypeProvides,
						Label:  "provides",
					})
				}
			}
		}
	}

	return neighbors, edges, nil
}

// expandEndpoints expands relationships for Endpoints
func (b *Builder) expandEndpoints(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	// Endpoints share the same name as their Service
	svcNode, err := b.createNode(node.Namespace, "service", node.Name)
	if err == nil {
		neighbors = append(neighbors, svcNode)
		edges = append(edges, GraphEdge{
			ID:     EdgeID(svcNode.ID, node.ID, EdgeTypeOwns),
			Source: svcNode.ID,
			Target: node.ID,
			Type:   EdgeTypeOwns,
			Label:  "owns",
		})
	}

	return neighbors, edges, nil
}

// expandHPA expands relationships for a HorizontalPodAutoscaler.
func (b *Builder) expandHPA(node GraphNode) ([]GraphNode, []GraphEdge, error) {
	neighbors := []GraphNode{}
	edges := []GraphEdge{}

	hpa, err := b.clientset.AutoscalingV2().HorizontalPodAutoscalers(node.Namespace).Get(b.ctx, node.Name, metav1.GetOptions{})
	if err != nil {
		return neighbors, edges, err
	}

	targetKind := strings.ToLower(hpa.Spec.ScaleTargetRef.Kind)
	targetName := hpa.Spec.ScaleTargetRef.Name
	if targetKind == "" || targetName == "" {
		return neighbors, edges, nil
	}

	targetNode, targetErr := b.createNode(node.Namespace, targetKind, targetName)
	if targetErr != nil {
		targetNode = fallbackNode(targetKind, node.Namespace, targetName)
	}

	neighbors = append(neighbors, targetNode)
	edges = append(edges, GraphEdge{
		ID:     EdgeID(node.ID, targetNode.ID, EdgeTypeScales),
		Source: node.ID,
		Target: targetNode.ID,
		Type:   EdgeTypeScales,
		Label:  "scales",
	})

	return neighbors, edges, nil
}

func (b *Builder) appendHPATargetingWorkload(node GraphNode, neighbors *[]GraphNode, edges *[]GraphEdge) {
	targetKind := workloadKindForHPATarget(node.Kind)
	if targetKind == "" {
		return
	}

	hpas, err := b.clientset.AutoscalingV2().HorizontalPodAutoscalers(node.Namespace).List(b.ctx, metav1.ListOptions{})
	if err != nil {
		return
	}

	for _, hpa := range hpas.Items {
		if hpa.Spec.ScaleTargetRef.Name != node.Name {
			continue
		}
		if !strings.EqualFold(hpa.Spec.ScaleTargetRef.Kind, targetKind) {
			continue
		}

		hpaNode, hpaErr := b.createNode(hpa.Namespace, "horizontalpodautoscaler", hpa.Name)
		if hpaErr != nil {
			hpaNode = fallbackNode("horizontalpodautoscaler", hpa.Namespace, hpa.Name)
		}

		*neighbors = append(*neighbors, hpaNode)
		*edges = append(*edges, GraphEdge{
			ID:     EdgeID(hpaNode.ID, node.ID, EdgeTypeScales),
			Source: hpaNode.ID,
			Target: node.ID,
			Type:   EdgeTypeScales,
			Label:  "scales",
		})
	}
}

func workloadKindForHPATarget(kind string) string {
	switch strings.ToLower(kind) {
	case "deployment":
		return "Deployment"
	case "statefulset":
		return "StatefulSet"
	case "daemonset":
		return "DaemonSet"
	case "replicaset":
		return "ReplicaSet"
	case "job":
		return "Job"
	case "cronjob":
		return "CronJob"
	default:
		return ""
	}
}

// Helper functions

func (b *Builder) resolvePolicyTargetPods(policy networkingv1.NetworkPolicy) ([]GraphNode, error) {
	selector := labels.Everything()
	if len(policy.Spec.PodSelector.MatchLabels) > 0 {
		selector = labels.SelectorFromSet(policy.Spec.PodSelector.MatchLabels)
	}

	pods, err := b.clientset.CoreV1().Pods(policy.Namespace).List(b.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return nil, err
	}

	result := make([]GraphNode, 0, len(pods.Items))
	for _, pod := range pods.Items {
		podNode, nodeErr := b.createNode(pod.Namespace, "pod", pod.Name)
		if nodeErr != nil {
			continue
		}
		result = append(result, podNode)
	}
	return result, nil
}

func (b *Builder) resolveIngressSources(policyNamespace string, rule networkingv1.NetworkPolicyIngressRule) ([]GraphNode, error) {
	if len(rule.From) == 0 {
		return []GraphNode{externalNode("ingress:any", "Any source")}, nil
	}

	sources := []GraphNode{}
	for _, peer := range rule.From {
		peerNodes, err := b.resolveNetworkPolicyPeer(policyNamespace, peer)
		if err != nil {
			continue
		}
		sources = append(sources, peerNodes...)
	}

	return sources, nil
}

func (b *Builder) resolveEgressDestinations(policyNamespace string, rule networkingv1.NetworkPolicyEgressRule) ([]GraphNode, error) {
	if len(rule.To) == 0 {
		return []GraphNode{externalNode("egress:any", "Any destination")}, nil
	}

	destinations := []GraphNode{}
	for _, peer := range rule.To {
		peerNodes, err := b.resolveNetworkPolicyPeer(policyNamespace, peer)
		if err != nil {
			continue
		}
		destinations = append(destinations, peerNodes...)
	}

	return destinations, nil
}

func (b *Builder) resolveNetworkPolicyPeer(policyNamespace string, peer networkingv1.NetworkPolicyPeer) ([]GraphNode, error) {
	result := []GraphNode{}

	if peer.IPBlock != nil {
		node := externalNode(peer.IPBlock.CIDR, peer.IPBlock.CIDR)
		if len(peer.IPBlock.Except) > 0 {
			node.Metadata["except"] = strings.Join(peer.IPBlock.Except, ",")
		}
		result = append(result, node)
	}

	namespaces := []string{policyNamespace}
	if peer.NamespaceSelector != nil {
		namespaces = []string{}
		nsSelector := labels.Everything()
		if len(peer.NamespaceSelector.MatchLabels) > 0 {
			nsSelector = labels.SelectorFromSet(peer.NamespaceSelector.MatchLabels)
		}
		nsList, err := b.clientset.CoreV1().Namespaces().List(b.ctx, metav1.ListOptions{LabelSelector: nsSelector.String()})
		if err != nil {
			return result, err
		}
		for _, ns := range nsList.Items {
			namespaces = append(namespaces, ns.Name)
		}
	}

	podSelector := labels.Everything()
	if peer.PodSelector != nil && len(peer.PodSelector.MatchLabels) > 0 {
		podSelector = labels.SelectorFromSet(peer.PodSelector.MatchLabels)
	}

	for _, ns := range namespaces {
		pods, err := b.clientset.CoreV1().Pods(ns).List(b.ctx, metav1.ListOptions{LabelSelector: podSelector.String()})
		if err != nil {
			continue
		}
		for _, pod := range pods.Items {
			podNode, nodeErr := b.createNode(pod.Namespace, "pod", pod.Name)
			if nodeErr != nil {
				continue
			}
			result = append(result, podNode)
		}
	}

	if len(result) == 0 && peer.IPBlock == nil && peer.PodSelector == nil && peer.NamespaceSelector == nil {
		result = append(result, externalNode("peer:any", "Any peer"))
	}

	return result, nil
}

func externalNode(name, label string) GraphNode {
	node := fallbackNode("external", "", name)
	node.Status = "External"
	node.Metadata["fullName"] = label
	return node
}

func createRBACSubjectNode(subject rbacv1.Subject) GraphNode {
	kind := strings.ToLower(subject.Kind)
	node := fallbackNode(kind, "", subject.Name)
	node.Status = "Subject"
	node.Group = GroupRBAC
	node.Metadata["fullName"] = fmt.Sprintf("%s: %s", subject.Kind, subject.Name)
	if subject.APIGroup != "" {
		node.Metadata["apiGroup"] = subject.APIGroup
	}
	return node
}

func summarizePolicyRules(rules []rbacv1.PolicyRule) string {
	if len(rules) == 0 {
		return "No policy rules"
	}

	parts := make([]string, 0, len(rules))
	for _, rule := range rules {
		verbs := strings.Join(rule.Verbs, ",")
		if verbs == "" {
			verbs = "*"
		}

		apiGroups := strings.Join(rule.APIGroups, ",")
		if apiGroups == "" {
			apiGroups = "core"
		}

		resources := strings.Join(rule.Resources, ",")
		if resources == "" {
			resources = strings.Join(rule.NonResourceURLs, ",")
		}
		if resources == "" {
			resources = "*"
		}

		ruleSummary := fmt.Sprintf("%s %s/%s", verbs, apiGroups, resources)
		if len(rule.ResourceNames) > 0 {
			ruleSummary = fmt.Sprintf("%s (names:%s)", ruleSummary, strings.Join(rule.ResourceNames, ","))
		}
		parts = append(parts, ruleSummary)
	}

	return strings.Join(parts, "; ")
}

func formatPolicyPortsLabel(direction string, ports []networkingv1.NetworkPolicyPort) string {
	if len(ports) == 0 {
		return direction
	}

	parts := make([]string, 0, len(ports))
	for _, port := range ports {
		protocol := "ANY"
		if port.Protocol != nil {
			protocol = string(*port.Protocol)
		}
		if port.Port == nil {
			parts = append(parts, protocol)
			continue
		}
		parts = append(parts, fmt.Sprintf("%s/%s", port.Port.String(), protocol))
	}

	return fmt.Sprintf("%s %s", direction, strings.Join(parts, ","))
}

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
