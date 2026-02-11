import { useMemo } from 'react';
import type { app } from '../../../../wailsjs/go/models';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';

type SubjectsTableProps = { subjects?: app.Subject[] | null };

export default function SubjectsTable({ subjects }: SubjectsTableProps) {
  const items = useMemo(() => (Array.isArray(subjects) ? subjects.filter(Boolean) : []), [subjects]);
  if (items.length === 0) {
    const emptyMsg = getEmptyTabMessage('subjects');
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
            <th>Kind</th>
            <th>Name</th>
            <th>Namespace</th>
          </tr>
        </thead>
        <tbody>
          {items.map((subject, idx) => (
            <tr key={`${subject.kind}-${subject.name}-${idx}`}>
              <td>{subject.kind || '-'}</td>
              <td>{subject.name || '-'}</td>
              <td>{subject.namespace || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
