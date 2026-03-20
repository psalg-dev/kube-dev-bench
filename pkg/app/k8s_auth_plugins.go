package app

import (
	_ "k8s.io/client-go/plugin/pkg/client/auth/azure" // Legacy AKS auth-provider stanza
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"   // Legacy GKE auth-provider stanza
	_ "k8s.io/client-go/plugin/pkg/client/auth/oidc"  // OIDC exec credential provider
)
