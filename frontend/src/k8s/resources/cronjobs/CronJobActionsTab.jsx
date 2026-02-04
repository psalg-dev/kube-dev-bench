import { useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import './CronJobActionsTab.css';

/**
 * Actions tab for CronJobs: Trigger Now, Suspend/Resume.
 *
 * @param {string} namespace - The namespace of the CronJob
 * @param {string} cronJobName - The name of the CronJob
 * @param {boolean} suspend - Current suspend state
 */
export default function CronJobActionsTab({ namespace, cronJobName, suspend }) {
  const [loading, setLoading] = useState(null); // 'trigger' | 'suspend' | null
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleTriggerNow = async () => {
    setLoading('trigger');
    setError(null);
    setMessage(null);

    try {
      await AppAPI.StartJobFromCronJob(namespace, cronJobName);
      setMessage(`Job triggered successfully from CronJob "${cronJobName}"`);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(null);
    }
  };

  const handleSuspendResume = async () => {
    setLoading('suspend');
    setError(null);
    setMessage(null);

    try {
      if (suspend) {
        await AppAPI.ResumeCronJob(namespace, cronJobName);
        setMessage(`CronJob "${cronJobName}" resumed successfully`);
      } else {
        await AppAPI.SuspendCronJob(namespace, cronJobName);
        setMessage(`CronJob "${cronJobName}" suspended successfully`);
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="cronjob-actions-tab">
      <div className="actions-header">
        <h3>CronJob Actions</h3>
        <p className="actions-description">
          Manage the CronJob &quot;{cronJobName}&quot; with the actions below.
        </p>
      </div>

      {message && (
        <div className="actions-message success">
          ✓ {message}
        </div>
      )}

      {error && (
        <div className="actions-message error">
          ✗ {error}
        </div>
      )}

      <div className="actions-grid">
        <div className="action-card">
          <div className="action-icon">▶️</div>
          <div className="action-content">
            <h4>Trigger Now</h4>
            <p>Manually create a Job from this CronJob immediately, regardless of the schedule.</p>
            <button
              className="action-btn primary"
              onClick={handleTriggerNow}
              disabled={loading !== null}
            >
              {loading === 'trigger' ? 'Triggering...' : 'Trigger Job Now'}
            </button>
          </div>
        </div>

        <div className="action-card">
          <div className="action-icon">{suspend ? '▶️' : '⏸️'}</div>
          <div className="action-content">
            <h4>{suspend ? 'Resume CronJob' : 'Suspend CronJob'}</h4>
            <p>
              {suspend
                ? 'Resume scheduled job creation. New jobs will be created according to the schedule.'
                : 'Suspend scheduled job creation. No new jobs will be created until resumed.'
              }
            </p>
            <div className="action-status">
              Current status:
              <span className={`status-badge ${suspend ? 'suspended' : 'active'}`}>
                {suspend ? 'Suspended' : 'Active'}
              </span>
            </div>
            <button
              className={`action-btn ${suspend ? 'success' : 'warning'}`}
              onClick={handleSuspendResume}
              disabled={loading !== null}
            >
              {loading === 'suspend'
                ? (suspend ? 'Resuming...' : 'Suspending...')
                : (suspend ? 'Resume' : 'Suspend')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
