import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import './wailsMocks';
import { genericAPIMock, resetAllMocks } from './wailsMocks';
import HolmesContext from '../holmes/HolmesContext';
import { HolmesOnboardingWizard } from '../holmes/HolmesOnboardingWizard';

describe('HolmesOnboardingWizard', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockImplementation((name) => {
      if (name === 'CheckHolmesDeployment') {
        return Promise.resolve({ phase: 'not_deployed', message: 'Holmes is not deployed' });
      }
      if (name === 'DeployHolmesGPT') {
        return Promise.resolve({ 
          phase: 'deployed', 
          message: 'Holmes deployed!',
          endpoint: 'http://holmesgpt.holmesgpt.svc.cluster.local:8080' 
        });
      }
      return Promise.resolve(undefined);
    });
  });

  it('does not render when showOnboarding is false', () => {
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: false,
        },
        hideOnboarding: vi.fn(),
        showConfigModal: vi.fn(),
        deployHolmes: vi.fn(),
        checkDeployment: vi.fn(),
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    expect(screen.queryByText('Welcome to Holmes AI')).not.toBeInTheDocument();
  });

  it('renders welcome step when showOnboarding is true', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: vi.fn(),
        showConfigModal: vi.fn(),
        deployHolmes: vi.fn(),
        checkDeployment: mockCheckDeployment,
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    expect(screen.getByText('Welcome to Holmes AI')).toBeInTheDocument();
    expect(screen.getByText('Root Cause Analysis')).toBeInTheDocument();
    expect(screen.getByText('Smart Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Cluster Insights')).toBeInTheDocument();
  });

  it('shows API key step when Get Started is clicked', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: vi.fn(),
        showConfigModal: vi.fn(),
        deployHolmes: vi.fn(),
        checkDeployment: mockCheckDeployment,
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    const getStartedBtn = screen.getByText('Get Started');
    fireEvent.click(getStartedBtn);

    expect(screen.getByText('Enter Your OpenAI API Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
  });

  it('calls hideOnboarding and showConfigModal when manual config is selected', async () => {
    const mockHideOnboarding = vi.fn();
    const mockShowConfigModal = vi.fn();
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: mockHideOnboarding,
        showConfigModal: mockShowConfigModal,
        deployHolmes: vi.fn(),
        checkDeployment: mockCheckDeployment,
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    const manualConfigBtn = screen.getByText('I already have Holmes running');
    fireEvent.click(manualConfigBtn);

    expect(mockHideOnboarding).toHaveBeenCalled();
    expect(mockShowConfigModal).toHaveBeenCalled();
  });

  it('shows error when trying to deploy without API key', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: vi.fn(),
        showConfigModal: vi.fn(),
        deployHolmes: vi.fn(),
        checkDeployment: mockCheckDeployment,
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    // Go to step 2
    fireEvent.click(screen.getByText('Get Started'));
    
    // Deploy button should be disabled when no key is entered
    const deployBtn = screen.getByText('Deploy Holmes');
    expect(deployBtn).toBeDisabled();
  });

  it('calls deployHolmes when Deploy button is clicked with valid key', async () => {
    const mockDeployHolmes = vi.fn().mockResolvedValue({ 
      phase: 'deployed', 
      endpoint: 'http://test:8080' 
    });
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: vi.fn(),
        showConfigModal: vi.fn(),
        deployHolmes: mockDeployHolmes,
        checkDeployment: mockCheckDeployment,
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    // Go to step 2
    fireEvent.click(screen.getByText('Get Started'));
    
    // Enter API key
    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: 'sk-test-key-12345' } });
    
    // Click deploy
    const deployBtn = screen.getByText('Deploy Holmes');
    expect(deployBtn).not.toBeDisabled();
    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(mockDeployHolmes).toHaveBeenCalledWith(
        { openAIKey: 'sk-test-key-12345' }
      );
    });
  });

  it('shows success screen after deployment completes', async () => {
    const mockDeployHolmes = vi.fn().mockResolvedValue({ 
      phase: 'deployed', 
      endpoint: 'http://holmesgpt.holmesgpt.svc.cluster.local:8080',
      message: 'Holmes is now deployed!'
    });
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: vi.fn(),
        showConfigModal: vi.fn(),
        deployHolmes: mockDeployHolmes,
        checkDeployment: mockCheckDeployment,
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    // Go to step 2
    fireEvent.click(screen.getByText('Get Started'));
    
    // Enter API key and deploy
    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: 'sk-test-key-12345' } });
    fireEvent.click(screen.getByText('Deploy Holmes'));

    // Should show success screen
    await waitFor(() => {
      expect(screen.getByText('Holmes is Ready!')).toBeInTheDocument();
    });
  });

  it('shows toggle button for showing/hiding API key', async () => {
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: vi.fn(),
        showConfigModal: vi.fn(),
        deployHolmes: vi.fn(),
        checkDeployment: mockCheckDeployment,
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
    });

    // Go to step 2
    fireEvent.click(screen.getByText('Get Started'));
    
    // API key input should be password type by default
    const input = screen.getByPlaceholderText('sk-...');
    expect(input).toHaveAttribute('type', 'password');
    
    // Find and click the show/hide toggle button
    const toggleBtn = screen.getByTitle('Show key');
    fireEvent.click(toggleBtn);
    
    // Now should be text type
    expect(input).toHaveAttribute('type', 'text');
  });

  it('closes when close button is clicked', async () => {
    const mockHideOnboarding = vi.fn();
    const mockCheckDeployment = vi.fn().mockResolvedValue({ phase: 'not_deployed' });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: mockHideOnboarding,
        showConfigModal: vi.fn(),
        deployHolmes: vi.fn(),
        checkDeployment: mockCheckDeployment,
      }}>
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
      message: 'Holmes is already deployed'
    });
    
    render(
      <HolmesContext.Provider value={{
        state: {
          showOnboarding: true,
        },
        hideOnboarding: vi.fn(),
        showConfigModal: vi.fn(),
        deployHolmes: vi.fn(),
        checkDeployment: mockCheckDeployment,
      }}>
        <HolmesOnboardingWizard />
      </HolmesContext.Provider>
    );

    // Should skip to success step
    await waitFor(() => {
      expect(screen.getByText('Holmes is Ready!')).toBeInTheDocument();
    });
  });
});
