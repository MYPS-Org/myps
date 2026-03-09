import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import {
  PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import type { TableEnum } from '../../../Project/Model.d';

const SAMPLE_DATA: TableEnum[] = [
  { Id: 1, NameId: 1, Name: 'With Detailed Design',    Description: 'Detailed engineering design has been completed' },
  { Id: 2, NameId: 2, Name: 'Without Detailed Design', Description: 'Detailed design is not yet available or not required' },
  { Id: 3, NameId: 3, Name: 'Ongoing Design',          Description: 'Detailed engineering design is currently being prepared' },
  { Id: 4, NameId: 4, Name: 'Waived',                  Description: 'Detailed design requirement has been formally waived' },
];

interface FormState { Name: string; Description: string; }
const EMPTY_FORM: FormState = { Name: '', Description: '' };
interface Props { data?: TableEnum[]; loading?: boolean; }

const DetailedDesignTable: React.FC<Props> = ({ data, loading = false }) => {
  const [rows, setRows]                = useState<TableEnum[]>([]);
  const [editId, setEditId]            = useState<number | null>(null);
  const [editForm, setEditForm]        = useState<FormState>(EMPTY_FORM);
  const [addForm, setAddForm]          = useState<FormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [search, setSearch]            = useState('');

  useEffect(() => {
    if (!loading) setRows(data !== undefined ? data : SAMPLE_DATA);
  }, [data, loading]);

  const filtered = rows.filter(r =>
    r.Name.toLowerCase().includes(search.toLowerCase()) ||
    (r.Description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (r: TableEnum) => { setEditId(r.Id); setEditForm({ Name: r.Name, Description: r.Description ?? '' }); setDeleteConfirmId(null); };
  const cancelEdit = () => setEditId(null);
  const saveEdit = () => {
    setRows(prev => prev.map(r => r.Id === editId ? { ...r, ...editForm } : r));
    // TODO: PATCH /codetable/detailed-design/{editId}
    cancelEdit();
  };
  const saveAdd = () => {
    if (!addForm) return;
    const nextId = rows.length > 0 ? Math.max(...rows.map(r => r.NameId)) + 1 : 1;
    setRows(prev => [{ Id: Date.now(), NameId: nextId, Name: addForm.Name, Description: addForm.Description }, ...prev]);
    // TODO: POST /codetable/detailed-design
    setAddForm(null);
  };
  const confirmDelete = (id: number) => {
    setRows(prev => prev.filter(r => r.Id !== id));
    // TODO: DELETE /codetable/detailed-design/{id}
    setDeleteConfirmId(null);
  };

  const inp = (v: 'add' | 'edit') =>
    `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Detailed Design</h4>
          <p className="text-sm text-gray-500 mt-0.5">Detailed engineering design status options for ProjectDetails</p>
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
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10">
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
                    <TableCell><input autoFocus value={addForm.Name} onChange={e => setAddForm(f => f ? { ...f, Name: e.target.value } : f)} placeholder="Name..." className={inp('add')} /></TableCell>
                    <TableCell><input value={addForm.Description} onChange={e => setAddForm(f => f ? { ...f, Description: e.target.value } : f)} placeholder="Description..." className={inp('add')} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={saveAdd}><CheckIcon className="h-3.5 w-3.5" /></Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.length === 0 && !addForm ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-gray-400">No records found.</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    <TableCell><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.NameId}</span></TableCell>
                    {editId === item.Id ? (
                      <>
                        <TableCell><input autoFocus value={editForm.Name} onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell><input value={editForm.Description} onChange={e => setEditForm(f => ({ ...f, Description: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="indigo" className="p-1.5" onClick={saveEdit}><CheckIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-sm text-gray-900">{item.Name}</TableCell>
                        <TableCell className="text-sm text-gray-500">{item.Description ?? '—'}</TableCell>
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
    </div>
  );
};

export default DetailedDesignTable;
