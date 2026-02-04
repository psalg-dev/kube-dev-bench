import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showSuccess, showWarning, showError } from '../notification.js';

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

  it('animates progress bar width based on duration', () => {
    const origRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb) => {
      cb();
      return 0;
    };

    showSuccess('progress', { duration: 1000 });
    const container = getContainer();
    const note = container.firstChild;
    const progress = note.querySelector('.gh-notification__progress');

    expect(progress.style.transition).toContain('1000ms');

    expect(progress.style.width).toBe('0%');
    // Notification should still be present before duration elapses
    expect(container.children.length).toBe(1);

    global.requestAnimationFrame = origRAF;
  });

  it('supports dragging notifications and stops on mouseup', () => {
    showSuccess('drag me', { duration: 5000 });
    const container = getContainer();
    const note = container.firstChild;

    vi.spyOn(note, 'getBoundingClientRect').mockReturnValue({
      left: 50,
      top: 80,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 50,
      y: 80,
      toJSON: () => ({}),
    });

    note.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 60, clientY: 100 }));
    expect(note.style.position).toBe('fixed');
    expect(note.style.left).toBe('50px');
    expect(note.style.top).toBe('80px');

    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 70, clientY: 110 }));
    expect(note.style.left).toBe('60px');
    expect(note.style.top).toBe('90px');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 70, clientY: 110 }));
    const afterLeft = note.style.left;
    const afterTop = note.style.top;
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 300 }));
    expect(note.style.left).toBe(afterLeft);
    expect(note.style.top).toBe(afterTop);
  });

  it('does not start dragging when clicking the close button', () => {
    showWarning('close drag', { duration: 5000 });
    const container = getContainer();
    const note = container.firstChild;
    const close = note.querySelector('.gh-notification__close');

    vi.spyOn(note, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });

    close.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 15, clientY: 25 }));
    expect(note.style.position).not.toBe('fixed');
  });
});

