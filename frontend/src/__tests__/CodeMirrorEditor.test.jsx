import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../components/CodeMirrorEditor/CodeMirrorCore', () => ({
  default: ({ value, onChange, language }) => (
    <textarea
      data-testid="code-mirror-core"
      data-language={language}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

import CodeMirrorEditor from '../components/CodeMirrorEditor';

describe('CodeMirrorEditor', () => {
  it('renders lazy core with provided value and language', async () => {
    render(<CodeMirrorEditor value="hello" language="yaml" />);
    const core = await screen.findByTestId('code-mirror-core');
    expect(core.value).toBe('hello');
    expect(core.getAttribute('data-language')).toBe('yaml');
  });

  it('forwards onChange to update handler', async () => {
    const onChange = vi.fn();
    render(<CodeMirrorEditor value="" language="yaml" onChange={onChange} />);
    const core = await screen.findByTestId('code-mirror-core');
    fireEvent.change(core, { target: { value: 'updated' } });
    expect(onChange).toHaveBeenCalledWith('updated');
  });
});
