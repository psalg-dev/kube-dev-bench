import React, { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import YamlTab from '../../../layout/bottompanel/YamlTab';

export default function HelmValuesTab({ namespace, releaseName }) {
  const [values, setValues] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    AppAPI.GetHelmReleaseValues(namespace, releaseName, showAll)
      .then((data) => {
        setValues(data || '# No values configured');
      })
      .catch((err) => {
        setValues(`# Error loading values: ${err.message || err}`);
      })
      .finally(() => setLoading(false));
  }, [namespace, releaseName, showAll]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading values...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Show all values (including defaults)
        </label>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <YamlTab content={values} />
      </div>
    </div>
  );
}
