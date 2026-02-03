/**
 * SwarmServicesOverviewTableGeneric.jsx
 * 
 * Swarm Services table using GenericResourceTable with additional
 * image update modal functionality.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { swarmServiceConfig, swarmServiceColumns } from '../../../config/resourceConfigs/swarm';
import ImageUpdateModal from './ImageUpdateModal';
import ImageUpdateSettingsModal from './ImageUpdateSettingsModal';
import ImageUpdateBadge from './ImageUpdateBadge';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import { GetSwarmServices } from '../../swarmApi';

const buttonStyle = {
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid var(--gh-border, #30363d)',
  backgroundColor: 'var(--gh-button-bg, #21262d)',
  color: 'var(--gh-text, #c9d1d9)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  marginRight: 8,
};

/**
 * Enhanced columns with image update handler injection
 */
function getColumnsWithImageUpdateHandler(onOpenDetails) {
  return swarmServiceColumns.map(col => {
    if (col.key === 'imageUpdate') {
      return {
        ...col,
        cell: ({ getValue }) => {
          const v = getValue();
          return (
            <ImageUpdateBadge 
              value={v} 
              onOpenDetails={() => onOpenDetails(v?.serviceId)} 
            />
          );
        },
      };
    }
    return col;
  });
}

export default function SwarmServicesOverviewTable() {
  const [imageUpdateServiceId, setImageUpdateServiceId] = useState(null);
  const [imageUpdateSettingsOpen, setImageUpdateSettingsOpen] = useState(false);
  const [imageUpdates, setImageUpdates] = useState({});
  const [services, setServices] = useState([]);
  const servicesRef = useRef(services);

  // Keep ref in sync
  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

  // Fetch services for modal lookup (the GenericResourceTable fetches separately)
  useEffect(() => {
    let active = true;
    const loadServices = async () => {
      try {
        const data = await GetSwarmServices();
        if (active) setServices(data || []);
      } catch {
        // Errors handled by GenericResourceTable
      }
    };
    loadServices();

    // Subscribe to service updates
    const offServices = EventsOn('swarm:services:update', (data) => {
      if (active && Array.isArray(data)) {
        setServices(data);
      }
    });

    // Subscribe to image update events
    const offImageUpdates = EventsOn('swarm:image:updates', (updates) => {
      if (active && updates && typeof updates === 'object') {
        setImageUpdates(updates);
      }
    });

    return () => {
      active = false;
      if (typeof offServices === 'function') offServices();
      if (typeof offImageUpdates === 'function') offImageUpdates();
    };
  }, []);

  // Find the selected service for the modal
  const serviceForUpdateModal = useMemo(() => {
    if (!imageUpdateServiceId) return null;
    const svc = services.find((s) => s?.id === imageUpdateServiceId);
    if (!svc) return null;
    // Merge image update data
    const u = imageUpdates[imageUpdateServiceId];
    if (!u) return svc;
    return {
      ...svc,
      imageUpdateAvailable: Boolean(u?.updateAvailable),
      imageLocalDigest: String(u?.localDigest || '').trim(),
      imageRemoteDigest: String(u?.remoteDigest || '').trim(),
      imageCheckedAt: String(u?.checkedAt || '').trim(),
    };
  }, [services, imageUpdateServiceId, imageUpdates]);

  // Create columns with the image update handler
  const columnsWithHandler = useMemo(
    () => getColumnsWithImageUpdateHandler(setImageUpdateServiceId),
    []
  );

  // Create a custom normalize function that merges image update data
  const normalizeWithImageUpdates = useCallback((service) => {
    const normalized = swarmServiceConfig.normalize(service);
    const id = normalized.id;
    const u = imageUpdates[id];
    if (!u) return normalized;

    const imageUpdateAvailable = Boolean(u?.updateAvailable);
    const imageLocalDigest = String(u?.localDigest || '').trim();
    const imageRemoteDigest = String(u?.remoteDigest || '').trim();
    const imageCheckedAt = String(u?.checkedAt || '').trim();

    return {
      ...normalized,
      imageUpdateAvailable,
      imageLocalDigest,
      imageRemoteDigest,
      imageCheckedAt,
      imageUpdate: {
        ...(normalized.imageUpdate || {}),
        imageUpdateAvailable,
        imageLocalDigest,
        imageRemoteDigest,
        imageCheckedAt,
      },
    };
  }, [imageUpdates]);

  // Header actions for Image Updates button
  const headerActions = useMemo(() => (
    <button
      id="swarm-image-update-settings-btn"
      type="button"
      onClick={() => setImageUpdateSettingsOpen(true)}
      style={buttonStyle}
      title="Image update detection settings"
    >
      Image Updates
    </button>
  ), []);

  return (
    <>
      <GenericResourceTable
        {...swarmServiceConfig}
        columns={columnsWithHandler}
        normalize={normalizeWithImageUpdates}
        headerActions={headerActions}
      />

      <ImageUpdateModal
        open={Boolean(imageUpdateServiceId)}
        service={serviceForUpdateModal}
        onClose={() => setImageUpdateServiceId(null)}
      />

      <ImageUpdateSettingsModal
        open={imageUpdateSettingsOpen}
        onClose={() => setImageUpdateSettingsOpen(false)}
      />
    </>
  );
}
