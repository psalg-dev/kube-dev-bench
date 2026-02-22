import { useEffect, useState } from 'react';
import { GetNodeYAML } from '../../../../wailsjs/go/main/App';
import YamlTab from '../../../layout/bottompanel/YamlTab';

type NodeYamlTabProps = {
  name: string;
};

export default function NodeYamlTab({ name }: NodeYamlTabProps) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!name) {
        setYaml('');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await GetNodeYAML(name);
        if (mounted) setYaml(result || '');
      } catch (err) {
        if (mounted) setError(String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [name]);

  return <YamlTab content={yaml} loading={loading} error={error} />;
}
