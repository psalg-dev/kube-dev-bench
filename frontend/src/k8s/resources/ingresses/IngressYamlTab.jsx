import { GetIngressYAML } from '../../../../wailsjs/go/main/App';
import ResourceYamlTab from '../../../layout/bottompanel/ResourceYamlTab';

export default function IngressYamlTab({ namespace, name }) {
  const isReady = Boolean(namespace && name);
  return (
    <ResourceYamlTab
      name={name}
      isReady={isReady}
      loadYaml={() => GetIngressYAML(namespace, name)}
    />
  );
}
