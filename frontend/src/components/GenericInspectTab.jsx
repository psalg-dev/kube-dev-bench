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
import TextViewerTab from '../layout/bottompanel/TextViewerTab.jsx';

/**
 * Generic inspect tab component for displaying JSON inspection data.
 * 
 * @param {Object} props - Component props
 * @param {string} props.id - Resource ID to fetch
 * @param {Function} props.fetchFn - Async function to fetch the JSON data (receives id)
 * @param {string} [props.loadingLabel='Loading...'] - Label shown while loading
 * @param {string} [props.filename] - Optional filename for download (defaults to id.json)
 * @returns {JSX.Element}
 */
export function GenericInspectTab({ 
  id, 
  fetchFn, 
  loadingLabel = 'Loading...', 
  filename 
}) {
  const { data: content, loading, error } = useAsyncData(
    () => fetchFn(id).then(json => String(json || '')),
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
