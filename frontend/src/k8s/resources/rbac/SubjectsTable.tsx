import React from 'react';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import type { app } from '../../../../wailsjs/go/models';

type SubjectsTableProps = {
  subjects?: app.Subject[] | null;
};

export default function SubjectsTable({ subjects }: SubjectsTableProps) {
  const items = Array.isArray(subjects) ? subjects.filter(Boolean) : [];
  if (items.length === 0) {
    const empty = getEmptyTabMessage('data');
    return (
      <div style={{ padding: 16 }}>
        <EmptyTabContent icon={empty.icon} title={empty.title || 'No subjects'} description={empty.description} tip={empty.tip} />
      </div>
    );
  }
  return (
    <div style={{ padding: 8, overflow: 'auto' }}>
      <table className="gh-table">
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '40%' }} />
          <col style={{ width: '40%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Kind</th>
            <th>Name</th>
            <th>Namespace</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, idx) => (
            <tr key={idx}>
              <td>{s.kind || '-'}</td>
              <td>{s.name || '-'}</td>
              <td>{s.namespace || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
