import { useMemo } from 'react';
import type { app } from '../../../../wailsjs/go/models';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';

type PolicyRulesTableProps = { rules?: app.PolicyRule[] | null };

export default function PolicyRulesTable({ rules }: PolicyRulesTableProps) {
  const items = useMemo<app.PolicyRule[]>(() => (Array.isArray(rules) ? rules.filter(Boolean) : []), [rules]);
  if (items.length === 0) {
    const emptyMsg = getEmptyTabMessage('policy-rules');
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
      <table className="panel-table">
        <thead>
          <tr>
            <th>Verbs</th>
            <th>API Groups</th>
            <th>Resources</th>
            <th>Resource Names</th>
          </tr>
        </thead>
        <tbody>
          {items.map((rule, idx) => (
            <tr key={idx}>
              <td>{Array.isArray(rule.verbs) ? rule.verbs.join(', ') : '-'}</td>
              <td>{Array.isArray(rule.apiGroups) ? rule.apiGroups.join(', ') : '-'}</td>
              <td>{Array.isArray(rule.resources) ? rule.resources.join(', ') : '-'}</td>
              <td>
                {Array.isArray(rule.resourceNames) && rule.resourceNames.length > 0
                  ? rule.resourceNames.join(', ')
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
