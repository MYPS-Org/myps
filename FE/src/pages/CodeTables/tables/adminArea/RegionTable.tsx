import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AdminAreaRegion } from '../../Model.d';
import { useAdminAreaContext } from '../../AdminAreaContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'AdminAreaRegion';

interface FormState { GdbId: string; Name: string; ParticipantId: string; IslandCode: string; }
const EMPTY_FORM: FormState = { GdbId: '', Name: '', ParticipantId: '', IslandCode: '' };

const ITEMS_PER_PAGE = 15;

const RegionTable: React.FC = () => {
  const { data, loading, refetch } = useAdminAreaContext();
  const { showToast } = useToast();
  const [search, setSearch]       = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [addForm, setAddForm]     = useState<FormState | null>(null);
  const [editId, setEditId]       = useState<number | null>(null);
  const [editForm, setEditForm]   = useState<FormState>(EMPTY_FORM);
  const confirm                   = useConfirmDialog();


  const rows: AdminAreaRegion[] = data?.Regions ?? [];
  const filtered = rows.filter(r =>
    r.Name.toLowerCase().includes(search.toLowerCase()) ||
    r.GdbId.toLowerCase().includes(search.toLowerCase()) ||
    r.ParticipantId.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageData   = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const onSearch = (v: string) => { setSearch(v); setCurrentPage(1); };

  const startEdit = (r: AdminAreaRegion) => {
    setEditId(r.Id);
    setEditForm({ GdbId: r.GdbId, Name: r.Name, ParticipantId: r.ParticipantId, IslandCode: r.IslandCode });
  };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: AdminAreaRegion) => {
    const currentActive = item.IsActive !== false;
    const nextActive = !currentActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Region',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Name', value: item.Name },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: item.Id, GdbId: item.GdbId, Name: item.Name, ParticipantId: item.ParticipantId, IslandCode: item.IslandCode, IsActive: nextActive }));
          showToast({ type: 'success', message: `Region ${nextActive ? 'activated' : 'deactivated'}.` });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update active status.' });
        }
        confirm.close();
      },
    });
  };

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Region',
      fields: [
        { label: 'GdbId',         value: addForm.GdbId, mono: true },
        { label: 'Name',          value: addForm.Name },
        { label: 'ParticipantId', value: addForm.ParticipantId, mono: true },
        { label: 'IslandCode',    value: addForm.IslandCode, mono: true },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify(addForm));
          showToast({ type: 'success', message: 'Region added.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to add region.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Region',
      fields: [
        { label: 'GdbId',         value: editForm.GdbId, mono: true },
        { label: 'Name',          value: editForm.Name },
        { label: 'ParticipantId', value: editForm.ParticipantId, mono: true },
        { label: 'IslandCode',    value: editForm.IslandCode, mono: true },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm }));
          showToast({ type: 'success', message: 'Region updated.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update region.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (id: number) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify({ Id: id }));
      showToast({ type: 'success', message: 'Region deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete region.' });
    }
  };

  const inp = (mode: 'add' | 'edit') =>
    `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${
      mode === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Regions</h4>
          <p className="text-sm text-gray-500 mt-0.5">Manage region GDB IDs and participant IDs</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => onSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52" />
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
              <TableHeader className="w-16">Id</TableHeader>
              <TableHeader className="w-32">GDB ID</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader className="w-36">Participant ID</TableHeader>
              <TableHeader className="w-24">Island Code</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-28">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-gray-400">Loading...</TableCell>
              </TableRow>
            ) : (
              <>
                {addForm !== null && (
                  <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                    <TableCell><span className="font-mono text-xs text-gray-400 px-2">auto</span></TableCell>
                    <TableCell><input autoFocus value={addForm.GdbId} onChange={e => setAddForm(f => f && ({ ...f, GdbId: e.target.value }))} placeholder="GDB ID *" className={inp('add')} /></TableCell>
                    <TableCell><input value={addForm.Name} onChange={e => setAddForm(f => f && ({ ...f, Name: e.target.value }))} placeholder="Region name *" className={inp('add')} /></TableCell>
                    <TableCell><input value={addForm.ParticipantId} onChange={e => setAddForm(f => f && ({ ...f, ParticipantId: e.target.value }))} placeholder="Participant ID *" className={inp('add')} /></TableCell>
                    <TableCell><input value={addForm.IslandCode} onChange={e => setAddForm(f => f && ({ ...f, IslandCode: e.target.value }))} placeholder="Code *" className={inp('add')} /></TableCell>
                    <TableCell />
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd} disabled={!addForm.GdbId.trim() || !addForm.Name.trim() || !addForm.ParticipantId.trim() || !addForm.IslandCode.trim()}>
                          <CheckIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {pageData.length === 0 && !addForm ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-gray-400">No records found.</TableCell></TableRow>
                ) : pageData.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    {editId === item.Id ? (
                      <>
                        <TableCell><span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.Id}</span></TableCell>
                        <TableCell><input value={editForm.GdbId} onChange={e => setEditForm(f => ({ ...f, GdbId: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell><input value={editForm.Name} onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell><input value={editForm.ParticipantId} onChange={e => setEditForm(f => ({ ...f, ParticipantId: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell><input value={editForm.IslandCode} onChange={e => setEditForm(f => ({ ...f, IslandCode: e.target.value }))} className={inp('edit')} /></TableCell>
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
                        <TableCell><span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.Id}</span></TableCell>
                        <TableCell><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.GdbId}</span></TableCell>
                        <TableCell className="font-medium text-gray-900">{item.Name}</TableCell>
                        <TableCell><span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{item.ParticipantId}</span></TableCell>
                        <TableCell><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.IslandCode}</span></TableCell>
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
                          <div className="flex gap-1">
                            <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="red" className="p-1.5" onClick={() => confirmDelete(item.Id)}><TrashIcon className="h-3.5 w-3.5" /></Button>
                          </div>
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

      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
          <span>Showing {filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} entries</span>
          <div className="flex items-center gap-2">
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default RegionTable;
