// Centralized notifications for the app (top-center of main content)
// - Follows GitHub dark theme colors
// - Types: success (green), error (red), warning (yellow)
// - Auto-dismiss after 3s with progress bar
// - Dismiss button and simple draggable behavior

const CONTAINER_ID = 'gh-notification-container';
const STYLE_ID = 'gh-notification-styles';

function ensureStylesInjected() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Container is placed inside #maincontent and positioned at top center */
    #${CONTAINER_ID} {
      position: absolute;
      top: 30px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      z-index: 1000;
      pointer-events: none; /* allow clicks to pass through except on notifications */
    }

    .gh-notification {
      pointer-events: auto;
      min-width: 320px;
      max-width: min(640px, 80vw);
      background: var(--gh-bg, #0d1117);
      border: 1px solid var(--gh-border, #30363d);
      color: var(--gh-text, #c9d1d9);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(1, 4, 9, 0.6);
      padding: 10px 12px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      grid-template-rows: auto auto;
      grid-template-areas:
        'icon text close'
        'progress progress progress';
      gap: 8px 10px;
      cursor: default;
      user-select: none;
      position: relative;
    }

    .gh-notification__icon { grid-area: icon; font-size: 18px; line-height: 1; }
    .gh-notification__text { grid-area: text; white-space: pre-wrap; word-break: break-word; }
    .gh-notification__close {
      grid-area: close;
      background: transparent;
      border: none;
      color: var(--gh-text-muted, #8b949e);
      cursor: pointer;
      font-size: 18px;
      padding: 0 4px;
    }
    .gh-notification__close:hover { color: var(--gh-text, #c9d1d9); }

    .gh-notification__progress {
      grid-area: progress;
      height: 3px;
      background: currentColor;
      opacity: 0.9;
      border-bottom-left-radius: 6px;
      border-bottom-right-radius: 6px;
      transform-origin: left center;
      width: 100%;
    }

    /* Type themes aligned with GitHub dark */
    .gh-notification--success {
      border-color: #2ea043;
      color: #3fb950; /* success fg */
      background: rgba(46, 160, 67, 0.5);
    }
    .gh-notification--error {
      border-color: #f85149;
      color: #f85149; /* danger fg */
      background: rgba(248, 81, 73, 0.5);
    }
    .gh-notification--warning {
      border-color: #d29922;
      color: #d29922; /* attention fg */
      background: rgba(210, 153, 34, 0.5);
    }
  `;
  document.head.appendChild(style);
}

function ensureContainer() {
  let container = document.getElementById(CONTAINER_ID);
  if (container) return container;

  // Prefer the main content area; fall back to body if not available
  const main = document.getElementById('maincontent') || document.body;
  container = document.createElement('div');
  container.id = CONTAINER_ID;
  main.appendChild(container);
  return container;
}

function makeDraggable(el) {
  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;
  const wasAbsolute = el.style.position === 'absolute' || el.style.position === 'fixed';

  const onMouseDown = (e) => {
    // Start dragging except when clicking the close button
    if (e.target.closest('.gh-notification__close')) return;
    dragging = true;
    const rect = el.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    origX = rect.left;
    origY = rect.top;
    // Lift to fixed so it can move freely over content
    el.style.position = 'fixed';
    el.style.left = `${origX}px`;
    el.style.top = `${origY}px`;
    el.style.right = 'auto';
    el.style.transform = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = `${origX + dx}px`;
    el.style.top = `${origY + dy}px`;
  };

  const onMouseUp = () => {
    dragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  el.addEventListener('mousedown', onMouseDown);

  return () => {
    el.removeEventListener('mousedown', onMouseDown);
    if (!wasAbsolute) {
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.transform = '';
    }
  };
}

function iconFor(type) {
  switch (type) {
    case 'success': return '✓';
    case 'warning': return '⚠️';
    case 'error':
    default: return '⛔';
  }
}

export function showNotification(message, { type = 'error', duration = 3000, dismissible = true } = {}) {
  ensureStylesInjected();
  const container = ensureContainer();

  // Enforce English text: ensure it's a string
  const text = String(message || '');

  const el = document.createElement('div');
  el.className = `gh-notification gh-notification--${type}`;
  el.innerHTML = `
    <div class="gh-notification__icon" aria-hidden="true">${iconFor(type)}</div>
    <div class="gh-notification__text" role="status">${text}</div>
    ${dismissible ? '<button class="gh-notification__close" aria-label="Dismiss">×</button>' : '<span />'}
    <div class="gh-notification__progress"></div>
  `;

  // Progress bar animation
  const progress = el.querySelector('.gh-notification__progress');
  progress.style.transition = `width ${duration}ms linear`;
  // Force layout flush then start transition
  requestAnimationFrame(() => { progress.style.width = '100%'; requestAnimationFrame(() => { progress.style.width = '0%'; }); });

  // Close handling
  let timeoutId = null;
  const remove = () => {
    if (!el.parentNode) return;
    el.parentNode.removeChild(el);
    if (timeoutId) clearTimeout(timeoutId);
    cleanupDrag && cleanupDrag();
  };

  if (dismissible) {
    el.querySelector('.gh-notification__close').addEventListener('click', remove);
  }

  // Auto-dismiss
  timeoutId = setTimeout(remove, duration);

  // Draggable
  const cleanupDrag = makeDraggable(el);

  // Insert at top to keep latest first
  container.insertBefore(el, container.firstChild);

  return remove;
}

export function showError(message, opts = {}) {
  return showNotification(message, { type: 'error', ...opts });
}

export function showSuccess(message, opts = {}) {
  return showNotification(message, { type: 'success', ...opts });
}

export function showWarning(message, opts = {}) {
  return showNotification(message, { type: 'warning', ...opts });
}
