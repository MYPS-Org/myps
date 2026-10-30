import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import {
  PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import type { TableEnum } from '../../../Project/Model.d';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';
import { updateCodeTable } from '../../Service';
import { useCodeTableContext } from '../../CodeTableContext';
import { useToast } from '../../../../components/toaster/ToasterContext';

const CODE = 'ProjectOrigin';

interface FormState { Name: string; Description: string; }
const EMPTY_FORM: FormState = { Name: '', Description: '' };

const OriginTable: React.FC = () => {
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const [editId, setEditId]            = useState<number | null>(null);
  const [editForm, setEditForm]        = useState<FormState>(EMPTY_FORM);
  const [addForm, setAddForm]          = useState<FormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [search, setSearch]            = useState('');
  const confirm                        = useConfirmDialog();

  const rows: TableEnum[] = (codeTableData?.ProjectOrigins ?? []) as TableEnum[];

  const filtered = rows.filter(r =>
    r.Name.toLowerCase().includes(search.toLowerCase()) ||
    (r.Description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (r: TableEnum) => { setEditId(r.Id); setEditForm({ Name: r.Name, Description: r.Description ?? '' }); setDeleteConfirmId(null); };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: TableEnum) => {
    const currentActive = item.IsActive !== false;
    const nextActive = !currentActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Project Origin',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Name', value: item.Name },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: item.Id, Name: item.Name, Description: item.Description, IsActive: nextActive }));
          showToast({ type: 'success', message: `Origin ${nextActive ? 'activated' : 'deactivated'}.` });
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
      // IsActive is not on the form: send the row's current value, or the edit would retire it.
      const original = rows.find(r => r.Id === editId);
      await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm, IsActive: original?.IsActive !== false }));
      showToast({ type: 'success', message: 'Origin updated successfully.' });
      await refetch();
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to update origin.' });
    }
    cancelEdit();
  };
  const saveAdd = async () => {
    if (!addForm) return;
    try {
      // Created active, so it is offered in Add Project straight away.
      await updateCodeTable(CODE, 0, JSON.stringify({ ...addForm, IsActive: true }));
      showToast({ type: 'success', message: 'Origin added successfully.' });
      await refetch();
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to add origin.' });
    }
    setAddForm(null);
  };
  const confirmDelete = async (payload: TableEnum) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Origin deleted.' });
      await refetch();
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to delete origin.' });
    }
    setDeleteConfirmId(null);
  };

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Project Origin',
      fields: [
        { label: 'Name',        value: addForm.Name },
        { label: 'Description', value: addForm.Description, optional: true },
      ],
      onConfirm: () => { saveAdd(); confirm.close(); },
    });
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Project Origin',
      fields: [
        { label: 'Name',        value: editForm.Name },
        { label: 'Description', value: editForm.Description, optional: true },
      ],
      onConfirm: () => { saveEdit(); confirm.close(); },
    });
  };

  const inp = (v: 'add' | 'edit') =>
    `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Project Origin</h4>
          <p className="text-sm text-gray-500 mt-0.5">Defines the funding or initiative origin of a project</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52" />
          </div>
          <Button color="indigo" className="flex items-center gap-1 text-sm" onClick={() => setAddForm(EMPTY_FORM)} disabled={!!addForm}>
            <PlusIcon className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-16">ID</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10">
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
                    <TableCell><textarea autoFocus value={addForm.Name} onChange={e => setAddForm(f => f ? { ...f, Name: e.target.value } : f)} placeholder="Name..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.Description} onChange={e => setAddForm(f => f ? { ...f, Description: e.target.value } : f)} placeholder="Description..." rows={3} className={inp('add')} /></TableCell>
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
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-gray-400">No records found.</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    <TableCell><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.NameId}</span></TableCell>
                    {editId === item.Id ? (
                      <>
                        <TableCell><textarea autoFocus value={editForm.Name} onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))} rows={2} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.Description} onChange={e => setEditForm(f => ({ ...f, Description: e.target.value }))} rows={3} className={inp('edit')} /></TableCell>
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
                        <TableCell className="text-sm text-gray-900 max-w-[180px] truncate" title={item.Name}>{item.Name}</TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-xs truncate" title={item.Description ?? ''}>{item.Description ?? '—'}</TableCell>
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

export default OriginTable;
