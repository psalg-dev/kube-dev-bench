import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ContextType } from 'react';
import './wailsMocks';
import { resetAllMocks } from './wailsMocks';
import HolmesContext from '../holmes/HolmesContext';
import { HolmesConfigModal } from '../holmes/HolmesConfigModal';

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

describe('HolmesConfigModal', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('does not render when showConfig is false', () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: false,
            enabled: false,
            endpoint: '',
          }),
          saveConfig: vi.fn(),
          testConnection: vi.fn(),
          hideConfigModal: vi.fn(),
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    expect(screen.queryByText('Holmes AI Configuration')).not.toBeInTheDocument();
  });

  it('renders when showConfig is true', () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: false,
            endpoint: '',
          }),
          saveConfig: vi.fn(),
          testConnection: vi.fn(),
          hideConfigModal: vi.fn(),
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    expect(screen.getByText('Holmes AI Configuration')).toBeInTheDocument();
    expect(screen.getByText('Enable Holmes AI')).toBeInTheDocument();
    expect(screen.getByLabelText('Holmes Endpoint')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Model key (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Response format (JSON schema, optional)')).toBeInTheDocument();
  });

  it('shows pre-filled values from state', () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: true,
            endpoint: 'http://holmes.test:8080',
            modelKey: 'fast-model',
            responseFormat: '{"type":"json_schema"}',
          }),
          saveConfig: vi.fn(),
          testConnection: vi.fn(),
          hideConfigModal: vi.fn(),
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    const endpointInput = screen.getByLabelText('Holmes Endpoint');
    expect(endpointInput).toHaveValue('http://holmes.test:8080');

    const modelKeyInput = screen.getByLabelText('Model key (optional)');
    expect(modelKeyInput).toHaveValue('fast-model');

    const responseFormatInput = screen.getByLabelText('Response format (JSON schema, optional)');
    expect(responseFormatInput).toHaveValue('{"type":"json_schema"}');
  });

  it('disables inputs when Holmes is disabled', () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: false,
            endpoint: '',
          }),
          saveConfig: vi.fn(),
          testConnection: vi.fn(),
          hideConfigModal: vi.fn(),
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    const endpointInput = screen.getByLabelText('Holmes Endpoint');
    expect(endpointInput).toBeDisabled();

    const apiKeyInput = screen.getByLabelText('API Key (optional)');
    expect(apiKeyInput).toBeDisabled();

    const modelKeyInput = screen.getByLabelText('Model key (optional)');
    expect(modelKeyInput).toBeDisabled();

    const responseFormatInput = screen.getByLabelText('Response format (JSON schema, optional)');
    expect(responseFormatInput).toBeDisabled();
  });

  it('enables inputs when Holmes is enabled', async () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: false,
            endpoint: '',
          }),
          saveConfig: vi.fn(),
          testConnection: vi.fn(),
          hideConfigModal: vi.fn(),
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      const endpointInput = screen.getByLabelText('Holmes Endpoint');
      expect(endpointInput).not.toBeDisabled();
    });
  });

  it('calls saveConfig when Save button is clicked', async () => {
    const mockSaveConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: true,
            endpoint: 'http://test:8080',
          }),
          saveConfig: mockSaveConfig,
          testConnection: vi.fn(),
          hideConfigModal: vi.fn(),
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    const saveButton = screen.getByRole('button', { name: /Save/ });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalled();
    });
  });

  it('calls testConnection when Test Connection button is clicked', async () => {
    const mockTestConnection = vi.fn().mockResolvedValue({ connected: true });

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: true,
            endpoint: 'http://test:8080',
          }),
          saveConfig: vi.fn(),
          testConnection: mockTestConnection,
          hideConfigModal: vi.fn(),
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    const testButton = screen.getByRole('button', { name: /Test Connection/ });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalled();
    });
  });

  it('calls hideConfigModal when Cancel button is clicked', () => {
    const mockHideConfigModal = vi.fn();

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: false,
            endpoint: '',
          }),
          saveConfig: vi.fn(),
          testConnection: vi.fn(),
          hideConfigModal: mockHideConfigModal,
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/ });
    fireEvent.click(cancelButton);

    expect(mockHideConfigModal).toHaveBeenCalled();
  });

  it('calls hideConfigModal when close button is clicked', () => {
    const mockHideConfigModal = vi.fn();

    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: false,
            endpoint: '',
          }),
          saveConfig: vi.fn(),
          testConnection: vi.fn(),
          hideConfigModal: mockHideConfigModal,
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    const closeButton = screen.getByTitle('Close');
    fireEvent.click(closeButton);

    expect(mockHideConfigModal).toHaveBeenCalled();
  });

  it('disables Test Connection when no endpoint', () => {
    render(
      <HolmesContext.Provider
        value={createHolmesContextValue({
          state: createHolmesState({
            showConfig: true,
            enabled: true,
            endpoint: '',
          }),
          saveConfig: vi.fn(),
          testConnection: vi.fn(),
          hideConfigModal: vi.fn(),
        })}
      >
        <HolmesConfigModal />
      </HolmesContext.Provider>
    );

    const testButton = screen.getByRole('button', { name: /Test Connection/ });
    expect(testButton).toBeDisabled();
  });
});
