import { GetPersistentVolumeYAML } from '../../../../wailsjs/go/main/App';
import ResourceYamlTab from '../../../layout/bottompanel/ResourceYamlTab';

export default function PersistentVolumeYamlTab({ name }) {
  return (
    <ResourceYamlTab
      name={name}
      isReady={Boolean(name)}
      loadYaml={() => GetPersistentVolumeYAML(name)}
    />
  );
}
