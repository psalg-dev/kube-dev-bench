import { useEffect, useState } from 'react';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';

type PortForwardInfoRaw = {
  namespace?: string;
  Namespace?: string;
  pod?: string;
  Pod?: string;
  local?: number;
  Local?: number;
  remote?: number;
  Remote?: number;
};

// ns/pod -> remotePort -> [localPorts]
export type PortForwardMap = Record<string, Record<number, number[]>>;

function buildMap(list: PortForwardInfoRaw[] | null | undefined): PortForwardMap {
  const map: PortForwardMap = {};
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!item) continue;
      const ns = item.namespace || item.Namespace;
      const pod = item.pod || item.Pod;
      const local = item.local ?? item.Local;
      const remote = item.remote ?? item.Remote;
      if (!ns || !pod || !Number.isFinite(local) || !Number.isFinite(remote)) continue;
      const key = `${ns}/${pod}`;
      const l = local as number;
      const r = remote as number;
      if (!map[key]) map[key] = {};
      if (!map[key][r]) map[key][r] = [];
      if (!map[key][r].includes(l)) map[key][r].push(l);
    }
  }
  return map;
}

/**
 * Hook to track active port-forwards across the app.
 * Subscribes to portforwards:update events and maintains a map of
 * namespace/pod -> remotePort -> [localPorts]
 */
export function usePortForwardState(): PortForwardMap {
  const [pfByKey, setPfByKey] = useState<PortForwardMap>({});

  useEffect(() => {
    const onUpdate = (list: PortForwardInfoRaw[] | null | undefined) => setPfByKey(buildMap(list));

    // EventsOn returns a per-listener unsubscribe; use THAT, never EventsOff(name)
    // (EventsOff removes every listener for the event).
    const unsub = EventsOn('portforwards:update', onUpdate);

    // Fetch initial state
    (async () => {
      try {
        const list = await AppAPI.ListPortForwards();
        onUpdate(list as PortForwardInfoRaw[]);
      } catch {}
    })();

    return () => {
      try { unsub?.(); } catch {}
    };
  }, []);

  return pfByKey;
}
