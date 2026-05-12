import React, { useEffect, useState, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ModificationCategoryReason } from '../../Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'ModificationReason';

interface EditForm { Reason: string; RevisionGroupId: number; ReasonId: number; IsDeleted: boolean; }

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
  const [editForm, setEditForm] = useState<EditForm>({ Reason: '', RevisionGroupId: 0, ReasonId: 0, IsDeleted: false });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const confirm = useConfirmDialog();
  const itemsPerPage = 15;

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
        String(d.RevisionGroupId).includes(lower) ||
        String(d.ReasonId).includes(lower)
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
  }, [data, searchTerm, sortColumn, sortDirection]);

  const handleSort = useCallback((col: number) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 0 ? 1 : (prev === 1 ? null : 0));
    } else {
      setSortColumn(col);
      setSortDirection(0);
    }
  }, [sortColumn]);

  const startEdit = (item: ModificationCategoryReason) => {
    setEditId(item.Id);
    setEditForm({ Reason: item.Reason, RevisionGroupId: item.RevisionGroupId, ReasonId: item.ReasonId, IsDeleted: item.IsDeleted });
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
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: item.Id, Reason: item.Reason, RevisionGroupId: item.RevisionGroupId, ReasonId: item.ReasonId, IsDeleted: item.IsDeleted, IsActive: nextActive }));
          showToast({ type: 'success', message: `Modification reason ${nextActive ? 'activated' : 'deactivated'}.` });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update active status.' });
        }
        confirm.close();
      },
    });
  };

  const saveEdit = async () => {
    try {
      await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm }));
      showToast({ type: 'success', message: 'Modification reason updated.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to update modification reason.' });
    }
    cancelEdit();
  };
  const confirmDelete = async (payload: ModificationCategoryReason) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Modification reason deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete modification reason.' });
    }
    setDeleteConfirmId(null);
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Revision Reason',
      fields: [
        { label: 'Group ID',   value: editForm.RevisionGroupId, mono: true },
        { label: 'Reason ID',  value: editForm.ReasonId,        mono: true },
        { label: 'Reason',     value: editForm.Reason },
        { label: 'Status',     value: editForm.IsDeleted ? 'Deleted' : 'Active' },
      ],
      onConfirm: async () => { await saveEdit(); confirm.close(); },
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
          <Button color="indigo" className="flex items-center gap-1 text-sm">
            <PlusIcon className="h-4 w-4" /> Add Reason
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(0)}>ID</TableHeader>
              <TableHeader className="w-28 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(1)}>Group ID</TableHeader>
              <TableHeader className="w-24 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(2)}>Reason ID</TableHeader>
              <TableHeader className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(3)}>Reason</TableHeader>
              <TableHeader className="w-24 text-center">Status</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              pageData.map(item => (
                <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.Id}</TableCell>
                  {editId === item.Id ? (
                    <>
                      <TableCell><input autoFocus type="number" value={editForm.RevisionGroupId} onChange={e => setEditForm(f => ({ ...f, RevisionGroupId: +e.target.value }))} className={inp('w-20')} /></TableCell>
                      <TableCell><input type="number" value={editForm.ReasonId} onChange={e => setEditForm(f => ({ ...f, ReasonId: +e.target.value }))} className={inp('w-20')} /></TableCell>
                      <TableCell><textarea value={editForm.Reason} onChange={e => setEditForm(f => ({ ...f, Reason: e.target.value }))} rows={3} className={inp()} /></TableCell>
                      <TableCell>
                        <select value={editForm.IsDeleted ? '1' : '0'} onChange={e => setEditForm(f => ({ ...f, IsDeleted: e.target.value === '1' }))} className={inp()}>
                          <option value="0">Active</option>
                          <option value="1">Deleted</option>
                        </select>
                      </TableCell>
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
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.RevisionGroupId}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{item.ReasonId}</TableCell>
                      <TableCell className="text-sm text-gray-900" title={item.Reason}>{item.Reason}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                          !item.IsDeleted
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {item.IsDeleted ? 'Deleted' : 'Active'}
                        </span>
                      </TableCell>
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
