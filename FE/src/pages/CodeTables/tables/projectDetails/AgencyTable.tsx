import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import {
  PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import type { AgencyEnum } from '../../../Project/Model.d';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';
import { updateCodeTable } from '../../Service';

const CODE = 'ProjectAgency';

interface FormState { NameId: number; Name: string; Description: string; }
const EMPTY_FORM: FormState = { NameId: 0, Name: '', Description: '' };

interface Props { data?: AgencyEnum[]; loading?: boolean; }

const AgencyTable: React.FC<Props> = ({ data, loading = false }) => {
  const [rows, setRows]                = useState<AgencyEnum[]>([]);
  const [editId, setEditId]            = useState<number | null>(null);
  const [editForm, setEditForm]        = useState<FormState>(EMPTY_FORM);
  const [addForm, setAddForm]          = useState<FormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [search, setSearch]            = useState('');
  const confirm                        = useConfirmDialog();

  useEffect(() => {
    if (!loading) setRows(data ?? []);
  }, [data, loading]);

  const filtered = rows.filter(r =>
    r.Name.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (r: AgencyEnum) => {
    setEditId(r.Id);
    setEditForm({ NameId: r.NameId, Name: r.Name, Description: r.Description ?? '' });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async () => {
    await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, NameId: editForm.NameId, Name: editForm.Name, Description: editForm.Description || null }));
    setRows(prev => prev.map(r => r.Id === editId ? { ...r, NameId: editForm.NameId, Name: editForm.Name, Description: editForm.Description || null } : r));
    cancelEdit();
  };
  const saveAdd = async () => {
    if (!addForm) return;
    await updateCodeTable(CODE, 0, JSON.stringify({ NameId: addForm.NameId, Name: addForm.Name, Description: addForm.Description || null }));
    setRows(prev => [{ Id: Date.now(), NameId: addForm.NameId, Name: addForm.Name, Description: addForm.Description || null }, ...prev]);
    setAddForm(null);
  };
  const confirmDelete = async (id: number) => {
    await updateCodeTable(CODE, 2, JSON.stringify({ Id: id }));
    setRows(prev => prev.filter(r => r.Id !== id));
    setDeleteConfirmId(null);
  };

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Agency',
      fields: [
        { label: 'NameId',      value: addForm.NameId,      mono: true },
        { label: 'Agency Name', value: addForm.Name },
        { label: 'Description', value: addForm.Description, optional: true },
      ],
      onConfirm: () => { saveAdd(); confirm.close(); },
    });
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Agency',
      fields: [
        { label: 'NameId',      value: editForm.NameId,      mono: true },
        { label: 'Agency Name', value: editForm.Name },
        { label: 'Description', value: editForm.Description, optional: true },
      ],
      onConfirm: () => { saveEdit(); confirm.close(); },
    });
  };

  const inputClass = (variant: 'add' | 'edit') =>
    `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${
      variant === 'add'
        ? 'border-indigo-300 focus:ring-indigo-500'
        : 'border-amber-300 focus:ring-amber-500'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Agency</h4>
          <p className="text-sm text-gray-500 mt-0.5">Government agencies involved in project implementation</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52"
            />
          </div>
          <Button color="indigo" className="flex items-center gap-1 text-sm"
            onClick={() => setAddForm(EMPTY_FORM)} disabled={!!addForm}>
            <PlusIcon className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-20">Id</TableHeader>
              <TableHeader className="w-24">NameId</TableHeader>
              <TableHeader>Agency Name</TableHeader>
              <TableHeader>Description</TableHeader>
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
                    </svg>
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {addForm !== null && (
                  <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                    <TableCell>
                      <span className="font-mono text-xs text-gray-400 px-2">auto</span>
                    </TableCell>
                    <TableCell>
                      <input autoFocus type="number" value={addForm.NameId || ''}
                        onChange={e => setAddForm(f => f ? { ...f, NameId: parseInt(e.target.value) || 0 } : f)}
                        placeholder="NameId *" className={inputClass('add')} />
                    </TableCell>
                    <TableCell>
                      <textarea value={addForm.Name}
                        onChange={e => setAddForm(f => f ? { ...f, Name: e.target.value } : f)}
                        placeholder="Agency Name *" rows={2} className={inputClass('add')} />
                    </TableCell>
                    <TableCell>
                      <textarea value={addForm.Description}
                        onChange={e => setAddForm(f => f ? { ...f, Description: e.target.value } : f)}
                        placeholder="Description (optional)" rows={3} className={inputClass('add')} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd} disabled={!addForm.NameId || !addForm.Name.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.length === 0 && !addForm ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400">No records found.</TableCell>
                  </TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    {editId === item.Id ? (
                      <>
                        <TableCell>
                          <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.Id}</span>
                        </TableCell>
                        <TableCell>
                          <input autoFocus type="number" value={editForm.NameId || ''}
                            onChange={e => setEditForm(f => ({ ...f, NameId: parseInt(e.target.value) || 0 }))}
                            className={inputClass('edit')} />
                        </TableCell>
                        <TableCell>
                          <textarea value={editForm.Name}
                            onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))}
                            rows={2} className={inputClass('edit')} />
                        </TableCell>
                        <TableCell>
                          <textarea value={editForm.Description}
                            onChange={e => setEditForm(f => ({ ...f, Description: e.target.value }))}
                            placeholder="Description (optional)"
                            rows={3} className={inputClass('edit')} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="amber" className="p-1.5" onClick={requestEdit} disabled={!editForm.NameId || !editForm.Name.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.Id}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.NameId}</span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-900 max-w-[180px] truncate" title={item.Name}>{item.Name}</TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-xs truncate" title={item.Description ?? ''}>{item.Description ?? '—'}</TableCell>
                        <TableCell>
                          {deleteConfirmId === item.Id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600">Delete?</span>
                              <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item.Id)}>Yes</Button>
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

export default AgencyTable;
