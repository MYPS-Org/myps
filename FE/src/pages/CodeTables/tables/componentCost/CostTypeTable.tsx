import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentTypeEnum } from '../../../Project/Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'ProjectComponent';

interface FormState { ComponentId: string; ComponentName: string; ExportToPCMA: boolean; }
const EMPTY_FORM: FormState = { ComponentId: '', ComponentName: '', ExportToPCMA: false };

const inp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

const CostTypeTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();

  const data: ComponentTypeEnum[] = codeTableData?.ProjectComponents ?? [];
  const filtered = data.filter(item =>
    !item.IsDeleted &&
    ((item.ComponentName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.ComponentId ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const startEdit = (item: ComponentTypeEnum) => {
    setEditId(item.Id);
    setEditForm({ ComponentId: item.ComponentId ?? '', ComponentName: item.ComponentName ?? '', ExportToPCMA: item.ExportToPCMA });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Cost Type',
      fields: [
        { label: 'Component ID', value: addForm.ComponentId, mono: true },
        { label: 'Name',         value: addForm.ComponentName },
        { label: 'Export PCMA', value: addForm.ExportToPCMA ? 'Yes' : 'No' },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify(addForm));
          showToast({ type: 'success', message: 'Cost type added successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to add cost type.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Cost Type',
      fields: [
        { label: 'Component ID', value: editForm.ComponentId, mono: true },
        { label: 'Name',         value: editForm.ComponentName },
        { label: 'Export PCMA', value: editForm.ExportToPCMA ? 'Yes' : 'No' },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm }));
          showToast({ type: 'success', message: 'Cost type updated successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update cost type.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (id: number) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify({ Id: id }));
      showToast({ type: 'success', message: 'Cost type deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete cost type.' });
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Cost Type (Component Types)</h4>
          <p className="text-sm text-gray-500 mt-0.5">Defines the types of cost components used in project budgeting</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button color="indigo" className="flex items-center gap-1 text-sm" onClick={() => setAddForm(EMPTY_FORM)} disabled={!!addForm}>
            <PlusIcon className="h-4 w-4" /> Add Cost Type
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-28">Component ID</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader className="w-32 text-center">Export to PCMA</TableHeader>
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
                    <TableCell><textarea autoFocus value={addForm.ComponentId} onChange={e => setAddForm(f => f ? { ...f, ComponentId: e.target.value } : f)} placeholder="Component ID" rows={1} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.ComponentName} onChange={e => setAddForm(f => f ? { ...f, ComponentName: e.target.value } : f)} placeholder="Name..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell className="text-center">
                      <input type="checkbox" checked={addForm.ExportToPCMA} onChange={e => setAddForm(f => f ? { ...f, ExportToPCMA: e.target.checked } : f)} className="h-4 w-4 accent-indigo-600" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd} disabled={!addForm.ComponentId.trim() || !addForm.ComponentName.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
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
                        <TableCell><textarea autoFocus value={editForm.ComponentId} onChange={e => setEditForm(f => ({ ...f, ComponentId: e.target.value }))} rows={1} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.ComponentName} onChange={e => setEditForm(f => ({ ...f, ComponentName: e.target.value }))} rows={2} className={inp('edit')} /></TableCell>
                        <TableCell className="text-center">
                          <input type="checkbox" checked={editForm.ExportToPCMA} onChange={e => setEditForm(f => ({ ...f, ExportToPCMA: e.target.checked }))} className="h-4 w-4 accent-amber-600" />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="amber" className="p-1.5" onClick={requestEdit} disabled={!editForm.ComponentId.trim() || !editForm.ComponentName.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.ComponentId}</span>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 max-w-xs truncate" title={item.ComponentName ?? ''}>{item.ComponentName}</TableCell>
                        <TableCell className="text-center">
                          {item.ExportToPCMA ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">Yes</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">No</span>
                          )}
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
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{filtered.length} record(s) found</p>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default CostTypeTable;
