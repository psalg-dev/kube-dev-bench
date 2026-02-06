/**
 * Generic inspect tab for displaying JSON data from any resource.
 * Consolidates 4 nearly identical InspectTab components:
 * - ConfigInspectTab.jsx
 * - SecretInspectTab.jsx
 * - NetworkInspectTab.jsx
 * - VolumeInspectTab.jsx
 *
 * Each follows the same pattern: fetch JSON, display in TextViewerTab.
 *
 * @example
 * import { GenericInspectTab } from '@/components/GenericInspectTab';
 * import { GetSwarmConfigInspectJSON } from '@/wailsjs/go/main/App';
 *
 * export function ConfigInspectTab({ id }) {
 *   return (
 *     <GenericInspectTab
 *       id={id}
 *       fetchFn={GetSwarmConfigInspectJSON}
 *       loadingLabel="Loading config..."
 *     />
 *   );
 * }
 */

import { useAsyncData } from '../hooks/useAsyncData';
import TextViewerTab from '../layout/bottompanel/TextViewerTab';

type GenericInspectTabProps = {
  id: string;
  fetchFn: (id: string) => Promise<unknown> | unknown;
  loadingLabel?: string;
  filename?: string;
};

/**
 * Generic inspect tab component for displaying JSON inspection data.
 */
export function GenericInspectTab({
  id,
  fetchFn,
  loadingLabel = 'Loading...',
  filename,
}: GenericInspectTabProps) {
  const { data: content, loading, error } = useAsyncData(
    () => Promise.resolve(fetchFn(id)).then((json) => String(json || '')),
    [id]
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TextViewerTab
        content={content || ''}
        loading={loading}
        error={error}
        loadingLabel={loadingLabel}
        filename={filename || `${id}.json`}
      />
    </div>
  );
}

export default GenericInspectTab;
