import { useEffect, useState } from 'react';

interface UptimeCellProps {
  startTime: number | string | Date;
}

export function UptimeCell({ startTime }: UptimeCellProps) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const start = new Date(startTime).getTime();

    // ponytail: update immediately, then every 1s
    const tick = () => {
      const now = Date.now();
      const diff = now - start;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        setElapsed(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setElapsed(`${hours}h ${minutes % 60}m`);
      } else if (minutes > 0) {
        setElapsed(`${minutes}m ${seconds % 60}s`);
      } else {
        setElapsed(`${seconds}s`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return <span>{elapsed || '-'}</span>;
}
