import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { MagnifyingGlassIcon, XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/toaster/ToasterContext';
import { globalSearch, getSearchColumns } from './Service';
import { SEARCH_TABLE_CONFIG } from './config';
import type { SearchableColumn, GlobalSearchResponse } from './Model';

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [selectedTableKey, setSelectedTableKey] = useState<string>('');
  const [columns, setColumns] = useState<SearchableColumn[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [searchValue, setSearchValue] = useState<string>('');
  const [result, setResult] = useState<GlobalSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [columnsLoading, setColumnsLoading] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTableKey('');
      setColumns([]);
      setSelectedColumn('');
      setSearchValue('');
      setResult(null);
    }
  }, [isOpen]);

  // Fetch columns whenever the selected table changes
  useEffect(() => {
    if (!selectedTableKey) {
      setColumns([]);
      setSelectedColumn('');
      return;
    }
    setColumnsLoading(true);
    setSelectedColumn('');
    setResult(null);
    getSearchColumns(selectedTableKey)
      .then((res) => {
        setColumns(res.Data ?? []);
      })
      .catch(() => {
        showToast({ type: 'error', message: 'Failed to load columns.' });
        setColumns([]);
      })
      .finally(() => setColumnsLoading(false));
  }, [selectedTableKey]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTableKey || !selectedColumn || !searchValue.trim()) {
      showToast({ type: 'warning', message: 'Please select a table, column, and enter a value.' });
      return;
    }
    setIsSearching(true);
    try {
      const res = await globalSearch({
        TableKey: selectedTableKey,
        ColumnField: selectedColumn,
        Value: searchValue.trim(),
      });
      setResult(res.Data ?? null);
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

  const activeTableConfig = SEARCH_TABLE_CONFIG.find((t) => t.key === selectedTableKey);
  const resultColumns = activeTableConfig?.resultColumns ?? [];
  const getLink = activeTableConfig?.getLink ?? null;

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
              {/* Table dropdown */}
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Table
                </label>
                <select
                  value={selectedTableKey}
                  onChange={(e) => setSelectedTableKey(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select table…</option>
                  {SEARCH_TABLE_CONFIG.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Column dropdown */}
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Column
                </label>
                <select
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  disabled={!selectedTableKey || columnsLoading}
                  className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {columnsLoading ? 'Loading…' : 'Select column…'}
                  </option>
                  {columns.map((col) => (
                    <option key={col.Field} value={col.Field}>
                      {col.Label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value input */}
              <div className="flex-[2] min-w-0">
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Enter search value…"
                  className="w-full rounded-lg border border-zinc-300 bg-white text-zinc-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Search button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSearching || !selectedTableKey || !selectedColumn || !searchValue.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors whitespace-nowrap"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  {isSearching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>
          </form>

          {/* Results */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {result === null && !isSearching && (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-400 gap-2">
                <MagnifyingGlassIcon className="w-10 h-10 opacity-30" />
                <p className="text-sm">Select a table, column, and value to search.</p>
              </div>
            )}

            {result !== null && result.Total === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-400 gap-2">
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs">
                  No records in <span className="font-semibold">{activeTableConfig?.label}</span> where{' '}
                  <span className="font-semibold">
                    {columns.find((c) => c.Field === result.ColumnField)?.Label ?? result.ColumnField}
                  </span>{' '}
                  contains &ldquo;{result.Value}&rdquo;.
                </p>
              </div>
            )}

            {result !== null && result.Total > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-zinc-500">
                    Showing <span className="font-semibold text-zinc-700">{result.Total}</span>{' '}
                    result{result.Total !== 1 ? 's' : ''} in{' '}
                    <span className="font-semibold">{activeTableConfig?.label}</span>
                    {result.Total === 50 && (
                      <span className="ml-1 text-amber-600">(capped at 50 — refine your search)</span>
                    )}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        {resultColumns.map((col) => (
                          <th
                            key={col.field}
                            className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {col.label}
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
                          <tr
                            key={idx}
                            className="hover:bg-zinc-50 transition-colors"
                          >
                            {resultColumns.map((col) => (
                              <td
                                key={col.field}
                                className="px-4 py-2.5 text-zinc-700 whitespace-nowrap max-w-[240px] truncate"
                                title={String(row[col.field] ?? '')}
                              >
                                {String(row[col.field] ?? '—')}
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
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default GlobalSearchDialog;
