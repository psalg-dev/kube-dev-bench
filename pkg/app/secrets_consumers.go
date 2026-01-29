package app

import (
	"fmt"
	"sort"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type SecretConsumer struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	RefType   string `json:"refType,omitempty"`
}

func podSpecUsesSecret(spec corev1.PodSpec, secretName string) (bool, string) {
	// Check volumes
	if used, refType := checkSecretInVolumes(spec.Volumes, secretName); used {
		return true, refType
	}

	// Check init containers
	for _, c := range spec.InitContainers {
		if used, refType := checkSecretInContainer(c, secretName); used {
			return true, "init:" + refType
		}
	}

	// Check containers
	for _, c := range spec.Containers {
		if used, refType := checkSecretInContainer(c, secretName); used {
			return true, refType
		}
	}

	// Check image pull secrets
	if checkImagePullSecrets(spec.ImagePullSecrets, secretName) {
		return true, "imagePullSecret"
	}

	return false, ""
}

// checkSecretInVolumes checks if a secret is referenced in volumes
func checkSecretInVolumes(volumes []corev1.Volume, secretName string) (bool, string) {
	for _, v := range volumes {
		if v.Secret != nil && v.Secret.SecretName == secretName {
			return true, fmt.Sprintf("volume:%s", v.Name)
		}
	}
	return false, ""
}

// checkSecretInContainer checks if a secret is referenced in a container
func checkSecretInContainer(c corev1.Container, secretName string) (bool, string) {
	// Check envFrom
	for _, from := range c.EnvFrom {
		if from.SecretRef != nil && from.SecretRef.Name == secretName {
			return true, fmt.Sprintf("envFrom:%s", c.Name)
		}
	}

	// Check env
	for _, e := range c.Env {
		if e.ValueFrom != nil && e.ValueFrom.SecretKeyRef != nil && e.ValueFrom.SecretKeyRef.Name == secretName {
			return true, fmt.Sprintf("env:%s", c.Name)
		}
	}

	return false, ""
}

// checkImagePullSecrets checks if a secret is used as an image pull secret
func checkImagePullSecrets(imagePullSecrets []corev1.LocalObjectReference, secretName string) bool {
	for _, ips := range imagePullSecrets {
		if ips.Name == secretName {
			return true
		}
	}
	return false
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

	consumers := []SecretConsumer{}

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

	// De-dup
	seen := map[string]bool{}
	out := make([]SecretConsumer, 0, len(consumers))
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

	return out, nil
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
