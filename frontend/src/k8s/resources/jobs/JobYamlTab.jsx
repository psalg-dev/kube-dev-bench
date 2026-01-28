import { GetJobYAML } from '../../../../wailsjs/go/main/App';
import ResourceYamlTab from '../../../layout/bottompanel/ResourceYamlTab';

export default function JobYamlTab({ namespace, name }) {
  const isReady = Boolean(namespace && name);
  return (
    <ResourceYamlTab
      name={name}
      isReady={isReady}
      loadYaml={() => GetJobYAML(namespace, name)}
    />
  );
}
