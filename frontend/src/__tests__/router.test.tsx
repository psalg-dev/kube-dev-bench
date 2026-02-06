import { describe, it, expect } from 'vitest';
import router, { k8sSections, swarmSections, allSections, sectionFromPath } from '../router';

describe('router', () => {
  describe('k8sSections', () => {
    it('contains expected kubernetes resource sections', () => {
      expect(k8sSections).toContain('pods');
      expect(k8sSections).toContain('deployments');
      expect(k8sSections).toContain('services');
      expect(k8sSections).toContain('jobs');
      expect(k8sSections).toContain('cronjobs');
      expect(k8sSections).toContain('daemonsets');
      expect(k8sSections).toContain('statefulsets');
      expect(k8sSections).toContain('replicasets');
      expect(k8sSections).toContain('configmaps');
      expect(k8sSections).toContain('secrets');
      expect(k8sSections).toContain('ingresses');
      expect(k8sSections).toContain('persistentvolumeclaims');
      expect(k8sSections).toContain('persistentvolumes');
      expect(k8sSections).toContain('helmreleases');
    });

    it('has 14 kubernetes sections', () => {
      expect(k8sSections.length).toBe(14);
    });
  });

  describe('swarmSections', () => {
    it('contains expected swarm sections', () => {
      expect(swarmSections).toContain('swarm-overview');
      expect(swarmSections).toContain('swarm-services');
      expect(swarmSections).toContain('swarm-tasks');
      expect(swarmSections).toContain('swarm-nodes');
      expect(swarmSections).toContain('swarm-stacks');
      expect(swarmSections).toContain('swarm-networks');
      expect(swarmSections).toContain('swarm-configs');
      expect(swarmSections).toContain('swarm-secrets');
      expect(swarmSections).toContain('swarm-volumes');
      expect(swarmSections).toContain('swarm-registries');
    });

    it('has 10 swarm sections', () => {
      expect(swarmSections.length).toBe(10);
    });
  });

  describe('allSections', () => {
    it('combines k8s and swarm sections', () => {
      expect(allSections.length).toBe(k8sSections.length + swarmSections.length);
    });

    it('includes all k8s sections', () => {
      for (const section of k8sSections) {
        expect(allSections).toContain(section);
      }
    });

    it('includes all swarm sections', () => {
      for (const section of swarmSections) {
        expect(allSections).toContain(section);
      }
    });
  });

  describe('sectionFromPath', () => {
    it('returns pods as default for empty path', () => {
      expect(sectionFromPath('')).toBe('pods');
    });

    it('returns pods as default for root path', () => {
      expect(sectionFromPath('/')).toBe('pods');
    });

    it('returns pods as default for unknown section', () => {
      expect(sectionFromPath('/unknown')).toBe('pods');
    });

    it('extracts k8s section from path', () => {
      expect(sectionFromPath('/pods')).toBe('pods');
      expect(sectionFromPath('/deployments')).toBe('deployments');
      expect(sectionFromPath('/services')).toBe('services');
      expect(sectionFromPath('/configmaps')).toBe('configmaps');
    });

    it('extracts swarm section from path', () => {
      expect(sectionFromPath('/swarm-overview')).toBe('swarm-overview');
      expect(sectionFromPath('/swarm-services')).toBe('swarm-services');
      expect(sectionFromPath('/swarm-nodes')).toBe('swarm-nodes');
    });

    it('handles path without leading slash', () => {
      expect(sectionFromPath('pods')).toBe('pods');
      expect(sectionFromPath('deployments')).toBe('deployments');
    });
  });

  describe('router export', () => {
    it('exports a valid router object', () => {
      expect(router).toBeDefined();
    });
  });
});
