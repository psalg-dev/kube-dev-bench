import type { FullConfig } from '@playwright/test';
import baseGlobalSetup from './global-setup.js';

export default async function globalSetup(config: FullConfig) {
  process.env.E2E_REGISTRY_SUITE = '1';
  // Registry tests only require 1 Wails instance since they don't need parallel isolation
  process.env.E2E_WAILS_INSTANCES = '1';
  return baseGlobalSetup(config);
}