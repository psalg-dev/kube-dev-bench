import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../wailsjs/go/main/App', () => ({
  DeleteResource: vi.fn(),
  UninstallHelmRelease: vi.fn(),
  RestartDeployment: vi.fn(),
  RestartStatefulSet: vi.fn(),
  RestartDaemonSet: vi.fn(),
  RestartPod: vi.fn(),
  ScaleResource: vi.fn(),
  SuspendCronJob: vi.fn(),
  ResumeCronJob: vi.fn(),
  RemoveSwarmStack: vi.fn(),
  RemoveSwarmVolume: vi.fn(),
  RemoveSwarmNode: vi.fn(),
  RemoveSwarmService: vi.fn(),
  RemoveSwarmNetwork: vi.fn(),
  RemoveSwarmConfig: vi.fn(),
  RemoveSwarmSecret: vi.fn(),
  RestartSwarmService: vi.fn(),
  ScaleSwarmService: vi.fn(),
  UpdateSwarmNodeAvailability: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import { executeBulkAction } from '../api/bulkOperations';

const mocks = AppAPI as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('executeBulkAction', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => {
      if (typeof fn?.mockReset === 'function') {
        fn.mockReset();
        fn.mockResolvedValue(undefined);
      }
    });
  });

  it('throws when resource kind is missing', async () => {
    await expect(executeBulkAction({ actionKey: 'delete', rows: [{}] })).rejects.toThrow('Missing resource kind');
  });

  it('returns empty summary when rows are missing', async () => {
    const result = await executeBulkAction({ platform: 'k8s', kind: 'deployments', actionKey: 'delete' });

    expect(result).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      failures: [],
    });
    expect(mocks.DeleteResource).not.toHaveBeenCalled();
  });

  it('deletes normalized k8s resources', async () => {
    const result = await executeBulkAction({
      platform: 'k8s',
      kind: 'deployments',
      actionKey: 'delete',
      rows: [{ name: 'api', namespace: 'default' }],
    });

    expect(mocks.DeleteResource).toHaveBeenCalledWith('deployment', 'default', 'api');
    expect(result.failed).toBe(0);
    expect(result.succeeded).toBe(1);
  });

  it('uninstalls helm releases using helm API', async () => {
    const result = await executeBulkAction({
      platform: 'k8s',
      kind: 'helmreleases',
      actionKey: 'delete',
      rows: [{ name: 'redis', namespace: 'apps' }],
    });

    expect(mocks.UninstallHelmRelease).toHaveBeenCalledWith('apps', 'redis');
    expect(mocks.DeleteResource).not.toHaveBeenCalled();
    expect(result.failed).toBe(0);
  });

  it('restarts supported k8s kinds', async () => {
    await executeBulkAction({
      platform: 'k8s',
      kind: 'deployment',
      actionKey: 'restart',
      rows: [{ Name: 'web', Namespace: 'prod' }],
    });

    expect(mocks.RestartDeployment).toHaveBeenCalledWith('prod', 'web');
  });

  it('scales k8s resources with replicas', async () => {
    await executeBulkAction({
      platform: 'k8s',
      kind: 'statefulset',
      actionKey: 'scale',
      rows: [{ name: 'db', namespace: 'prod' }],
      options: { replicas: 4 },
    });

    expect(mocks.ScaleResource).toHaveBeenCalledWith('statefulset', 'prod', 'db', 4);
  });

  it('runs cronjob suspend and resume', async () => {
    await executeBulkAction({
      platform: 'k8s',
      kind: 'cronjobs',
      actionKey: 'suspend',
      rows: [{ name: 'nightly', namespace: 'ops' }],
    });

    await executeBulkAction({
      platform: 'k8s',
      kind: 'cronjobs',
      actionKey: 'resume',
      rows: [{ name: 'nightly', namespace: 'ops' }],
    });

    expect(mocks.SuspendCronJob).toHaveBeenCalledWith('ops', 'nightly');
    expect(mocks.ResumeCronJob).toHaveBeenCalledWith('ops', 'nightly');
  });

  it('aggregates failures instead of throwing for mixed rows', async () => {
    mocks.DeleteResource.mockRejectedValueOnce(new Error('backend refused'));

    const result = await executeBulkAction({
      platform: 'k8s',
      kind: 'deployments',
      actionKey: 'delete',
      rows: [
        { name: 'ok', namespace: 'default' },
        { namespace: 'default' },
        { name: 'boom', namespace: 'default' },
      ],
    });

    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(2);
    const errors = result.failures.map((entry) => entry.error);
    expect(errors.some((message) => message.includes('Missing resource name'))).toBe(true);
    expect(errors.some((message) => message.includes('backend refused'))).toBe(true);
  });

  it('executes swarm delete actions by kind', async () => {
    await executeBulkAction({ platform: 'swarm', kind: 'stacks', actionKey: 'delete', rows: [{ stackName: 'infra' }] });
    await executeBulkAction({ platform: 'swarm', kind: 'volumes', actionKey: 'delete', rows: [{ volumeName: 'data' }] });
    await executeBulkAction({ platform: 'swarm', kind: 'nodes', actionKey: 'delete', rows: [{ nodeId: 'n1' }] });
    await executeBulkAction({ platform: 'swarm', kind: 'services', actionKey: 'delete', rows: [{ id: 'svc1' }] });
    await executeBulkAction({ platform: 'swarm', kind: 'networks', actionKey: 'delete', rows: [{ networkId: 'net1' }] });
    await executeBulkAction({ platform: 'swarm', kind: 'configs', actionKey: 'delete', rows: [{ configId: 'cfg1' }] });
    await executeBulkAction({ platform: 'swarm', kind: 'secrets', actionKey: 'delete', rows: [{ secretId: 'sec1' }] });

    expect(mocks.RemoveSwarmStack).toHaveBeenCalledWith('infra');
    expect(mocks.RemoveSwarmVolume).toHaveBeenCalledWith('data', false);
    expect(mocks.RemoveSwarmNode).toHaveBeenCalledWith('n1', false);
    expect(mocks.RemoveSwarmService).toHaveBeenCalledWith('svc1');
    expect(mocks.RemoveSwarmNetwork).toHaveBeenCalledWith('net1');
    expect(mocks.RemoveSwarmConfig).toHaveBeenCalledWith('cfg1');
    expect(mocks.RemoveSwarmSecret).toHaveBeenCalledWith('sec1');
  });

  it('runs swarm service restart and scale', async () => {
    await executeBulkAction({
      platform: 'swarm',
      kind: 'service',
      actionKey: 'restart',
      rows: [{ ID: 'service-1' }],
    });

    await executeBulkAction({
      platform: 'swarm',
      kind: 'service',
      actionKey: 'scale',
      rows: [{ ID: 'service-2' }],
      options: { replicas: 7 },
    });

    expect(mocks.RestartSwarmService).toHaveBeenCalledWith('service-1');
    expect(mocks.ScaleSwarmService).toHaveBeenCalledWith('service-2', 7);
  });

  it('updates swarm node availability actions', async () => {
    await executeBulkAction({ platform: 'swarm', kind: 'node', actionKey: 'drain', rows: [{ id: 'node-1' }] });
    await executeBulkAction({ platform: 'swarm', kind: 'node', actionKey: 'pause', rows: [{ id: 'node-1' }] });
    await executeBulkAction({ platform: 'swarm', kind: 'node', actionKey: 'activate', rows: [{ id: 'node-1' }] });

    expect(mocks.UpdateSwarmNodeAvailability).toHaveBeenNthCalledWith(1, 'node-1', 'drain');
    expect(mocks.UpdateSwarmNodeAvailability).toHaveBeenNthCalledWith(2, 'node-1', 'pause');
    expect(mocks.UpdateSwarmNodeAvailability).toHaveBeenNthCalledWith(3, 'node-1', 'active');
  });

  it('reports unsupported action failures in swarm mode', async () => {
    const result = await executeBulkAction({
      platform: 'swarm',
      kind: 'task',
      actionKey: 'restart',
      rows: [{ id: 'task-1' }],
    });

    expect(result.failed).toBe(1);
    expect(result.failures[0].error).toContain('Restart not supported for task');
  });
});
