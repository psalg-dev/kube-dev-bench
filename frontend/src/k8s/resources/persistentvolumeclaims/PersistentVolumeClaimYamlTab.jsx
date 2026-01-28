import { GetPersistentVolumeClaimYAML } from '../../../../wailsjs/go/main/App';
import ResourceYamlTab from '../../../layout/bottompanel/ResourceYamlTab';

export default function PersistentVolumeClaimYamlTab({ namespace, name }) {
  const isReady = Boolean(namespace && name);
  return (
    <ResourceYamlTab
      name={name}
      isReady={isReady}
      loadYaml={() => GetPersistentVolumeClaimYAML(namespace, name)}
    />
  );
}
