package app

import (
	"fmt"
	"sort"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type SecretConsumer struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	RefType   string `json:"refType,omitempty"`
}

// checkContainerSecretRef checks if a container references a secret
func checkContainerSecretRef(c corev1.Container, secretName string) (bool, string) {
	for _, from := range c.EnvFrom {
		if from.SecretRef != nil && from.SecretRef.Name == secretName {
			return true, fmt.Sprintf("envFrom:%s", c.Name)
		}
	}
	for _, e := range c.Env {
		if e.ValueFrom != nil && e.ValueFrom.SecretKeyRef != nil && e.ValueFrom.SecretKeyRef.Name == secretName {
			return true, fmt.Sprintf("env:%s", c.Name)
		}
	}
	return false, ""
}

// checkVolumeSecretRef checks if any volume references a secret
func checkVolumeSecretRef(volumes []corev1.Volume, secretName string) (bool, string) {
	for _, v := range volumes {
		if v.Secret != nil && v.Secret.SecretName == secretName {
			return true, fmt.Sprintf("volume:%s", v.Name)
		}
	}
	return false, ""
}

// checkContainersSecretRef checks init and regular containers for secret references
func checkContainersSecretRef(spec corev1.PodSpec, secretName string) (bool, string) {
	for _, c := range spec.InitContainers {
		if ok, why := checkContainerSecretRef(c, secretName); ok {
			return true, "init:" + why
		}
	}
	for _, c := range spec.Containers {
		if ok, why := checkContainerSecretRef(c, secretName); ok {
			return true, why
		}
	}
	return false, ""
}

func podSpecUsesSecret(spec corev1.PodSpec, secretName string) (bool, string) {
	if ok, why := checkVolumeSecretRef(spec.Volumes, secretName); ok {
		return true, why
	}

	if ok, why := checkContainersSecretRef(spec, secretName); ok {
		return true, why
	}

	for _, ips := range spec.ImagePullSecrets {
		if ips.Name == secretName {
			return true, "imagePullSecret"
		}
	}

	return false, ""
}

// GetSecretConsumers returns pods and deployments in the namespace that reference the given Secret.
func (a *App) GetSecretConsumers(namespace, secretName string) ([]SecretConsumer, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	if secretName == "" {
		return nil, fmt.Errorf("secret name is required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	consumers, err := a.collectSecretConsumers(clientset, namespace, secretName)
	if err != nil {
		return nil, err
	}

	return sortedSecretConsumers(dedupSecretConsumers(consumers)), nil
}

func (a *App) collectSecretConsumers(clientset kubernetes.Interface, namespace, secretName string) ([]SecretConsumer, error) {
	var consumers []SecretConsumer

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, p := range pods.Items {
		if ok, why := podSpecUsesSecret(p.Spec, secretName); ok {
			consumers = append(consumers, SecretConsumer{Kind: "Pod", Name: p.Name, Namespace: p.Namespace, RefType: why})
		}
	}

	deps, err := clientset.AppsV1().Deployments(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, d := range deps.Items {
		if ok, why := podSpecUsesSecret(d.Spec.Template.Spec, secretName); ok {
			consumers = append(consumers, SecretConsumer{Kind: "Deployment", Name: d.Name, Namespace: d.Namespace, RefType: why})
		}
	}

	return consumers, nil
}

func dedupSecretConsumers(consumers []SecretConsumer) []SecretConsumer {
	seen := map[string]bool{}
	out := make([]SecretConsumer, 0, len(consumers))
	for _, c := range consumers {
		k := c.Kind + "/" + c.Namespace + "/" + c.Name
		if !seen[k] {
			seen[k] = true
			out = append(out, c)
		}
	}
	return out
}

func sortedSecretConsumers(consumers []SecretConsumer) []SecretConsumer {
	sort.Slice(consumers, func(i, j int) bool {
		if consumers[i].Kind != consumers[j].Kind {
			return consumers[i].Kind < consumers[j].Kind
		}
		if consumers[i].Namespace != consumers[j].Namespace {
			return consumers[i].Namespace < consumers[j].Namespace
		}
		return consumers[i].Name < consumers[j].Name
	})
	return consumers
}

// UpdateSecretDataKey updates (or creates) a single key in a Secret's data.
// The value is treated as plain text and stored as raw bytes.
func (a *App) UpdateSecretDataKey(namespace, secretName, key, value string) error {
	if namespace == "" {
		return fmt.Errorf("namespace is required")
	}
	if secretName == "" {
		return fmt.Errorf("secret name is required")
	}
	if key == "" {
		return fmt.Errorf("key is required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}

	s, err := clientset.CoreV1().Secrets(namespace).Get(a.ctx, secretName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if s.Data == nil {
		s.Data = map[string][]byte{}
	}
	s.Data[key] = []byte(value)

	_, err = clientset.CoreV1().Secrets(namespace).Update(a.ctx, s, metav1.UpdateOptions{})
	return err
}
