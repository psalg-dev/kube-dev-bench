import { GetSecretYAML } from '../../../../wailsjs/go/main/App';
import ResourceYamlTab from '../../../layout/bottompanel/ResourceYamlTab';

export default function SecretYamlTab({ namespace, name }) {
  const isReady = Boolean(namespace && name);
  return (
    <ResourceYamlTab
      name={name}
      isReady={isReady}
      loadYaml={() => GetSecretYAML(namespace, name)}
    />
  );
}
