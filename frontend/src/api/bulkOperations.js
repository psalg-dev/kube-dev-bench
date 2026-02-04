import * as AppAPI from '../../wailsjs/go/main/App';
import { normalizeBulkKind } from '../constants/bulkActions.js';

function resolveName(row) {
  return row?.name ?? row?.Name ?? row?.id ?? row?.ID ?? row?.stackName ?? row?.StackName ?? row?.volumeName ?? row?.VolumeName ?? '';
}

function resolveNamespace(row) {
  return row?.namespace ?? row?.Namespace ?? '';
}

function resolveSwarmId(row) {
  return row?.id ?? row?.ID ?? row?.nodeId ?? row?.NodeID ?? row?.networkId ?? row?.NetworkID ?? row?.configId ?? row?.ConfigID ?? row?.secretId ?? row?.SecretID ?? '';
}

async function runK8sAction(kind, actionKey, row, options) {
  const name = resolveName(row);
  const namespace = resolveNamespace(row);
  if (!name) throw new Error('Missing resource name');

  switch (actionKey) {
    case 'delete':
      if (kind === 'helmrelease') {
        if (!AppAPI.UninstallHelmRelease) throw new Error('UninstallHelmRelease API unavailable; rebuild bindings');
        return AppAPI.UninstallHelmRelease(namespace, name);
      }
      if (!AppAPI.DeleteResource) throw new Error('DeleteResource API unavailable; rebuild bindings');
      return AppAPI.DeleteResource(kind, namespace, name);
    case 'restart': {
      const restartHandlers = {
        deployment: AppAPI.RestartDeployment,
        statefulset: AppAPI.RestartStatefulSet,
        daemonset: AppAPI.RestartDaemonSet,
        pod: AppAPI.RestartPod,
      };
      const fn = restartHandlers[kind];
      if (!fn) throw new Error(`Restart not supported for ${kind}`);
      return fn(namespace, name);
    }
    case 'scale':
      if (!AppAPI.ScaleResource) throw new Error('ScaleResource API unavailable; rebuild bindings');
      if (typeof options?.replicas !== 'number') throw new Error('Missing replicas value');
      return AppAPI.ScaleResource(kind, namespace, name, options.replicas);
    case 'suspend':
      if (!AppAPI.SuspendCronJob) throw new Error('SuspendCronJob API unavailable; rebuild bindings');
      return AppAPI.SuspendCronJob(namespace, name);
    case 'resume':
      if (!AppAPI.ResumeCronJob) throw new Error('ResumeCronJob API unavailable; rebuild bindings');
      return AppAPI.ResumeCronJob(namespace, name);
    default:
      throw new Error(`Unsupported bulk action ${actionKey}`);
  }
}

async function runSwarmAction(kind, actionKey, row, options) {
  switch (actionKey) {
    case 'delete': {
      if (kind === 'stack') {
        const stackName = resolveName(row);
        if (!stackName) throw new Error('Missing stack name');
        if (!AppAPI.RemoveSwarmStack) throw new Error('RemoveSwarmStack API unavailable; rebuild bindings');
        return AppAPI.RemoveSwarmStack(stackName);
      }
      if (kind === 'volume') {
        const volumeName = resolveName(row);
        if (!volumeName) throw new Error('Missing volume name');
        if (!AppAPI.RemoveSwarmVolume) throw new Error('RemoveSwarmVolume API unavailable; rebuild bindings');
        return AppAPI.RemoveSwarmVolume(volumeName, false);
      }
      if (kind === 'node') {
        const nodeId = resolveSwarmId(row);
        if (!nodeId) throw new Error('Missing node id');
        if (!AppAPI.RemoveSwarmNode) throw new Error('RemoveSwarmNode API unavailable; rebuild bindings');
        return AppAPI.RemoveSwarmNode(nodeId, false);
      }
      if (kind === 'service') {
        const serviceId = resolveSwarmId(row);
        if (!serviceId) throw new Error('Missing service id');
        if (!AppAPI.RemoveSwarmService) throw new Error('RemoveSwarmService API unavailable; rebuild bindings');
        return AppAPI.RemoveSwarmService(serviceId);
      }
      if (kind === 'network') {
        const networkId = resolveSwarmId(row);
        if (!networkId) throw new Error('Missing network id');
        if (!AppAPI.RemoveSwarmNetwork) throw new Error('RemoveSwarmNetwork API unavailable; rebuild bindings');
        return AppAPI.RemoveSwarmNetwork(networkId);
      }
      if (kind === 'config') {
        const configId = resolveSwarmId(row);
        if (!configId) throw new Error('Missing config id');
        if (!AppAPI.RemoveSwarmConfig) throw new Error('RemoveSwarmConfig API unavailable; rebuild bindings');
        return AppAPI.RemoveSwarmConfig(configId);
      }
      if (kind === 'secret') {
        const secretId = resolveSwarmId(row);
        if (!secretId) throw new Error('Missing secret id');
        if (!AppAPI.RemoveSwarmSecret) throw new Error('RemoveSwarmSecret API unavailable; rebuild bindings');
        return AppAPI.RemoveSwarmSecret(secretId);
      }
      throw new Error(`Remove not supported for ${kind}`);
    }
    case 'restart': {
      if (kind !== 'service') throw new Error(`Restart not supported for ${kind}`);
      const serviceId = resolveSwarmId(row);
      if (!serviceId) throw new Error('Missing service id');
      if (!AppAPI.RestartSwarmService) throw new Error('RestartSwarmService API unavailable; rebuild bindings');
      return AppAPI.RestartSwarmService(serviceId);
    }
    case 'scale': {
      if (kind !== 'service') throw new Error(`Scale not supported for ${kind}`);
      const serviceId = resolveSwarmId(row);
      if (!serviceId) throw new Error('Missing service id');
      if (!AppAPI.ScaleSwarmService) throw new Error('ScaleSwarmService API unavailable; rebuild bindings');
      if (typeof options?.replicas !== 'number') throw new Error('Missing replicas value');
      return AppAPI.ScaleSwarmService(serviceId, options.replicas);
    }
    case 'drain':
    case 'pause':
    case 'activate': {
      if (kind !== 'node') throw new Error(`Availability update not supported for ${kind}`);
      const nodeId = resolveSwarmId(row);
      if (!nodeId) throw new Error('Missing node id');
      if (!AppAPI.UpdateSwarmNodeAvailability) throw new Error('UpdateSwarmNodeAvailability API unavailable; rebuild bindings');
      const availability = actionKey === 'activate' ? 'active' : actionKey;
      return AppAPI.UpdateSwarmNodeAvailability(nodeId, availability);
    }
    default:
      throw new Error(`Unsupported bulk action ${actionKey}`);
  }
}

export async function executeBulkAction({ platform = 'k8s', kind, actionKey, rows, options = {} }) {
  const normalizedKind = normalizeBulkKind(kind, platform);
  if (!normalizedKind) throw new Error('Missing resource kind');
  const targets = Array.isArray(rows) ? rows : [];

  const tasks = targets.map((row) => {
    if (platform === 'swarm') {
      return runSwarmAction(normalizedKind, actionKey, row, options);
    }
    return runK8sAction(normalizedKind, actionKey, row, options);
  });

  const results = await Promise.allSettled(tasks);
  const failures = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failures.push({
        row: targets[index],
        error: result.reason?.message || String(result.reason || 'Unknown error'),
      });
    }
  });

  return {
    total: results.length,
    succeeded: results.length - failures.length,
    failed: failures.length,
    failures,
  };
}
