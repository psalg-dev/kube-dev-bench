import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { navigateToResource, resourceLinkStyles, resourceLinkHoverStyles } from '../utils/resourceNavigation';

describe('resourceNavigation', () => {
  describe('navigateToResource', () => {
    let dispatchEventSpy;
    let capturedEvent;

    beforeEach(() => {
      capturedEvent = null;
      dispatchEventSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
        capturedEvent = event;
        return true;
      });
    });

    afterEach(() => {
      dispatchEventSpy.mockRestore();
    });

    it('dispatches a custom event with resource details', () => {
      navigateToResource({ resource: 'Pod', name: 'my-pod', namespace: 'default' });

      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
      expect(capturedEvent).toBeInstanceOf(CustomEvent);
      expect(capturedEvent.type).toBe('navigate-to-resource');
    });

    it('includes resource type in event detail', () => {
      navigateToResource({ resource: 'Deployment', name: 'my-deployment', namespace: 'prod' });

      expect(capturedEvent.detail.resource).toBe('Deployment');
    });

    it('includes resource name in event detail', () => {
      navigateToResource({ resource: 'Service', name: 'my-service', namespace: 'default' });

      expect(capturedEvent.detail.name).toBe('my-service');
    });

    it('includes namespace in event detail', () => {
      navigateToResource({ resource: 'ConfigMap', name: 'my-config', namespace: 'kube-system' });

      expect(capturedEvent.detail.namespace).toBe('kube-system');
    });

    it('defaults namespace to empty string when not provided', () => {
      navigateToResource({ resource: 'Pod', name: 'my-pod' });

      expect(capturedEvent.detail.namespace).toBe('');
    });

    it('works with Kubernetes resource types', () => {
      const k8sResources = [
        'Pod', 'Deployment', 'Service', 'ConfigMap', 'Secret',
        'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob',
        'Ingress', 'PersistentVolume', 'PersistentVolumeClaim',
      ];

      k8sResources.forEach((resource) => {
        navigateToResource({ resource, name: 'test-resource', namespace: 'default' });
        expect(capturedEvent.detail.resource).toBe(resource);
      });
    });

    it('works with Swarm resource types', () => {
      const swarmResources = [
        'SwarmService', 'SwarmTask', 'SwarmNode', 'SwarmNetwork',
        'SwarmVolume', 'SwarmConfig', 'SwarmSecret', 'SwarmStack',
      ];

      swarmResources.forEach((resource) => {
        navigateToResource({ resource, name: 'test-resource' });
        expect(capturedEvent.detail.resource).toBe(resource);
      });
    });

    it('handles special characters in resource name', () => {
      navigateToResource({ 
        resource: 'Pod', 
        name: 'my-pod-with-special-chars-123', 
        namespace: 'default' 
      });

      expect(capturedEvent.detail.name).toBe('my-pod-with-special-chars-123');
    });

    it('handles empty resource name', () => {
      navigateToResource({ resource: 'Pod', name: '', namespace: 'default' });

      expect(capturedEvent.detail.name).toBe('');
    });
  });

  describe('resourceLinkStyles', () => {
    it('has cursor pointer style', () => {
      expect(resourceLinkStyles.cursor).toBe('pointer');
    });

    it('has link color', () => {
      expect(resourceLinkStyles.color).toBeDefined();
      expect(resourceLinkStyles.color).toContain('--gh-link');
    });

    it('has no text decoration', () => {
      expect(resourceLinkStyles.textDecoration).toBe('none');
    });

    it('has transition for color', () => {
      expect(resourceLinkStyles.transition).toContain('color');
    });
  });

  describe('resourceLinkHoverStyles', () => {
    it('has underline text decoration', () => {
      expect(resourceLinkHoverStyles.textDecoration).toBe('underline');
    });

    it('has hover color', () => {
      expect(resourceLinkHoverStyles.color).toBeDefined();
      expect(resourceLinkHoverStyles.color).toContain('--gh-link-hover');
    });
  });
});
