# Docker Swarm Bottom Panel Improvements

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06

This document analyzes the current state of Docker Swarm resource bottom panels and provides suggestions for improvements.

## Current Status (Verified 2026-02-06)

- The improvements described in this document are implemented in Swarm resource views under [frontend/src/docker/resources](frontend/src/docker/resources).
- Advanced tabs and actions (configs/secrets/volumes/stack resources/placements) are present in [frontend/src/docker/resources/services/SwarmServicesOverviewTable.tsx](frontend/src/docker/resources/services/SwarmServicesOverviewTable.tsx) and related tables.
- E2E coverage for the improvements exists in [e2e/tests/swarm/71-volumes-files.spec.ts](e2e/tests/swarm/71-volumes-files.spec.ts), [e2e/tests/swarm/72-configs.spec.ts](e2e/tests/swarm/72-configs.spec.ts), [e2e/tests/swarm/73-secrets.spec.ts](e2e/tests/swarm/73-secrets.spec.ts), [e2e/tests/swarm/74-networks-volumes-usage.spec.ts](e2e/tests/swarm/74-networks-volumes-usage.spec.ts), and [e2e/tests/swarm/75-nodes-services-stacks.spec.ts](e2e/tests/swarm/75-nodes-services-stacks.spec.ts).

## Current State Analysis

### Summary by Resource Type

| Resource | Tabs Available | Summary Tab Content | Actions | Status |
|----------|---------------|---------------------|---------|--------|
| Services | Summary, Tasks, Logs | Rich - Quick info + Service logs | Scale, Restart, Delete | Well implemented |
| Tasks | Summary, Logs | Good - All task metadata | None (read-only) | Good |
| Nodes | Summary, Tasks | Good - Node info + task list | Drain, Activate, Delete | Well implemented |
| Networks | Summary only | Basic - 7 fields | Delete | **SPARSE** |
| Configs | Summary, Data | Moderate - Metadata + data view | Delete | Needs edit |
| Secrets | Summary only | Basic - 4 fields | Delete | **SPARSE** |
| Stacks | Summary, Services | Moderate - Count + services list | Delete | Moderate |
| Volumes | Summary only | Basic - 5 fields | Delete | **SPARSE** |

---

## Detailed Analysis & Improvement Suggestions

### 1. Services (Good - Minor Improvements)

**Current State:**
- Summary tab shows quick info (mode, replicas, image, ID) + logs preview
- Tasks tab shows service tasks in table
- Logs tab shows full service logs
- Actions: Scale, Restart, Delete

**Suggestions:**
- [ ] Add "Environment Variables" section in Summary or dedicated tab
- [ ] Add "Ports" section showing published ports mapping
- [ ] Add "Mounts" section showing volume/bind mounts
- [ ] Add "Update Config" to show update parallelism, delay, failure action
- [ ] Add "Resources" section showing CPU/memory limits and reservations
- [ ] Add "Placement" tab showing constraints and preferences
- [ ] Add "Update Service" action to modify image tag

---

### 2. Tasks (Good - Minor Improvements)

**Current State:**
- Summary shows all task metadata (ID, service, node, state, container, error, timestamps)
- Logs tab shows container logs (if container exists)
- No actions (read-only - correct behavior)

**Suggestions:**
- [ ] Add "Events" section showing task state history/timeline
- [ ] Show logs preview in Summary tab (right panel) like Services do
- [ ] Add "Container Details" section (if container exists) with ports, mounts
- [ ] Add network information (IPs, networks attached)

---

### 3. Nodes (Good - Minor Improvements)

**Current State:**
- Summary shows node metadata (ID, hostname, role, availability, address, version)
- Tasks tab shows all tasks on node
- Actions: Drain, Activate, Delete

**Suggestions:**
- [ ] Add "Resources" section showing CPU/memory capacity and usage
- [ ] Add "Labels" tab to view and edit node labels
- [ ] Add "Logs" tab (daemon logs if accessible)
- [ ] Show platform info (OS, Architecture) in Summary
- [ ] Add TLS info section for manager nodes
- [ ] Add "Promote" / "Demote" actions for worker/manager role changes

---

### 4. Networks (**SPARSE - Needs Significant Improvement**)

**Current State:**
- Only Summary tab with 7 basic fields (ID, name, driver, scope, attachable, internal, created)
- Only Delete action

**Suggestions:**
- [ ] Add "Connected Services" tab showing services attached to network
- [ ] Add "IPAM" section showing:
  - Subnet
  - Gateway
  - IP Range
  - Auxiliary addresses
- [ ] Add "Options" section showing driver options
- [ ] Add "Containers" tab showing containers connected to network
- [ ] Add labels display in Quick Info
- [ ] Add "Inspect" tab showing raw JSON for advanced users

---

### 5. Configs (**Needs Edit Functionality**)

**Current State:**
- Summary shows basic metadata (ID, name, size, timestamps)
- Data tab shows config content in read-only pre block
- Only Delete action

**Required Improvements (per user request):**
- [ ] **Add "Edit" action to modify config data from Summary view**
  - Note: Docker configs are immutable - editing requires create new + delete old
  - UI should handle this transparently (create new version, update services, delete old)
  - Warn user about service restart implications

**Additional Suggestions:**
- [ ] Add "Used By" section showing services using this config
- [ ] Add "Download" action to export config file
- [ ] Add "Clone" action to create copy with modifications
- [ ] Add "Compare" feature to diff two config versions
- [ ] Add syntax highlighting based on content detection (JSON, YAML, etc.)
- [ ] Add "Create Config" action in table view
- [ ] Show config template variables if used

---

### 6. Secrets (**SPARSE - Needs Significant Improvement + Edit**)

**Current State:**
- Only Summary tab with 4 basic fields (ID, name, created, updated)
- Values intentionally not shown (security)
- Only Delete action

**Required Improvements (per user request):**
- [ ] **Add "Edit" action to modify secret from Summary view**
  - Same immutability constraints as configs
  - Additional security consideration: require confirmation before showing edit dialog
  - Consider masking input field option

**Additional Suggestions:**
- [ ] Add "Used By" section showing services using this secret
- [ ] Add "Labels" display in Quick Info section
- [ ] Add "Rotate" action (create new version with same name pattern)
- [ ] Add "Clone" action to create copy
- [ ] Add "Create Secret" action in table view
- [ ] Add "External" indicator for secrets managed outside Swarm
- [ ] Add "Driver" info if using external secret store
- [ ] Consider optional "Reveal" feature with strong security warnings

---

### 7. Stacks (Moderate - Improvements Possible)

**Current State:**
- Summary shows stack name, service count, orchestrator
- Services tab shows table of services in stack
- Only Delete action

**Suggestions:**
- [ ] Add "Networks" tab showing stack-created networks
- [ ] Add "Volumes" tab showing stack-created volumes
- [ ] Add "Configs" tab showing stack configs
- [ ] Add "Secrets" tab showing stack secrets
- [ ] Add "Compose File" tab to view/edit stack definition
- [ ] Add "Update Stack" action to redeploy with changes
- [ ] Add "Export" action to download compose file
- [ ] Show stack health status (services healthy/unhealthy count)
- [ ] Add rollback functionality

---

### 8. Volumes (**SPARSE - Needs Significant Improvement + Files Tab**)

**Current State:**
- Only Summary tab with 5 fields (name, driver, scope, mountpoint, created)
- Only Delete action

**Required Improvements (per user request):**
- [ ] **Add "Files" tab with full file browser capability** (see detailed plan below)
  - Browse directory structure
  - Read file contents
  - Download files
  - Upload files
  - Write/edit files
  - Create/delete files and folders
  - Respect read-only volume status

**Additional Suggestions:**
- [ ] Add "Usage" tab showing:
  - Size (if available from driver)
  - Containers/Services using this volume
- [ ] Add "Options" section showing driver-specific options
- [ ] Add "Labels" display in Quick Info section
- [ ] Add "Status" section (if driver provides status info)
- [ ] Add "Clone" action (create volume from this volume)
- [ ] Add "Backup" action (if applicable)
- [ ] Show if volume is in use (prevent delete if mounted)

---

## Priority Improvements

### High Priority (User Requested)

1. **Configs: Add Edit functionality**
   - Create edit overlay/modal with text editor
   - Handle Docker's immutability (create new + migrate services + delete old)
   - Add confirmation for service restart implications

2. **Secrets: Add Edit functionality**
   - Similar to configs but with masked input option
   - Security confirmation before editing
   - Handle immutability transparently

3. **Volumes: Add Files tab with file browser**
   - Full file browser with read/write capabilities
   - See detailed implementation plan below

### High Priority (Sparse Content)

4. **Networks: Add Connected Services tab**
   - Most useful improvement for network management
   - Show which services/containers use the network

5. **Volumes: Add Usage information**
   - Show which services/containers mount the volume
   - Critical for understanding dependencies before deletion

6. **Secrets: Add "Used By" section**
   - Show which services reference this secret
   - Critical for impact analysis

### Medium Priority (UX Improvements)

6. **Configs: Add "Used By" section**
7. **Networks: Add IPAM information**
8. **Stacks: Add related resources tabs (networks, volumes, configs, secrets)**
9. **Nodes: Add Labels management**
10. **Services: Add Ports and Mounts sections**

### Lower Priority (Nice to Have)

11. Syntax highlighting for config data
12. Raw JSON "Inspect" tabs for advanced users
13. Export/Download actions for configs
14. Clone actions for creating copies
15. Events/timeline views for tasks

---

## Implementation Notes

### Edit Functionality for Configs/Secrets

Docker Swarm configs and secrets are immutable. To implement "edit":

```
1. User clicks "Edit" on config/secret
2. Show editor with current data (secrets: require confirmation)
3. User modifies and clicks "Save"
4. Backend:
   a. Create new config/secret with modified data
   b. Find all services using old config/secret
   c. Update each service to use new config/secret
   d. Wait for services to update
   e. Delete old config/secret
5. Show success/failure feedback
```

### Backend API Additions Needed

For the suggested improvements, these new backend endpoints may be needed:

- `GetConfigUsage(configId)` - Returns services using config
- `GetSecretUsage(secretId)` - Returns services using secret
- `GetNetworkServices(networkId)` - Returns services attached to network
- `GetNetworkContainers(networkId)` - Returns containers on network
- `GetVolumeUsage(volumeName)` - Returns services/containers using volume
- `UpdateConfig(configId, newData)` - Create new + migrate + delete old
- `UpdateSecret(secretId, newData)` - Create new + migrate + delete old
- `UpdateNodeLabels(nodeId, labels)` - Modify node labels
- `PromoteNode(nodeId)` / `DemoteNode(nodeId)` - Change node role

---

## Volume Files Tab - Detailed Implementation Plan

### Overview

Add a "Files" tab to the Volumes bottom panel that provides a full file browser experience, allowing users to browse, read, download, upload, and write files within Docker volumes. Write operations are disabled for read-only volumes.

### Technical Approach

Docker volumes are not directly accessible from the host filesystem (especially with Docker Desktop or remote Docker). The solution uses a **temporary helper container** pattern:

```
1. Create/reuse a lightweight container (alpine) with the volume mounted
2. Execute commands inside the container to perform file operations
3. Use docker cp for file transfers (upload/download)
4. Container is cached and reused for performance
```

### Backend API Design

#### New Go Functions (pkg/app/docker_integration.go)

```go
// VolumeFileEntry represents a file or directory in a volume
type VolumeFileEntry struct {
    Name        string    `json:"name"`
    Path        string    `json:"path"`
    IsDir       bool      `json:"isDir"`
    Size        int64     `json:"size"`
    ModTime     time.Time `json:"modTime"`
    Permissions string    `json:"permissions"`
}

// VolumeFileContent represents file content with metadata
type VolumeFileContent struct {
    Path     string `json:"path"`
    Content  string `json:"content"`
    Size     int64  `json:"size"`
    IsBinary bool   `json:"isBinary"`
    Encoding string `json:"encoding"` // "utf-8" or "base64"
}

// VolumeInfo includes read-only status
type VolumeInfo struct {
    Name       string            `json:"name"`
    Driver     string            `json:"driver"`
    Mountpoint string            `json:"mountpoint"`
    ReadOnly   bool              `json:"readOnly"`
    Options    map[string]string `json:"options"`
    Labels     map[string]string `json:"labels"`
}

// Browse volume directory - returns list of files/folders
func (a *App) BrowseVolume(volumeName string, path string) ([]VolumeFileEntry, error)

// Read file content from volume
func (a *App) ReadVolumeFile(volumeName string, filePath string, maxSize int64) (*VolumeFileContent, error)

// Write file content to volume
func (a *App) WriteVolumeFile(volumeName string, filePath string, content string, encoding string) error

// Delete file or directory from volume
func (a *App) DeleteVolumeFile(volumeName string, filePath string, recursive bool) error

// Create directory in volume
func (a *App) CreateVolumeDirectory(volumeName string, dirPath string) error

// Upload file to volume (from local filesystem via Wails file dialog)
func (a *App) UploadToVolume(volumeName string, destPath string) error

// Download file from volume (to local filesystem via Wails save dialog)
func (a *App) DownloadFromVolume(volumeName string, srcPath string) error

// Get volume info including read-only status
func (a *App) GetVolumeInfo(volumeName string) (*VolumeInfo, error)

// Check if volume is read-only
func (a *App) IsVolumeReadOnly(volumeName string) (bool, error)
```

#### Helper Container Management (pkg/app/docker/volume_browser.go)

```go
const (
    VolumeBrowserImage     = "alpine:latest"
    VolumeBrowserPrefix    = "kubedevbench-volume-browser-"
    VolumeMountPath        = "/volume"
    MaxFileReadSize        = 10 * 1024 * 1024  // 10MB
    BinaryDetectionSize    = 8192
)

// GetOrCreateBrowserContainer returns existing or creates new helper container
func (c *DockerClient) GetOrCreateBrowserContainer(volumeName string) (string, error) {
    // 1. Check for existing container: kubedevbench-volume-browser-{volumeName}
    // 2. If exists and running, return container ID
    // 3. If exists but stopped, start it and return ID
    // 4. If not exists, create new container with volume mounted at /volume
    // 5. Container config: alpine, tail -f /dev/null (keeps it running)
}

// ExecuteInBrowser runs a command in the browser container
func (c *DockerClient) ExecuteInBrowser(containerID string, cmd []string) (string, error)

// CleanupBrowserContainer removes the helper container
func (c *DockerClient) CleanupBrowserContainer(volumeName string) error

// CleanupAllBrowserContainers removes all helper containers (on app shutdown)
func (c *DockerClient) CleanupAllBrowserContainers() error
```

#### File Operations Implementation

```go
// BrowseVolume implementation
func (c *DockerClient) BrowseVolume(volumeName, path string) ([]VolumeFileEntry, error) {
    containerID, err := c.GetOrCreateBrowserContainer(volumeName)
    if err != nil {
        return nil, err
    }

    // Sanitize path to prevent directory traversal
    safePath := filepath.Join(VolumeMountPath, filepath.Clean("/"+path))

    // Execute: ls -la --time-style=full-iso {path}
    // Parse output into VolumeFileEntry structs
    output, err := c.ExecuteInBrowser(containerID, []string{
        "ls", "-la", "--time-style=full-iso", safePath,
    })

    return parseDirectoryListing(output)
}

// ReadVolumeFile implementation
func (c *DockerClient) ReadVolumeFile(volumeName, filePath string, maxSize int64) (*VolumeFileContent, error) {
    containerID, err := c.GetOrCreateBrowserContainer(volumeName)
    if err != nil {
        return nil, err
    }

    safePath := filepath.Join(VolumeMountPath, filepath.Clean("/"+filePath))

    // Check file size first
    sizeOutput, _ := c.ExecuteInBrowser(containerID, []string{"stat", "-c", "%s", safePath})
    size := parseSize(sizeOutput)

    if size > maxSize {
        return nil, fmt.Errorf("file too large: %d bytes (max %d)", size, maxSize)
    }

    // Detect if binary
    headOutput, _ := c.ExecuteInBrowser(containerID, []string{
        "head", "-c", fmt.Sprintf("%d", BinaryDetectionSize), safePath,
    })
    isBinary := detectBinary(headOutput)

    if isBinary {
        // Read as base64
        output, err := c.ExecuteInBrowser(containerID, []string{"base64", safePath})
        return &VolumeFileContent{Path: filePath, Content: output, IsBinary: true, Encoding: "base64"}
    }

    // Read as text
    output, err := c.ExecuteInBrowser(containerID, []string{"cat", safePath})
    return &VolumeFileContent{Path: filePath, Content: output, IsBinary: false, Encoding: "utf-8"}
}

// WriteVolumeFile implementation
func (c *DockerClient) WriteVolumeFile(volumeName, filePath, content, encoding string) error {
    // Check read-only status first
    if readonly, _ := c.IsVolumeReadOnly(volumeName); readonly {
        return fmt.Errorf("volume %s is read-only", volumeName)
    }

    containerID, err := c.GetOrCreateBrowserContainer(volumeName)
    if err != nil {
        return err
    }

    safePath := filepath.Join(VolumeMountPath, filepath.Clean("/"+filePath))

    if encoding == "base64" {
        // Decode and write binary
        // Use: echo {content} | base64 -d > {path}
    } else {
        // Write text content using heredoc or temp file + docker cp
    }
}

// Upload/Download use docker cp
func (c *DockerClient) UploadToVolume(volumeName, localPath, destPath string) error {
    containerID, err := c.GetOrCreateBrowserContainer(volumeName)
    safeDest := filepath.Join(VolumeMountPath, filepath.Clean("/"+destPath))

    // docker cp localPath containerID:safeDest
    return c.CopyToContainer(containerID, localPath, safeDest)
}

func (c *DockerClient) DownloadFromVolume(volumeName, srcPath, localPath string) error {
    containerID, err := c.GetOrCreateBrowserContainer(volumeName)
    safeSrc := filepath.Join(VolumeMountPath, filepath.Clean("/"+srcPath))

    // docker cp containerID:safeSrc localPath
    return c.CopyFromContainer(containerID, safeSrc, localPath)
}
```

### Frontend Implementation

#### New Components

```
frontend/src/docker/resources/volumes/
├── SwarmVolumesOverviewTable.jsx  (existing - add Files tab)
├── VolumeFilesTab.jsx             (new - main file browser component)
├── VolumeFileBrowser.jsx          (new - directory listing view)
├── VolumeFileViewer.jsx           (new - file content viewer/editor)
├── VolumeFileActions.jsx          (new - toolbar with actions)
└── volumeFilesApi.js              (new - API wrapper)
```

#### VolumeFilesTab.jsx Structure

```jsx
const VolumeFilesTab = ({ volume }) => {
    const [currentPath, setCurrentPath] = useState('/');
    const [entries, setEntries] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [viewMode, setViewMode] = useState('browser'); // 'browser' | 'viewer' | 'editor'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isReadOnly, setIsReadOnly] = useState(false);

    // Check read-only status on mount
    useEffect(() => {
        IsVolumeReadOnly(volume.Name).then(setIsReadOnly);
    }, [volume.Name]);

    // Load directory contents
    useEffect(() => {
        loadDirectory(currentPath);
    }, [currentPath, volume.Name]);

    return (
        <div className="volume-files-tab">
            <VolumeFileActions
                currentPath={currentPath}
                isReadOnly={isReadOnly}
                onUpload={handleUpload}
                onNewFolder={handleNewFolder}
                onNewFile={handleNewFile}
                onRefresh={handleRefresh}
            />

            <VolumePathBreadcrumb
                path={currentPath}
                onNavigate={setCurrentPath}
            />

            {viewMode === 'browser' && (
                <VolumeFileBrowser
                    entries={entries}
                    loading={loading}
                    onNavigate={handleNavigate}
                    onFileSelect={handleFileSelect}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    isReadOnly={isReadOnly}
                />
            )}

            {viewMode === 'viewer' && (
                <VolumeFileViewer
                    volume={volume}
                    filePath={selectedFile}
                    isReadOnly={isReadOnly}
                    onEdit={() => setViewMode('editor')}
                    onBack={() => setViewMode('browser')}
                    onDownload={handleDownload}
                />
            )}

            {viewMode === 'editor' && (
                <VolumeFileEditor
                    volume={volume}
                    filePath={selectedFile}
                    onSave={handleSave}
                    onCancel={() => setViewMode('viewer')}
                />
            )}
        </div>
    );
};
```

#### VolumeFileBrowser.jsx - Directory Listing

```jsx
const VolumeFileBrowser = ({ entries, loading, onNavigate, onFileSelect, onDelete, onDownload, isReadOnly }) => {
    return (
        <table className="file-browser-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Modified</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {/* Parent directory link */}
                <tr className="parent-dir" onClick={() => onNavigate('..')}>
                    <td><FolderIcon /> ..</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                </tr>

                {entries.map(entry => (
                    <tr key={entry.path}
                        className={entry.isDir ? 'directory' : 'file'}
                        onDoubleClick={() => entry.isDir ? onNavigate(entry.name) : onFileSelect(entry)}>
                        <td>
                            {entry.isDir ? <FolderIcon /> : <FileIcon type={entry.name} />}
                            {entry.name}
                        </td>
                        <td>{entry.isDir ? '-' : formatFileSize(entry.size)}</td>
                        <td>{formatDate(entry.modTime)}</td>
                        <td className="permissions">{entry.permissions}</td>
                        <td className="actions">
                            {!entry.isDir && (
                                <button onClick={() => onDownload(entry)} title="Download">
                                    <DownloadIcon />
                                </button>
                            )}
                            {!isReadOnly && (
                                <button onClick={() => onDelete(entry)} title="Delete" className="danger">
                                    <DeleteIcon />
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
```

#### VolumeFileViewer.jsx - File Content Display

```jsx
const VolumeFileViewer = ({ volume, filePath, isReadOnly, onEdit, onBack, onDownload }) => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        ReadVolumeFile(volume.Name, filePath, 10 * 1024 * 1024)
            .then(setContent)
            .catch(setError)
            .finally(() => setLoading(false));
    }, [volume.Name, filePath]);

    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorDisplay error={error} />;

    return (
        <div className="file-viewer">
            <div className="file-viewer-header">
                <button onClick={onBack}><BackIcon /> Back</button>
                <span className="file-path">{filePath}</span>
                <div className="file-viewer-actions">
                    <button onClick={() => onDownload(filePath)}><DownloadIcon /> Download</button>
                    {!isReadOnly && !content.isBinary && (
                        <button onClick={onEdit}><EditIcon /> Edit</button>
                    )}
                </div>
            </div>

            <div className="file-viewer-content">
                {content.isBinary ? (
                    <BinaryFilePreview content={content} />
                ) : (
                    <SyntaxHighlightedCode
                        content={content.content}
                        filename={filePath}
                    />
                )}
            </div>
        </div>
    );
};
```

#### VolumeFileEditor.jsx - Edit File Content

```jsx
const VolumeFileEditor = ({ volume, filePath, onSave, onCancel }) => {
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        ReadVolumeFile(volume.Name, filePath)
            .then(result => {
                setContent(result.content);
                setOriginalContent(result.content);
            })
            .finally(() => setLoading(false));
    }, [volume.Name, filePath]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await WriteVolumeFile(volume.Name, filePath, content, 'utf-8');
            onSave();
        } catch (error) {
            // Show error notification
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = content !== originalContent;

    return (
        <div className="file-editor">
            <div className="file-editor-header">
                <span className="file-path">{filePath}</span>
                <div className="file-editor-actions">
                    <button onClick={onCancel} disabled={saving}>Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className="primary">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <textarea
                className="file-editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
            />
        </div>
    );
};
```

### UI/UX Design

#### Files Tab Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Upload] [New Folder] [New File] [Refresh]              🔒 Read-only│
├─────────────────────────────────────────────────────────────────────┤
│ 📁 / > data > logs >                                                │
├──────────────────────────────────────────────────────┬──────────────┤
│ Name                    │ Size    │ Modified    │ Perm │ Actions   │
├─────────────────────────┼─────────┼─────────────┼──────┼───────────┤
│ 📁 ..                   │ -       │ -           │ -    │           │
│ 📁 backups              │ -       │ 2024-01-15  │ drwx │ [🗑]      │
│ 📁 config               │ -       │ 2024-01-14  │ drwx │ [🗑]      │
│ 📄 app.log              │ 2.4 MB  │ 2024-01-15  │ -rw- │ [⬇] [🗑] │
│ 📄 settings.json        │ 1.2 KB  │ 2024-01-10  │ -rw- │ [⬇] [🗑] │
│ 📄 database.db          │ 50 MB   │ 2024-01-15  │ -rw- │ [⬇] [🗑] │
└─────────────────────────┴─────────┴─────────────┴──────┴───────────┘
```

#### File Viewer Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← Back]                    /data/config/settings.json   [⬇] [✏️]  │
├─────────────────────────────────────────────────────────────────────┤
│  1 │ {                                                              │
│  2 │   "database": {                                                │
│  3 │     "host": "localhost",                                       │
│  4 │     "port": 5432,                                              │
│  5 │     "name": "myapp"                                            │
│  6 │   },                                                           │
│  7 │   "logging": {                                                 │
│  8 │     "level": "info",                                           │
│  9 │     "format": "json"                                           │
│ 10 │   }                                                            │
│ 11 │ }                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Read-Only Volume Detection

Volumes can be read-only for several reasons:

1. **Volume driver option**: Some drivers support `readonly` option
2. **Mount options**: When mounted with `ro` flag in service/container
3. **External/NFS volumes**: May be read-only at storage level

Detection approach:
```go
func (c *DockerClient) IsVolumeReadOnly(volumeName string) (bool, error) {
    // 1. Check volume options for "ro" or "readonly"
    volume, err := c.client.VolumeInspect(ctx, volumeName)
    if opts := volume.Options; opts != nil {
        if opts["o"] == "ro" || opts["readonly"] == "true" {
            return true, nil
        }
    }

    // 2. Try to create a test file in browser container
    containerID, _ := c.GetOrCreateBrowserContainer(volumeName)
    testFile := "/volume/.kubedevbench-write-test"
    _, err = c.ExecuteInBrowser(containerID, []string{
        "sh", "-c", fmt.Sprintf("touch %s && rm %s", testFile, testFile),
    })

    return err != nil, nil  // If error, volume is read-only
}
```

### Security Considerations

1. **Path Traversal Prevention**
   - All paths sanitized with `filepath.Clean("/"+path)`
   - Paths prefixed with mount point, never allow absolute paths
   - Reject paths containing `..` that would escape mount

2. **File Size Limits**
   - Default max read: 10MB (configurable)
   - Large files require explicit download action
   - Show warning for files > 1MB

3. **Binary File Handling**
   - Detect binary files before displaying
   - Binary files: show hex preview or download only
   - No editing of binary files

4. **Container Isolation**
   - Helper containers run with minimal privileges
   - No network access (`--network none`)
   - Auto-cleanup on app shutdown

5. **Confirmation Dialogs**
   - Delete operations require confirmation
   - Overwrite existing files requires confirmation
   - Large file uploads show warning

### Performance Optimizations

1. **Container Reuse**
   - Helper container cached per volume
   - Container kept running between operations
   - Cleanup on volume disconnect or app shutdown

2. **Lazy Loading**
   - Only load visible directory contents
   - File content loaded on demand
   - Pagination for directories with many entries (>100 files)

3. **Caching**
   - Cache directory listings for 5 seconds
   - Invalidate on write operations
   - Manual refresh button available

### Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Container creation fails | "Unable to access volume. Docker may be unavailable." | Retry button |
| Permission denied | "Permission denied. File may be owned by root." | Show as read-only |
| File not found | "File no longer exists. Directory may have changed." | Refresh directory |
| Volume not found | "Volume was removed." | Navigate back to list |
| File too large | "File exceeds 10MB limit. Use Download instead." | Download button |
| Network timeout | "Operation timed out. Try again." | Retry button |

### Testing Plan

#### Unit Tests (frontend/src/__tests__/)
- VolumeFilesTab rendering
- Path breadcrumb navigation
- File size formatting
- Binary detection logic
- Read-only state handling

#### E2E Tests (e2e/tests/swarm/)
- Browse volume directory
- Navigate into subdirectory
- View text file content
- Download file
- Upload file (if not read-only)
- Edit and save file (if not read-only)
- Delete file (if not read-only)
- Create new folder (if not read-only)
- Handle read-only volume correctly

### Implementation Phases

#### Phase 1: Basic Browse & Read (MVP)
- [ ] Backend: `GetOrCreateBrowserContainer`
- [ ] Backend: `BrowseVolume`
- [ ] Backend: `ReadVolumeFile`
- [ ] Backend: `IsVolumeReadOnly`
- [ ] Frontend: `VolumeFilesTab` with directory listing
- [ ] Frontend: `VolumeFileViewer` for text files
- [ ] Add "Files" tab to Volumes bottom panel

#### Phase 2: Download & Upload
- [ ] Backend: `DownloadFromVolume` with Wails save dialog
- [ ] Backend: `UploadToVolume` with Wails open dialog
- [ ] Frontend: Download button in browser and viewer
- [ ] Frontend: Upload button in toolbar

#### Phase 3: Write Operations
- [ ] Backend: `WriteVolumeFile`
- [ ] Backend: `DeleteVolumeFile`
- [ ] Backend: `CreateVolumeDirectory`
- [ ] Frontend: `VolumeFileEditor` component
- [ ] Frontend: Delete confirmation dialog
- [ ] Frontend: New folder dialog
- [ ] Disable write UI when read-only

#### Phase 4: Polish & Edge Cases
- [ ] Binary file preview (hex dump)
- [ ] Syntax highlighting based on extension
- [ ] Large directory pagination
- [ ] Container cleanup on app shutdown
- [ ] Error handling improvements
- [ ] E2E tests

---

## File References

Current implementations to modify:

- [SwarmNetworksOverviewTable.jsx](frontend/src/docker/resources/networks/SwarmNetworksOverviewTable.jsx)
- [SwarmSecretsOverviewTable.jsx](frontend/src/docker/resources/secrets/SwarmSecretsOverviewTable.jsx)
- [SwarmVolumesOverviewTable.jsx](frontend/src/docker/resources/volumes/SwarmVolumesOverviewTable.jsx)
- [SwarmConfigsOverviewTable.jsx](frontend/src/docker/resources/configs/SwarmConfigsOverviewTable.jsx)
- [SwarmStacksOverviewTable.jsx](frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx)
- [SwarmServicesOverviewTable.jsx](frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx)
- [SwarmNodesOverviewTable.jsx](frontend/src/docker/resources/nodes/SwarmNodesOverviewTable.jsx)
- [SwarmTasksOverviewTable.jsx](frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.jsx)

Backend files to extend:

- [docker_integration.go](pkg/app/docker_integration.go)
- [services.go](pkg/app/docker/services.go)
- [configs.go](pkg/app/docker/configs.go)
- [secrets.go](pkg/app/docker/secrets.go)
- [networks.go](pkg/app/docker/networks.go)
- [volumes.go](pkg/app/docker/volumes.go)
- [nodes.go](pkg/app/docker/nodes.go)

