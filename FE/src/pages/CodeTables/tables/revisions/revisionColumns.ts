// Readable column headers and names for the Revisions code tables. Several of them list the
// server's fields as they come (CategoryName, RevisionGroupId, SecondSegmentName...) and showed
// bare group numbers, which meant nothing to a user. The values and payloads are unchanged:
// this only decides what a column is called and how a key is shown.

/** Header text per field; a table can override one (Headers calls its own RevisionGroupId "Group No."). */
const LABELS: Record<string, string> = {
  CategoryName: 'Name',
  CategoryId: 'Category',
  RevisionGroupId: 'Revision Group',
  RevisionName: 'Name',
  SecondSegmentName: 'File Name Code',
};

export const columnLabel = (field: string, overrides: Record<string, string> = {}) =>
  overrides[field] ?? LABELS[field] ?? field;

interface RevisionHeaderRow { RevisionGroupId: number; RevisionName: string }
interface RevisionCategoryRow { CategoryId: number; CategoryName: string }

/** "Modification (1)": a revision group's name with its number, as the Documents table shows it. */
export const revisionGroupName = (headers: RevisionHeaderRow[], groupId: unknown): string => {
  if (groupId === null || groupId === undefined || groupId === '') return '';
  const name = headers.find(h => h.RevisionGroupId === groupId)?.RevisionName;
  return name ? `${name.trim()} (${groupId})` : String(groupId);
};

/** "Category A - Typographical Error (1)": a revision category's name with its number. */
export const revisionCategoryName = (categories: RevisionCategoryRow[], categoryId: unknown): string => {
  if (categoryId === null || categoryId === undefined || categoryId === '') return '';
  const name = categories.find(c => c.CategoryId === categoryId)?.CategoryName;
  return name ? `${name} (${categoryId})` : String(categoryId);
};
