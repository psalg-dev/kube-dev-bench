Status: done

# Slice 10: Route swarm resources to config + useHolmesStream

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 10: Route swarm resources to config + useHolmesStream` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `04-holmes-stream`
- `06-reskin-overview`

## Agent notes
Fixed typecheck errors by adding `useResourceIdInsteadOfNamespaceName?: boolean` property to the `ResourceConfig` interface and updating all swarm resource config files (node, service, stack, task) to use this property.