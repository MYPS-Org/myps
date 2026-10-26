import React from 'react';
import type { StatusFilter, ValidityFilter } from './validityStatusFilter';

interface ValidityStatusFiltersProps {
  validity: ValidityFilter;
  onValidityChange: (value: ValidityFilter) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
}

const SELECT_CLASS =
  'text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500';

/** Validity (All / Valid / Not Valid) and Status (All / Active / Inactive) filters for the
 *  Project Details Category and Thrust code tables. Pair with matchesValidityStatus. */
const ValidityStatusFilters: React.FC<ValidityStatusFiltersProps> = ({
  validity, onValidityChange, status, onStatusChange,
}) => (
  <>
    <select
      aria-label="Filter by validity"
      value={validity}
      onChange={e => onValidityChange(e.target.value as ValidityFilter)}
      className={SELECT_CLASS}
    >
      <option value="All">All Validity</option>
      <option value="Valid">Valid</option>
      <option value="NotValid">Not Valid</option>
    </select>
    <select
      aria-label="Filter by status"
      value={status}
      onChange={e => onStatusChange(e.target.value as StatusFilter)}
      className={SELECT_CLASS}
    >
      <option value="All">All Statuses</option>
      <option value="Active">Active</option>
      <option value="Inactive">Inactive</option>
    </select>
  </>
);

export default ValidityStatusFilters;
