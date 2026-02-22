package app

import (
	"context"
	"testing"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsfake "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset/fake"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetCustomResourceDefinitions_ReturnsCRDs(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewClientset()

	crdClientset := apiextensionsfake.NewClientset(
		&apiextensionsv1.CustomResourceDefinition{
			ObjectMeta: metav1.ObjectMeta{
				Name: "myresources.example.com",
				Labels: map[string]string{
					"app": "myapp",
				},
				Annotations: map[string]string{
					"description": "test CRD",
				},
			},
			Spec: apiextensionsv1.CustomResourceDefinitionSpec{
				Group: "example.com",
				Scope: apiextensionsv1.NamespaceScoped,
				Names: apiextensionsv1.CustomResourceDefinitionNames{
					Kind:     "MyResource",
					ListKind: "MyResourceList",
					Singular: "myresource",
					Plural:   "myresources",
					ShortNames: []string{"mr"},
				},
				Versions: []apiextensionsv1.CustomResourceDefinitionVersion{
					{
						Name:    "v1",
						Served:  true,
						Storage: true,
					},
					{
						Name:    "v1beta1",
						Served:  true,
						Storage: false,
					},
				},
			},
		},
		&apiextensionsv1.CustomResourceDefinition{
			ObjectMeta: metav1.ObjectMeta{
				Name: "configs.cluster.x-k8s.io",
			},
			Spec: apiextensionsv1.CustomResourceDefinitionSpec{
				Group: "cluster.x-k8s.io",
				Scope: apiextensionsv1.ClusterScoped,
				Names: apiextensionsv1.CustomResourceDefinitionNames{
					Kind:     "Config",
					Plural:   "configs",
					Singular: "config",
				},
				Versions: []apiextensionsv1.CustomResourceDefinitionVersion{
					{
						Name:    "v1alpha1",
						Served:  true,
						Storage: true,
					},
				},
			},
		},
	)

	app := &App{
		ctx:              ctx,
		testClientset:    clientset,
		testCRDClientset: crdClientset,
	}

	crds, err := app.GetCustomResourceDefinitions()
	if err != nil {
		t.Fatalf("GetCustomResourceDefinitions failed: %v", err)
	}

	if len(crds) != 2 {
		t.Fatalf("expected 2 CRDs, got %d", len(crds))
	}

	// Find the CRD by name
	var myResourceCRD *CustomResourceDefinitionInfo
	for i := range crds {
		if crds[i].Name == "myresources.example.com" {
			myResourceCRD = &crds[i]
			break
		}
	}

	if myResourceCRD == nil {
		t.Fatal("expected to find CRD 'myresources.example.com'")
	}

	// Verify CRD details
	if myResourceCRD.Group != "example.com" {
		t.Errorf("expected group 'example.com', got '%s'", myResourceCRD.Group)
	}
	if myResourceCRD.Kind != "MyResource" {
		t.Errorf("expected kind 'MyResource', got '%s'", myResourceCRD.Kind)
	}
	if myResourceCRD.Scope != "Namespaced" {
		t.Errorf("expected scope 'Namespaced', got '%s'", myResourceCRD.Scope)
	}
	if len(myResourceCRD.Versions) != 2 {
		t.Errorf("expected 2 versions, got %d", len(myResourceCRD.Versions))
	}
	if len(myResourceCRD.ShortNames) != 1 || myResourceCRD.ShortNames[0] != "mr" {
		t.Errorf("expected short name 'mr', got %v", myResourceCRD.ShortNames)
	}
}

func TestGetCustomResourceDefinitions_NoCRDs(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewClientset()
	crdClientset := apiextensionsfake.NewClientset()

	app := &App{
		ctx:              ctx,
		testClientset:    clientset,
		testCRDClientset: crdClientset,
	}

	crds, err := app.GetCustomResourceDefinitions()
	if err != nil {
		t.Fatalf("GetCustomResourceDefinitions failed: %v", err)
	}

	if len(crds) != 0 {
		t.Errorf("expected 0 CRDs, got %d", len(crds))
	}
}

func TestGetCustomResourceDefinitionDetail_ReturnsCRD(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewClientset()

	crdClientset := apiextensionsfake.NewClientset(
		&apiextensionsv1.CustomResourceDefinition{
			ObjectMeta: metav1.ObjectMeta{
				Name: "myresources.example.com",
			},
			Spec: apiextensionsv1.CustomResourceDefinitionSpec{
				Group: "example.com",
				Scope: apiextensionsv1.NamespaceScoped,
				Names: apiextensionsv1.CustomResourceDefinitionNames{
					Kind:     "MyResource",
					Plural:   "myresources",
					Singular: "myresource",
				},
				Versions: []apiextensionsv1.CustomResourceDefinitionVersion{
					{
						Name:    "v1",
						Served:  true,
						Storage: true,
					},
				},
			},
		},
	)

	app := &App{
		ctx:              ctx,
		testClientset:    clientset,
		testCRDClientset: crdClientset,
	}

	crd, err := app.GetCustomResourceDefinitionDetail("myresources.example.com")
	if err != nil {
		t.Fatalf("GetCustomResourceDefinitionDetail failed: %v", err)
	}

	if crd.Name != "myresources.example.com" {
		t.Errorf("expected CRD name 'myresources.example.com', got '%s'", crd.Name)
	}
	if len(crd.Versions) != 1 {
		t.Errorf("expected 1 version, got %d", len(crd.Versions))
	}
	if !crd.Versions[0].Storage {
		t.Errorf("expected storage version to be true")
	}
}

func TestGetCustomResourceDefinitionDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetCustomResourceDefinitionDetail("")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestBuildCRDInfo_ClusterScoped(t *testing.T) {
	crd := &apiextensionsv1.CustomResourceDefinition{
		ObjectMeta: metav1.ObjectMeta{
			Name: "configs.example.com",
		},
		Spec: apiextensionsv1.CustomResourceDefinitionSpec{
			Group: "example.com",
			Scope: apiextensionsv1.ClusterScoped,
			Names: apiextensionsv1.CustomResourceDefinitionNames{
				Kind:     "Config",
				Plural:   "configs",
				Singular: "config",
			},
			Versions: []apiextensionsv1.CustomResourceDefinitionVersion{
				{
					Name:    "v1",
					Served:  true,
					Storage: true,
				},
			},
		},
	}

	info := buildCRDInfo(crd, metav1.Now().Time)

	if info.Scope != "Cluster" {
		t.Errorf("expected scope 'Cluster', got '%s'", info.Scope)
	}
}
