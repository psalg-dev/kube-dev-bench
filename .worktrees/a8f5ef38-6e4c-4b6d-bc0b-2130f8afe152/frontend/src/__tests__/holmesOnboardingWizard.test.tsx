import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { ContextType } from 'react';
import './wailsMocks';
import { genericAPIMock, resetAllMocks } from './wailsMocks';
import HolmesContext from '../holmes/HolmesContext';
import { HolmesOnboardingWizard } from '../holmes/HolmesOnboardingWizard';

type HolmesContextValue = NonNullable<ContextType<typeof HolmesContext>>;
type HolmesState = HolmesContextValue['state'];

const baseHolmesState: HolmesState = {
  enabled: false,
  configured: false,
  endpoint: '',
  modelKey: '',
  responseFormat: '',
  loading: false,
  query: '',
  queryTimestamp: null,
  response: null,
  responseTimestamp: null,
  error: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  canceledStreamId: null,
  toolEvents: [],
  showConfig: false,
  showPanel: false,
  showOnboarding: false,
  deploymentStatus: null,
  deploying: false,
};

const createHolmesState = (overrides: Partial<HolmesState> = {}): HolmesState => ({
  ...baseHolmesState,
  ...overrides,
});

const toUndefinedPromise = <T,>(value: T) => Promise.resolve(value as unknown as undefined);

const createHolmesContextValue = (overrides: Partial<HolmesContextValue> = {}): HolmesContextValue => ({
  state: baseHolmesState,
  askHolmes: vi.fn().mockResolvedValue(undefined),
  cancelHolmes: vi.fn().mockResolvedValue(undefined),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  clearConfig: vi.fn().mockResolvedValue(undefined),
  testConnection: vi.fn().mockResolvedValue({ connected: true }),
  reconnectHolmes: vi.fn().mockResolvedValue({ connected: true }),
  showConfigModal: vi.fn(),
  hideConfigModal: vi.fn(),
  showPanel: vi.fn(),
  hidePanel: vi.fn(),
  togglePanel: vi.fn(),
  clearResponse: vi.fn(),
  loadConfig: vi.fn().mockResolvedValue(undefined),
  checkDeployment: vi.fn().mockResolvedValue({ phase: 'not_deployed' }),
  deployHolmes: vi.fn().mockResolvedValue({ phase: 'not_deployed' }),
  showOnboarding: vi.fn(),
  hideOnboarding: vi.fn(),
  ...overrides,
});

describe('HolmesOnboardingWizard', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockImplementation((name) => {
      if (name === 'CheckHolmesDeployment') {
        return toUndefinedPromise({ phase: 'not_deployed', message: 'Holmes is not deployed' });
      }
      if (name === 'DeployHolmesGPT') {
        return toUndefinedPromise({
          phase: 'deployed',
          message: 'Holmes deployed!',
          endpoint: 'http://holmesgpt.holmesgpt.svc.cluster.local:8080',
        });
      }
      return toUndefinedPromise(undefined);
    });
  });

  it('does not render when showOnboarding is false', () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: false,
          }),
          hideOnboarding: vi.fn(),
          showConfigModal: vi.fn(),
          deployHolmes: vi.fn(),
          checkDeployment: vi.fn(),
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    expect(screen.queryByText('Welcome to Holmes AI')).not.toBeInTheDocument();
  });

  it('renders welcome step when showOnboarding is true', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: vi.fn(),
          showConfigModal: vi.fn(),
          deployHolmes: vi.fn(),
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome to Holmes AI')).toBeInTheDocument();
      expect(screen.getByText('Root Cause Analysis')).toBeInTheDocument();
      expect(screen.getByText('Smart Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Cluster Insights')).toBeInTheDocument();
    });
  });

  it('shows API key step when Get Started is clicked', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: vi.fn(),
          showConfigModal: vi.fn(),
          deployHolmes: vi.fn(),
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    const getStartedBtn = screen.getByText('Get Started');
    await act(async () => {
      fireEvent.click(getStartedBtn);
    });

    expect(screen.getByText('Enter Your OpenAI API Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
  });

  it('calls hideOnboarding and showConfigModal when manual config is selected', async () => {
    const mockHideOnboarding = vi.fn();
    const mockShowConfigModal = vi.fn();
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: mockHideOnboarding,
          showConfigModal: mockShowConfigModal,
          deployHolmes: vi.fn(),
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    const manualConfigBtn = screen.getByText('I already have Holmes running');
    await act(async () => {
      fireEvent.click(manualConfigBtn);
    });

    expect(mockHideOnboarding).toHaveBeenCalled();
    expect(mockShowConfigModal).toHaveBeenCalled();
  });

  it('shows error when trying to deploy without API key', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: vi.fn(),
          showConfigModal: vi.fn(),
          deployHolmes: vi.fn(),
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Get Started'));
    });

    const deployBtn = screen.getByText('Deploy Holmes');
    expect(deployBtn).toBeDisabled();
  });

  it('calls deployHolmes when Deploy button is clicked with valid key', async () => {
    const mockDeployHolmes = vi.fn().mockResolvedValue({
      phase: 'deployed',
      endpoint: 'http://test:8080',
    });
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: vi.fn(),
          showConfigModal: vi.fn(),
          deployHolmes: mockDeployHolmes,
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Get Started'));
    });

    const input = screen.getByPlaceholderText('sk-...');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'sk-test-key-12345' } });
    });

    const deployBtn = screen.getByText('Deploy Holmes');
    expect(deployBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(deployBtn);
    });

    await waitFor(() => {
      expect(mockDeployHolmes).toHaveBeenCalledWith({ openAIKey: 'sk-test-key-12345' });
    });
  });

  it('shows success screen after deployment completes', async () => {
    const mockDeployHolmes = vi.fn().mockResolvedValue({
      phase: 'deployed',
      endpoint: 'http://holmesgpt.holmesgpt.svc.cluster.local:8080',
      message: 'Holmes is now deployed!',
    });
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: vi.fn(),
          showConfigModal: vi.fn(),
          deployHolmes: mockDeployHolmes,
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Get Started'));

    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: 'sk-test-key-12345' } });
    fireEvent.click(screen.getByText('Deploy Holmes'));

    await waitFor(() => {
      expect(screen.getByText('Holmes is Ready!')).toBeInTheDocument();
    });
  });

  it('shows toggle button for showing/hiding API key', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: vi.fn(),
          showConfigModal: vi.fn(),
          deployHolmes: vi.fn(),
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Get Started'));

    const input = screen.getByPlaceholderText('sk-...');
    expect(input).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByTitle('Show key');
    fireEvent.click(toggleBtn);

    expect(input).toHaveAttribute('type', 'text');
  });

  it('closes when close button is clicked', async () => {
    const mockHideOnboarding = vi.fn();
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: mockHideOnboarding,
          showConfigModal: vi.fn(),
          deployHolmes: vi.fn(),
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);

    expect(mockHideOnboarding).toHaveBeenCalled();
  });

  it('skips to success step if Holmes is already deployed', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({
      phase: 'deployed',
      endpoint: 'http://existing:8080',
      message: 'Holmes is already deployed',
    });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showOnboarding: true,
          }),
          hideOnboarding: vi.fn(),
          showConfigModal: vi.fn(),
          deployHolmes: vi.fn(),
          checkDeployment: mockCheckDeployment,
        })}
      >
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Holmes is Ready!')).toBeInTheDocument();
    });
  });
});