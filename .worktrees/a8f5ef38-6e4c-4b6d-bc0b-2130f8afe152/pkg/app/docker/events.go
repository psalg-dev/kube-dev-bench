package docker

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
)

// SwarmEvent represents a Docker event for the frontend
type SwarmEvent struct {
	Type       string `json:"type"`       // container, image, network, volume, service, node, etc.
	Action     string `json:"action"`     // create, start, stop, die, kill, remove, update, etc.
	Actor      string `json:"actor"`      // ID or name of the object
	ActorName  string `json:"actorName"`  // Name of the object (if available)
	Time       string `json:"time"`       // Formatted timestamp
	TimeUnix   int64  `json:"timeUnix"`   // Unix timestamp for sorting
	Attributes string `json:"attributes"` // JSON string of attributes
}

// GetRecentEvents retrieves recent Docker events from the past duration
func GetRecentEvents(ctx context.Context, cli *client.Client, since time.Duration) ([]SwarmEvent, error) {
	if cli == nil {
		return nil, fmt.Errorf("docker client not connected")
	}

	sinceTime := time.Now().Add(-since)

	options := events.ListOptions{
		Since: sinceTime.Format(time.RFC3339),
		Until: time.Now().Format(time.RFC3339),
		Filters: filters.NewArgs(
			// Include relevant event types for Swarm
			filters.Arg("type", "container"),
			filters.Arg("type", "service"),
			filters.Arg("type", "node"),
			filters.Arg("type", "network"),
			filters.Arg("type", "volume"),
			filters.Arg("type", "config"),
			filters.Arg("type", "secret"),
		),
	}

	messageChan, errChan := cli.Events(ctx, options)

	var result []SwarmEvent

	// Collect events with a timeout
	collectCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for {
		select {
		case event, ok := <-messageChan:
			if !ok {
				// Channel closed, return what we have
				return result, nil
			}

			actorName := ""
			if name, ok := event.Actor.Attributes["name"]; ok {
				actorName = name
			} else if name, ok := event.Actor.Attributes["com.docker.swarm.service.name"]; ok {
				actorName = name
			}

			swarmEvent := SwarmEvent{
				Type:      string(event.Type),
				Action:    string(event.Action),
				Actor:     event.Actor.ID,
				ActorName: actorName,
				Time:      time.Unix(event.Time, 0).Format(time.RFC3339),
				TimeUnix:  event.Time,
			}

			result = append(result, swarmEvent)

		case err := <-errChan:
			if err != nil && err != context.Canceled {
				return result, fmt.Errorf("error reading events: %w", err)
			}
			return result, nil

		case <-collectCtx.Done():
			// Timeout or context done, return what we have
			return result, nil
		}
	}
}

// GetSwarmServiceEvents retrieves events for a specific service
func GetSwarmServiceEvents(ctx context.Context, cli *client.Client, serviceID string, since time.Duration) ([]SwarmEvent, error) {
	if cli == nil {
		return nil, fmt.Errorf("docker client not connected")
	}

	sinceTime := time.Now().Add(-since)

	options := events.ListOptions{
		Since: sinceTime.Format(time.RFC3339),
		Until: time.Now().Format(time.RFC3339),
		Filters: filters.NewArgs(
			filters.Arg("type", "service"),
			filters.Arg("service", serviceID),
		),
	}

	messageChan, errChan := cli.Events(ctx, options)

	var result []SwarmEvent

	collectCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for {
		select {
		case event, ok := <-messageChan:
			if !ok {
				return result, nil
			}

			actorName := ""
			if name, ok := event.Actor.Attributes["name"]; ok {
				actorName = name
			}

			swarmEvent := SwarmEvent{
				Type:      string(event.Type),
				Action:    string(event.Action),
				Actor:     event.Actor.ID,
				ActorName: actorName,
				Time:      time.Unix(event.Time, 0).Format(time.RFC3339),
				TimeUnix:  event.Time,
			}

			result = append(result, swarmEvent)

		case err := <-errChan:
			if err != nil && err != context.Canceled {
				return result, fmt.Errorf("error reading events: %w", err)
			}
			return result, nil

		case <-collectCtx.Done():
			return result, nil
		}
	}
}
