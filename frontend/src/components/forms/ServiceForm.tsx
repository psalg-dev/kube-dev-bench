import TextField from './TextField';
import NumberField from './NumberField';
import SelectField from './SelectField';
import CollapsibleSection from './CollapsibleSection';
import KeyValueEditor from './KeyValueEditor';
import PortMappingEditor from './PortMappingEditor';
import type { SwarmServiceFormData, SwarmServiceFormErrors } from '../../hooks/useSwarmServiceForm';

type ServiceFormProps = {
  data: SwarmServiceFormData;
  onChange: (data: SwarmServiceFormData) => void;
  errors?: SwarmServiceFormErrors;
};

export default function ServiceForm({ data, onChange, errors }: ServiceFormProps) {
  const d = data;
  const e = errors || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TextField
        id="swarm-service-name"
        label="Name"
        value={d.name}
        onChange={(v) => onChange({ ...d, name: v })}
        required
        error={e.name}
        placeholder="my-service"
      />

      <TextField
        id="swarm-service-image"
        label="Image"
        value={d.image}
        onChange={(v) => onChange({ ...d, image: v })}
        required
        error={e.image}
        placeholder="nginx:latest"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        <SelectField
          id="swarm-service-mode"
          label="Mode"
          value={d.mode}
          onChange={(v) => onChange({ ...d, mode: v as SwarmServiceFormData['mode'] })}
          options={[
            { value: 'replicated', label: 'Replicated' },
            { value: 'global', label: 'Global' },
          ]}
        />

        {d.mode === 'replicated' ? (
          <NumberField
            id="swarm-service-replicas"
            label="Replicas"
            value={d.replicas}
            onChange={(v) => onChange({ ...d, replicas: v })}
            min={0}
            max={100}
            error={e.replicas}
          />
        ) : (
          <div />
        )}
      </div>

      <CollapsibleSection id="swarm-port-mappings-section" title="Port Mappings" count={d.ports?.length || 0}>
        <PortMappingEditor ports={d.ports} onChange={(ports) => onChange({ ...d, ports })} />
        {e.ports ? (
          <div style={{ marginTop: 8, fontSize: 12, color: '#f14c4c' }} role="alert">
            {e.ports}
          </div>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection id="swarm-env-vars-section" title="Environment Variables" count={d.env?.length || 0}>
        <KeyValueEditor
          title="Environment Variables"
          rows={d.env}
          onChange={(env) => onChange({ ...d, env })}
          keyPlaceholder="VARIABLE_NAME"
          valuePlaceholder="value"
          addButtonLabel="Add env var"
          addButtonId="add-env-var-btn"
          ariaPrefix="Env"
        />
      </CollapsibleSection>

      <CollapsibleSection id="swarm-labels-section" title="Labels" count={d.labels?.length || 0}>
        <KeyValueEditor
          title="Labels"
          rows={d.labels}
          onChange={(labels) => onChange({ ...d, labels })}
          keyPlaceholder="com.example.key"
          valuePlaceholder="value"
          addButtonLabel="Add label"
          addButtonId="add-label-btn"
          ariaPrefix="Label"
        />
      </CollapsibleSection>
    </div>
  );
}
