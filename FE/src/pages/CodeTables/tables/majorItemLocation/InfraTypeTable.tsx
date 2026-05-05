import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { InfraTypeEnum } from '../../../Project/Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'ProjectInfraType';

interface FormState { InfraId: number; InfraCode: string; InfraName: string; }
const EMPTY_FORM: FormState = { InfraId: 0, InfraCode: '', InfraName: '' };

const inp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

const InfraTypeTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();

  const data: InfraTypeEnum[] = codeTableData?.InfraTypes ?? [];
  const filtered = data.filter(item =>
    item.InfraName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.InfraCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = (item: InfraTypeEnum) => {
    setEditId(item.Id);
    setEditForm({ InfraId: item.InfraId, InfraCode: item.InfraCode, InfraName: item.InfraName });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Infrastructure Type',
      fields: [
        { label: 'Infra ID',  value: addForm.InfraId, mono: true },
        { label: 'Code',      value: addForm.InfraCode, mono: true },
        { label: 'Name',      value: addForm.InfraName },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify(addForm));
          showToast({ type: 'success', message: 'Infrastructure type added successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to add infrastructure type.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Infrastructure Type',
      fields: [
        { label: 'Infra ID',  value: editForm.InfraId, mono: true },
        { label: 'Code',      value: editForm.InfraCode, mono: true },
        { label: 'Name',      value: editForm.InfraName },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm }));
          showToast({ type: 'success', message: 'Infrastructure type updated successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update infrastructure type.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (payload: InfraTypeEnum) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Infrastructure type deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete infrastructure type.' });
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Infrastructure Types</h4>
          <p className="text-sm text-gray-500 mt-0.5">Master list of infrastructure type codes used for major item locations</p>
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
            <PlusIcon className="h-4 w-4" /> Add Type
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-20">Infra ID</TableHeader>
              <TableHeader className="w-24">Code</TableHeader>
              <TableHeader>Name</TableHeader>
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
                    <TableCell><input autoFocus type="number" value={addForm.InfraId || ''} onChange={e => setAddForm(f => f ? { ...f, InfraId: +e.target.value } : f)} placeholder="Infra ID" className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.InfraCode} onChange={e => setAddForm(f => f ? { ...f, InfraCode: e.target.value } : f)} placeholder="Code..." rows={1} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.InfraName} onChange={e => setAddForm(f => f ? { ...f, InfraName: e.target.value } : f)} placeholder="Name..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd} disabled={!addForm.InfraCode.trim() || !addForm.InfraName.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
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
                        <TableCell><input autoFocus type="number" value={editForm.InfraId || ''} onChange={e => setEditForm(f => ({ ...f, InfraId: +e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.InfraCode} onChange={e => setEditForm(f => ({ ...f, InfraCode: e.target.value }))} rows={1} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.InfraName} onChange={e => setEditForm(f => ({ ...f, InfraName: e.target.value }))} rows={2} className={inp('edit')} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="amber" className="p-1.5" onClick={requestEdit} disabled={!editForm.InfraCode.trim() || !editForm.InfraName.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-mono text-xs text-gray-500">{item.InfraId}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">{item.InfraCode}</span>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 max-w-xs truncate" title={item.InfraName}>{item.InfraName}</TableCell>
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
      <p className="text-xs text-gray-400">{filtered.length} record(s) found</p>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default InfraTypeTable;