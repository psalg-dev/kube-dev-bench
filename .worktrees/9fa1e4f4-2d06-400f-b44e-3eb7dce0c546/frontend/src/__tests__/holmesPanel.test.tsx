import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ContextType } from 'react';
import './wailsMocks';
import { genericAPIMock, resetAllMocks } from './wailsMocks';
import HolmesContext, { HolmesProvider } from '../holmes/HolmesContext';
import { HolmesPanel } from '../holmes/HolmesPanel';

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

describe('HolmesPanel', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return toUndefinedPromise({ enabled: true, endpoint: 'http://test:8080', apiKey: '' });
      }
      if (name === 'AskHolmes') {
        return toUndefinedPromise({ response: 'Test response from Holmes' });
      }
      return toUndefinedPromise(undefined);
    });
  });

  it('does not render when panel is hidden', async () => {
    render(
      <HolmesProvider>
        <HolmesPanel />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(genericAPIMock).toHaveBeenCalledWith('GetHolmesConfig');
      expect(screen.queryByText('Holmes AI')).not.toBeInTheDocument();
    });
  });

  it('renders when panel is visible', async () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: false,
            response: null,
            responseTimestamp: null,
            error: null,
            query: '',
            queryTimestamp: null,
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getByText('Holmes AI')).toBeInTheDocument();
  });

  it('shows unconfigured state when Holmes is disabled', async () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: false,
            configured: false,
            endpoint: '',
            showPanel: true,
            loading: false,
            response: null,
            responseTimestamp: null,
            error: null,
            query: '',
            queryTimestamp: null,
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
          showOnboarding: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getByText('Holmes AI')).toBeInTheDocument();
    expect(screen.getByText('Holmes AI is not configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deploy Holmes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manual Configuration/ })).toBeInTheDocument();
  });

  it('shows input form when configured', async () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: false,
            response: null,
            responseTimestamp: null,
            error: null,
            query: '',
            queryTimestamp: null,
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getByPlaceholderText(/Ask about your cluster/)).toBeInTheDocument();
  });

  it('shows loading state when asking', async () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: true,
            response: null,
            responseTimestamp: null,
            error: null,
            query: 'Test question',
            queryTimestamp: new Date().toISOString(),
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getByTestId('holmes-spinner')).toBeInTheDocument();
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('displays response when available', async () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: false,
            response: { response: 'This is the answer from Holmes AI' },
            responseTimestamp: new Date().toISOString(),
            error: null,
            query: 'Test question',
            queryTimestamp: new Date().toISOString(),
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getByText('This is the answer from Holmes AI')).toBeInTheDocument();
  });

  it('displays error when present', async () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: false,
            response: null,
            responseTimestamp: null,
            error: 'Connection failed',
            query: 'Test question',
            queryTimestamp: new Date().toISOString(),
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getAllByText('Connection failed').length).toBeGreaterThan(0);
  });

  it('calls askHolmes when form is submitted', async () => {
    const mockAskHolmes = vi.fn().mockResolvedValue({ response: 'answer' });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: false,
            response: null,
            responseTimestamp: null,
            error: null,
            query: '',
            queryTimestamp: null,
          }),
          askHolmes: mockAskHolmes,
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    const input = screen.getByPlaceholderText(/Ask about your cluster/);
    fireEvent.change(input, { target: { value: 'What is wrong with my pod?' } });

    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(mockAskHolmes).toHaveBeenCalledWith('What is wrong with my pod?');
    });
  });

  it('calls hidePanel when close button is clicked', async () => {
    const mockHidePanel = vi.fn();

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: false,
            response: null,
            responseTimestamp: null,
            error: null,
            query: '',
            queryTimestamp: null,
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: mockHidePanel,
          clearResponse: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    const closeButton = screen.getByTitle('Close panel');
    fireEvent.click(closeButton);

    expect(mockHidePanel).toHaveBeenCalled();
  });

  it('calls showConfigModal when manual config button is clicked', async () => {
    const mockShowConfigModal = vi.fn();

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: false,
            configured: false,
            endpoint: '',
            showPanel: true,
            loading: false,
            response: null,
            responseTimestamp: null,
            error: null,
            query: '',
            queryTimestamp: null,
          }),
          askHolmes: vi.fn(),
          showConfigModal: mockShowConfigModal,
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
          showOnboarding: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    const configureButton = screen.getByRole('button', { name: /Manual Configuration/ });
    fireEvent.click(configureButton);

    expect(mockShowConfigModal).toHaveBeenCalled();
  });

  it('calls showOnboarding when deploy button is clicked', async () => {
    const mockShowOnboarding = vi.fn();

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: false,
            configured: false,
            endpoint: '',
            showPanel: true,
            loading: false,
            response: null,
            responseTimestamp: null,
            error: null,
            query: '',
            queryTimestamp: null,
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
          showOnboarding: mockShowOnboarding,
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    const deployButton = screen.getByRole('button', { name: /Deploy Holmes/ });
    fireEvent.click(deployButton);

    expect(mockShowOnboarding).toHaveBeenCalled();
  });

  it('renders conversation history and supports clear', async () => {
    const mockClear = vi.fn();
    const now = new Date().toISOString();

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: false,
            response: { response: 'Answer' },
            responseTimestamp: now,
            error: null,
            query: 'Question',
            queryTimestamp: now,
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: mockClear,
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Question')).toBeInTheDocument();
      expect(screen.getByText('Answer')).toBeInTheDocument();
    });

    const clearButton = screen.getByTitle('Clear conversation');
    fireEvent.click(clearButton);
    expect(mockClear).toHaveBeenCalled();
  });

  it('exports conversation history', async () => {
    const now = new Date().toISOString();
    const mockUrl = 'blob:holmes-export';
    const createObjectURL = vi.fn(() => mockUrl);
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            enabled: true,
            configured: true,
            endpoint: 'http://test:8080',
            showPanel: true,
            loading: false,
            response: { response: 'Answer' },
            responseTimestamp: now,
            error: null,
            query: 'Question',
            queryTimestamp: now,
          }),
          askHolmes: vi.fn(),
          showConfigModal: vi.fn(),
          hidePanel: vi.fn(),
          clearResponse: vi.fn(),
        })}
      >
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Question')).toBeInTheDocument();
    });

    const exportButton = screen.getByTitle('Export conversation');
    fireEvent.click(exportButton);
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });
});
