package docker

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
	"gopkg.in/yaml.v3"
)

type composeFile struct {
	Version  string                    `yaml:"version"`
	Services map[string]composeService `yaml:"services"`
}

type composeService struct {
	Image  string            `yaml:"image,omitempty"`
	Ports  []string          `yaml:"ports,omitempty"`
	Deploy *composeDeploy    `yaml:"deploy,omitempty"`
	Labels map[string]string `yaml:"labels,omitempty"`
}

type composeDeploy struct {
	Mode     string                `yaml:"mode,omitempty"`
	Replicas *uint64               `yaml:"replicas,omitempty"`
	Update   *composeUpdateConfig  `yaml:"update_config,omitempty"`
	Restart  *composeRestartPolicy `yaml:"restart_policy,omitempty"`
}

type composeUpdateConfig struct {
	Parallelism   *uint64 `yaml:"parallelism,omitempty"`
	Delay         string  `yaml:"delay,omitempty"`
	FailureAction string  `yaml:"failure_action,omitempty"`
	Order         string  `yaml:"order,omitempty"`
}

type composeRestartPolicy struct {
	Condition   string  `yaml:"condition,omitempty"`
	Delay       string  `yaml:"delay,omitempty"`
	MaxAttempts *uint64 `yaml:"max_attempts,omitempty"`
	Window      string  `yaml:"window,omitempty"`
}

// GetSwarmStackComposeYAML generates a best-effort docker-compose YAML derived from current service specs.
// It is NOT source-of-truth; it only includes fields we can reliably infer.
func GetSwarmStackComposeYAML(ctx context.Context, cli *client.Client, stackName string) (string, error) {
	services, err := cli.ServiceList(ctx, swarm.ServiceListOptions{})
	if err != nil {
		return "", err
	}

	cf := composeFile{
		Version:  "3.8",
		Services: map[string]composeService{},
	}

	names := make([]string, 0, len(services))
	for _, svc := range services {
		if svc.Spec.Labels["com.docker.stack.namespace"] != stackName {
			continue
		}
		name := svc.Spec.Name
		names = append(names, name)
		cf.Services[name] = buildComposeService(&svc)
	}

	sort.Strings(names)

	b, err := yaml.Marshal(cf)
	if err != nil {
		return "", err
	}

	out := strings.TrimSpace(string(b))
	if out == "" {
		return "", nil
	}
	return out + "\n", nil
}

// buildComposeService builds a composeService from a swarm service
func buildComposeService(svc *swarm.Service) composeService {
	cs := composeService{
		Image:  svc.Spec.TaskTemplate.ContainerSpec.Image,
		Labels: svc.Spec.Labels,
		Ports:  buildServicePorts(svc.Endpoint.Spec.Ports),
	}

	deploy := buildComposeDeploy(svc)
	if deploy != nil {
		cs.Deploy = deploy
	}

	return cs
}

// buildServicePorts converts swarm port configs to compose port strings
func buildServicePorts(ports []swarm.PortConfig) []string {
	if ports == nil {
		return nil
	}

	result := make([]string, 0, len(ports))
	for _, p := range ports {
		if p.PublishedPort == 0 || p.TargetPort == 0 {
			continue
		}
		proto := string(p.Protocol)
		if proto == "" {
			proto = "tcp"
		}
		result = append(result, fmt.Sprintf("%d:%d/%s", p.PublishedPort, p.TargetPort, proto))
	}
	return result
}

// buildComposeDeploy builds deploy config from a swarm service
func buildComposeDeploy(svc *swarm.Service) *composeDeploy {
	deploy := &composeDeploy{}

	// Set mode and replicas
	switch {
	case svc.Spec.Mode.Replicated != nil:
		deploy.Mode = "replicated"
		if svc.Spec.Mode.Replicated.Replicas != nil {
			rep := *svc.Spec.Mode.Replicated.Replicas
			deploy.Replicas = &rep
		}
	case svc.Spec.Mode.Global != nil:
		deploy.Mode = "global"
	}

	deploy.Update = buildComposeUpdateConfig(svc.Spec.UpdateConfig)
	deploy.Restart = buildComposeRestartPolicy(svc.Spec.TaskTemplate.RestartPolicy)

	// Only return if any field is set
	if deploy.Mode == "" && deploy.Replicas == nil && deploy.Update == nil && deploy.Restart == nil {
		return nil
	}
	return deploy
}

// buildComposeUpdateConfig builds update config from swarm update config
func buildComposeUpdateConfig(uc *swarm.UpdateConfig) *composeUpdateConfig {
	if uc == nil {
		return nil
	}

	cu := &composeUpdateConfig{}
	if uc.Parallelism != 0 {
		p := uc.Parallelism
		cu.Parallelism = &p
	}
	if uc.Delay != 0 {
		cu.Delay = uc.Delay.String()
	}
	if uc.FailureAction != "" {
		cu.FailureAction = uc.FailureAction
	}
	if uc.Order != "" {
		cu.Order = uc.Order
	}

	// Only return if any field is set
	if cu.Parallelism == nil && cu.Delay == "" && cu.FailureAction == "" && cu.Order == "" {
		return nil
	}
	return cu
}

// buildComposeRestartPolicy builds restart policy from swarm restart policy
func buildComposeRestartPolicy(rp *swarm.RestartPolicy) *composeRestartPolicy {
	if rp == nil {
		return nil
	}

	cr := &composeRestartPolicy{}
	if rp.Condition != "" {
		cr.Condition = string(rp.Condition)
	}
	if rp.Delay != nil && *rp.Delay != 0 {
		cr.Delay = rp.Delay.String()
	}
	if rp.MaxAttempts != nil {
		m := uint64(*rp.MaxAttempts)
		cr.MaxAttempts = &m
	}
	if rp.Window != nil && *rp.Window != 0 {
		cr.Window = rp.Window.String()
	}

	// Only return if any field is set
	if cr.Condition == "" && cr.Delay == "" && cr.MaxAttempts == nil && cr.Window == "" {
		return nil
	}
	return cr
}
