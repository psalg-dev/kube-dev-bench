import { useEffect, useState } from 'react';
import { GetResourceYAML } from '../../../../wailsjs/go/main/App';
import YamlTab from '../../../layout/bottompanel/YamlTab';

type RoleYamlTabProps = { namespace?: string; name?: string };

export default function RoleYamlTab({ namespace = '', name = '' }: RoleYamlTabProps) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    if (!name) return;
    setLoading(true); setError(null);
    try { const res = await GetResourceYAML('role', namespace, name); setYaml(res || ''); }
    catch (e: unknown) { setError(String(e)); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [namespace, name]);
  return <YamlTab content={yaml} loading={loading} error={error} />;
}
