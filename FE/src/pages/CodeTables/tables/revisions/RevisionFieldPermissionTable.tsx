import React, { useEffect, useState, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { RevisionRules } from '../../Model.d';
import { fetchRevisionRules } from '../../Service';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const STATUS_COLORS: Record<string, string> = {
  'Completed': 'bg-green-50 text-green-700 border-green-200',
  'Terminated': 'bg-red-50 text-red-600 border-red-200',
  'Not-Yet Started': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'On-Going': 'bg-blue-50 text-blue-700 border-blue-200',
};

const RevisionFieldPermissionTable: React.FC = () => {
  const [data, setData] = useState<RevisionRules[]>([]);
  const [filteredData, setFilteredData] = useState<RevisionRules[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<RevisionRules>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const confirm = useConfirmDialog();
  const itemsPerPage = 15;

  useEffect(() => {
    fetchRevisionRules()
      .then(res => {
        setData(res.Data);
        setFilteredData(res.Data);
      })
      .catch(err => console.error('Error fetching revision rules:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const uniqueCategories = [...new Set(data.map(d => d.Category))].filter(Boolean);

  useEffect(() => {
    let filtered = data;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.Category?.toLowerCase().includes(lower) ||
        d.Reason?.toLowerCase().includes(lower) ||
        d.Field?.toLowerCase().includes(lower)
      );
    }
    if (selectedCategory) {
      filtered = filtered.filter(d => d.Category === selectedCategory);
    }
    if (sortColumn !== null && sortDirection !== null) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (sortColumn) {
          case 0: aVal = a.Id; bVal = b.Id; break;
          case 1: aVal = a.Category; bVal = b.Category; break;
          case 2: aVal = a.Reason; bVal = b.Reason; break;
          case 3: aVal = a.PCMAStatus; bVal = b.PCMAStatus; break;
          case 4: aVal = a.PackageStatus; bVal = b.PackageStatus; break;
          default: return 0;
        }
        if (aVal < bVal) return sortDirection === 0 ? -1 : 1;
        if (aVal > bVal) return sortDirection === 0 ? 1 : -1;
        return 0;
      });
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [data, searchTerm, selectedCategory, sortColumn, sortDirection]);

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
    setEditForm({ Category: item.Category, Reason: item.Reason, PCMAStatus: item.PCMAStatus, PackageStatus: item.PackageStatus, Field: item.Field });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = () => {
    setData(prev => prev.map(r => r.Id === editId ? { ...r, ...editForm } as RevisionRules : r));
    // TODO: PATCH /codetable/revisionrules/{editId}
    cancelEdit();
  };
  const confirmDelete = (id: number) => {
    setData(prev => prev.filter(r => r.Id !== id));
    // TODO: DELETE /codetable/revisionrules/{id}
    setDeleteConfirmId(null);
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Revision Field Permission',
      fields: [
        { label: 'Category',       value: editForm.Category ?? '' },
        { label: 'Reason',         value: editForm.Reason ?? '' },
        { label: 'PCMA Status',    value: editForm.PCMAStatus ?? '' },
        { label: 'Package Status', value: editForm.PackageStatus ?? '' },
        { label: 'Field',          value: editForm.Field ?? '', mono: true },
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Revision Field Permission</h4>
          <p className="text-sm text-gray-500 mt-0.5">Rules defining which fields can be edited per revision category and PCMA/package status</p>
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
          {uniqueCategories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <Button color="indigo" className="flex items-center gap-1 text-sm">
            <PlusIcon className="h-4 w-4" /> Add Rule
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12 cursor-pointer hover:bg-gray-100" onClick={() => handleSort(0)}>ID</TableHeader>
              <TableHeader className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(1)}>Category</TableHeader>
              <TableHeader className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(2)}>Reason</TableHeader>
              <TableHeader className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(3)}>PCMA Status</TableHeader>
              <TableHeader className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(4)}>Package Status</TableHeader>
              <TableHeader>Field</TableHeader>
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
                      <TableCell><textarea autoFocus value={editForm.Category ?? ''} onChange={e => setEditForm(f => ({ ...f, Category: e.target.value }))} rows={2} className={inp()} /></TableCell>
                      <TableCell><textarea value={editForm.Reason ?? ''} onChange={e => setEditForm(f => ({ ...f, Reason: e.target.value }))} rows={2} className={inp()} /></TableCell>
                      <TableCell><textarea value={editForm.PCMAStatus ?? ''} onChange={e => setEditForm(f => ({ ...f, PCMAStatus: e.target.value }))} rows={2} className={inp()} /></TableCell>
                      <TableCell><textarea value={editForm.PackageStatus ?? ''} onChange={e => setEditForm(f => ({ ...f, PackageStatus: e.target.value }))} rows={2} className={inp()} /></TableCell>
                      <TableCell><textarea value={editForm.Field ?? ''} onChange={e => setEditForm(f => ({ ...f, Field: e.target.value }))} rows={2} className={`${inp()} font-mono`} /></TableCell>
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
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                          {item.Category}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-900 max-w-[150px] truncate" title={item.Reason ?? ''}>{item.Reason}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[item.PCMAStatus] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {item.PCMAStatus}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[item.PackageStatus] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {item.PackageStatus}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-gray-700">{item.Field}</TableCell>
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
