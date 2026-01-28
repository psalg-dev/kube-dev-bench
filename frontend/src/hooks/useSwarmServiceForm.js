import { useCallback, useMemo, useState } from 'react';
import {
  rowsToObject,
  serviceFormToYaml,
  validateServiceForm,
  yamlToServiceForm,
} from '../utils/swarmYamlUtils';

export function getDefaultServiceForm() {
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
  const [viewMode, setViewMode] = useState('form');
  const [formData, setFormData] = useState(getDefaultServiceForm());
  const [yamlText, setYamlText] = useState('');
  const [errors, setErrors] = useState({});

  const validate = useCallback((d) => {
    const errs = validateServiceForm(d);
    setErrors(errs);
    return errs;
  }, []);

  const toCreateOptions = useCallback((d) => {
    const mode = d.mode || 'replicated';
    const replicas =
      mode === 'replicated' ? Number.parseInt(String(d.replicas || 0), 10) : 0;

    return {
      name: d.name.trim(),
      image: d.image.trim(),
      mode,
      replicas: Number.isFinite(replicas) ? replicas : 0,
      labels: rowsToObject(d.labels),
      env: rowsToObject(d.env),
      ports: (d.ports || [])
        .map((p) => ({
          protocol: p.protocol || 'tcp',
          targetPort: Number.parseInt(String(p.targetPort || 0), 10),
          publishedPort: Number.parseInt(String(p.publishedPort || 0), 10),
          publishMode: p.publishMode || 'ingress',
        }))
        .filter(
          (p) =>
            Number.isFinite(p.targetPort) && Number.isFinite(p.publishedPort),
        ),
    };
  }, []);

  const formToYaml = useCallback((d) => {
    const envObject = rowsToObject(d.env);
    const labelsObject = rowsToObject(d.labels);
    return serviceFormToYaml({ ...d, envObject, labelsObject });
  }, []);

  const switchTo = useCallback(
    (nextMode) => {
      if (nextMode === viewMode) return { ok: true };

      if (nextMode === 'yaml') {
        const y = formToYaml(formData);
        setYamlText(y);
        setViewMode('yaml');
        return { ok: true };
      }

      try {
        const nextForm = yamlToServiceForm(yamlText);
        setFormData(nextForm);
        setViewMode('form');
        validate(nextForm);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    },
    [formData, formToYaml, validate, viewMode, yamlText],
  );

  const api = useMemo(
    () => ({
      viewMode,
      setViewMode,
      formData,
      setFormData,
      yamlText,
      setYamlText,
      errors,
      validate,
      toCreateOptions,
      formToYaml,
      switchTo,
    }),
    [
      errors,
      formData,
      formToYaml,
      setFormData,
      setViewMode,
      switchTo,
      toCreateOptions,
      validate,
      viewMode,
      yamlText,
    ],
  );

  return api;
}
