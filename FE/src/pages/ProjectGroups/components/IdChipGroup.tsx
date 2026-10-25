import React from 'react';

/**
 * A heading with its count and up to ten ID chips, then "+N more". Renders nothing when empty.
 * Copied from Program's ConfirmDialogBatch PreviewGroup, which is not exported.
 */
const IdChipGroup: React.FC<{ title: string; ids: string[]; chipClass: string }> = ({ title, ids, chipClass }) => {
  if (ids.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1">{title} ({ids.length})</p>
      <div className="flex flex-wrap gap-1">
        {ids.slice(0, 10).map((id) => (
          <span key={id} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${chipClass}`}>
            {id}
          </span>
        ))}
        {ids.length > 10 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
            +{ids.length - 10} more
          </span>
        )}
      </div>
    </div>
  );
};

export default IdChipGroup;
