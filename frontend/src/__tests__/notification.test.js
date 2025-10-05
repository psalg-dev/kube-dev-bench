import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showNotification, showSuccess, showWarning, showError } from '../notification.js';

// Provide requestAnimationFrame polyfill for JSDOM + fake timers
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

beforeEach(() => {
  // Clean DOM between tests
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="maincontent"></div>';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

function getContainer() { return document.getElementById('gh-notification-container'); }

describe('notification system', () => {
  it('injects styles & container once', () => {
    expect(getContainer()).toBeNull();
    showSuccess('Hello');
    const style = document.getElementById('gh-notification-styles');
    expect(style).not.toBeNull();
    const container = getContainer();
    expect(container).not.toBeNull();
    // Subsequent call should not duplicate style
    showError('Again');
    expect(document.querySelectorAll('#gh-notification-styles').length).toBe(1);
  });

  it('stacks newest notifications on top', () => {
    showSuccess('first');
    showWarning('second');
    const container = getContainer();
    const texts = [...container.querySelectorAll('.gh-notification__text')].map(n=>n.textContent);
    expect(texts[0]).toBe('second');
    expect(texts[1]).toBe('first');
  });

  it('auto-dismisses after duration', () => {
    showSuccess('bye', { duration: 1000 });
    const container = getContainer();
    expect(container.children.length).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(container.children.length).toBe(0);
  });

  it('manual dismiss works & cancels timeout', () => {
    showWarning('close me', { duration: 5000 });
    const container = getContainer();
    const note = container.firstChild;
    note.querySelector('.gh-notification__close').click();
    expect(container.children.length).toBe(0);
    vi.advanceTimersByTime(5000); // should not throw or re-remove
    expect(container.children.length).toBe(0);
  });

  it('returns remover function', () => {
    const remove = showError('removable', { duration: 5000 });
    const container = getContainer();
    expect(container.children.length).toBe(1);
    remove();
    expect(container.children.length).toBe(0);
  });

  it('handles non-string message coercion', () => {
    showSuccess({ a: 1 });
    const container = getContainer();
    const text = container.querySelector('.gh-notification__text').textContent;
    expect(text).toContain('[object Object]');
  });
});

