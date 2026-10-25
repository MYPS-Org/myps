export type ValidityFilter = 'All' | 'Valid' | 'NotValid';
export type StatusFilter = 'All' | 'Active' | 'Inactive';

interface FilterableRow {
  IsActive?: boolean;
  // Computed by the API (OptionProjectCategory / OptionProjectThrustList .IsCurrentlyValid):
  // the end year is 0 (no expiry) or not yet passed. The same flag decides whether the row is
  // offered for a new selection in the Project Details Category / Sub-Category dropdowns.
  IsCurrentlyValid: boolean;
}

/** True when the row passes both the Validity and the Status filter. */
export const matchesValidityStatus = (
  row: FilterableRow,
  validity: ValidityFilter,
  status: StatusFilter,
): boolean => {
  const matchValidity =
    validity === 'All' || (validity === 'Valid' ? row.IsCurrentlyValid : !row.IsCurrentlyValid);
  // Same reading as the table's Active badge: only an explicit false is Inactive.
  const isActive = row.IsActive !== false;
  const matchStatus = status === 'All' || (status === 'Active' ? isActive : !isActive);
  return matchValidity && matchStatus;
};
