package docker

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
	"gopkg.in/yaml.v3"
)

type swarmServiceLister interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
}

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

func toDurationString(d interface{}) string {
	// Docker types use time.Duration underneath; yaml wants string.
	// We accept fmt.Stringer or fallback.
	if d == nil {
		return ""
	}
	if s, ok := d.(fmt.Stringer); ok {
		return s.String()
	}
	return fmt.Sprint(d)
}

func buildComposeService(svc swarm.Service) composeService {
	cs := composeService{
		Image:  svc.Spec.TaskTemplate.ContainerSpec.Image,
		Labels: svc.Spec.Labels,
	}
	cs.Ports = composePorts(svc)
	cs.Deploy = composeDeployConfig(svc)
	return cs
}

func composePorts(svc swarm.Service) []string {
	if svc.Endpoint.Spec.Ports == nil {
		return nil
	}
	ports := make([]string, 0, len(svc.Endpoint.Spec.Ports))
	for _, p := range svc.Endpoint.Spec.Ports {
		if p.PublishedPort == 0 || p.TargetPort == 0 {
			continue
		}
		proto := string(p.Protocol)
		if proto == "" {
			proto = "tcp"
		}
		ports = append(ports, fmt.Sprintf("%d:%d/%s", p.PublishedPort, p.TargetPort, proto))
	}
	if len(ports) == 0 {
		return nil
	}
	return ports
}

func composeDeployConfig(svc swarm.Service) *composeDeploy {
	deploy := &composeDeploy{}
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

	if uc := svc.Spec.UpdateConfig; uc != nil {
		deploy.Update = composeUpdateConfigFromSpec(uc)
	}

	if rp := svc.Spec.TaskTemplate.RestartPolicy; rp != nil {
		deploy.Restart = composeRestartPolicyFromSpec(rp)
	}

	if deploy.Mode == "" && deploy.Replicas == nil && deploy.Update == nil && deploy.Restart == nil {
		return nil
	}
	return deploy
}

func composeUpdateConfigFromSpec(uc *swarm.UpdateConfig) *composeUpdateConfig {
	cu := &composeUpdateConfig{}
	if uc.Parallelism != 0 {
		p := uint64(uc.Parallelism)
		cu.Parallelism = &p
	}
	if uc.Delay != 0 {
		cu.Delay = uc.Delay.String()
	}
	if uc.FailureAction != "" {
		cu.FailureAction = string(uc.FailureAction)
	}
	if uc.Order != "" {
		cu.Order = string(uc.Order)
	}
	if cu.Parallelism == nil && cu.Delay == "" && cu.FailureAction == "" && cu.Order == "" {
		return nil
	}
	return cu
}

func composeRestartPolicyFromSpec(rp *swarm.RestartPolicy) *composeRestartPolicy {
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
	if cr.Condition == "" && cr.Delay == "" && cr.MaxAttempts == nil && cr.Window == "" {
		return nil
	}
	return cr
}

// GetSwarmStackComposeYAML generates a best-effort docker-compose YAML derived from current service specs.
// It is NOT source-of-truth; it only includes fields we can reliably infer.
func GetSwarmStackComposeYAML(ctx context.Context, cli *client.Client, stackName string) (string, error) {
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return "", err
	}

	cf := composeFile{
		Version:  "3.8",
		Services: map[string]composeService{},
	}

	// Stable output ordering
	var names []string
	for _, svc := range services {
		if svc.Spec.Labels["com.docker.stack.namespace"] != stackName {
			continue
		}
		name := svc.Spec.Name
		names = append(names, name)

		cf.Services[name] = buildComposeService(svc)
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
