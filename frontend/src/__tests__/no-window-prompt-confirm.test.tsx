import { describe, it, expect } from 'vitest';

// Guard: table/dialog code must route through the ModalProvider, never native
// window.prompt/confirm. Uses vite's import.meta.glob to read every source file
// as raw text at test time (no node fs/require in the jsdom env).
const sources = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('no window.prompt / window.confirm in app source', () => {
  it('finds no native prompt/confirm calls outside tests', () => {
    const promptPattern = /window\.(prompt|confirm)\s*\(/g;
    const offenders: string[] = [];

    for (const [path, content] of Object.entries(sources)) {
      if (path.includes('/__tests__/')) continue;
      const matches = content.match(promptPattern);
      if (matches) offenders.push(`${path}: ${matches.join(', ')}`);
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
