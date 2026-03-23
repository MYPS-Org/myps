import React, { useEffect, useState, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { RevisionRules } from '../../Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

// ── Field permission types ────────────────────────────────────────────────────
type CrudRule = { Message: string; CanAdd: boolean; CanDelete: boolean };
type SectionWithCrud = { Fields: Record<string, boolean>; CRUD: CrudRule };
interface FieldRules {
  ProjectDetailsRules: Record<string, boolean>;
  ComponentCostRules: SectionWithCrud;
  ComponentCostYearRules: SectionWithCrud;
  MajorItemOfWorkRules: SectionWithCrud;
  MajorItemLocationRules: SectionWithCrud;
  FundingProfileRules: SectionWithCrud;
}

const SECTION_LABELS: Record<string, string> = {
  ProjectDetailsRules:    'Project Details',
  ComponentCostRules:     'Component Cost',
  ComponentCostYearRules: 'Component Cost Year',
  MajorItemOfWorkRules:   'Major Item of Work',
  MajorItemLocationRules: 'Major Item Location',
  FundingProfileRules:    'Funding Profile',
};

const CRUD_SECTIONS = [
  'ComponentCostRules', 'ComponentCostYearRules',
  'MajorItemOfWorkRules', 'MajorItemLocationRules', 'FundingProfileRules',
] as const;

const parseFieldRules = (field: string): FieldRules | null => {
  try { return JSON.parse(field); } catch { return null; }
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => !disabled && onChange(!value)}
    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
      value ? 'bg-indigo-600' : 'bg-gray-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

// ── Field rules editor (read-only or editable) ────────────────────────────────
const FieldRulesEditor: React.FC<{
  rules: FieldRules;
  onChange?: (rules: FieldRules) => void;
}> = ({ rules, onChange }) => {
  const readOnly = !onChange;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  const setProjectField = (field: string, value: boolean) =>
    onChange?.({ ...rules, ProjectDetailsRules: { ...rules.ProjectDetailsRules, [field]: value } });

  const setSectionField = (section: keyof Omit<FieldRules, 'ProjectDetailsRules'>, field: string, value: boolean) => {
    const sec = rules[section] as SectionWithCrud;
    onChange?.({ ...rules, [section]: { ...sec, Fields: { ...sec.Fields, [field]: value } } });
  };

  const setSectionCrud = (section: keyof Omit<FieldRules, 'ProjectDetailsRules'>, key: 'CanAdd' | 'CanDelete', value: boolean) => {
    const sec = rules[section] as SectionWithCrud;
    onChange?.({ ...rules, [section]: { ...sec, CRUD: { ...sec.CRUD, [key]: value } } });
  };

  return (
    <div className="space-y-1.5">
      {/* ProjectDetailsRules — flat boolean map */}
      {(() => {
        const isOpen = expanded['ProjectDetailsRules'] ?? false;
        const fields = rules.ProjectDetailsRules ?? {};
        const trueCount = Object.values(fields).filter(Boolean).length;
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button type="button" onClick={() => toggle('ProjectDetailsRules')}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700">
              <span className="flex items-center gap-1.5">
                {isOpen ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                {SECTION_LABELS['ProjectDetailsRules']}
              </span>
              <span className="text-xs font-normal text-gray-400">{trueCount} / {Object.keys(fields).length} editable</span>
            </button>
            {isOpen && (
              <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                {Object.entries(fields).map(([field, val]) => (
                  <div key={field} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 font-mono truncate">{field}</span>
                    <Toggle value={val} onChange={v => setProjectField(field, v)} disabled={readOnly} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Sections with Fields + CRUD */}
      {CRUD_SECTIONS.map(key => {
        const sec = rules[key] as SectionWithCrud | undefined;
        if (!sec) return null;
        const isOpen = expanded[key] ?? false;
        const trueCount = Object.values(sec.Fields ?? {}).filter(Boolean).length;
        return (
          <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
            <button type="button" onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700">
              <span className="flex items-center gap-1.5">
                {isOpen ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                {SECTION_LABELS[key]}
              </span>
              <span className="text-xs font-normal text-gray-400">
                {trueCount} / {Object.keys(sec.Fields ?? {}).length} editable
                {sec.CRUD?.CanAdd && ' · Can Add'}
                {sec.CRUD?.CanDelete && ' · Can Delete'}
              </span>
            </button>
            {isOpen && (
              <div className="px-3 py-2 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                  {Object.entries(sec.Fields ?? {}).map(([field, val]) => (
                    <div key={field} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-600 font-mono truncate">{field}</span>
                      <Toggle value={val} onChange={v => setSectionField(key, field, v)} disabled={readOnly} />
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-2 flex items-center gap-6">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">CRUD</span>
                  <div className="flex items-center gap-2">
                    <Toggle value={sec.CRUD?.CanAdd ?? false} onChange={v => setSectionCrud(key, 'CanAdd', v)} disabled={readOnly} />
                    <span className="text-xs text-gray-600">Can Add</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle value={sec.CRUD?.CanDelete ?? false} onChange={v => setSectionCrud(key, 'CanDelete', v)} disabled={readOnly} />
                    <span className="text-xs text-gray-600">Can Delete</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'Terminated':      'bg-red-50 text-red-600 border-red-200',
  'Not-Yet Started': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'On-Going':        'bg-blue-50 text-blue-700 border-blue-200',
  'Completed':       'bg-green-50 text-green-700 border-green-200',
  'Packaged':        'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Unpackaged':      'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Edit form ─────────────────────────────────────────────────────────────────
interface EditForm {
  Reason: string;
  RevisionGroupId: number;
  ReasonId: number;
  PCMA_Status: string;
  Package_Status: string;
  fieldRules: FieldRules | null;
}

const CODE = 'RevisionRules';

const RevisionFieldPermissionTable: React.FC = () => {
  const { data: codeTableData, loading: isLoading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const [data, setData] = useState<RevisionRules[]>([]);
  const [filteredData, setFilteredData] = useState<RevisionRules[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ Reason: '', RevisionGroupId: 0, ReasonId: 0, PCMA_Status: '', Package_Status: '', fieldRules: null });
  const [viewFieldId, setViewFieldId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const confirm = useConfirmDialog();
  const itemsPerPage = 15;

  useEffect(() => {
    const rules = codeTableData?.RevisionRules ?? [];
    setData(rules);
    setFilteredData(rules);
  }, [codeTableData]);

  useEffect(() => {
    let filtered = data;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.Reason?.toLowerCase().includes(lower) ||
        d.PCMA_Status?.toLowerCase().includes(lower) ||
        d.Package_Status?.toLowerCase().includes(lower)
      );
    }
    if (sortColumn !== null && sortDirection !== null) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (sortColumn) {
          case 0: aVal = a.Id; bVal = b.Id; break;
          case 1: aVal = a.Reason ?? ''; bVal = b.Reason ?? ''; break;
          case 2: aVal = a.PCMA_Status ?? ''; bVal = b.PCMA_Status ?? ''; break;
          case 3: aVal = a.Package_Status ?? ''; bVal = b.Package_Status ?? ''; break;
          default: return 0;
        }
        if (aVal < bVal) return sortDirection === 0 ? -1 : 1;
        if (aVal > bVal) return sortDirection === 0 ? 1 : -1;
        return 0;
      });
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [data, searchTerm, sortColumn, sortDirection]);

  const handleSort = useCallback((col: number) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 0 ? 1 : (prev === 1 ? null : 0));
    } else {
      setSortColumn(col);
      setSortDirection(0);
    }
  }, [sortColumn]);

  const startEdit = (item: RevisionRules) => {
    setEditId(item.Id);
    setEditForm({
      Reason: item.Reason,
      RevisionGroupId: item.RevisionGroupId,
      ReasonId: item.ReasonId,
      PCMA_Status: item.PCMA_Status,
      Package_Status: item.Package_Status,
      fieldRules: parseFieldRules(item.Field),
    });
    setViewFieldId(null);
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    try {
      await updateCodeTable(CODE, 1, JSON.stringify({
        Id: editId,
        Reason: editForm.Reason,
        RevisionGroupId: editForm.RevisionGroupId,
        ReasonId: editForm.ReasonId,
        PCMA_Status: editForm.PCMA_Status,
        Package_Status: editForm.Package_Status,
        Field: JSON.stringify(editForm.fieldRules),
      }));
      showToast({ type: 'success', message: 'Field permission updated.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to update field permission.' });
    }
    cancelEdit();
  };

  const confirmDelete = async (id: number) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify({ Id: id }));
      showToast({ type: 'success', message: 'Field permission deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete field permission.' });
    }
    setDeleteConfirmId(null);
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Revision Field Permission',
      fields: [
        { label: 'Reason',         value: editForm.Reason },
        { label: 'PCMA Status',    value: editForm.PCMA_Status },
        { label: 'Package Status', value: editForm.Package_Status },
      ],
      onConfirm: () => { saveEdit(); confirm.close(); },
    });
  };

  const inp = (extra = 'w-full') =>
    `${extra} px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none border-amber-300 focus:ring-amber-500`;

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const pageData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading revision rules...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Revision Field Permission</h4>
          <p className="text-sm text-gray-500 mt-0.5">Rules defining which fields can be edited per revision reason and project status</p>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search reason or status..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-60"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(0)}>ID</TableHeader>
              <TableHeader className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(1)}>Reason</TableHeader>
              <TableHeader className="w-36 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(2)}>PCMA Status</TableHeader>
              <TableHeader className="w-36 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(3)}>Package Status</TableHeader>
              <TableHeader className="w-28">Field Rules</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              pageData.map(item => {
                const fieldRules = parseFieldRules(item.Field);
                const isEditing = editId === item.Id;
                const isViewing = viewFieldId === item.Id;
                return (
                  <React.Fragment key={item.Id}>
                    <TableRow className={isEditing ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                      <TableCell className="font-mono text-xs text-gray-500">{item.Id}</TableCell>

                      {isEditing ? (
                        <>
                          <TableCell>
                            <textarea autoFocus value={editForm.Reason} onChange={e => setEditForm(f => ({ ...f, Reason: e.target.value }))} rows={2} className={inp()} />
                          </TableCell>
                          <TableCell>
                            <input value={editForm.PCMA_Status} onChange={e => setEditForm(f => ({ ...f, PCMA_Status: e.target.value }))} className={inp()} />
                          </TableCell>
                          <TableCell>
                            <input value={editForm.Package_Status} onChange={e => setEditForm(f => ({ ...f, Package_Status: e.target.value }))} className={inp()} />
                          </TableCell>
                          <TableCell className="text-xs text-gray-400 italic align-middle">↓ edit below</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button color="amber" className="p-1.5" onClick={requestEdit}><CheckIcon className="h-3.5 w-3.5" /></Button>
                              <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-sm text-gray-900" title={item.Reason}>{item.Reason}</TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[item.PCMA_Status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {item.PCMA_Status || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[item.Package_Status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {item.Package_Status || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => setViewFieldId(isViewing ? null : item.Id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 whitespace-nowrap"
                            >
                              {isViewing ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                              View Rules
                            </button>
                          </TableCell>
                          <TableCell>
                            {deleteConfirmId === item.Id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-red-600">Delete?</span>
                                <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item.Id)}>Yes</Button>
                                <Button color="zinc" className="px-2 py-1 text-xs" onClick={() => setDeleteConfirmId(null)}>No</Button>
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                                <Button color="red" className="p-1.5" onClick={() => setDeleteConfirmId(item.Id)}><TrashIcon className="h-3.5 w-3.5" /></Button>
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>

                    {/* Expandable field-rules panel */}
                    {(isViewing || isEditing) && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-slate-50 px-6 pb-5 pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                            Field Permissions {isEditing ? '— toggle to edit' : '— read only'}
                          </p>
                          {isEditing ? (
                            editForm.fieldRules
                              ? <FieldRulesEditor rules={editForm.fieldRules} onChange={fieldRules => setEditForm(f => ({ ...f, fieldRules }))} />
                              : <p className="text-xs text-red-500">Could not parse field rules JSON.</p>
                          ) : (
                            fieldRules
                              ? <FieldRulesEditor rules={fieldRules} />
                              : <p className="text-xs text-red-500">Could not parse field rules JSON.</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {filteredData.length === 0 ? '0' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredData.length)}`} of {filteredData.length} records
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

export default RevisionFieldPermissionTable;
