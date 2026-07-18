Status: ready-for-agent

# Slice 14: Finish window.prompt/window.confirm eradication (33 remaining calls slice 12 missed)

Slice 12 replaced native prompts with BaseModal dialogs but only grepped the OLD table dirs.
The per-resource UI moved into `config/resourceConfigs/` during slices 7-11 and took its
native prompts along. 33 calls remain. Finish the job using the exact pattern already
established by slice 12 (see commit 1e13931 "Slice 12: Replace window.prompt/confirm with
BaseModal modals" - follow it, do not invent a new pattern).

Files with remaining calls (grep `window.prompt(` / `window.confirm(` from frontend/src to confirm):
- config/resourceConfigs/podConfig.tsx (1), config/resourceConfigs/swarm/*.tsx (18 across
  configConfig, networkConfig, nodeConfig, secretConfig, serviceConfig, stackConfig, volumeConfig)
- docker/registry/SwarmRegistriesOverview.tsx (1)
- docker/resources/: ConfigSummaryPanel (1), SecretEditModal (1), SecretSummaryPanel (1),
  StackSummaryPanel (1), VolumeFilesTab (4)
- k8s/resources/helmreleases/: HelmActions (2), HelmHistoryTab (1), HelmRepositoriesDialog (1)
- layout/connection/ConnectionHooksSettings.tsx (1)

Contract:
- Replace every native prompt/confirm with the BaseModal-based dialogs used by slice 12
  (confirm dialogs for destructive actions, input modals where a value is entered).
- Destructive confirmations must remain confirmations - do not remove the guard, replace it.
- Extend the existing slice-12 grep-assertion test so it also covers `config/resourceConfigs`
  and the other dirs listed above; test fails if any `window.prompt(`/`window.confirm(` remains
  under frontend/src EXCEPT in test files and BaseModal internals.

Done when: that grep test passes, `npm run typecheck` green, `npm run test` green.

## Blocked by
None

## Agent notes
