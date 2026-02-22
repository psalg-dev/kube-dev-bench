import { useEffect, useState } from 'react';
import { GetResourceYAML } from '../../../../wailsjs/go/main/App';
import YamlTab from '../../../layout/bottompanel/YamlTab';

type HPAYamlTabProps = {
  namespace: string;
  name: string;
};

export default function HPAYamlTab({ namespace, name }: HPAYamlTabProps) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!namespace || !name) {
        setYaml('');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await GetResourceYAML('horizontalpodautoscaler', namespace, name);
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
  }, [namespace, name]);

  return <YamlTab content={yaml} loading={loading} error={error} />;
}
