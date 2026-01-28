import type { FullConfig } from '@playwright/test';
import baseGlobalSetup from './global-setup.js';

export default async function globalSetup(config: FullConfig) {
  process.env.E2E_REGISTRY_SUITE = '1';
  return baseGlobalSetup(config);
}