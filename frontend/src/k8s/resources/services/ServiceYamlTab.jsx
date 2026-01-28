import { GetServiceYAML } from '../../../../wailsjs/go/main/App';
import ResourceYamlTab from '../../../layout/bottompanel/ResourceYamlTab';

export default function ServiceYamlTab({ namespace, name }) {
  const isReady = Boolean(namespace && name);
  return (
    <ResourceYamlTab
      name={name}
      isReady={isReady}
      loadYaml={() => GetServiceYAML(namespace, name)}
    />
  );
}
