import yaml from 'js-yaml';

function toInt(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function serviceFormToYaml(formData) {
  const mode = formData?.mode || 'replicated';

  const doc = {
    name: (formData?.name || '').toString(),
    image: (formData?.image || '').toString(),
    mode,
  };

  if (mode === 'replicated') {
    doc.replicas = toInt(formData?.replicas) ?? 1;
  }

  doc.ports = (formData?.ports || []).map((p) => ({
    protocol: (p?.protocol || 'tcp'),
    targetPort: toInt(p?.targetPort),
    publishedPort: toInt(p?.publishedPort),
    publishMode: (p?.publishMode || 'ingress'),
  })).filter((p) => p.targetPort !== undefined || p.publishedPort !== undefined);

  doc.env = (formData?.envObject || formData?.env || {});
  doc.labels = (formData?.labelsObject || formData?.labels || {});

  const dumped = yaml.dump(doc, { noRefs: true, lineWidth: -1, sortKeys: false, indent: 2 });

  // js-yaml renders empty arrays/maps in flow style (`ports: []`, `env: {}`), which looks "flat".
  // Replace those with indented placeholder blocks so users see the intended YAML shape.
  const replaceLine = (src, key, replacementBlock) => {
    const re = new RegExp(`^${key}:\\s*(\\[\\]|\\{\\})\\s*$`, 'm');
    if (!re.test(src)) return src;
    return src.replace(re, replacementBlock);
  };

  let out = dumped;
  out = replaceLine(out, 'ports', [
    'ports:',
    '  # - protocol: tcp',
    '  #   targetPort: 80',
    '  #   publishedPort: 8080',
    '  #   publishMode: ingress',
  ].join('\n'));
  out = replaceLine(out, 'env', [
    'env:',
    '  # KEY: value',
  ].join('\n'));
  out = replaceLine(out, 'labels', [
    'labels:',
    '  # com.example.label: value',
  ].join('\n'));

  return out;
}

export function yamlToServiceForm(yamlText) {
  const parsed = yaml.load(yamlText || '');
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('YAML must be a mapping/object.');
  }

  const name = (parsed.name ?? '').toString();
  const image = (parsed.image ?? '').toString();
  const mode = (parsed.mode ?? 'replicated').toString();
  const replicas = parsed.replicas ?? 1;

  const ports = Array.isArray(parsed.ports) ? parsed.ports : [];

  return {
    name,
    image,
    mode: mode === 'global' ? 'global' : 'replicated',
    replicas: toInt(replicas) ?? 1,
    ports: ports.map((p) => ({
      id: `port_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      protocol: (p?.protocol || 'tcp').toString(),
      targetPort: p?.targetPort ?? '',
      publishedPort: p?.publishedPort ?? '',
      publishMode: (p?.publishMode || 'ingress').toString(),
    })),
    env: objectToRows(parsed.env),
    labels: objectToRows(parsed.labels),
  };
}

export function rowsToObject(rows) {
  const out = {};
  for (const row of rows || []) {
    const k = (row?.key || '').trim();
    if (!k) continue;
    out[k] = (row?.value ?? '').toString();
  }
  return out;
}

export function objectToRows(obj) {
  const o = (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
  return Object.keys(o).sort().map((k) => ({ id: `kv_${k}`, key: k, value: (o[k] ?? '').toString() }));
}

export function validateServiceForm(formData) {
  const errors = {};
  const name = (formData?.name || '').trim();
  const image = (formData?.image || '').trim();

  if (!name) {
    errors.name = 'Name is required.';
  } else {
    const dns = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!dns.test(name)) errors.name = 'Name must be lowercase DNS-compatible (a-z, 0-9, hyphen).';
  }

  if (!image) {
    errors.image = 'Image is required.';
  }

  if ((formData?.mode || 'replicated') === 'replicated') {
    const r = toInt(formData?.replicas);
    if (r === undefined || r < 0) errors.replicas = 'Replicas must be an integer >= 0.';
  }

  const ports = formData?.ports || [];
  for (const p of ports) {
    const t = toInt(p?.targetPort);
    const pub = toInt(p?.publishedPort);
    const any = (p?.targetPort !== '' && p?.targetPort !== undefined) || (p?.publishedPort !== '' && p?.publishedPort !== undefined);
    if (!any) continue;

    if (!t || t < 1 || t > 65535) {
      errors.ports = 'All port mappings must have a valid target port (1-65535).';
      break;
    }
    if (!pub || pub < 1 || pub > 65535) {
      errors.ports = 'All port mappings must have a valid published port (1-65535).';
      break;
    }
  }

  return errors;
}

function ensureMapping(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return v;
}

function ensureString(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

function renderObjectPlaceholderBlocks(dumped, replacements) {
  let out = dumped;
  for (const r of replacements) {
    const re = new RegExp(`^${r.key}:\\s*(\\{\\}|\\[\\])\\s*$`, 'm');
    if (re.test(out)) out = out.replace(re, r.replacement);
  }
  return out;
}

export function configFormToYaml(formData) {
  const doc = {
    name: ensureString(formData?.name).trim(),
    labels: ensureMapping(formData?.labels),
    data: ensureString(formData?.data),
  };
  const dumped = yaml.dump(doc, { noRefs: true, lineWidth: -1, sortKeys: false, indent: 2 });
  return renderObjectPlaceholderBlocks(dumped, [{
    key: 'labels',
    replacement: [
      'labels:',
      '  # com.example.owner: dev',
    ].join('\n')
  }]);
}

export function yamlToConfigForm(yamlText) {
  const parsed = yaml.load(yamlText || '');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('YAML must be a mapping/object.');
  }
  return {
    name: ensureString(parsed.name).trim(),
    labels: ensureMapping(parsed.labels),
    data: ensureString(parsed.data),
  };
}

export function secretFormToYaml(formData) {
  const doc = {
    name: ensureString(formData?.name).trim(),
    labels: ensureMapping(formData?.labels),
    data: ensureString(formData?.data),
  };
  const dumped = yaml.dump(doc, { noRefs: true, lineWidth: -1, sortKeys: false, indent: 2 });
  return renderObjectPlaceholderBlocks(dumped, [{
    key: 'labels',
    replacement: [
      'labels:',
      '  # com.example.owner: dev',
    ].join('\n')
  }]);
}

export function yamlToSecretForm(yamlText) {
  const parsed = yaml.load(yamlText || '');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('YAML must be a mapping/object.');
  }
  return {
    name: ensureString(parsed.name).trim(),
    labels: ensureMapping(parsed.labels),
    data: ensureString(parsed.data),
  };
}

export function nodeFormToYaml(formData) {
  const doc = {
    id: ensureString(formData?.id).trim(),
    availability: ensureString(formData?.availability || 'active').trim(),
    role: ensureString(formData?.role || 'worker').trim(),
    labels: ensureMapping(formData?.labels),
  };
  const dumped = yaml.dump(doc, { noRefs: true, lineWidth: -1, sortKeys: false, indent: 2 });
  return renderObjectPlaceholderBlocks(dumped, [{
    key: 'labels',
    replacement: [
      'labels:',
      '  # com.example.owner: dev',
    ].join('\n')
  }]);
}

export function yamlToNodeForm(yamlText) {
  const parsed = yaml.load(yamlText || '');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('YAML must be a mapping/object.');
  }
  return {
    id: ensureString(parsed.id).trim(),
    availability: ensureString(parsed.availability || 'active').trim(),
    role: ensureString(parsed.role || 'worker').trim(),
    labels: ensureMapping(parsed.labels),
  };
}
