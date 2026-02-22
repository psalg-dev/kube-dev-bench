package app

import (
	"fmt"
	"time"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsclientset "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CustomResourceDefinitionInfo represents summary information about a CRD
type CustomResourceDefinitionInfo struct {
	Name              string            `json:"name"`
	Group             string            `json:"group"`
	Scope             string            `json:"scope"`
	Kind              string            `json:"kind"`
	ListKind          string            `json:"listKind"`
	Singular          string            `json:"singular"`
	Plural            string            `json:"plural"`
	ShortNames        []string          `json:"shortNames"`
	Versions          []CRDVersion      `json:"versions"`
	Age               string            `json:"age"`
	Labels            map[string]string `json:"labels"`
	Annotations       map[string]string `json:"annotations"`
	Raw               interface{}       `json:"raw,omitempty"`
}

// CRDVersion represents a version of a CRD
type CRDVersion struct {
	Name    string `json:"name"`
	Served  bool   `json:"served"`
	Storage bool   `json:"storage"`
}

// GetCustomResourceDefinitions returns all CRDs in the cluster
func (a *App) GetCustomResourceDefinitions() ([]CustomResourceDefinitionInfo, error) {
	var apiExtClient apiextensionsclientset.Interface

	// Check if we have a test client
	if a.testCRDClientset != nil {
		apiExtClient = a.testCRDClientset.(apiextensionsclientset.Interface)
	} else {
		// Create apiextensions client
		config, err := a.getRESTConfig()
		if err != nil {
			return nil, err
		}

		apiExtClient, err = apiextensionsclientset.NewForConfig(config)
		if err != nil {
			return nil, err
		}
	}

	crds, err := apiExtClient.ApiextensionsV1().CustomResourceDefinitions().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]CustomResourceDefinitionInfo, 0, len(crds.Items))

	for _, crd := range crds.Items {
		info := buildCRDInfo(&crd, now)
		result = append(result, info)
	}

	return result, nil
}

// buildCRDInfo constructs a CustomResourceDefinitionInfo from a CRD
func buildCRDInfo(crd *apiextensionsv1.CustomResourceDefinition, now time.Time) CustomResourceDefinitionInfo {
	age := "-"
	if !crd.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(crd.CreationTimestamp.Time))
	}

	// Extract versions
	versions := make([]CRDVersion, 0, len(crd.Spec.Versions))
	for _, version := range crd.Spec.Versions {
		versions = append(versions, CRDVersion{
			Name:    version.Name,
			Served:  version.Served,
			Storage: version.Storage,
		})
	}

	return CustomResourceDefinitionInfo{
		Name:        crd.Name,
		Group:       crd.Spec.Group,
		Scope:       string(crd.Spec.Scope),
		Kind:        crd.Spec.Names.Kind,
		ListKind:    crd.Spec.Names.ListKind,
		Singular:    crd.Spec.Names.Singular,
		Plural:      crd.Spec.Names.Plural,
		ShortNames:  crd.Spec.Names.ShortNames,
		Versions:    versions,
		Age:         age,
		Labels:      crd.Labels,
		Annotations: crd.Annotations,
		Raw:         crd,
	}
}

// GetCustomResourceDefinitionDetail returns detailed information about a specific CRD
func (a *App) GetCustomResourceDefinitionDetail(name string) (*CustomResourceDefinitionInfo, error) {
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	var apiExtClient apiextensionsclientset.Interface

	// Check if we have a test client
	if a.testCRDClientset != nil {
		apiExtClient = a.testCRDClientset.(apiextensionsclientset.Interface)
	} else {
		// Create apiextensions client
		config, err := a.getRESTConfig()
		if err != nil {
			return nil, err
		}

		apiExtClient, err = apiextensionsclientset.NewForConfig(config)
		if err != nil {
			return nil, err
		}
	}

	crd, err := apiExtClient.ApiextensionsV1().CustomResourceDefinitions().Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildCRDInfo(crd, time.Now())
	return &info, nil
}
