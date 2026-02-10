import { useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import Button from '../../../components/ui/Button';
import './CronJobActionsTab.css';

type CronJobActionsTabProps = {
	namespace?: string;
	cronJobName?: string;
	suspend?: boolean;
};

/**
 * Actions tab for CronJobs: Trigger Now, Suspend/Resume.
 */
export default function CronJobActionsTab({ namespace, cronJobName, suspend }: CronJobActionsTabProps) {
	const [loading, setLoading] = useState<'trigger' | 'suspend' | null>(null); // 'trigger' | 'suspend' | null
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleTriggerNow = async () => {
		setLoading('trigger');
		setError(null);
		setMessage(null);

		try {
			if (!namespace || !cronJobName) {
				setError('Missing namespace or CronJob name.');
				return;
			}
			await AppAPI.StartJobFromCronJob(namespace, cronJobName);
			setMessage(`Job triggered successfully from CronJob "${cronJobName}"`);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setLoading(null);
		}
	};

	const handleSuspendResume = async () => {
		setLoading('suspend');
		setError(null);
		setMessage(null);

		try {
			if (!namespace || !cronJobName) {
				setError('Missing namespace or CronJob name.');
				return;
			}
			if (suspend) {
				await AppAPI.ResumeCronJob(namespace, cronJobName);
				setMessage(`CronJob "${cronJobName}" resumed successfully`);
			} else {
				await AppAPI.SuspendCronJob(namespace, cronJobName);
				setMessage(`CronJob "${cronJobName}" suspended successfully`);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
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
						<Button
							className="action-btn primary"
							variant="primary"
							onClick={handleTriggerNow}
							disabled={loading !== null}
						>
							{loading === 'trigger' ? 'Triggering...' : 'Trigger Job Now'}
						</Button>
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
						<Button
							className={`action-btn ${suspend ? 'success' : 'warning'}`}
							onClick={handleSuspendResume}
							disabled={loading !== null}
						>
							{loading === 'suspend'
								? (suspend ? 'Resuming...' : 'Suspending...')
								: (suspend ? 'Resume' : 'Suspend')
							}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
