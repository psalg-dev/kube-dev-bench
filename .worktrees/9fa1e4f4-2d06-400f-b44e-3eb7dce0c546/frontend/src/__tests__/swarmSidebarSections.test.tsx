import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const swarmCounts = vi.hoisted(() => ({
  counts: {
    services: 3,
    tasks: 10,
    nodes: 2,
    stacks: 1,
    networks: 5,
    configs: 2,
    secrets: 1,
    volumes: 4,
  } as {
    services?: number;
    tasks?: number;
    nodes?: number;
    stacks?: number;
    networks?: number;
    configs?: number;
    secrets?: number;
    volumes?: number;
  },
  registriesCount: 7,
}));

vi.mock('../docker/SwarmResourceCountsContext', () => ({
  useSwarmResourceCounts: () => swarmCounts,
}));

import { SwarmSidebarSections } from '../docker/SwarmSidebarSections';

describe('SwarmSidebarSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    swarmCounts.counts = {
      services: 3,
      tasks: 10,
      nodes: 2,
      stacks: 1,
      networks: 5,
      configs: 2,
      secrets: 1,
      volumes: 4,
    };
    swarmCounts.registriesCount = 7;
  });

  it('renders section labels and counts', () => {
    const { container } = render(
      <MemoryRouter>
        <SwarmSidebarSections selected="swarm-overview" onSelect={() => {}} />
      </MemoryRouter>
    );

    // Labels
    expect(screen.getByText('Swarm')).toBeTruthy();
    expect(screen.getByText('Services')).toBeTruthy();
    expect(screen.getByText('Tasks')).toBeTruthy();
    expect(screen.getByText('Nodes')).toBeTruthy();
    expect(screen.getByText('Stacks')).toBeTruthy();
    expect(screen.getByText('Networks')).toBeTruthy();
    expect(screen.getByText('Configs')).toBeTruthy();
    expect(screen.getByText('Secrets')).toBeTruthy();
    expect(screen.getByText('Volumes')).toBeTruthy();
    expect(screen.getByText('Registries')).toBeTruthy();

    const services = container.querySelector('#section-swarm-services') as HTMLElement | null;
    const tasks = container.querySelector('#section-swarm-tasks') as HTMLElement | null;
    const nodes = container.querySelector('#section-swarm-nodes') as HTMLElement | null;
    const stacks = container.querySelector('#section-swarm-stacks') as HTMLElement | null;
    const networks = container.querySelector('#section-swarm-networks') as HTMLElement | null;
    const configs = container.querySelector('#section-swarm-configs') as HTMLElement | null;
    const volumes = container.querySelector('#section-swarm-volumes') as HTMLElement | null;
    const registries = container.querySelector('#section-swarm-registries') as HTMLElement | null;

    if (!services || !tasks || !nodes || !stacks || !networks || !configs || !volumes || !registries) {
      throw new Error('Missing sidebar sections');
    }

    // Counts (scoped to avoid duplicates like "2")
    expect(within(services).getByText('3')).toBeTruthy();
    expect(within(tasks).getByText('10')).toBeTruthy();
    expect(within(nodes).getByText('2')).toBeTruthy();
    expect(within(stacks).getByText('1')).toBeTruthy();
    expect(within(networks).getByText('5')).toBeTruthy();
    expect(within(configs).getByText('2')).toBeTruthy();
    expect(within(volumes).getByText('4')).toBeTruthy();
    expect(within(registries).getByText('7')).toBeTruthy();
  });

  it('calls onSelect with the clicked section key and stops propagation', () => {
    const onSelect = vi.fn();
    const parentOnClick = vi.fn();

    const { container } = render(
      <MemoryRouter>
        <div onClick={parentOnClick}>
          <SwarmSidebarSections selected="swarm-overview" onSelect={onSelect} />
        </div>
      </MemoryRouter>
    );

    const services = container.querySelector('#section-swarm-services');
    if (!services) throw new Error('Missing services section');

    fireEvent.click(services);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('swarm-services');
    expect(parentOnClick).not.toHaveBeenCalled();
  });

  it('adds selected class to the selected section and shows dash for missing counts', () => {
    swarmCounts.counts.tasks = undefined;

    const { container } = render(
      <MemoryRouter>
        <SwarmSidebarSections selected="swarm-tasks" onSelect={() => {}} />
      </MemoryRouter>
    );

    const tasks = container.querySelector('#section-swarm-tasks');
    if (!tasks) throw new Error('Missing tasks section');
    expect(tasks.className).toContain('selected');

    // Missing numeric count renders '-' (for the tasks count span)
    expect(screen.getByText('-')).toBeTruthy();
  });
});
