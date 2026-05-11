import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { MagnifyingGlassIcon, XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/toaster/ToasterContext';
import { globalSearch, fetchCategory } from './Service';
import type { CategoryOption, GlobalSearchResponse } from './Model';

/**
 * Maps a CategoryName to a function that builds a navigation URL from a result row.
 * Categories without navigation return null.
 */
const CATEGORY_NAV: Record<string, (row: Record<string, unknown>) => string | null> = {
  'Project ID': (row) =>
    row['ProjectId'] && row['StageName']
      ? `/projects/project-details/${row['ProjectId']}:${row['StageName']}`
      : null,
  'Alternate ID': (row) =>
    row['ProjectId'] && row['StageName']
      ? `/projects/project-details/${row['ProjectId']}:${row['StageName']}`
      : null,
  'Description': (row) =>
    row['ProjectId'] && row['StageName']
      ? `/projects/project-details/${row['ProjectId']}:${row['StageName']}`
      : null,
  'UACS': (row) =>
    row['ProjectId'] && row['StageName']
      ? `/projects/project-details/${row['ProjectId']}:${row['StageName']}`
      : null,
  'Program Name': (row) =>
    row['ProgramId'] && row['StageName'] ? `/programs/programdetails/${row['ProgramId']}:${row['StageName']}` : null,
};

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [searchValue, setSearchValue] = useState<string>('');
  const [result, setResult] = useState<GlobalSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch categories when dialog opens; reset state on close
  useEffect(() => {
    if (isOpen) {
      setIsLoadingCategories(true);
      fetchCategory()
        .then((res) => {
          const data = res.Data as { CategoryList?: CategoryOption[] };
          setCategories(data?.CategoryList ?? []);
        })
        .catch(() => {
          showToast({ type: 'error', message: 'Failed to load search categories.' });
        })
        .finally(() => setIsLoadingCategories(false));
    } else {
      setSelectedCategoryId('');
      setSearchValue('');
      setResult(null);
      setCategories([]);
    }
  }, [isOpen]);

  // Clear results when category changes
  useEffect(() => {
    setResult(null);
    setSearchValue('');
  }, [selectedCategoryId]);

  const selectedCategory = categories.find((c) => c.Id === selectedCategoryId) ?? null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !searchValue.trim()) {
      showToast({ type: 'warning', message: 'Please select a search category and enter a value.' });
      return;
    }
    setIsSearching(true);
    try {
      const res = await globalSearch(selectedCategory.CategoryName, searchValue.trim());
      const data = (res.Data as GlobalSearchResponse) ?? null;
      setResult(data);
    } catch {
      showToast({ type: 'error', message: 'Search failed. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleNavigate = (url: string) => {
    onClose();
    navigate(url);
  };

  // Derive columns dynamically from the first result row
  const dynamicColumns = result?.Data?.length ? Object.keys(result.Data[0]) : [];

  // Get the nav builder for the currently selected category (null = no navigation)
  const getLink = selectedCategory ? (CATEGORY_NAV[selectedCategory.CategoryName] ?? null) : null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div className="fixed inset-0 flex items-start justify-center pt-16 px-4">
        <DialogPanel className="w-full max-w-5xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[80vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
            <div className="flex items-center gap-2">
              <MagnifyingGlassIcon className="w-5 h-5 text-zinc-500" />
              <DialogTitle className="text-base font-semibold text-zinc-800">
                Global Search
              </DialogTitle>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="px-6 py-4 border-b border-zinc-200 shrink-0">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Category dropdown */}
              <div className="w-full sm:w-56 shrink-0">
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Search By
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : '')}
                  disabled={isLoadingCategories}
                  className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{isLoadingCategories ? 'Loading…' : 'Select category…'}</option>
                  {categories.map((c) => (
                    <option key={c.Id} value={c.Id}>
                      {c.CategoryName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value input */}
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Enter search value…"
                  disabled={!selectedCategory}
                  className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Search button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSearching || !selectedCategory || !searchValue.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors whitespace-nowrap"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  {isSearching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>
          </form>

          {/* Results */}
          <div className="flex-1 overflow-hidden px-6 py-4 flex flex-col min-h-0">
            {result === null && !isSearching && (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-400 gap-2">
                <MagnifyingGlassIcon className="w-10 h-10 opacity-30" />
                <p className="text-sm">Select a category and enter a value to search.</p>
              </div>
            )}

            {result !== null && result.Data.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-400 gap-2">
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs">
                  No records found for{' '}
                  <span className="font-semibold">{selectedCategory?.CategoryName}</span>.
                </p>
              </div>
            )}

            {result !== null && result.Data.length > 0 && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-xs text-zinc-500">
                    {result.Title}
                    {result.Data.length === 50 && (
                      <span className="ml-1 text-amber-600">(capped at 50 — refine your search)</span>
                    )}
                  </p>
                </div>

                <div className="overflow-auto rounded-lg border border-zinc-200 flex-1 min-h-0">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 sticky top-0 z-10">
                      <tr>
                        {dynamicColumns.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                        {getLink && (
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                            Action
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-100">
                      {result.Data.map((row, idx) => {
                        const link = getLink?.(row) ?? null;
                        return (
                          <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                            {dynamicColumns.map((col) => (
                              <td
                                key={col}
                                className="px-4 py-2.5 text-zinc-700 whitespace-nowrap max-w-[240px] truncate"
                                title={String(row[col] ?? '')}
                              >
                                {String(row[col] ?? '—')}
                              </td>
                            ))}
                            {getLink && (
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                {link ? (
                                  <button
                                    type="button"
                                    onClick={() => handleNavigate(link)}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                                  >
                                    View
                                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-zinc-300 text-xs">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default GlobalSearchDialog;
