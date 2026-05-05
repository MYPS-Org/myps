import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { SourceEnum } from '../../../Project/Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'FundingSource';
type NatureFilter = 'All' | 'Local' | 'Foreign';

interface FormState { Organization: string; Name: string; Nature: string; }
const EMPTY_FORM: FormState = { Organization: '', Name: '', Nature: 'Local' };

const inp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

const FundingSourceTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [natureFilter, setNatureFilter] = useState<NatureFilter>('All');
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();

  const data: SourceEnum[] = codeTableData?.FundingSources ?? [];
  const filtered = data.filter(item => {
    const matchSearch =
      item.Organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchNature = natureFilter === 'All' || item.Nature === natureFilter;
    return matchSearch && matchNature;
  });

  const startEdit = (item: SourceEnum) => {
    setEditId(item.Id);
    setEditForm({ Organization: item.Organization, Name: item.Name, Nature: item.Nature ?? 'Local' });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Funding Source',
      fields: [
        { label: 'Organization', value: addForm.Organization, mono: true },
        { label: 'Description',  value: addForm.Name },
        { label: 'Nature',       value: addForm.Nature },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify(addForm));
          showToast({ type: 'success', message: 'Funding source added successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to add funding source.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Funding Source',
      fields: [
        { label: 'Organization', value: editForm.Organization, mono: true },
        { label: 'Description',  value: editForm.Name },
        { label: 'Nature',       value: editForm.Nature },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm }));
          showToast({ type: 'success', message: 'Funding source updated successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update funding source.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (payload: SourceEnum) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Funding source deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete funding source.' });
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Funding Source</h4>
          <p className="text-sm text-gray-500 mt-0.5">Organizations and institutions that fund project activities</p>
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
            {(['All', 'Local', 'Foreign'] as NatureFilter[]).map(n => (
              <button
                key={n}
                onClick={() => setNatureFilter(n)}
                className={`px-3 py-2 transition-colors ${natureFilter === n ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button color="indigo" className="flex items-center gap-1 text-sm" onClick={() => setAddForm(EMPTY_FORM)} disabled={!!addForm}>
            <PlusIcon className="h-4 w-4" /> Add Source
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-28">Organization</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader className="w-24 text-center">Nature</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {addForm !== null && (
                  <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                    <TableCell className="text-xs text-gray-400 italic">New</TableCell>
                    <TableCell><textarea autoFocus value={addForm.Organization} onChange={e => setAddForm(f => f ? { ...f, Organization: e.target.value } : f)} placeholder="Org code..." rows={1} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.Name} onChange={e => setAddForm(f => f ? { ...f, Name: e.target.value } : f)} placeholder="Description..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell>
                      <select value={addForm.Nature} onChange={e => setAddForm(f => f ? { ...f, Nature: e.target.value } : f)} className={inp('add')}>
                        <option value="Local">Local</option>
                        <option value="Foreign">Foreign</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd} disabled={!addForm.Organization.trim() || !addForm.Name.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.length === 0 && !addForm ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-gray-500">No records found.</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    <TableCell className="font-mono text-xs text-gray-500">{item.Id}</TableCell>
                    {editId === item.Id ? (
                      <>
                        <TableCell><textarea autoFocus value={editForm.Organization} onChange={e => setEditForm(f => ({ ...f, Organization: e.target.value }))} rows={1} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.Name} onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))} rows={2} className={inp('edit')} /></TableCell>
                        <TableCell>
                          <select value={editForm.Nature} onChange={e => setEditForm(f => ({ ...f, Nature: e.target.value }))} className={inp('edit')}>
                            <option value="Local">Local</option>
                            <option value="Foreign">Foreign</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="amber" className="p-1.5" onClick={requestEdit} disabled={!editForm.Organization.trim() || !editForm.Name.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <span className="font-mono text-sm font-bold text-indigo-700">{item.Organization}</span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-900 max-w-xs truncate" title={item.Name}>{item.Name}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                            item.Nature === 'Foreign'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {item.Nature ?? '—'}
                          </span>
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
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">
        {filtered.length} record(s) · {filtered.filter(d => d.Nature === 'Local').length} local · {filtered.filter(d => d.Nature === 'Foreign').length} foreign
      </p>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default FundingSourceTable;