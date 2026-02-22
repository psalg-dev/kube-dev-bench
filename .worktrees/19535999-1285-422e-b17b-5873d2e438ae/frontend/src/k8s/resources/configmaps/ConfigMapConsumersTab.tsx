import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { navigateToResource } from '../../../utils/resourceNavigation';
import type { app } from '../../../../wailsjs/go/models';

type ConfigMapConsumersTabProps = {
	namespace?: string;
	configMapName?: string;
};

export default function ConfigMapConsumersTab({ namespace, configMapName }: ConfigMapConsumersTabProps) {
	const [items, setItems] = useState<app.ConfigMapConsumer[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!namespace || !configMapName) return;
		let cancelled = false;
		const run = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await AppAPI.GetConfigMapConsumers(namespace, configMapName);
				if (!cancelled) setItems(Array.isArray(res) ? res : []);
			} catch (e: unknown) {
				const message = e instanceof Error ? e.message : String(e);
				if (!cancelled) setError(message);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		run();
		return () => { cancelled = true; };
	}, [namespace, configMapName]);

	const handleRowClick = (consumer: app.ConfigMapConsumer) => {
		const kind = consumer.kind;
		const name = consumer.name;
		if (kind && name) {
			const targetNamespace = consumer.namespace || namespace;
			navigateToResource({ resource: kind, name, namespace: targetNamespace });
		}
	};

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	if (!items || items.length === 0) {
		const emptyMsg = getEmptyTabMessage('consumers');
		return (
			<EmptyTabContent
				icon={emptyMsg.icon}
				title={emptyMsg.title}
				description={emptyMsg.description}
				tip={emptyMsg.tip}
			/>
		);
	}

	return (
		<div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
			<style>{`
				.consumers-table tbody tr {
					cursor: pointer;
					transition: background-color 0.15s ease;
				}
				.consumers-table tbody tr:hover td {
					background-color: var(--gh-hover-bg, rgba(177, 186, 196, 0.12));
				}
				.consumers-table .resource-link {
					color: var(--gh-link, #58a6ff);
				}
				.consumers-table tbody tr:hover .resource-link {
					text-decoration: underline;
				}
			`}</style>
			<table className="panel-table consumers-table">
				<thead>
					<tr>
						<th>Kind</th>
						<th>Name</th>
						<th>Reference</th>
					</tr>
				</thead>
				<tbody>
					{items.map((c, idx) => (
						<tr
							key={`${c.kind}-${c.name}-${idx}`}
							onClick={() => handleRowClick(c)}
							title={`Open ${c.kind}: ${c.name}`}
						>
							<td>{c.kind}</td>
							<td className="resource-link">{c.name}</td>
							<td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.refType ?? '-'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export { ConfigMapConsumersTab };
