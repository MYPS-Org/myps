import React, { useEffect, useState, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ModificationCategoryReason } from '../../Model.d';
import { fetchRevisionReasons } from '../../Service';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

type StatusFilter = 'all' | 'active' | 'obsolete';

interface EditForm { codeGroupId: number; codeDescription: string; sequenceNo: number; obsoleteFlag: number; }

const ModificationReasonTable: React.FC = () => {
  const [data, setData] = useState<ModificationCategoryReason[]>([]);
  const [filteredData, setFilteredData] = useState<ModificationCategoryReason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ codeGroupId: 0, codeDescription: '', sequenceNo: 0, obsoleteFlag: 0 });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const confirm = useConfirmDialog();
  const itemsPerPage = 15;

  useEffect(() => {
    fetchRevisionReasons()
      .then(res => {
        setData(res.Data);
        setFilteredData(res.Data);
      })
      .catch(err => console.error('Error fetching modification reasons:', err))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    let filtered = data;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.codeDescription.toLowerCase().includes(lower) ||
        String(d.codeGroupId).includes(lower)
      );
    }
    if (statusFilter !== 'all') {
      const flag = statusFilter === 'active' ? 0 : 1;
      filtered = filtered.filter(d => d.obsoleteFlag === flag);
    }
    if (sortColumn !== null && sortDirection !== null) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (sortColumn) {
          case 0: aVal = a.id; bVal = b.id; break;
          case 1: aVal = a.codeGroupId; bVal = b.codeGroupId; break;
          case 2: aVal = a.codeDescription.toLowerCase(); bVal = b.codeDescription.toLowerCase(); break;
          case 3: aVal = a.sequenceNo; bVal = b.sequenceNo; break;
          default: return 0;
        }
        if (aVal < bVal) return sortDirection === 0 ? -1 : 1;
        if (aVal > bVal) return sortDirection === 0 ? 1 : -1;
        return 0;
      });
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [data, searchTerm, statusFilter, sortColumn, sortDirection]);

  const handleSort = useCallback((col: number) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 0 ? 1 : (prev === 1 ? null : 0));
    } else {
      setSortColumn(col);
      setSortDirection(0);
    }
  }, [sortColumn]);

  const startEdit = (item: ModificationCategoryReason) => {
    setEditId(item.id);
    setEditForm({ codeGroupId: item.codeGroupId, codeDescription: item.codeDescription, sequenceNo: item.sequenceNo, obsoleteFlag: item.obsoleteFlag });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = () => {
    setData(prev => prev.map(r => r.id === editId ? { ...r, ...editForm } : r));
    // TODO: PATCH /codetable/modificationreasons/{editId}
    cancelEdit();
  };
  const confirmDelete = (id: number) => {
    setData(prev => prev.filter(r => r.id !== id));
    // TODO: DELETE /codetable/modificationreasons/{id}
    setDeleteConfirmId(null);
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Modification Reason',
      fields: [
        { label: 'Group ID',    value: editForm.codeGroupId,    mono: true },
        { label: 'Description', value: editForm.codeDescription },
        { label: 'Seq No',      value: editForm.sequenceNo },
        { label: 'Status',      value: editForm.obsoleteFlag === 0 ? 'Active' : 'Obsolete' },
      ],
      onConfirm: () => { saveEdit(); confirm.close(); },
    });
  };

  const inp = (v: 'edit', extra = 'w-full') =>
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
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {(['all', 'active', 'obsolete'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 capitalize transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {s}
              </button>
            ))}
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
              <TableHeader className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(2)}>Description</TableHeader>
              <TableHeader className="w-24 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort(3)}>Seq No</TableHeader>
              <TableHeader className="w-24 text-center">Status</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              pageData.map(item => (
                <TableRow key={item.id} className={editId === item.id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.id}</TableCell>
                  {editId === item.id ? (
                    <>
                      <TableCell><input autoFocus type="number" value={editForm.codeGroupId} onChange={e => setEditForm(f => ({ ...f, codeGroupId: +e.target.value }))} className={inp('edit', 'w-20')} /></TableCell>
                      <TableCell><textarea value={editForm.codeDescription} onChange={e => setEditForm(f => ({ ...f, codeDescription: e.target.value }))} rows={3} className={inp('edit')} /></TableCell>
                      <TableCell className="text-center"><input type="number" value={editForm.sequenceNo} onChange={e => setEditForm(f => ({ ...f, sequenceNo: +e.target.value }))} className={inp('edit', 'w-16')} /></TableCell>
                      <TableCell>
                        <select value={editForm.obsoleteFlag} onChange={e => setEditForm(f => ({ ...f, obsoleteFlag: +e.target.value }))} className={inp('edit')}>
                          <option value={0}>Active</option>
                          <option value={1}>Obsolete</option>
                        </select>
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
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.codeGroupId}</span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-900 max-w-xs truncate" title={item.codeDescription}>{item.codeDescription}</TableCell>
                      <TableCell className="text-center text-sm text-gray-600">{item.sequenceNo}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                          item.obsoleteFlag === 0
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {item.obsoleteFlag === 0 ? 'Active' : 'Obsolete'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Delete?</span>
                            <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item.id)}>Yes</Button>
                            <Button color="zinc" className="px-2 py-1 text-xs" onClick={() => setDeleteConfirmId(null)}>No</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="red" className="p-1.5" onClick={() => setDeleteConfirmId(item.id)}><TrashIcon className="h-3.5 w-3.5" /></Button>
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
