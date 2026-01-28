import { GetPodYAML } from '../../../../wailsjs/go/main/App';
import ResourceYamlTab from '../../../layout/bottompanel/ResourceYamlTab';

export default function PodYamlTab({ podName }) {
  return (
    <ResourceYamlTab
      name={podName}
      isReady={Boolean(podName)}
      loadYaml={() => GetPodYAML(podName)}
    />
  );
}
