import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import './wailsMocks';
import { genericAPIMock, resetAllMocks } from './wailsMocks';
import HolmesContext, { HolmesProvider } from '../holmes/HolmesContext';
import { HolmesPanel } from '../holmes/HolmesPanel';

describe('HolmesPanel', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return Promise.resolve({ enabled: true, endpoint: 'http://test:8080', apiKey: '' });
      }
      if (name === 'AskHolmes') {
        return Promise.resolve({ response: 'Test response from Holmes' });
      }
      return Promise.resolve(undefined);
    });
  });

  it('does not render when panel is hidden', async () => {
    render(
      <HolmesProvider>
        <HolmesPanel />
      </HolmesProvider>
    );

    // Panel should not be visible initially
    expect(screen.queryByText('Holmes AI')).not.toBeInTheDocument();
  });

  it('renders when panel is visible', async () => {
    render(
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
      }}>
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getByText('Holmes AI')).toBeInTheDocument();
  });

  it('shows unconfigured state when Holmes is disabled', async () => {
    render(
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
        showOnboarding: vi.fn(),
      }}>
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
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
      }}>
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getByPlaceholderText(/Ask about your cluster/)).toBeInTheDocument();
  });

  it('shows loading state when asking', async () => {
    render(
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
      }}>
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    // Loading spinner should appear
    expect(screen.getByTestId('holmes-spinner')).toBeInTheDocument();
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('displays response when available', async () => {
    render(
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
      }}>
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getByText('This is the answer from Holmes AI')).toBeInTheDocument();
  });

  it('displays error when present', async () => {
    render(
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
      }}>
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    expect(screen.getAllByText('Connection failed').length).toBeGreaterThan(0);
  });

  it('calls askHolmes when form is submitted', async () => {
    const mockAskHolmes = vi.fn().mockResolvedValue({ response: 'answer' });

    render(
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: mockAskHolmes,
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
      }}>
        <HolmesPanel />
      </HolmesContext.Provider>
    );

    const input = screen.getByPlaceholderText(/Ask about your cluster/);
    fireEvent.change(input, { target: { value: 'What is wrong with my pod?' } });

    const form = input.closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockAskHolmes).toHaveBeenCalledWith('What is wrong with my pod?');
    });
  });

  it('calls hidePanel when close button is clicked', async () => {
    const mockHidePanel = vi.fn();

    render(
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: mockHidePanel,
        clearResponse: vi.fn(),
      }}>
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
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: mockShowConfigModal,
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
        showOnboarding: vi.fn(),
      }}>
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
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
        showOnboarding: mockShowOnboarding,
      }}>
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
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: mockClear,
      }}>
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
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    render(
      <HolmesContext.Provider value={{
        state: {
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
        },
        askHolmes: vi.fn(),
        showConfigModal: vi.fn(),
        hidePanel: vi.fn(),
        clearResponse: vi.fn(),
      }}>
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
