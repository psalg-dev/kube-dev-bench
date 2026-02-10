import React from 'react';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import type { app } from '../../../../wailsjs/go/models';

type PolicyRulesTableProps = {
  rules?: app.PolicyRule[] | null;
};

export default function PolicyRulesTable({ rules }: PolicyRulesTableProps) {
  const items = Array.isArray(rules) ? rules.filter(Boolean) : [];
  if (items.length === 0) {
    const empty = getEmptyTabMessage('rules');
    return (
      <div style={{ padding: 16 }}>
        <EmptyTabContent icon={empty.icon} title={empty.title || 'No rules'} description={empty.description} tip={empty.tip} />
      </div>
    );
  }
  return (
    <div style={{ padding: 8, overflow: 'auto' }}>
      <table className="gh-table">
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '28%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Verbs</th>
            <th>API Groups</th>
            <th>Resources</th>
            <th>Resource Names</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r, idx) => (
            <tr key={idx}>
              <td>{Array.isArray(r.verbs) ? r.verbs.join(', ') : '-'}</td>
              <td>{Array.isArray(r.apiGroups) ? r.apiGroups.join(', ') : '-'}</td>
              <td>{Array.isArray(r.resources) ? r.resources.join(', ') : '-'}</td>
              <td>{Array.isArray(r.resourceNames) ? r.resourceNames.join(', ') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
