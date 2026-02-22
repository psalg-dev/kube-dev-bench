package app

import (
	"fmt"
	"sort"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ConfigMapConsumer struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	RefType   string `json:"refType,omitempty"`
}

// checkContainerConfigMapRef checks if a container references a configmap
func checkContainerConfigMapRef(c corev1.Container, configMapName string) (bool, string) {
	for _, from := range c.EnvFrom {
		if from.ConfigMapRef != nil && from.ConfigMapRef.Name == configMapName {
			return true, fmt.Sprintf("envFrom:%s", c.Name)
		}
	}
	for _, e := range c.Env {
		if e.ValueFrom != nil && e.ValueFrom.ConfigMapKeyRef != nil && e.ValueFrom.ConfigMapKeyRef.Name == configMapName {
			return true, fmt.Sprintf("env:%s", c.Name)
		}
	}
	return false, ""
}

// checkVolumeConfigMapRef checks if any volume references a configmap
func checkVolumeConfigMapRef(volumes []corev1.Volume, configMapName string) (bool, string) {
	for _, v := range volumes {
		if v.ConfigMap != nil && v.ConfigMap.Name == configMapName {
			return true, fmt.Sprintf("volume:%s", v.Name)
		}
	}
	return false, ""
}

// checkContainersConfigMapRef checks init and regular containers for configmap references
func checkContainersConfigMapRef(spec corev1.PodSpec, configMapName string) (bool, string) {
	for _, c := range spec.InitContainers {
		if ok, why := checkContainerConfigMapRef(c, configMapName); ok {
			return true, "init:" + why
		}
	}
	for _, c := range spec.Containers {
		if ok, why := checkContainerConfigMapRef(c, configMapName); ok {
			return true, why
		}
	}
	return false, ""
}

func podSpecUsesConfigMap(spec corev1.PodSpec, configMapName string) (bool, string) {
	if ok, why := checkVolumeConfigMapRef(spec.Volumes, configMapName); ok {
		return true, why
	}

	return checkContainersConfigMapRef(spec, configMapName)
}

// dedupAndSortConsumers removes duplicates and sorts consumers by Kind/Namespace/Name.
func dedupAndSortConsumers(consumers []ConfigMapConsumer) []ConfigMapConsumer {
	seen := map[string]bool{}
	out := make([]ConfigMapConsumer, 0, len(consumers))
	for _, c := range consumers {
		k := c.Kind + "/" + c.Namespace + "/" + c.Name
		if seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Kind != out[j].Kind {
			return out[i].Kind < out[j].Kind
		}
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// GetConfigMapConsumers returns pods and deployments in the namespace that reference the given ConfigMap.
func (a *App) GetConfigMapConsumers(namespace, configMapName string) ([]ConfigMapConsumer, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	if configMapName == "" {
		return nil, fmt.Errorf("configMap name is required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	consumers := []ConfigMapConsumer{}

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, p := range pods.Items {
		if ok, why := podSpecUsesConfigMap(p.Spec, configMapName); ok {
			consumers = append(consumers, ConfigMapConsumer{Kind: "Pod", Name: p.Name, Namespace: p.Namespace, RefType: why})
		}
	}

	deps, err := clientset.AppsV1().Deployments(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, d := range deps.Items {
		if ok, why := podSpecUsesConfigMap(d.Spec.Template.Spec, configMapName); ok {
			consumers = append(consumers, ConfigMapConsumer{Kind: "Deployment", Name: d.Name, Namespace: d.Namespace, RefType: why})
		}
	}

	// Scan StatefulSets
	stsList, err := clientset.AppsV1().StatefulSets(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, sts := range stsList.Items {
		if ok, why := podSpecUsesConfigMap(sts.Spec.Template.Spec, configMapName); ok {
			consumers = append(consumers, ConfigMapConsumer{Kind: "StatefulSet", Name: sts.Name, Namespace: sts.Namespace, RefType: why})
		}
	}

	// Scan DaemonSets
	dsList, err := clientset.AppsV1().DaemonSets(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, ds := range dsList.Items {
		if ok, why := podSpecUsesConfigMap(ds.Spec.Template.Spec, configMapName); ok {
			consumers = append(consumers, ConfigMapConsumer{Kind: "DaemonSet", Name: ds.Name, Namespace: ds.Namespace, RefType: why})
		}
	}

	// Scan Jobs
	jobs, err := clientset.BatchV1().Jobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, job := range jobs.Items {
		if ok, why := podSpecUsesConfigMap(job.Spec.Template.Spec, configMapName); ok {
			consumers = append(consumers, ConfigMapConsumer{Kind: "Job", Name: job.Name, Namespace: job.Namespace, RefType: why})
		}
	}

	// Scan CronJobs
	cronJobs, err := clientset.BatchV1().CronJobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, cj := range cronJobs.Items {
		if ok, why := podSpecUsesConfigMap(cj.Spec.JobTemplate.Spec.Template.Spec, configMapName); ok {
			consumers = append(consumers, ConfigMapConsumer{Kind: "CronJob", Name: cj.Name, Namespace: cj.Namespace, RefType: why})
		}
	}

	return dedupAndSortConsumers(consumers), nil
}

// UpdateConfigMapDataKey updates (or creates) a single key in a ConfigMap's data map.
// BinaryData is not modified.
func (a *App) UpdateConfigMapDataKey(namespace, configMapName, key, value string) error {
	if namespace == "" {
		return fmt.Errorf("namespace is required")
	}
	if configMapName == "" {
		return fmt.Errorf("configMap name is required")
	}
	if key == "" {
		return fmt.Errorf("key is required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}

	cm, err := clientset.CoreV1().ConfigMaps(namespace).Get(a.ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		return err
	}

	if cm.Data == nil {
		cm.Data = map[string]string{}
	}
	cm.Data[key] = value

	_, err = clientset.CoreV1().ConfigMaps(namespace).Update(a.ctx, cm, metav1.UpdateOptions{})
	return err
}
