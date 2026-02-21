import type { CSSProperties } from 'react';

type HealthStatus = 'healthy' | 'unhealthy' | 'starting' | 'none';

interface HealthStatusBadgeProps {
  status?: string | null;
  lastCheckAt?: string | null;
}

function normalize(status?: string | null): HealthStatus {
  const s = String(status || '').toLowerCase();
  if (s === 'healthy') return 'healthy';
  if (s === 'unhealthy') return 'unhealthy';
  if (s === 'starting') return 'starting';
  return 'none';
}

function stylesFor(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return {
        fg: 'var(--gh-success-fg, #2ea44f)',
        bg: 'rgba(46, 164, 79, 0.10)',
        bd: 'var(--gh-border, #30363d)',
      };
    case 'starting':
      return {
        fg: 'var(--gh-attention-fg, #d29922)',
        bg: 'rgba(210, 153, 34, 0.12)',
        bd: 'var(--gh-border, #30363d)',
      };
    case 'unhealthy':
      return {
        fg: 'var(--gh-danger-fg, #d73a49)',
        bg: 'rgba(248, 81, 73, 0.12)',
        bd: 'var(--gh-border, #30363d)',
      };
    default:
      return {
        fg: 'var(--gh-text-secondary, #8b949e)',
        bg: 'rgba(110, 118, 129, 0.12)',
        bd: 'var(--gh-border, #30363d)',
      };
  }
}

export default function HealthStatusBadge({ status, lastCheckAt = null }: HealthStatusBadgeProps) {
  const s = normalize(status);
  const c = stylesFor(s);
  const label = s === 'none' ? 'none' : s;
  const title = lastCheckAt ? `Last check: ${lastCheckAt}` : `Health: ${label}`;

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    border: `1px solid ${c.bd}`,
    background: c.bg,
    color: c.fg,
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    borderRadius: 0,
    whiteSpace: 'nowrap',
  };

  return (
    <span title={title} style={badgeStyle}>
      <span style={{ fontSize: 10, lineHeight: 1 }}>
        {s === 'healthy' ? '✓' : s === 'unhealthy' ? '!' : s === 'starting' ? '…' : '—'}
      </span>
      {label}
    </span>
  );
}