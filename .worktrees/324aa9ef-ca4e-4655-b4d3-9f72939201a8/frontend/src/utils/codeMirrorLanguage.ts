import { yaml as yamlLang } from '@codemirror/lang-yaml';
import type { Extension } from '@codemirror/state';

const yamlExts = ['.yaml', '.yml'];

function looksLikeYaml(text?: string | null) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (s.startsWith('{') || s.startsWith('[')) return false; // likely JSON
  // Very small heuristics: common k8s/docker-ish keys.
  if (/^\s*(apiVersion|kind|metadata|services|version)\s*:/m.test(s)) return true;
  // Generic YAML-ish key: value lines.
  if (/^\s*[^\s#:][^:]*:\s*.+/m.test(s)) return true;
  return false;
}

export function getCodeMirrorLanguageExtensions(filename?: string | null, content?: string | null): Extension[] {
  const name = String(filename || '').toLowerCase();
  const isYamlByName = yamlExts.some((ext) => name.endsWith(ext));
  if (isYamlByName || looksLikeYaml(content)) return [yamlLang()];
  return [];
}
