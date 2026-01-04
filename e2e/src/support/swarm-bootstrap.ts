import { type Page } from '@playwright/test';
import { SwarmConnectionWizardPage } from '../pages/SwarmConnectionWizardPage.js';
import { SwarmSidebarPage } from '../pages/SwarmSidebarPage.js';

export interface SwarmBootstrapOptions {
  page: Page;
  /** Override the default Docker host (defaults to local socket) */
  dockerHost?: string;
  /** Skip connection wizard if already connected */
  skipIfConnected?: boolean;
}

export interface SwarmBootstrapResult {
  sidebar: SwarmSidebarPage;
  wizard: SwarmConnectionWizardPage;
}

/**
 * Bootstrap the Swarm section of the application.
 * Connects to Docker Swarm if not already connected and returns page objects.
 */
export async function bootstrapSwarm(opts: SwarmBootstrapOptions): Promise<SwarmBootstrapResult> {
  const { page, skipIfConnected = true } = opts;

  const wizard = new SwarmConnectionWizardPage(page);
  const sidebar = new SwarmSidebarPage(page);

  // Navigate to app if not already there
  if (!page.url().includes('localhost') && !page.url().includes('127.0.0.1')) {
    await page.goto('/');
  }

  // Check if already connected to Swarm
  const isConnected = await sidebar.isSwarmConnected();

  if (!isConnected || !skipIfConnected) {
    // Open Swarm connection wizard
    const isWizardVisible = await wizard.isVisible();
    if (!isWizardVisible) {
      await wizard.openFromSidebarGear();
    }

    // Connect to local Docker
    await wizard.connectToLocalDocker();
  }

  return { sidebar, wizard };
}

/**
 * Helper to create a test service in Docker Swarm.
 * Returns the service name.
 */
export async function createTestService(opts: {
  name: string;
  image?: string;
  replicas?: number;
}): Promise<string> {
  const { name, image = 'nginx:alpine', replicas = 1 } = opts;
  
  // This would call the backend API directly or use docker CLI
  // For E2E tests, we typically use the UI to create resources
  // But for setup, direct API calls are faster
  
  // The actual implementation would depend on how Docker API is exposed
  // For now, return the name for UI-based creation
  return name;
}

/**
 * Generate a unique test resource name.
 */
export function uniqueSwarmName(prefix: string): string {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}
