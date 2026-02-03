package app

import (
	"context"
	"strings"

	"k8s.io/client-go/kubernetes"
)

type holmesContextBuilder struct {
	clientset kubernetes.Interface
	ctx       context.Context
	sb        strings.Builder
}

func (a *App) newHolmesContextBuilder() (*holmesContextBuilder, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	return &holmesContextBuilder{
		clientset: clientset,
		ctx:       ctx,
	}, nil
}
