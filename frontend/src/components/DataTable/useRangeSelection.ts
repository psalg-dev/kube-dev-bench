import { useState } from 'react';

export function computeRange(orderedIds: string[], anchorId: string | null, targetId: string): string[] {
  if (!anchorId) return [targetId];

  const anchorIdx = orderedIds.indexOf(anchorId);
  const targetIdx = orderedIds.indexOf(targetId);

  if (anchorIdx === -1 || targetIdx === -1) return [targetId];

  const start = Math.min(anchorIdx, targetIdx);
  const end = Math.max(anchorIdx, targetIdx);

  return orderedIds.slice(start, end + 1);
}

export function useRangeSelection() {
  const [anchorId, setAnchor] = useState<string | null>(null);

  return {
    anchorId,
    setAnchor,
    rangeTo(orderedIds: string[], targetId: string): string[] {
      return computeRange(orderedIds, anchorId, targetId);
    },
  };
}
