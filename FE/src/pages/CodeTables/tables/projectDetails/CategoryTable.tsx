import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import {
  PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import type { CategoryEnum } from '../../../Project/Model.d';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';
import { updateCodeTable } from '../../Service';
import { useCodeTableContext } from '../../CodeTableContext';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ValidityStatusFilters from './ValidityStatusFilters';
import { matchesValidityStatus, type StatusFilter, type ValidityFilter } from './validityStatusFilter';

const CODE = 'ProjectCategory';

interface FormState { CategoryName: string; Minimum: number; Maximum: number; ValidUntil: number; }
const EMPTY_FORM: FormState = { CategoryName: '', Minimum: 0, Maximum: 0, ValidUntil: new Date().getFullYear() };


const CategoryTable: React.FC = () => {
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const [editId, setEditId]            = useState<number | null>(null);
  const [editForm, setEditForm]        = useState<FormState>(EMPTY_FORM);
  const [addForm, setAddForm]          = useState<FormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [search, setSearch]            = useState('');
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('All');
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('All');
  const confirm                        = useConfirmDialog();
  const { showToast }                  = useToast();

  const rows: CategoryEnum[] = (codeTableData?.ProjectCategories ?? []) as CategoryEnum[];

  const filtered = rows.filter(r =>
    (
      (r.CategoryName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(r.CategoryId ?? '').toLowerCase().includes(search.toLowerCase())
    ) && matchesValidityStatus(r, validityFilter, statusFilter)
  );

  const startEdit = (r: CategoryEnum) => {
    setEditId(r.Id);
    setEditForm({ CategoryName: r.CategoryName ?? '', Minimum: r.Minimum, Maximum: r.Maximum, ValidUntil: r.ValidUntil });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: CategoryEnum) => {
    const currentActive = item.IsActive !== false;
    const nextActive = !currentActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Project Category',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Category', value: item.CategoryName ?? '' },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: item.Id, CategoryName: item.CategoryName, Minimum: item.Minimum, Maximum: item.Maximum, ValidUntil: item.ValidUntil, IsActive: nextActive }));
          showToast({ type: 'success', message: `Category ${nextActive ? 'activated' : 'deactivated'}.` });
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
      // Keep the row's Active state: the API reads a missing IsActive as false, so leaving it
      // out would quietly deactivate the category on every edit (#482, the #397 bug class).
      const original = rows.find(r => r.Id === editId);
      await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm, IsActive: original?.IsActive !== false }));
      showToast({ type: 'success', message: 'Category updated successfully.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to update category.' });
    }
    cancelEdit();
  };
  const saveAdd = async () => {
    if (!addForm) return;
    try {
      // A new Category starts Active: the API reads a missing IsActive as false (#482).
      await updateCodeTable(CODE, 0, JSON.stringify({ ...addForm, IsActive: true }));
      showToast({ type: 'success', message: 'Category added successfully.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to add category.' });
    }
    setAddForm(null);
  };
  const confirmDelete = async (payload: CategoryEnum) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Category deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete category.' });
    }
    setDeleteConfirmId(null);
  };

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Project Category',
      fields: [
        { label: 'Name',        value: addForm.CategoryName },
        { label: 'Min Amount',  value: addForm.Minimum },
        { label: 'Max Amount',  value: addForm.Maximum },
        { label: 'Valid Until', value: addForm.ValidUntil },
      ],
      onConfirm: () => { saveAdd(); confirm.close(); },
    });
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Project Category',
      fields: [
        { label: 'Name',        value: editForm.CategoryName },
        { label: 'Min Amount',  value: editForm.Minimum },
        { label: 'Max Amount',  value: editForm.Maximum },
        { label: 'Valid Until', value: editForm.ValidUntil },
      ],
      onConfirm: () => { saveEdit(); confirm.close(); },
    });
  };

  const numInp = (color: 'add' | 'edit') =>
    `px-2 py-1 text-sm border rounded w-28 focus:outline-none focus:ring-1 ${color === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;
  const txtInp = (color: 'add' | 'edit') =>
    `px-2 py-1 text-sm border rounded w-full focus:outline-none focus:ring-1 resize-none ${color === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Project Category</h4>
          <p className="text-sm text-gray-500 mt-0.5">Defines cost thresholds and validity for project categories</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52" />
          </div>
          <ValidityStatusFilters
            validity={validityFilter} onValidityChange={setValidityFilter}
            status={statusFilter} onStatusChange={setStatusFilter}
          />
          <Button color="indigo" className="flex items-center gap-1 text-sm" onClick={() => setAddForm(EMPTY_FORM)} disabled={!!addForm}>
            <PlusIcon className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader>Category ID</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Min Amount</TableHeader>
              <TableHeader>Max Amount</TableHeader>
              <TableHeader className="w-24">Valid Until</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10">
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>Loading...
                </div>
              </TableCell></TableRow>
            ) : (
              <>
                {addForm !== null && (
                  <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                    <TableCell className="text-xs text-gray-400 italic">New</TableCell>
                    <TableCell><span className="text-xs text-gray-400 italic px-1">auto</span></TableCell>
                    <TableCell><textarea autoFocus value={addForm.CategoryName} onChange={e => setAddForm(f => f ? { ...f, CategoryName: e.target.value } : f)} placeholder="Category name..." rows={2} className={txtInp('add')} /></TableCell>
                    <TableCell><input type="number" value={addForm.Minimum} onChange={e => setAddForm(f => f ? { ...f, Minimum: +e.target.value } : f)} className={numInp('add')} /></TableCell>
                    <TableCell><input type="number" value={addForm.Maximum} onChange={e => setAddForm(f => f ? { ...f, Maximum: +e.target.value } : f)} className={numInp('add')} /></TableCell>
                    <TableCell><input type="number" value={addForm.ValidUntil} onChange={e => setAddForm(f => f ? { ...f, ValidUntil: +e.target.value } : f)} className={numInp('add')} /></TableCell>
                    <TableCell />
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd}><CheckIcon className="h-3.5 w-3.5" /></Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.length === 0 && !addForm ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-400">No records found.</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    <TableCell><span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{item.Id}</span></TableCell>
                    {editId === item.Id ? (
                      <>
                        <TableCell><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.CategoryId}</span></TableCell>
                        <TableCell><textarea autoFocus value={editForm.CategoryName} onChange={e => setEditForm(f => ({ ...f, CategoryName: e.target.value }))} rows={2} className={txtInp('edit')} /></TableCell>
                        <TableCell><input type="number" value={editForm.Minimum} onChange={e => setEditForm(f => ({ ...f, Minimum: +e.target.value }))} className={numInp('edit')} /></TableCell>
                        <TableCell><input type="number" value={editForm.Maximum} onChange={e => setEditForm(f => ({ ...f, Maximum: +e.target.value }))} className={numInp('edit')} /></TableCell>
                        <TableCell><input type="number" value={editForm.ValidUntil} onChange={e => setEditForm(f => ({ ...f, ValidUntil: +e.target.value }))} className={numInp('edit')} /></TableCell>
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
                        <TableCell><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.CategoryId}</span></TableCell>
                        <TableCell className="text-sm font-medium text-gray-900 max-w-[150px] truncate" title={item.CategoryName}>{item.CategoryName}</TableCell>
                        <TableCell className="text-sm text-gray-600">{item.Minimum.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-gray-600">{item.Maximum.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-gray-600">{item.ValidUntil === 0 ? 'No expiry' : item.ValidUntil}</TableCell>
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
                            <div className="flex gap-1">
                              <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                              <Button color="red" className="p-1.5" onClick={() => setDeleteConfirmId(item.Id)}><TrashIcon className="h-3.5 w-3.5" /></Button>
                            </div>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{filtered.length} record(s)</p>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default CategoryTable;
