import { test } from '../src/fixtures.js';

test.skip('bottom panels: batch + config + storage (split into 60/61/62)', async () => {
  // This spec was split so Playwright can run the parts in parallel:
  // - tests/60-bottom-panels-batch.spec.ts
  // - tests/61-bottom-panels-config.spec.ts
  // - tests/62-bottom-panels-storage.spec.ts
});
