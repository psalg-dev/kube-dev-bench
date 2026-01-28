import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSwarmServiceForm, {
  getDefaultServiceForm,
} from '../hooks/useSwarmServiceForm';

// Mock swarmYamlUtils
vi.mock('../utils/swarmYamlUtils', () => ({
  rowsToObject: vi.fn((rows) => {
    const obj = {};
    (rows || []).forEach((r) => {
      if (r.key && r.key.trim()) obj[r.key.trim()] = r.value || '';
    });
    return obj;
  }),
  serviceFormToYaml: vi.fn(
    (form) => `name: ${form.name}\nimage: ${form.image}`,
  ),
  validateServiceForm: vi.fn((form) => {
    const errs = {};
    if (!form.name?.trim()) errs.name = 'Name is required';
    if (!form.image?.trim()) errs.image = 'Image is required';
    return errs;
  }),
  yamlToServiceForm: vi.fn((yaml) => {
    if (yaml.includes('invalid')) throw new Error('Invalid YAML');
    return {
      name: 'parsed-service',
      image: 'parsed-image:latest',
      mode: 'replicated',
      replicas: 2,
      ports: [],
      env: [],
      labels: [],
    };
  }),
}));

describe('getDefaultServiceForm', () => {
  it('returns default form values', () => {
    const defaults = getDefaultServiceForm();

    expect(defaults.name).toBe('my-service');
    expect(defaults.image).toBe('nginx:latest');
    expect(defaults.mode).toBe('replicated');
    expect(defaults.replicas).toBe(1);
    expect(defaults.ports).toEqual([]);
    expect(defaults.env).toEqual([{ id: 'kv_env_init', key: '', value: '' }]);
    expect(defaults.labels).toEqual([
      { id: 'kv_label_init', key: '', value: '' },
    ]);
  });
});

describe('useSwarmServiceForm', () => {
  describe('initial state', () => {
    it('starts in form viewMode', () => {
      const { result } = renderHook(() => useSwarmServiceForm());
      expect(result.current.viewMode).toBe('form');
    });

    it('initializes with default form data', () => {
      const { result } = renderHook(() => useSwarmServiceForm());
      expect(result.current.formData.name).toBe('my-service');
      expect(result.current.formData.image).toBe('nginx:latest');
    });

    it('starts with empty yaml text', () => {
      const { result } = renderHook(() => useSwarmServiceForm());
      expect(result.current.yamlText).toBe('');
    });

    it('starts with empty errors', () => {
      const { result } = renderHook(() => useSwarmServiceForm());
      expect(result.current.errors).toEqual({});
    });
  });

  describe('validate function', () => {
    it('validates form data and sets errors', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      act(() => {
        result.current.setFormData({ name: '', image: '' });
      });

      let errs;
      act(() => {
        errs = result.current.validate(result.current.formData);
      });

      expect(errs.name).toBe('Name is required');
      expect(errs.image).toBe('Image is required');
      expect(result.current.errors.name).toBe('Name is required');
    });
  });

  describe('toCreateOptions', () => {
    it('converts form data to create options', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      const options = result.current.toCreateOptions({
        name: 'test-service',
        image: 'nginx:1.21',
        mode: 'replicated',
        replicas: 3,
        labels: [{ key: 'app', value: 'test' }],
        env: [{ key: 'NODE_ENV', value: 'production' }],
        ports: [
          {
            protocol: 'tcp',
            targetPort: 80,
            publishedPort: 8080,
            publishMode: 'ingress',
          },
        ],
      });

      expect(options.name).toBe('test-service');
      expect(options.image).toBe('nginx:1.21');
      expect(options.mode).toBe('replicated');
      expect(options.replicas).toBe(3);
    });

    it('handles global mode (replicas = 0)', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      const options = result.current.toCreateOptions({
        name: 'global-service',
        image: 'nginx',
        mode: 'global',
        replicas: 5, // Should be ignored for global
      });

      expect(options.mode).toBe('global');
      expect(options.replicas).toBe(0);
    });

    it('filters out invalid ports', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      const options = result.current.toCreateOptions({
        name: 'svc',
        image: 'img',
        mode: 'replicated',
        replicas: 1,
        ports: [
          { protocol: 'tcp', targetPort: 80, publishedPort: 8080 },
          { protocol: 'tcp', targetPort: 'invalid', publishedPort: 8081 },
        ],
        labels: [],
        env: [],
      });

      expect(options.ports.length).toBe(1);
    });
  });

  describe('switchTo function', () => {
    it('does nothing when switching to current mode', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      const response = result.current.switchTo('form');

      expect(response.ok).toBe(true);
      expect(result.current.viewMode).toBe('form');
    });

    it('switches from form to yaml mode', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      act(() => {
        result.current.switchTo('yaml');
      });

      expect(result.current.viewMode).toBe('yaml');
    });

    it('switches from yaml to form mode', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      // First switch to yaml
      act(() => {
        result.current.switchTo('yaml');
      });

      // Then switch back to form
      let response;
      act(() => {
        response = result.current.switchTo('form');
      });

      expect(response.ok).toBe(true);
      expect(result.current.viewMode).toBe('form');
    });

    it('returns error when YAML is invalid', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      // First switch to yaml
      act(() => {
        result.current.switchTo('yaml');
      });

      // Set invalid yaml
      act(() => {
        result.current.setYamlText('invalid yaml');
      });

      // Then try to switch back to form
      let response;
      act(() => {
        response = result.current.switchTo('form');
      });

      expect(response.ok).toBe(false);
      expect(response.error).toBe('Invalid YAML');
    });
  });

  describe('setFormData', () => {
    it('updates form data', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      act(() => {
        result.current.setFormData({
          name: 'new-service',
          image: 'alpine:3.14',
        });
      });

      expect(result.current.formData.name).toBe('new-service');
      expect(result.current.formData.image).toBe('alpine:3.14');
    });
  });

  describe('setYamlText', () => {
    it('updates yaml text', () => {
      const { result } = renderHook(() => useSwarmServiceForm());

      act(() => {
        result.current.setYamlText('name: test\nimage: nginx');
      });

      expect(result.current.yamlText).toBe('name: test\nimage: nginx');
    });
  });
});
