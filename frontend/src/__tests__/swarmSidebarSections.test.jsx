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
  },
  registriesCount: 7,
}));

vi.mock('../docker/SwarmResourceCountsContext.jsx', () => ({
  useSwarmResourceCounts: () => swarmCounts,
}));

import { SwarmSidebarSections } from '../docker/SwarmSidebarSections.jsx';

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
      </MemoryRouter>,
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

    // Counts (scoped to avoid duplicates like "2")
    expect(
      within(container.querySelector('#section-swarm-services')).getByText('3'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('#section-swarm-tasks')).getByText('10'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('#section-swarm-nodes')).getByText('2'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('#section-swarm-stacks')).getByText('1'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('#section-swarm-networks')).getByText('5'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('#section-swarm-configs')).getByText('2'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('#section-swarm-volumes')).getByText('4'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('#section-swarm-registries')).getByText(
        '7',
      ),
    ).toBeTruthy();
  });

  it('calls onSelect with the clicked section key and stops propagation', () => {
    const onSelect = vi.fn();
    const parentOnClick = vi.fn();

    const { container } = render(
      <MemoryRouter>
        <div onClick={parentOnClick}>
          <SwarmSidebarSections selected="swarm-overview" onSelect={onSelect} />
        </div>
      </MemoryRouter>,
    );

    const services = container.querySelector('#section-swarm-services');
    expect(services).toBeTruthy();

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
      </MemoryRouter>,
    );

    const tasks = container.querySelector('#section-swarm-tasks');
    expect(tasks.className).toContain('selected');

    // Missing numeric count renders '-' (for the tasks count span)
    expect(screen.getByText('-')).toBeTruthy();
  });
});
