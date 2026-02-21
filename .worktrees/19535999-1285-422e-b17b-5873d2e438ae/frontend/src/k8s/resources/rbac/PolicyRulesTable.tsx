import React from 'react';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';

type PolicyRule = {
  verbs?: string[] | string;
  apiGroups?: string[] | string;
  resources?: string[] | string;
  resourceNames?: string[] | string;
  Verbs?: string[] | string;
  APIGroups?: string[] | string;
  Resources?: string[] | string;
  ResourceNames?: string[] | string;
};

function normalizeList(val?: string[] | string): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalize(rule: PolicyRule) {
  const verbs = normalizeList(rule.verbs ?? rule.Verbs);
  const apiGroups = normalizeList(rule.apiGroups ?? rule.APIGroups);
  const resources = normalizeList(rule.resources ?? rule.Resources);
  const resourceNames = normalizeList(rule.resourceNames ?? rule.ResourceNames);
  return {
    verbs: verbs.sort(),
    apiGroups: apiGroups.length ? apiGroups : ['-'],
    resources: resources.length ? resources : ['-'],
    resourceNames: resourceNames.length ? resourceNames : ['-'],
  };
}

export default function PolicyRulesTable({ rules }: { rules?: PolicyRule[] }) {
  const items = (rules || []).map(normalize);
  if (!items.length) {
    const emptyMessage = getEmptyTabMessage('policy-rules');
    return (
      <EmptyTabContent
        icon={emptyMessage.icon}
        title={emptyMessage.title}
        description={emptyMessage.description}
        tip={emptyMessage.tip}
      />
    );
  }
  return (
    <table className="gh-table">
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
          <tr key={`rule-${idx}`}>
            <td>{r.verbs.join(', ')}</td>
            <td>{r.apiGroups.join(', ')}</td>
            <td>{r.resources.join(', ')}</td>
            <td>{r.resourceNames.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
