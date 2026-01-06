# Docker Swarm Resource Creation Overlay - Form-Based Refactoring Plan

## Executive Summary

This document outlines a comprehensive plan to refactor the Docker Swarm resource creation overlay from a primarily YAML-based approach to a form-based UI that maximizes usability. The refactoring focuses on providing intuitive form fields for the most commonly used resource options while maintaining the ability to toggle to raw YAML for advanced users.

## Current State Analysis

### Existing Implementation
Location: [CreateManifestOverlay.jsx](frontend/src/CreateManifestOverlay.jsx)

**What Works:**
- Config/Secret: Name + labels + text editor (functional)
- Network: Full form-based creation (driver, scope, attachable, internal, subnet, gateway)
- Volume: Form-based creation (driver, driver options, labels)

**What's Missing:**
- **Service creation**: Shows YAML template but NOT wired to `CreateSwarmService` backend RPC
- **Stack creation**: Shows YAML template but NOT wired to `CreateSwarmStack` backend RPC
- **Form/YAML toggle**: No ability to switch between form and raw manifest view
- **Advanced service options**: Mounts, constraints, resource limits, update/rollback config

### Backend RPCs Available (via Wails)

```typescript
// Service - CreateServiceOptions struct
CreateSwarmService(opts: {
  name: string;           // required
  image: string;          // required
  mode: string;           // "replicated" | "global"
  replicas: number;       // only for replicated mode
  labels: Record<string, string>;
  env: Record<string, string>;
  ports: Array<{
    protocol: "tcp" | "udp";
    targetPort: number;
    publishedPort: number;
    publishMode: "ingress" | "host";
  }>;
}) => string;

// Stack - Compose YAML based
CreateSwarmStack(stackName: string, composeYAML: string) => string;

// Network - Already has form support
CreateSwarmNetwork(name: string, driver: string, opts: CreateNetworkOptions) => string;

// Volume - Already has form support
CreateSwarmVolume(name: string, driver: string, labels: object, driverOpts: object) => SwarmVolumeInfo;

// Config/Secret - Already functional
CreateSwarmConfig(name: string, data: string, labels: object) => string;
CreateSwarmSecret(name: string, data: string, labels: object) => string;
```

---

## Design Principles

1. **Usability First**: Most common fields should be immediately visible and easy to fill
2. **Progressive Disclosure**: Advanced options in collapsible sections
3. **Flexibility**: Toggle between form and raw YAML for power users
4. **Validation**: Real-time validation with helpful error messages
5. **Consistency**: Uniform look and feel across all resource types

---

## Resource Type Field Prioritization

### Service (Highest Complexity)

**Primary Fields (Always Visible):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | text | Yes | Service name (DNS-compatible) |
| Image | text | Yes | Docker image with optional tag |
| Mode | dropdown | No | "replicated" (default) or "global" |
| Replicas | number | No | Number of replicas (only for replicated) |

**Secondary Fields (Expandable Section - "Port Mappings"):**
| Field | Type | Description |
|-------|------|-------------|
| Ports | repeater | Protocol, target port, published port, publish mode |

**Tertiary Fields (Expandable Section - "Environment & Labels"):**
| Field | Type | Description |
|-------|------|-------------|
| Environment Variables | key-value editor | KEY=value pairs |
| Labels | key-value editor | Metadata labels |

**Advanced Fields (Future - Expandable Section):**
- Resource limits (CPU, memory)
- Placement constraints
- Update configuration
- Rollback configuration
- Health checks
- Mounts/volumes
- Networks

### Stack

**Primary Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Stack Name | text | Yes | Stack identifier |
| Compose Content | code editor | Yes | Docker Compose YAML |

**Note:** Stacks are inherently YAML-based (docker-compose format), so the form view provides the name field while the compose content remains a YAML editor with syntax highlighting.

---

## Additional Overlay Refactorings (Stacks + Tasks)

This section documents the planned/implemented UX changes for Swarm Stacks and Swarm Tasks overlays, using the Swarm Service overlay as the baseline.

### Tasks: Create Button Behavior (Indirect Creation)

**Rationale:** Docker Swarm tasks are not created directly by users; they are scheduled as a consequence of creating/updating a Swarm service.

**UX decision:**
- The **+** button in the **Tasks** view opens the **Swarm Service** creation overlay.
- The service create overlay shows an **inline hint** explaining the consequence: creating a service will create tasks.

**Acceptance criteria:**
- Clicking **+** in Tasks opens the Service create overlay.
- The service create overlay shows the inline hint text.
- No "Create is not implemented for Swarm task" error is reachable from the Tasks + flow.

### Stacks: Overlay UX Parity

**Rationale:** Stacks are deployed from Compose YAML. A full form builder is out of scope; we should keep the Compose editor but make the overall overlay feel as polished and consistent as the Service overlay.

**UX decision:**
- The **+** button in the **Stacks** view opens the **Swarm Stack** creation overlay.
- The create overlay shows an **inline hint** explaining the consequence: deploying a stack will create services (and their tasks).
- The overlay includes a required **Stack Name** field and a required **Compose YAML editor**.

**Acceptance criteria:**
- Clicking **+** in Stacks opens the Stack create overlay.
- The stack create overlay shows the inline hint text.
- Submitting without a name shows "Name is required".
- Submitting with empty compose shows "Compose YAML is empty".
- Successful create calls `CreateSwarmStack(name, composeYAML)` and emits `swarm:stacks:update`.

### Config

**Primary Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | text | Yes | Config name |
| Data | text area/editor | Yes | Configuration content |
| Labels | key-value editor | No | Metadata labels |

### Secret

**Primary Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | text | Yes | Secret name |
| Data | text area/editor | Yes | Secret value (handled securely) |
| Labels | key-value editor | No | Metadata labels |

### Network (Already Implemented - Minor Enhancements)

**Primary Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | text | Yes | Network name |
| Driver | dropdown | No | overlay (default), bridge, macvlan, host |
| Scope | dropdown | No | swarm (default), local |
| Attachable | checkbox | No | Allow manual container attachment |
| Internal | checkbox | No | Restrict external access |

**Secondary Fields:**
| Field | Type | Description |
|-------|------|-------------|
| Subnet | text | CIDR notation (e.g., 10.0.0.0/24) |
| Gateway | text | Gateway IP address |
| Labels | key-value editor | Metadata labels |

### Volume (Already Implemented - Minor Enhancements)

**Primary Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | text | Yes | Volume name |
| Driver | dropdown | No | local (default), nfs, or custom |

**Secondary Fields:**
| Field | Type | Description |
|-------|------|-------------|
| Driver Options | key-value editor | Driver-specific options |
| Labels | key-value editor | Metadata labels |

---

## UI/UX Design

### Overlay Layout

```
+----------------------------------------------------------+
|  New Swarm Service                              [×]       |
+----------------------------------------------------------+
|  [Form] [YAML]                    ← View mode toggle      |
+----------------------------------------------------------+
|                                                           |
|  Form View:                                               |
|  ┌─────────────────────────────────────────────────────┐ |
|  │ Name *         [my-nginx___________________]        │ |
|  │ Image *        [nginx:latest_______________]        │ |
|  │                                                     │ |
|  │ Mode           [Replicated ▼]                       │ |
|  │ Replicas       [3  ]                                │ |
|  └─────────────────────────────────────────────────────┘ |
|                                                           |
|  ▶ Port Mappings (0)                    ← Collapsible    |
|  ▶ Environment Variables (0)            ← Collapsible    |
|  ▶ Labels (0)                           ← Collapsible    |
|                                                           |
|  -OR- YAML View:                                          |
|  ┌─────────────────────────────────────────────────────┐ |
|  │ name: my-nginx                                      │ |
|  │ image: nginx:latest                                 │ |
|  │ mode: replicated                                    │ |
|  │ replicas: 3                                         │ |
|  │ ...                                                 │ |
|  └─────────────────────────────────────────────────────┘ |
|                                                           |
+----------------------------------------------------------+
|  Target: Docker Swarm                     [Create]        |
+----------------------------------------------------------+
```

### View Toggle Behavior

1. **Form → YAML**: Convert current form state to YAML representation
2. **YAML → Form**: Parse YAML and populate form fields (with validation)
3. **Sync indicator**: Show when form and YAML are in sync or have unsaved changes

### Collapsible Sections

Use consistent expand/collapse pattern:
- `▶ Section Name (count)` - collapsed
- `▼ Section Name (count)` - expanded
- Count shows number of items configured

---

## Implementation Plan

### Phase 1: Core Infrastructure (Foundation)

#### 1.1 Create Reusable Form Components

**File:** `frontend/src/components/forms/` (new directory)

| Component | Purpose |
|-----------|---------|
| `FormField.jsx` | Wrapper for label + input + validation error |
| `TextField.jsx` | Text input with validation |
| `NumberField.jsx` | Numeric input with min/max |
| `SelectField.jsx` | Dropdown select |
| `CheckboxField.jsx` | Boolean checkbox |
| `KeyValueEditor.jsx` | Extract existing component, add features |
| `PortMappingEditor.jsx` | Specialized repeater for ports |
| `CollapsibleSection.jsx` | Expandable section with header |
| `ViewToggle.jsx` | Form/YAML toggle button group |

#### 1.2 State Management Pattern

```javascript
// New hook: useSwarmResourceForm
const useSwarmResourceForm = (resourceType, initialData) => {
  const [formData, setFormData] = useState(initialData);
  const [viewMode, setViewMode] = useState('form'); // 'form' | 'yaml'
  const [yamlContent, setYamlContent] = useState('');
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Convert form to YAML
  const formToYaml = () => { /* ... */ };

  // Parse YAML to form (with validation)
  const yamlToForm = () => { /* ... */ };

  // Validate form data
  const validate = () => { /* ... */ };

  return { formData, setFormData, viewMode, setViewMode, ... };
};
```

#### 1.3 YAML Conversion Utilities

**File:** `frontend/src/utils/swarmYamlUtils.js`

```javascript
// Service form ↔ YAML conversion
export function serviceFormToYaml(formData) { /* ... */ }
export function yamlToServiceForm(yaml) { /* ... */ }

// Stack form ↔ YAML (mostly pass-through with name extraction)
export function stackFormToYaml(formData) { /* ... */ }
export function yamlToStackForm(yaml) { /* ... */ }

// Generic validation
export function validateSwarmResource(type, formData) { /* ... */ }
```

### Phase 2: Service Creation Form (Priority #1)

#### 2.1 Service Form State Structure

```javascript
const serviceFormDefaults = {
  name: '',
  image: '',
  mode: 'replicated',
  replicas: 1,
  ports: [],
  env: [],      // [{ key: '', value: '' }]
  labels: [],   // [{ key: '', value: '' }]
};
```

#### 2.2 Wire Service Creation to Backend

**Current:** Shows YAML template, no backend call
**Target:** Call `AppAPI.CreateSwarmService(opts)` with form data

```javascript
// In handleCreate for kind === 'service':
if (k === 'service') {
  const opts = {
    name: formData.name.trim(),
    image: formData.image.trim(),
    mode: formData.mode,
    replicas: formData.mode === 'replicated' ? parseInt(formData.replicas, 10) : 0,
    labels: keyValueArrayToObject(formData.labels),
    env: keyValueArrayToObject(formData.env),
    ports: formData.ports.map(p => ({
      protocol: p.protocol || 'tcp',
      targetPort: parseInt(p.targetPort, 10),
      publishedPort: parseInt(p.publishedPort, 10),
      publishMode: p.publishMode || 'ingress',
    })),
  };

  await AppAPI.CreateSwarmService(opts);
  showSuccess(`Swarm service "${opts.name}" was created successfully!`);
  EventsEmit('swarm:services:update', null);
  onClose?.();
  return;
}
```

#### 2.3 Service Form Component

**File:** `frontend/src/components/forms/ServiceForm.jsx`

```jsx
export default function ServiceForm({ data, onChange, errors }) {
  return (
    <>
      <TextField
        label="Name"
        value={data.name}
        onChange={(v) => onChange({ ...data, name: v })}
        error={errors.name}
        required
        placeholder="my-service"
      />
      <TextField
        label="Image"
        value={data.image}
        onChange={(v) => onChange({ ...data, image: v })}
        error={errors.image}
        required
        placeholder="nginx:latest"
      />
      <SelectField
        label="Mode"
        value={data.mode}
        onChange={(v) => onChange({ ...data, mode: v })}
        options={[
          { value: 'replicated', label: 'Replicated' },
          { value: 'global', label: 'Global' },
        ]}
      />
      {data.mode === 'replicated' && (
        <NumberField
          label="Replicas"
          value={data.replicas}
          onChange={(v) => onChange({ ...data, replicas: v })}
          min={0}
          max={100}
        />
      )}

      <CollapsibleSection title="Port Mappings" count={data.ports.length}>
        <PortMappingEditor
          ports={data.ports}
          onChange={(ports) => onChange({ ...data, ports })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Environment Variables" count={data.env.length}>
        <KeyValueEditor
          rows={data.env}
          onChange={(env) => onChange({ ...data, env })}
          keyPlaceholder="VARIABLE_NAME"
          valuePlaceholder="value"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Labels" count={data.labels.length}>
        <KeyValueEditor
          rows={data.labels}
          onChange={(labels) => onChange({ ...data, labels })}
          keyPlaceholder="com.example.key"
          valuePlaceholder="value"
        />
      </CollapsibleSection>
    </>
  );
}
```

### Phase 3: Stack Creation Form (Priority #2)

#### 3.1 Stack Form State

```javascript
const stackFormDefaults = {
  name: '',
  composeYaml: getDefaultComposeTemplate(),
};
```

#### 3.2 Wire Stack Creation to Backend

```javascript
if (k === 'stack') {
  const stackName = formData.name.trim();
  const composeYaml = viewMode === 'form' ? formData.composeYaml : yamlContent;

  if (!stackName) {
    setError('Stack name is required.');
    return;
  }
  if (!composeYaml.trim()) {
    setError('Compose YAML is required.');
    return;
  }

  await AppAPI.CreateSwarmStack(stackName, composeYaml);
  showSuccess(`Swarm stack "${stackName}" was deployed successfully!`);
  EventsEmit('swarm:stacks:update', null);
  onClose?.();
  return;
}
```

### Phase 4: View Toggle Implementation

#### 4.1 Toggle Component

```jsx
function ViewToggle({ mode, onChange }) {
  return (
    <div className="view-toggle">
      <button
        className={mode === 'form' ? 'active' : ''}
        onClick={() => onChange('form')}
        aria-pressed={mode === 'form'}
      >
        Form
      </button>
      <button
        className={mode === 'yaml' ? 'active' : ''}
        onClick={() => onChange('yaml')}
        aria-pressed={mode === 'yaml'}
      >
        YAML
      </button>
    </div>
  );
}
```

#### 4.2 View Switching Logic

```javascript
const handleViewChange = (newMode) => {
  if (newMode === viewMode) return;

  if (newMode === 'yaml') {
    // Convert form data to YAML
    const yaml = formToYaml(resourceType, formData);
    setYamlContent(yaml);
  } else {
    // Parse YAML back to form (with validation)
    const result = yamlToForm(resourceType, yamlContent);
    if (result.errors.length > 0) {
      // Show warning but allow switch
      setParseWarnings(result.errors);
    }
    setFormData(result.data);
  }

  setViewMode(newMode);
};
```

### Phase 5: Enhance Existing Forms

#### 5.1 Config/Secret Enhancements
- Add file upload option for data content
- Add "from template" dropdown for common formats
- Improve text editor with line numbers

#### 5.2 Network Enhancements
- Add IPAM pool configuration
- Add driver options for advanced drivers
- Group advanced options in collapsible section

#### 5.3 Volume Enhancements
- Add common driver preset options (NFS path, device)
- Add scope display

### Phase 6: Testing

#### 6.1 Unit Tests

**File:** `frontend/src/__tests__/swarmResourceForms.test.jsx`

```javascript
describe('ServiceForm', () => {
  it('renders all primary fields', () => {});
  it('shows replicas field only in replicated mode', () => {});
  it('validates required fields', () => {});
  it('converts form data to CreateServiceOptions correctly', () => {});
});

describe('ViewToggle', () => {
  it('converts form to YAML correctly', () => {});
  it('parses YAML to form correctly', () => {});
  it('shows warning on YAML parse errors', () => {});
});
```

#### 6.2 E2E Tests

**File:** `e2e/tests/swarm/60-create-service.spec.ts`

```typescript
test('create service via form', async ({ page }) => {
  // Open overlay
  // Fill form fields
  // Click create
  // Verify service appears in list
});

test('create service via YAML toggle', async ({ page }) => {
  // Open overlay
  // Switch to YAML mode
  // Edit YAML
  // Click create
  // Verify service
});
```

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `frontend/src/components/forms/FormField.jsx` | Base form field wrapper |
| `frontend/src/components/forms/TextField.jsx` | Text input component |
| `frontend/src/components/forms/NumberField.jsx` | Number input component |
| `frontend/src/components/forms/SelectField.jsx` | Dropdown component |
| `frontend/src/components/forms/CheckboxField.jsx` | Checkbox component |
| `frontend/src/components/forms/PortMappingEditor.jsx` | Port mapping repeater |
| `frontend/src/components/forms/CollapsibleSection.jsx` | Expandable section |
| `frontend/src/components/forms/ViewToggle.jsx` | Form/YAML toggle |
| `frontend/src/components/forms/ServiceForm.jsx` | Service creation form |
| `frontend/src/components/forms/StackForm.jsx` | Stack creation form |
| `frontend/src/hooks/useSwarmResourceForm.js` | Form state management hook |
| `frontend/src/utils/swarmYamlUtils.js` | YAML conversion utilities |
| `frontend/src/__tests__/swarmResourceForms.test.jsx` | Unit tests |
| `e2e/tests/swarm/60-create-service.spec.ts` | E2E tests |

### Modified Files
| File | Changes |
|------|---------|
| `frontend/src/CreateManifestOverlay.jsx` | Integrate view toggle, service/stack forms, wire to backend |
| `frontend/src/__tests__/createManifestOverlay.test.jsx` | Add tests for new functionality |

---

## Stable DOM Selectors (for E2E tests)

```javascript
// View toggle
#swarm-view-toggle
#swarm-view-form-btn
#swarm-view-yaml-btn

// Service form
#swarm-service-name
#swarm-service-image
#swarm-service-mode
#swarm-service-replicas
#swarm-port-mappings-section
#swarm-env-vars-section
#swarm-labels-section
#add-port-mapping-btn
#add-env-var-btn
#add-label-btn

// Stack form
#swarm-stack-name
#swarm-compose-editor

// Common
#swarm-create-btn
#swarm-create-overlay
```

---

## Validation Rules

### Service
| Field | Rules |
|-------|-------|
| Name | Required, DNS-compatible (lowercase, alphanumeric, hyphens) |
| Image | Required, valid Docker image reference |
| Replicas | Integer >= 0, only when mode = "replicated" |
| Ports | Target port required, valid port range (1-65535) |

### Stack
| Field | Rules |
|-------|-------|
| Name | Required, alphanumeric with hyphens/underscores |
| Compose YAML | Required, valid YAML, must have `services` key |

### Network
| Field | Rules |
|-------|-------|
| Name | Required, DNS-compatible |
| Subnet | Valid CIDR notation if provided |
| Gateway | Valid IP address if provided, must be within subnet |

### Volume
| Field | Rules |
|-------|-------|
| Name | Required, alphanumeric with underscores |

---

## Implementation Order

1. **Phase 1.1**: Create reusable form components (2-3 components at a time)
2. **Phase 1.2**: Implement `useSwarmResourceForm` hook
3. **Phase 2**: Service form + backend wiring + unit tests
4. **Phase 4**: View toggle implementation
5. **Phase 3**: Stack form + backend wiring + unit tests
6. **Phase 5**: Enhance existing forms (config, secret, network, volume)
7. **Phase 6**: E2E tests

---

## Success Metrics

1. **Usability**: Users can create services without knowing YAML syntax
2. **Flexibility**: Power users can switch to YAML for advanced configuration
3. **Reliability**: All form submissions correctly call backend APIs
4. **Test Coverage**: >= 70% unit test coverage for new code
5. **E2E Coverage**: Happy path tests for each resource type

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| YAML parsing errors | User frustration | Show clear error messages, highlight problematic lines |
| Form/YAML sync complexity | Data loss | Warn before switching with unsaved changes |
| Backend API mismatch | Failed creation | Validate against backend types, add TypeScript types |
| Breaking existing functionality | Regression | Comprehensive test coverage before changes |

---

## Appendix: Default Templates

### Service YAML Template
```yaml
name: my-service
image: nginx:latest
mode: replicated
replicas: 1
ports:
  - targetPort: 80
    publishedPort: 8080
    protocol: tcp
    publishMode: ingress
env: {}
labels: {}
```

### Stack Compose Template
```yaml
version: "3.8"
services:
  web:
    image: nginx:latest
    deploy:
      replicas: 1
    ports:
      - "8080:80"
```
