import { useCallback, useMemo, useState } from 'react';
import { rowsToObject, serviceFormToYaml, validateServiceForm, yamlToServiceForm } from '../utils/swarmYamlUtils';

export interface KeyValueRow {
  id?: string;
  key: string;
  value: string;
}

export interface PortMappingRow {
  id?: string;
  protocol?: string;
  targetPort?: string;
  publishedPort?: string;
  publishMode?: string;
}

export interface SwarmServiceFormData {
  name: string;
  image: string;
  mode: 'replicated' | 'global';
  replicas: number | string;
  ports: PortMappingRow[];
  env: KeyValueRow[];
  labels: KeyValueRow[];
}

export interface SwarmServiceFormErrors {
  name?: string;
  image?: string;
  replicas?: string;
  ports?: string;
  [key: string]: string | undefined;
}

interface SwarmServiceCreatePort {
  protocol: string;
  targetPort: number;
  publishedPort: number;
  publishMode: string;
}

export interface SwarmServiceCreateOptions {
  name: string;
  image: string;
  mode: 'replicated' | 'global';
  replicas: number;
  labels: Record<string, string>;
  env: Record<string, string>;
  ports: SwarmServiceCreatePort[];
}

export function getDefaultServiceForm(): SwarmServiceFormData {
  return {
    name: 'my-service',
    image: 'nginx:latest',
    mode: 'replicated',
    replicas: 1,
    ports: [],
    env: [{ id: 'kv_env_init', key: '', value: '' }],
    labels: [{ id: 'kv_label_init', key: '', value: '' }],
  };
}

export default function useSwarmServiceForm() {
  const [viewMode, setViewMode] = useState<'form' | 'yaml'>('form');
  const [formData, setFormData] = useState<SwarmServiceFormData>(getDefaultServiceForm());
  const [yamlText, setYamlText] = useState('');
  const [errors, setErrors] = useState<SwarmServiceFormErrors>({});

  const updateFormData = useCallback(
    (
      next:
        | Partial<SwarmServiceFormData>
        | SwarmServiceFormData
        | ((_prev: SwarmServiceFormData) => SwarmServiceFormData)
    ) => {
      if (typeof next === 'function') {
        setFormData(next as (_prev: SwarmServiceFormData) => SwarmServiceFormData);
        return;
      }
      setFormData((prev) => ({ ...prev, ...next }));
    },
    []
  );

  const validate = useCallback((d: SwarmServiceFormData) => {
    const envObject = rowsToObject(d.env);
    const labelsObject = rowsToObject(d.labels);
    const errs = validateServiceForm({
      ...d,
      envObject,
      labelsObject,
      env: envObject,
      labels: labelsObject,
    }) as SwarmServiceFormErrors;
    setErrors(errs);
    return errs;
  }, []);

  const toCreateOptions = useCallback((d: SwarmServiceFormData): SwarmServiceCreateOptions => {
    const mode = d.mode || 'replicated';
    const replicas = mode === 'replicated' ? Number.parseInt(String(d.replicas || 0), 10) : 0;

    return {
      name: d.name.trim(),
      image: d.image.trim(),
      mode,
      replicas: Number.isFinite(replicas) ? replicas : 0,
      labels: rowsToObject(d.labels) as Record<string, string>,
      env: rowsToObject(d.env) as Record<string, string>,
      ports: (d.ports || []).map((p) => ({
        protocol: (p.protocol || 'tcp'),
        targetPort: Number.parseInt(String(p.targetPort || 0), 10),
        publishedPort: Number.parseInt(String(p.publishedPort || 0), 10),
        publishMode: (p.publishMode || 'ingress'),
      })).filter((p) => Number.isFinite(p.targetPort) && Number.isFinite(p.publishedPort)),
    };
  }, []);

  const formToYaml = useCallback((d: SwarmServiceFormData) => {
    const envObject = rowsToObject(d.env);
    const labelsObject = rowsToObject(d.labels);
    return serviceFormToYaml({
      ...d,
      envObject,
      labelsObject,
      env: envObject,
      labels: labelsObject,
    });
  }, []);

  const switchTo = useCallback((nextMode: 'form' | 'yaml') => {
    if (nextMode === viewMode) return { ok: true } as const;

    if (nextMode === 'yaml') {
      const y = formToYaml(formData);
      setYamlText(y);
      setViewMode('yaml');
      return { ok: true } as const;
    }

    try {
      const nextForm = yamlToServiceForm(yamlText) as SwarmServiceFormData;
      setFormData(nextForm);
      setViewMode('form');
      validate(nextForm);
      return { ok: true } as const;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message } as const;
    }
  }, [formData, formToYaml, validate, viewMode, yamlText]);

  const api = useMemo(() => ({
    viewMode,
    setViewMode,
    formData,
    setFormData: updateFormData,
    yamlText,
    setYamlText,
    errors,
    validate,
    toCreateOptions,
    formToYaml,
    switchTo,
  }), [errors, formData, formToYaml, setViewMode, switchTo, toCreateOptions, updateFormData, validate, viewMode, yamlText]);

  return api;
}
