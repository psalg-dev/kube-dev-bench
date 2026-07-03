import { useEffect, useState } from 'react';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOff, EventsOn } from '../../wailsjs/runtime/runtime';

type PortForwardInfoRaw = Record<string, any> & {
  namespace?: string;
  Namespace?: string;
  pod?: string;
  Pod?: string;
  local?: number;
  Local?: number;
  remote?: number;
  Remote?: number;
};

type PortForwardMap = Record<string, Record<number, number[]>>;

/**
 * Hook to track active port-forwards across the app.
 * Subscribes to portforwards:update events and maintains a map of
 * namespace/pod -> remotePort -> [localPorts]
 */
export function usePortForwardState() {
  const [pfByKey, setPfByKey] = useState<PortForwardMap>({});

  useEffect(() => {
    function buildMap(list: PortForwardInfoRaw[] | null | undefined): PortForwardMap {
      const map: PortForwardMap = {};
      if (Array.isArray(list)) {
        for (const item of list) {
          if (!item) continue;
          const ns = item.namespace || item.Namespace;
          const pod = item.pod || item.Pod;
          const local = (item.local ?? item.Local) as number | undefined;
          const remote = (item.remote ?? item.Remote) as number | undefined;
          if (!ns || !pod || !Number.isFinite(local) || !Number.isFinite(remote)) continue;
          const key = `${ns}/${pod}`;
          if (!map[key]) map[key] = {};
          if (!map[key][remote as number]) map[key][remote as number] = [];
          if (!map[key][remote as number].includes(local as number)) map[key][remote as number].push(local as number);
        }
      }
      return map;
    }

    const onUpdate = (list: PortForwardInfoRaw[] | null | undefined) => setPfByKey(buildMap(list));

    EventsOn('portforwards:update', onUpdate);

    // Fetch initial state
    (async () => {
      try {
        const list = await AppAPI.ListPortForwards();
        onUpdate(list as PortForwardInfoRaw[]);
      } catch {}
    })();

    return () => {
      try {
        EventsOff('portforwards:update');
      } catch {}
    };
  }, []);

  return pfByKey;
}
