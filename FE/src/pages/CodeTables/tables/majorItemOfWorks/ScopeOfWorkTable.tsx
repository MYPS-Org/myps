import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { InfraTypeEnum } from '../../../Project/Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'ProjectScopeOfWork';

interface ScopeOfWorkRow {
  id: number;
  infraTypes: string[];
  workCategory: string;
  description: string;
  measure: number;
  minAmount: number | null;
  maxAmount: number | null;
  isActive: boolean;
}

interface FormState {
  infraTypes: string[];
  workCategory: string;
  description: string;
  minAmount: string;
  maxAmount: string;
}

const EMPTY_FORM: FormState = {
  infraTypes: [],
  workCategory: '',
  description: '',
  minAmount: '',
  maxAmount: '',
};

// ── Toggle switch (uniform with RevisionFieldPermissionTable) ─────────────────
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => !disabled && onChange(!value)}
    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
      value ? 'bg-indigo-600' : 'bg-gray-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
      value ? 'translate-x-4' : 'translate-x-0'
    }`} />
  </button>
);

// ── InfraType toggle panel ────────────────────────────────────────────────────
interface InfraTogglePanelProps {
  allInfraTypes: { code: string; name: string }[];
  selected: string[];
  onChange?: (codes: string[]) => void;
  readOnly?: boolean;
}

const InfraTogglePanel: React.FC<InfraTogglePanelProps> = ({ allInfraTypes, selected, onChange, readOnly }) => {
  const toggle = (code: string) => {
    if (!onChange) return;
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
      {allInfraTypes.map(it => (
        <div key={it.code} className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs text-gray-600 truncate" title={it.name}>
            <span className="font-mono font-medium">{it.code}</span>
            <span className="text-gray-400 ml-1 hidden sm:inline">{it.name}</span>
          </span>
          <Toggle value={selected.includes(it.code)} onChange={() => toggle(it.code)} disabled={readOnly} />
        </div>
      ))}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatAmount = (val: number | null) =>
  val === null ? <span className="text-gray-400">—</span> : <span>{val.toLocaleString()}</span>;

const inp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${
    v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
  }`;

const numInp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${
    v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
  }`;

// ── Main component ────────────────────────────────────────────────────────────
const ScopeOfWorkTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredData, setFilteredData] = useState<ScopeOfWorkRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [viewInfraId, setViewInfraId] = useState<number | null>(null);
  const itemsPerPage = 15;

  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();

  const allInfraTypes = useMemo<{ code: string; name: string }[]>(
    () => (codeTableData?.InfraTypes ?? [] as InfraTypeEnum[]).map(t => ({ code: t.InfraCode, name: t.InfraName })),
    [codeTableData],
  );

  const allData = useMemo<ScopeOfWorkRow[]>(() =>
    (codeTableData?.ScopeOfWorks ?? []).map(s => ({
      id: s.Id,
      infraTypes: Array.isArray(s.InfraType) ? s.InfraType : [String(s.InfraType)],
      workCategory: s.WorkCategory,
      description: s.Description,
      measure: s.Measure,
      minAmount: s.MinAmount ?? null,
      maxAmount: s.MaxAmount ?? null,
      isActive: s.IsActive !== false,
    })),
    [codeTableData],
  );

  const uniqueCategories = useMemo(
    () => [...new Set(allData.map(d => d.workCategory))].sort(),
    [allData],
  );

  useEffect(() => {
    let filtered = allData;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.description.toLowerCase().includes(lower) ||
        d.workCategory.toLowerCase().includes(lower),
      );
    }
    if (selectedCategory) filtered = filtered.filter(d => d.workCategory === selectedCategory);
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, allData]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const pageData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ── CRUD helpers ──────────────────────────────────────────────────────────
  const startEdit = (item: ScopeOfWorkRow) => {
    setEditId(item.id);
    setViewInfraId(null);
    setEditForm({
      infraTypes: [...item.infraTypes],
      workCategory: item.workCategory,
      description: item.description,
      minAmount: item.minAmount !== null ? String(item.minAmount) : '',
      maxAmount: item.maxAmount !== null ? String(item.maxAmount) : '',
    });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: ScopeOfWorkRow) => {
    const nextActive = !item.isActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Scope of Work',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Description', value: item.description },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({
            Id: item.id,
            InfraType: item.infraTypes,
            WorkCategory: item.workCategory,
            Description: item.description,
            Measure: item.measure,
            MinAmount: item.minAmount,
            MaxAmount: item.maxAmount,
            IsActive: nextActive,
          }));
          showToast({ type: 'success', message: `Scope of work ${nextActive ? 'activated' : 'deactivated'}.` });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update active status.' });
        }
        confirm.close();
      },
    });
  };

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Scope of Work',
      fields: [
        { label: 'Infra Types',   value: addForm.infraTypes.join(', ') || '—' },
        { label: 'Work Category', value: addForm.workCategory },
        { label: 'Description',   value: addForm.description },
        { label: 'Min Amount',    value: addForm.minAmount || '—' },
        { label: 'Max Amount',    value: addForm.maxAmount || '—' },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify({
            InfraType: addForm.infraTypes,
            WorkCategory: addForm.workCategory,
            Description: addForm.description,
            Measure: 0,
            MinAmount: addForm.minAmount !== '' ? Number(addForm.minAmount) : null,
            MaxAmount: addForm.maxAmount !== '' ? Number(addForm.maxAmount) : null,
          }));
          showToast({ type: 'success', message: 'Scope of work added successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to add scope of work.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = (item: ScopeOfWorkRow) => {
    confirm.request({
      mode: 'edit',
      tableName: 'Scope of Work',
      fields: [
        { label: 'Infra Types',   value: editForm.infraTypes.join(', ') || '—' },
        { label: 'Work Category', value: editForm.workCategory },
        { label: 'Description',   value: editForm.description },
        { label: 'Min Amount',    value: editForm.minAmount || '—' },
        { label: 'Max Amount',    value: editForm.maxAmount || '—' },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({
            Id: item.id,
            InfraType: editForm.infraTypes,
            WorkCategory: editForm.workCategory,
            Description: editForm.description,
            Measure: item.measure,
            MinAmount: editForm.minAmount !== '' ? Number(editForm.minAmount) : null,
            MaxAmount: editForm.maxAmount !== '' ? Number(editForm.maxAmount) : null,
          }));
          showToast({ type: 'success', message: 'Scope of work updated successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update scope of work.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (item: ScopeOfWorkRow) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify({ Id: item.id }));
      showToast({ type: 'success', message: 'Scope of work deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete scope of work.' });
    }
    setDeleteConfirmId(null);
  };

  const addValid = addForm
    ? addForm.workCategory.trim() !== '' && addForm.description.trim() !== ''
    : false;
  const editValid = editForm.workCategory.trim() !== '' && editForm.description.trim() !== '';

  return (
    <div className="space-y-4">
      {/* ── Header + filters ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Scope of Work</h4>
          <p className="text-sm text-gray-500 mt-0.5">Work type definitions with infra type assignments and quantity limits</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Work Categories</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button
            color="indigo"
            className="flex items-center gap-1 text-sm"
            onClick={() => setAddForm({ ...EMPTY_FORM })}
            disabled={!!addForm}
          >
            <PlusIcon className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-36">Work Category</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader className="w-24 text-center">Min</TableHeader>
              <TableHeader className="w-24 text-center">Max</TableHeader>
              <TableHeader className="w-32">Infra Types</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {/* ── Add row ─────────────────────────────────────────────── */}
                {addForm !== null && (
                  <>
                    <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                      <TableCell>
                        <textarea
                          autoFocus
                          value={addForm.workCategory}
                          onChange={e => setAddForm(f => f ? { ...f, workCategory: e.target.value } : f)}
                          placeholder="Work category..."
                          rows={2}
                          className={inp('add')}
                        />
                      </TableCell>
                      <TableCell>
                        <textarea
                          value={addForm.description}
                          onChange={e => setAddForm(f => f ? { ...f, description: e.target.value } : f)}
                          placeholder="Description..."
                          rows={2}
                          className={inp('add')}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="number"
                          value={addForm.minAmount}
                          onChange={e => setAddForm(f => f ? { ...f, minAmount: e.target.value } : f)}
                          placeholder="Min..."
                          className={numInp('add')}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="number"
                          value={addForm.maxAmount}
                          onChange={e => setAddForm(f => f ? { ...f, maxAmount: e.target.value } : f)}
                          placeholder="Max..."
                          className={numInp('add')}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-indigo-600 font-medium">
                          {addForm.infraTypes.length} / {allInfraTypes.length} selected
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">See panel below</p>
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-400 italic">—</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button color="indigo" className="p-1.5" onClick={requestAdd} disabled={!addValid}>
                            <CheckIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}>
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={7} className="bg-indigo-50/60 px-6 pb-4 pt-2 border-t border-indigo-100">
                        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Infra Types — toggle to assign</p>
                        <InfraTogglePanel
                          allInfraTypes={allInfraTypes}
                          selected={addForm.infraTypes}
                          onChange={codes => setAddForm(f => f ? { ...f, infraTypes: codes } : f)}
                        />
                      </TableCell>
                    </TableRow>
                  </>
                )}

                {pageData.length === 0 && !addForm ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-gray-500">No records found.</TableCell>
                  </TableRow>
                ) : (
                  pageData.map(item => {
                    const isEditing = editId === item.id;
                    const isViewing = viewInfraId === item.id;
                    const assignedCount = item.infraTypes.length;
                    const totalCount = allInfraTypes.length;
                    return (
                      <React.Fragment key={item.id}>
                        <TableRow className={isEditing ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                          {isEditing ? (
                            /* ── Edit row ──────────────────────────────── */
                            <>
                              <TableCell>
                                <textarea
                                  autoFocus
                                  value={editForm.workCategory}
                                  onChange={e => setEditForm(f => ({ ...f, workCategory: e.target.value }))}
                                  rows={2}
                                  className={inp('edit')}
                                />
                              </TableCell>
                              <TableCell>
                                <textarea
                                  value={editForm.description}
                                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                  rows={2}
                                  className={inp('edit')}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  value={editForm.minAmount}
                                  onChange={e => setEditForm(f => ({ ...f, minAmount: e.target.value }))}
                                  className={numInp('edit')}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  value={editForm.maxAmount}
                                  onChange={e => setEditForm(f => ({ ...f, maxAmount: e.target.value }))}
                                  className={numInp('edit')}
                                />
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-amber-600 font-medium">
                                  {editForm.infraTypes.length} / {totalCount} selected
                                </span>
                                <p className="text-xs text-gray-400 mt-0.5">See panel below</p>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${
                                  item.isActive
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-gray-100 text-gray-500 border-gray-300'
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${item.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button color="amber" className="p-1.5" onClick={() => requestEdit(item)} disabled={!editValid}>
                                    <CheckIcon className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button color="zinc" className="p-1.5" onClick={cancelEdit}>
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            /* ── Read row ──────────────────────────────── */
                            <>
                              <TableCell className="max-w-[140px]">
                                <span className="block truncate text-sm text-gray-700" title={item.workCategory}>
                                  {item.workCategory}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-[220px]">
                                <span className="block truncate text-sm text-gray-900" title={item.description}>
                                  {item.description}
                                </span>
                              </TableCell>
                              <TableCell className="text-center text-sm">{formatAmount(item.minAmount)}</TableCell>
                              <TableCell className="text-center text-sm">{formatAmount(item.maxAmount)}</TableCell>
                              <TableCell>
                                <button
                                  onClick={() => setViewInfraId(isViewing ? null : item.id)}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 whitespace-nowrap"
                                >
                                  {isViewing
                                    ? <ChevronDownIcon className="h-3.5 w-3.5" />
                                    : <ChevronRightIcon className="h-3.5 w-3.5" />
                                  }
                                  {assignedCount} / {totalCount} types
                                </button>
                              </TableCell>
                              <TableCell className="text-center">
                                <button
                                  onClick={() => requestToggleActive(item)}
                                  title={item.isActive ? 'Click to deactivate' : 'Click to activate'}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer transition-colors shadow-sm ${
                                    item.isActive
                                      ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                                      : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                                  }`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${item.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </TableCell>
                              <TableCell>
                                {deleteConfirmId === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-red-600">Delete?</span>
                                    <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item)}>Yes</Button>
                                    <Button color="zinc" className="px-2 py-1 text-xs" onClick={() => setDeleteConfirmId(null)}>No</Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1.5">
                                    <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}>
                                      <PencilIcon className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button color="red" className="p-1.5" onClick={() => setDeleteConfirmId(item.id)}>
                                      <TrashIcon className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </>
                          )}
                        </TableRow>

                        {/* ── Expandable infra-types panel ────────────── */}
                        {(isViewing || isEditing) && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-slate-50 px-6 pb-5 pt-2 border-t border-gray-100">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                Infra Types {isEditing ? '— toggle to assign' : '— read only'}
                              </p>
                              {isEditing ? (
                                <InfraTogglePanel
                                  allInfraTypes={allInfraTypes}
                                  selected={editForm.infraTypes}
                                  onChange={codes => setEditForm(f => ({ ...f, infraTypes: codes }))}
                                />
                              ) : (
                                <InfraTogglePanel
                                  allInfraTypes={allInfraTypes}
                                  selected={item.infraTypes}
                                  readOnly
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        )}
      </div>

      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default ScopeOfWorkTable;
