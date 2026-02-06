import { describe, it, expect } from 'vitest';
import { getCodeMirrorLanguageExtensions } from '../utils/codeMirrorLanguage';

describe('codeMirrorLanguage', () => {
  it('returns yaml extension based on filename', () => {
    expect(getCodeMirrorLanguageExtensions('manifest.yaml', '')).toHaveLength(1);
    expect(getCodeMirrorLanguageExtensions('manifest.yml', '')).toHaveLength(1);
  });

  it('detects yaml based on content heuristics', () => {
    const yaml = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: x\n';
    expect(getCodeMirrorLanguageExtensions('unknown.txt', yaml)).toHaveLength(1);
  });

  it('does not treat json as yaml', () => {
    const json = '{"kind": "ConfigMap"}';
    expect(getCodeMirrorLanguageExtensions('unknown.txt', json)).toHaveLength(0);
  });

  it('returns empty list for empty inputs', () => {
    expect(getCodeMirrorLanguageExtensions('', '')).toHaveLength(0);
    expect(getCodeMirrorLanguageExtensions(null as unknown as string, null as unknown as string)).toHaveLength(0);
  });
});
