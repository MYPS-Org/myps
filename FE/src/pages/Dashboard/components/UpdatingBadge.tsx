import React from 'react';

/**
 * Marks a section that keeps showing its previous figures, dimmed, while new ones load for a
 * changed year or filter (useSectionData's keepPreviousData), instead of collapsing to a skeleton.
 */
const UpdatingBadge: React.FC<{ isLight: boolean }> = ({ isLight }) => (
  <span
    role="status"
    className={`px-2 py-0.5 rounded-full text-[11px] font-bold animate-pulse whitespace-nowrap ${
      isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
    }`}
  >
    Updating…
  </span>
);

export default UpdatingBadge;
