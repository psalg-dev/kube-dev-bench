import React from 'react';

type Subject = {
  kind?: string;
  Kind?: string;
  name?: string;
  Name?: string;
  namespace?: string;
  Namespace?: string;
};

function normalize(sub: Subject) {
  return {
    kind: sub.kind ?? sub.Kind ?? '-',
    name: sub.name ?? sub.Name ?? '-',
    namespace: sub.namespace ?? sub.Namespace ?? '-',
  };
}

export default function SubjectsTable({ subjects }: { subjects?: Subject[] }) {
  const items = (subjects || []).map(normalize);
  if (!items.length) {
    return (
      <div style={{ padding: '12px', color: 'var(--gh-text-muted)' }}>
        No subjects
      </div>
    );
  }
  return (
    <table className="gh-table">
      <thead>
        <tr>
          <th>Kind</th>
          <th>Name</th>
          <th>Namespace</th>
        </tr>
      </thead>
      <tbody>
        {items.map((s, idx) => (
          <tr key={`subject-${idx}`}>
            <td>{s.kind}</td>
            <td>{s.name}</td>
            <td>{s.namespace}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
