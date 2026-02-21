import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  serviceFormToYaml,
  yamlToServiceForm,
  rowsToObject,
  objectToRows,
  validateServiceForm,
  configFormToYaml,
  yamlToConfigForm,
} from '../utils/swarmYamlUtils';

describe('swarmYamlUtils', () => {
  describe('rowsToObject / objectToRows', () => {
    it('converts rows to object (ignoring empty keys)', () => {
      expect(rowsToObject([{ key: 'A', value: '1' }, { key: '  ', value: 'x' }])).toEqual({ A: '1' });
    });

    it('converts object to sorted rows', () => {
      const rows = objectToRows({ b: 2, a: 1 });
      expect(rows.map((r) => r.key)).toEqual(['a', 'b']);
      expect(rows.find((r) => r.key === 'a')?.value).toBe('1');
    });
  });

  describe('serviceFormToYaml / yamlToServiceForm', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    const randSpy = vi.spyOn(Math, 'random');

    beforeEach(() => {
      nowSpy.mockReturnValue(1234567890);
      randSpy.mockReturnValue(0.5);
    });

    afterEach(() => {
      nowSpy.mockReset();
      randSpy.mockReset();
    });

    it('renders placeholder blocks for empty ports/env/labels', () => {
      const out = serviceFormToYaml({ name: 'svc', image: 'nginx:1.25', ports: [], env: {}, labels: {} });
      expect(out).toContain('ports:');
      expect(out).toContain('# - protocol: tcp');
      expect(out).toContain('env:');
      expect(out).toContain('# KEY: value');
      expect(out).toContain('labels:');
      expect(out).toContain('# com.example.label: value');
    });

    it('round-trips basic service yaml to form', () => {
      const yamlText = [
        'name: svc',
        'image: nginx:1.25',
        'mode: replicated',
        'replicas: 2',
        'ports:',
        '  - protocol: tcp',
        '    targetPort: 80',
        '    publishedPort: 8080',
        '    publishMode: ingress',
        'env:',
        '  A: 1',
        'labels:',
        '  b: two',
      ].join('\n');

      const form = yamlToServiceForm(yamlText);
      expect(form.name).toBe('svc');
      expect(form.image).toBe('nginx:1.25');
      expect(form.mode).toBe('replicated');
      expect(form.replicas).toBe(2);
      expect(form.ports).toHaveLength(1);
      expect(form.ports[0].targetPort).toBe(80);
      expect(form.ports[0].publishedPort).toBe(8080);
      expect(form.env.map((r) => r.key)).toEqual(['A']);
      expect(form.labels.map((r) => r.key)).toEqual(['b']);
    });

    it('throws for non-mapping YAML', () => {
      expect(() => yamlToServiceForm('- a\n- b\n')).toThrow('YAML must be a mapping/object.');
    });
  });

  describe('validateServiceForm', () => {
    it('requires name and image and validates DNS-ish name', () => {
      expect(validateServiceForm({})).toMatchObject({
        name: 'Name is required.',
        image: 'Image is required.',
      });

      expect(validateServiceForm({ name: 'Bad_Name', image: 'x' })).toMatchObject({
        name: 'Name must be lowercase DNS-compatible (a-z, 0-9, hyphen).',
      });
    });

    it('validates replicas for replicated mode only', () => {
      expect(validateServiceForm({ name: 'svc', image: 'x', mode: 'replicated', replicas: -1 })).toMatchObject({
        replicas: 'Replicas must be an integer >= 0.',
      });
      expect(validateServiceForm({ name: 'svc', image: 'x', mode: 'global', replicas: -1 })).toEqual({});
    });

    it('validates port mappings when any value is set', () => {
      expect(validateServiceForm({
        name: 'svc',
        image: 'x',
        ports: [{ targetPort: 0, publishedPort: 8080 }],
      })).toMatchObject({ ports: 'All port mappings must have a valid target port (1-65535).' });

      expect(validateServiceForm({
        name: 'svc',
        image: 'x',
        ports: [{ targetPort: 80, publishedPort: 70000 }],
      })).toMatchObject({ ports: 'All port mappings must have a valid published port (1-65535).' });
    });
  });

  describe('configFormToYaml / yamlToConfigForm', () => {
    it('renders placeholder labels block when labels empty', () => {
      const out = configFormToYaml({ name: 'cfg', labels: {}, data: 'x' });
      expect(out).toContain('labels:');
      expect(out).toContain('# com.example.owner: dev');
    });

    it('parses mapping YAML to config form', () => {
      const form = yamlToConfigForm('name: cfg\nlabels:\n  b: two\ndata: hello\n');
      expect(form).toEqual({ name: 'cfg', labels: { b: 'two' }, data: 'hello' });
    });

    it('throws for non-mapping YAML', () => {
      expect(() => yamlToConfigForm('- a\n- b\n')).toThrow('YAML must be a mapping/object.');
    });
  });
});
