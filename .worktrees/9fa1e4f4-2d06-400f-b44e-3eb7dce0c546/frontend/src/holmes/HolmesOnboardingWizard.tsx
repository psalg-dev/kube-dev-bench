import { useState, useEffect, useRef } from 'react';
import { useHolmes } from './HolmesContext';
import './HolmesOnboardingWizard.css';

type HolmesDeploymentStatus = {
  phase?: string;
  message?: string;
  progress?: number;
  endpoint?: string;
  error?: string;
};

/**
 * HolmesOnboardingWizard - Guided setup for deploying HolmesGPT to the cluster
 *
 * Steps:
 * 1. Welcome - Explain what Holmes is and what's needed
 * 2. API Key - Collect OpenAI API key
 * 3. Deploy - Show deployment progress
 * 4. Complete - Success message with quick start tips
 */
export function HolmesOnboardingWizard() {
  const {
    state,
    hideOnboarding,
    showConfigModal,
    deployHolmes,
    checkDeployment,
  } = useHolmes();

  const [step, setStep] = useState(1);
  const [openAIKey, setOpenAIKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCheckedDeploymentRef = useRef(false);

  // Use deployment status from context (updated by event listener)
  const deployStatus = state.deploymentStatus as HolmesDeploymentStatus | null;

  // Check if already deployed when wizard opens
  useEffect(() => {
    if (!state.showOnboarding) {
      hasCheckedDeploymentRef.current = false;
      return;
    }
    if (hasCheckedDeploymentRef.current || !checkDeployment) {
      return;
    }
    hasCheckedDeploymentRef.current = true;
    checkDeployment()
      .then(status => {
        if (status.phase === 'deployed') {
          // Already deployed, skip to complete
          setStep(4);
        }
      })
      .catch(() => {
        // Ignore errors, just continue with wizard
      });
  }, [state.showOnboarding, checkDeployment]);

  const isDeploying = step === 3 && deployStatus?.phase !== 'deployed' && deployStatus?.phase !== 'failed';
  const activeStep = deployStatus?.phase === 'deployed' ? 4 : step;
  const deploymentError = deployStatus?.phase === 'failed' ? (deployStatus.error || 'Deployment failed') : null;

  const resetWizardState = () => {
    setStep(1);
    setOpenAIKey('');
    setShowKey(false);
    setError(null);
  };

  const handleDeploy = async () => {
    if (!openAIKey.trim()) {
      setError('Please enter your OpenAI API key');
      return;
    }

    setError(null);
    setStep(3);

    try {
      const result = await deployHolmes({
        openAIKey: openAIKey.trim(),
      });

      if (result.phase === 'deployed') {
        setStep(4);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed';
      setError(message || 'Deployment failed');
    }
  };

  const handleClose = () => {
    if (!isDeploying) {
      resetWizardState();
      hideOnboarding();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isDeploying) {
      resetWizardState();
      hideOnboarding();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !isDeploying) {
      resetWizardState();
      hideOnboarding();
    }
  };

  const handleManualConfig = () => {
    resetWizardState();
    hideOnboarding();
    showConfigModal();
  };

  if (!state.showOnboarding) return null;

  const renderStep1Welcome = () => (
    <div className="holmes-wizard-content">
      <div className="holmes-wizard-icon">🔍</div>
      <h2>Welcome to Holmes AI</h2>
      <p className="holmes-wizard-intro">
        Holmes is an AI-powered Kubernetes troubleshooting assistant that helps you
        diagnose issues, understand cluster behavior, and get actionable recommendations.
      </p>

      <div className="holmes-wizard-features">
        <div className="holmes-feature">
          <span className="holmes-feature-icon">🎯</span>
          <div>
            <strong>Root Cause Analysis</strong>
            <p>Automatically investigate pod failures and crashes</p>
          </div>
        </div>
        <div className="holmes-feature">
          <span className="holmes-feature-icon">💡</span>
          <div>
            <strong>Smart Recommendations</strong>
            <p>Get AI-powered suggestions to fix issues</p>
          </div>
        </div>
        <div className="holmes-feature">
          <span className="holmes-feature-icon">📊</span>
          <div>
            <strong>Cluster Insights</strong>
            <p>Ask questions about your workloads in natural language</p>
          </div>
        </div>
      </div>

      <div className="holmes-wizard-requirements">
        <h4>What you&apos;ll need:</h4>
        <ul>
          <li>An OpenAI API key (GPT-5 preferred, GPT-4.1 as fallback)</li>
          <li>Cluster admin permissions to deploy Holmes</li>
        </ul>
      </div>

      <div className="holmes-wizard-actions">
        <button
          className="holmes-wizard-btn holmes-wizard-btn-primary"
          onClick={() => setStep(2)}
          disabled={false}
        >
          Get Started
        </button>
        <button
          className="holmes-wizard-btn"
          onClick={handleManualConfig}
        >
          I already have Holmes running
        </button>
      </div>
    </div>
  );

  const renderStep2APIKey = () => (
    <div className="holmes-wizard-content">
      <div className="holmes-wizard-step-indicator">Step 1 of 2</div>
      <h2>Enter Your OpenAI API Key</h2>
      <p>
        Holmes uses OpenAI&apos;s GPT models to analyze your cluster and provide intelligent insights.
        Your API key is stored securely as a Kubernetes secret.
      </p>

      <div className="holmes-wizard-field">
        <label htmlFor="openai-key">OpenAI API Key</label>
        <div className="holmes-wizard-input-group">
          <input
            type={showKey ? 'text' : 'password'}
            id="openai-key"
            className="holmes-wizard-input"
            placeholder="sk-..."
            value={openAIKey}
            onChange={(e) => setOpenAIKey(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="holmes-wizard-btn holmes-wizard-btn-icon"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? '🙈' : '👁️'}
          </button>
        </div>
        <p className="holmes-wizard-help">
          Get your API key from{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
          >
            platform.openai.com
          </a>
        </p>
      </div>

      {error && (
        <div className="holmes-wizard-error">
          <span className="holmes-error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="holmes-wizard-actions">
        <button
          className="holmes-wizard-btn"
          onClick={() => setStep(1)}
        >
          Back
        </button>
        <button
          className="holmes-wizard-btn holmes-wizard-btn-primary"
          onClick={handleDeploy}
          disabled={!openAIKey.trim()}
        >
          Deploy Holmes
        </button>
      </div>
    </div>
  );

  const renderStep3Deploying = () => (
    <div className="holmes-wizard-content">
      <div className="holmes-wizard-step-indicator">Step 2 of 2</div>
      <h2>Deploying Holmes</h2>

      <div className="holmes-wizard-progress-container">
        <div className="holmes-wizard-spinner"></div>
        <div className="holmes-wizard-progress">
          <div
            className="holmes-wizard-progress-bar"
            style={{ width: `${deployStatus?.progress || 0}%` }}
          ></div>
        </div>
        <div className="holmes-wizard-progress-text">
          {deployStatus?.progress || 0}%
        </div>
      </div>

      <p className="holmes-wizard-status">
        {deployStatus?.message || 'Initializing...'}
      </p>

      {(deploymentError || error) && (
        <div className="holmes-wizard-error">
          <span className="holmes-error-icon">⚠️</span>
          {deploymentError || error}
          <button
            className="holmes-wizard-btn"
            onClick={() => {
              setError(null);
              setStep(2);
            }}
            style={{ marginTop: 12 }}
          >
            Try Again
          </button>
        </div>
      )}

      <div className="holmes-wizard-deployment-steps">
        <DeploymentStep
          status={getStepStatus(deployStatus?.progress, 0, 25)}
          label="Adding Helm repository"
        />
        <DeploymentStep
          status={getStepStatus(deployStatus?.progress, 25, 40)}
          label="Updating repositories"
        />
        <DeploymentStep
          status={getStepStatus(deployStatus?.progress, 40, 60)}
          label="Installing chart"
        />
        <DeploymentStep
          status={getStepStatus(deployStatus?.progress, 60, 95)}
          label="Waiting for deployment"
        />
        <DeploymentStep
          status={getStepStatus(deployStatus?.progress, 95, 100)}
          label="Configuring integration"
        />
      </div>
    </div>
  );

  const renderStep4Complete = () => (
    <div className="holmes-wizard-content">
      <div className="holmes-wizard-success-icon">✓</div>
      <h2>Holmes is Ready!</h2>
      <p>
        HolmesGPT has been successfully deployed to your cluster and is now configured
        to help you troubleshoot issues.
      </p>

      {deployStatus?.endpoint && (
        <div className="holmes-wizard-info">
          <strong>Endpoint:</strong> {deployStatus.endpoint}
        </div>
      )}

      <div className="holmes-wizard-tips">
        <h4>Quick Start Tips:</h4>
        <ul>
          <li>Ask &quot;What&apos;s wrong with my cluster?&quot; for an overview</li>
          <li>Select a pod and ask Holmes to investigate failures</li>
          <li>Use natural language to explore your workloads</li>
        </ul>
      </div>

      <div className="holmes-wizard-actions">
        <button
          className="holmes-wizard-btn holmes-wizard-btn-primary"
          onClick={handleClose}
        >
          Start Using Holmes
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="holmes-wizard-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="holmes-wizard-modal" id="holmes-onboarding-wizard">
        <div className="holmes-wizard-header">
          <div className="holmes-wizard-logo">
            <span>🔍</span>
            <span>Holmes AI Setup</span>
          </div>
          {!isDeploying && (
            <button
              className="holmes-wizard-close"
              onClick={handleClose}
              title="Close"
            >
              ✕
            </button>
          )}
        </div>

        {activeStep === 1 && renderStep1Welcome()}
        {activeStep === 2 && renderStep2APIKey()}
        {activeStep === 3 && renderStep3Deploying()}
        {activeStep === 4 && renderStep4Complete()}
      </div>
    </div>
  );
}

/**
 * Helper component for deployment step visualization
 */
type DeploymentStepProps = {
  status: 'pending' | 'active' | 'complete';
  label: string;
};

function DeploymentStep({ status, label }: DeploymentStepProps) {
  const icons = {
    pending: '○',
    active: '◉',
    complete: '✓',
  };

  return (
    <div className={`holmes-deployment-step holmes-deployment-step-${status}`}>
      <span className="holmes-deployment-step-icon">{icons[status]}</span>
      <span>{label}</span>
    </div>
  );
}

/**
 * Helper to determine step status based on progress
 */
function getStepStatus(progress = 0, start: number, end: number): 'pending' | 'active' | 'complete' {
  if (progress >= end) return 'complete';
  if (progress >= start) return 'active';
  return 'pending';
}

export default HolmesOnboardingWizard;
