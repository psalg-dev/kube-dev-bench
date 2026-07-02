import { useRef } from 'react';

export function computeRange(
  orderedIds: string[],
  anchorId: string | null,
  targetId: string
): string[] {
  // If anchor is null or not in the list, return just the target
  if (anchorId === null) {
    return [targetId];
  }

  const anchorIndex = orderedIds.indexOf(anchorId);
  if (anchorIndex === -1) {
    return [targetId];
  }

  const targetIndex = orderedIds.indexOf(targetId);
  if (targetIndex === -1) {
    return [targetId];
  }

  // Get the range between anchor and target (inclusive)
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);

  return orderedIds.slice(start, end + 1);
}

export function useRangeSelection() {
  const anchorRef = useRef<string | null>(null);

  return {
    get anchorId(): string | null {
      return anchorRef.current;
    },
    setAnchor(id: string | null): void {
      anchorRef.current = id;
    },
    rangeTo(orderedIds: string[], targetId: string): string[] {
      return computeRange(orderedIds, anchorRef.current, targetId);
    },
  };
}
