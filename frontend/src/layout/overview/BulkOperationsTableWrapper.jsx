import { useState, useCallback, useMemo } from 'react';
import { useTableSelection } from '../../hooks/useTableSelection';
import BulkActionBar from '../../components/BulkActionBar';
import BulkConfirmDialog from '../../components/BulkConfirmDialog';
import BulkProgressDialog from '../../components/BulkProgressDialog';
import { executeBulkAction } from '../../api/bulkOperations';
import './BulkSelection.css';

/**
 * Higher-order wrapper that adds bulk operation support to any table component.
 * 
 * @param {Object} props
 * @param {Array} props.data - Array of row objects
 * @param {string} props.resourceKind - Kubernetes/Swarm resource kind (e.g., 'pod', 'deployment', 'service')
 * @param {string} props.platform - 'k8s' or 'swarm'
 * @param {function} props.getRowKey - Function to get unique key from row (row, index) => string
 * @param {function} props.getRowName - Function to get display name from row (row) => string
 * @param {function} props.getRowNamespace - Function to get namespace from row (row) => string (optional for Swarm)
 * @param {function} props.getRowId - For Swarm resources, get the ID (row) => string
 * @param {React.ReactNode} props.children - Function that receives selection props and renders the table
 * @param {function} props.onOperationComplete - Callback when bulk operation completes (for refreshing data)
 */
export default function BulkOperationsTableWrapper({
  data,
  resourceKind,
  platform = 'k8s',
  getRowKey = (row, idx) => row?.name || idx,
  getRowName = (row) => row?.name || row?.Name || '',
  getRowNamespace = (row) => row?.namespace || row?.Namespace || '',
  getRowId = (row) => row?.id || row?.ID || '',
  children,
  onOperationComplete
}) {
  // Selection state
  const {
    selectedKeys,
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    toggleAll,
    toggleRow,
    clearSelection,
    isSelected,
    getSelectedRows
  } = useTableSelection(data, getRowKey);

  // Bulk operation UI state
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [progressDialog, setProgressDialog] = useState(null);

  // Get selected items formatted for the API
  const selectedItems = useMemo(() => {
    const rows = getSelectedRows();
    return rows.map((row) => {
      if (platform === 'swarm') {
        return {
          id: getRowId(row),
          name: getRowName(row),
          kind: resourceKind
        };
      }
      return {
        name: getRowName(row),
        namespace: getRowNamespace(row),
        kind: resourceKind
      };
    });
  }, [getSelectedRows, resourceKind, platform, getRowId, getRowName, getRowNamespace]);

  // Handle action selection from BulkActionBar
  const handleActionSelect = useCallback((action, options) => {
    const items = selectedItems.map(item => ({
      ...item,
      displayName: item.namespace ? `${item.namespace}/${item.name}` : item.name
    }));

    setConfirmDialog({
      action,
      items,
      options,
      title: `${action.label} ${items.length} ${resourceKind}${items.length > 1 ? 's' : ''}?`,
      destructive: action.destructive
    });
  }, [selectedItems, resourceKind]);

  // Handle confirmation
  const handleConfirm = useCallback(async () => {
    const { action, items, options } = confirmDialog;
    setConfirmDialog(null);

    // Initialize progress dialog
    const progressItems = items.map(item => ({
      id: item.id || `${item.namespace}/${item.name}`,
      name: item.displayName,
      namespace: item.namespace,
      status: 'pending',
      error: null
    }));

    setProgressDialog({
      title: `${action.label} in progress...`,
      items: progressItems,
      isComplete: false,
      successCount: 0,
      errorCount: 0
    });

    try {
      // Execute the bulk operation
      const result = await executeBulkAction(action.id, items, platform, options);

      // Update progress with results
      const updatedItems = progressItems.map((item, idx) => {
        const resultItem = result.results?.[idx];
        return {
          ...item,
          status: resultItem?.success ? 'success' : 'error',
          error: resultItem?.error || null
        };
      });

      setProgressDialog({
        title: `${action.label} complete`,
        items: updatedItems,
        isComplete: true,
        successCount: result.successCount || 0,
        errorCount: result.errorCount || 0
      });

      // Clear selection on success
      if (result.errorCount === 0) {
        clearSelection();
      }

      // Notify parent to refresh data
      if (onOperationComplete) {
        onOperationComplete(result);
      }
    } catch (error) {
      // Mark all as failed on execution error
      const failedItems = progressItems.map(item => ({
        ...item,
        status: 'error',
        error: error.message || 'Operation failed'
      }));

      setProgressDialog({
        title: `${action.label} failed`,
        items: failedItems,
        isComplete: true,
        successCount: 0,
        errorCount: progressItems.length
      });
    }
  }, [confirmDialog, platform, clearSelection, onOperationComplete]);

  // Handle closing progress dialog
  const handleProgressClose = useCallback(() => {
    setProgressDialog(null);
  }, []);

  // Handle retry failed items
  const handleRetryFailed = useCallback(() => {
    // Filter to only failed items and restart operation
    if (progressDialog && confirmDialog) {
      const failedItems = progressDialog.items
        .filter(item => item.status === 'error')
        .map(item => ({
          name: item.name.split('/').pop(),
          namespace: item.namespace,
          kind: resourceKind,
          displayName: item.name
        }));

      if (failedItems.length > 0) {
        setProgressDialog(null);
        setConfirmDialog({
          ...confirmDialog,
          items: failedItems
        });
      }
    }
  }, [progressDialog, confirmDialog, resourceKind]);

  // Selection handlers with shift-click support
  const handleRowSelect = useCallback((row, idx, event) => {
    event.stopPropagation();
    toggleRow(row, idx, event.shiftKey);
  }, [toggleRow]);

  const handleSelectAll = useCallback(() => {
    toggleAll();
  }, [toggleAll]);

  // Render checkbox for a row
  const renderCheckbox = useCallback((row, idx) => {
    const selected = isSelected(row, idx);
    return (
      <td className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="bulk-checkbox"
          checked={selected}
          onChange={(e) => handleRowSelect(row, idx, e)}
          onClick={(e) => handleRowSelect(row, idx, e)}
          aria-label={`Select ${getRowName(row)}`}
        />
      </td>
    );
  }, [isSelected, handleRowSelect, getRowName]);

  // Render header checkbox
  const renderHeaderCheckbox = useCallback(() => {
    return (
      <th className="bulk-select-header">
        <input
          type="checkbox"
          className="bulk-checkbox bulk-checkbox-all"
          checked={isAllSelected}
          ref={(el) => {
            if (el) el.indeterminate = isPartiallySelected;
          }}
          onChange={handleSelectAll}
          aria-label="Select all rows"
        />
      </th>
    );
  }, [isAllSelected, isPartiallySelected, handleSelectAll]);

  // Child render props
  const selectionProps = {
    // State
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    
    // Renderers
    renderCheckbox,
    renderHeaderCheckbox,
    
    // Handlers
    toggleRow: handleRowSelect,
    toggleAll: handleSelectAll,
    clearSelection,
    isSelected
  };

  return (
    <div className="bulk-operations-wrapper">
      {/* Bulk action bar - shown when items are selected */}
      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          resourceKind={resourceKind}
          platform={platform}
          onActionSelect={handleActionSelect}
          onClearSelection={clearSelection}
        />
      )}

      {/* Table with selection support */}
      {typeof children === 'function' ? children(selectionProps) : children}

      {/* Confirmation dialog */}
      {confirmDialog && (
        <BulkConfirmDialog
          isOpen={true}
          title={confirmDialog.title}
          items={confirmDialog.items}
          action={confirmDialog.action}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDialog(null)}
          destructive={confirmDialog.destructive}
        />
      )}

      {/* Progress dialog */}
      {progressDialog && (
        <BulkProgressDialog
          isOpen={true}
          title={progressDialog.title}
          items={progressDialog.items}
          isComplete={progressDialog.isComplete}
          successCount={progressDialog.successCount}
          errorCount={progressDialog.errorCount}
          onClose={handleProgressClose}
          onRetryFailed={handleRetryFailed}
        />
      )}
    </div>
  );
}
