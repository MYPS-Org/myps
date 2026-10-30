import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ModificationCategoryReason } from '../../Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';
import { revisionGroupName } from './revisionColumns';

const CODE = 'RevisionReasons';

interface EditForm { Reason: string; RevisionGroupId: number; ReasonId: number; }
interface AddForm { Reason: string; RevisionGroupId: number; }
const EMPTY_ADD_FORM: AddForm = { Reason: '', RevisionGroupId: 0 };

const ModificationReasonTable: React.FC = () => {
  const { data: codeTableData, loading: isLoading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const [data, setData] = useState<ModificationCategoryReason[]>([]);
  const [filteredData, setFilteredData] = useState<ModificationCategoryReason[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ Reason: '', RevisionGroupId: 0, ReasonId: 0 });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<AddForm | null>(null);
  const confirm = useConfirmDialog();
  const itemsPerPage = 15;

  const revisionHeaders = useMemo(
    () => (codeTableData?.RevisionHeaders ?? []) as { Id: number; RevisionName: string; RevisionGroupId: number }[],
    [codeTableData]
  );

  useEffect(() => {
    const reasons = (codeTableData?.Reasons ?? []) as ModificationCategoryReason[];
    setData(reasons);
    setFilteredData(reasons);
  }, [codeTableData]);

  useEffect(() => {
    let filtered = data;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.Reason.toLowerCase().includes(lower) ||
        revisionGroupName(revisionHeaders, d.RevisionGroupId).toLowerCase().includes(lower)
      );
    }
    if (sortColumn !== null && sortDirection !== null) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (sortColumn) {
          case 0: aVal = a.Id; bVal = b.Id; break;
          case 1: aVal = a.RevisionGroupId; bVal = b.RevisionGroupId; break;
          case 2: aVal = a.ReasonId; bVal = b.ReasonId; break;
          case 3: aVal = a.Reason.toLowerCase(); bVal = b.Reason.toLowerCase(); break;
          default: return 0;
        }
        if (aVal < bVal) return sortDirection === 0 ? -1 : 1;
        if (aVal > bVal) return sortDirection === 0 ? 1 : -1;
        return 0;
      });
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [data, searchTerm, sortColumn, sortDirection, revisionHeaders]);

  const handleSort = useCallback((col: number) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 0 ? 1 : (prev === 1 ? null : 0));
    } else {
      setSortColumn(col);
      setSortDirection(0);
    }
  }, [sortColumn]);

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Revision Reason',
      fields: [
        { label: 'Group', value: revisionHeaders.find(h => h.RevisionGroupId === addForm.RevisionGroupId)?.RevisionName ?? String(addForm.RevisionGroupId) },
        { label: 'Reason', value: addForm.Reason },
      ],
      onConfirm: async () => {
        try {
          // Revisions only offer active reasons, so a new reason must be created active.
          await updateCodeTable(CODE, 0, JSON.stringify({ ...addForm, IsActive: true }));
          showToast({ type: 'success', message: 'Revision reason added.' });
          await refetch();
        } catch (error) {
          // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
          if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to add revision reason.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const startEdit = (item: ModificationCategoryReason) => {
    setEditId(item.Id);
    setEditForm({ Reason: item.Reason, RevisionGroupId: item.RevisionGroupId, ReasonId: item.ReasonId });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: ModificationCategoryReason) => {
    const currentActive = item.IsActive !== false;
    const nextActive = !currentActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Modification Reason',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Reason', value: item.Reason },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ ...item, IsActive: nextActive }));
          showToast({ type: 'success', message: `Modification reason ${nextActive ? 'activated' : 'deactivated'}.` });
          await refetch();
        } catch (error) {
          // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
          if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to update active status.' });
        }
        confirm.close();
      },
    });
  };

  const saveEdit = async () => {
    try {
      // Start from the stored row: CategoryId and IsActive are not on the form, and leaving them
      // out made the server clear the categories and deactivate the reason on every edit.
      const original = data.find(r => r.Id === editId);
      await updateCodeTable(CODE, 1, JSON.stringify({ ...original, ...editForm, Id: editId }));
      showToast({ type: 'success', message: 'Modification reason updated.' });
      await refetch();
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to update modification reason.' });
    }
    cancelEdit();
  };
  const confirmDelete = async (payload: ModificationCategoryReason) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Modification reason deleted.' });
      await refetch();
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to delete modification reason.' });
    }
    setDeleteConfirmId(null);
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Revision Reason',
      fields: [
        { label: 'Revision Group', value: revisionGroupName(revisionHeaders, editForm.RevisionGroupId) },
        { label: 'Reason',     value: editForm.Reason },
      ],
      onConfirm: async () => { await saveEdit(); confirm.close(); },
    });
  };

  const inp = (mode: 'add' | 'edit' = 'edit', extra = 'w-full') =>
    `${extra} px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${
      mode === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
    }`;

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
          <span className="text-sm">Loading modification reasons...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Modification Reason</h4>
          <p className="text-sm text-gray-500 mt-0.5">Specific reasons that justify project revisions per category</p>
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
          <Button color="indigo" className="flex items-center gap-1 text-sm"
            onClick={() => setAddForm(EMPTY_ADD_FORM)} disabled={!!addForm}>
            <PlusIcon className="h-4 w-4" /> Add Reason
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(0)}>ID</TableHeader>
              <TableHeader className="w-56 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(1)}>Revision Group</TableHeader>
              <TableHeader className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(3)}>Reason</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {addForm !== null && (
              <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                <TableCell><span className="font-mono text-xs text-gray-400 px-2">auto</span></TableCell>
                <TableCell>
                  <select
                    autoFocus
                    value={addForm.RevisionGroupId || ''}
                    onChange={e => setAddForm(f => f && ({ ...f, RevisionGroupId: +e.target.value }))}
                    className={inp('add')}
                  >
                    <option value="">— Select Header —</option>
                    {revisionHeaders.map(h => (
                      <option key={h.Id} value={h.RevisionGroupId}>{h.RevisionName}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <textarea
                    value={addForm.Reason}
                    onChange={e => setAddForm(f => f && ({ ...f, Reason: e.target.value }))}
                    rows={2}
                    placeholder="Reason text *"
                    className={inp('add')}
                  />
                </TableCell>
                <TableCell />
                <TableCell>
                  <div className="flex gap-1">
                    <Button color="indigo" className="p-1.5" onClick={requestAdd}
                      disabled={!addForm.Reason.trim() || !addForm.RevisionGroupId}>
                      <CheckIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {pageData.length === 0 && !addForm ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              pageData.map(item => (
                <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.Id}</TableCell>
                  {editId === item.Id ? (
                    <>
                      <TableCell>
                        <select
                          autoFocus
                          value={editForm.RevisionGroupId}
                          onChange={e => setEditForm(f => ({ ...f, RevisionGroupId: +e.target.value }))}
                          className={inp('edit', 'w-full')}
                        >
                          <option value="">— Select Header —</option>
                          {revisionHeaders.map(h => (
                            <option key={h.Id} value={h.RevisionGroupId}>{h.RevisionName}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell><textarea value={editForm.Reason} onChange={e => setEditForm(f => ({ ...f, Reason: e.target.value }))} rows={3} className={inp()} /></TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${
                          item.IsActive !== false
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-300'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${item.IsActive !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {item.IsActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button color="amber" className="p-1.5" onClick={requestEdit}><CheckIcon className="h-3.5 w-3.5" /></Button>
                          <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        {/* The group's name, not its bare number; Reason ID is an internal number and is not shown. */}
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{revisionGroupName(revisionHeaders, item.RevisionGroupId)}</span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-900" title={item.Reason}>{item.Reason}</TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => requestToggleActive(item)}
                          title={item.IsActive !== false ? 'Click to deactivate' : 'Click to activate'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer transition-colors shadow-sm ${
                            item.IsActive !== false
                              ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                              : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${item.IsActive !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {item.IsActive !== false ? 'Active' : 'Inactive'}
                        </button>
                      </TableCell>
                      <TableCell>
                        {deleteConfirmId === item.Id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Delete?</span>
                            <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item)}>Yes</Button>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {filteredData.length === 0 ? '0' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredData.length)}`} of {filteredData.length} records
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>
              Previous
            </Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default ModificationReasonTable;
