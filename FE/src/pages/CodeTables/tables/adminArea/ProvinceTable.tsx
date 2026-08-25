import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AdminAreaProvince, AdminAreaRegion } from '../../Model.d';
import { useAdminAreaContext } from '../../AdminAreaContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'AdminAreaProvince';

interface FormState { Name: string; Code: string; RegionParticipantId: string; }
const EMPTY_FORM: FormState = { Name: '', Code: '', RegionParticipantId: '' };

const ITEMS_PER_PAGE = 15;

const isActive = (item: AdminAreaProvince) => item.Deprecated !== true;

const ProvinceTable: React.FC = () => {
  const { data, loading, refetch } = useAdminAreaContext();
  const { showToast } = useToast();
  const [search, setSearch]           = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [addForm, setAddForm]         = useState<FormState | null>(null);
  const [editId, setEditId]           = useState<number | null>(null);
  const [editForm, setEditForm]       = useState<FormState>(EMPTY_FORM);
  const confirm                       = useConfirmDialog();


  const rows: AdminAreaProvince[]  = data?.Provinces ?? [];
  const regions: AdminAreaRegion[] = data?.Regions ?? [];
  const regionName = (participantId: string) => regions.find(r => r.ParticipantId === participantId)?.Name ?? '';

  const filtered = rows.filter(r =>
    r.Name.toLowerCase().includes(search.toLowerCase()) ||
    r.Code.toLowerCase().includes(search.toLowerCase()) ||
    regionName(r.RegionParticipantId).toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageData   = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const onSearch = (v: string) => { setSearch(v); setCurrentPage(1); };

  const startEdit = (r: AdminAreaProvince) => {
    setEditId(r.Id);
    setEditForm({ Name: r.Name, Code: r.Code, RegionParticipantId: r.RegionParticipantId });
  };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: AdminAreaProvince) => {
    const currentActive = isActive(item);
    const nextActive = !currentActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Province',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Name', value: item.Name },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: item.Id, Name: item.Name, Code: item.Code, RegionParticipantId: item.RegionParticipantId, Deprecated: !nextActive }));
          showToast({ type: 'success', message: `Province ${nextActive ? 'activated' : 'deactivated'}.` });
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
      tableName: 'Province',
      fields: [
        { label: 'Name',   value: addForm.Name },
        { label: 'Code',   value: addForm.Code, mono: true },
        { label: 'Region', value: regionName(addForm.RegionParticipantId) },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify(addForm));
          showToast({ type: 'success', message: 'Province added.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to add province.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Province',
      fields: [
        { label: 'Name',   value: editForm.Name },
        { label: 'Code',   value: editForm.Code, mono: true },
        { label: 'Region', value: regionName(editForm.RegionParticipantId) },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm }));
          showToast({ type: 'success', message: 'Province updated.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update province.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (payload: AdminAreaProvince) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Province deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete province.' });
    }
  };

  const inp = (mode: 'add' | 'edit') =>
    `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${
      mode === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
    }`;

  const sel = (mode: 'add' | 'edit') =>
    `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 bg-white ${
      mode === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Provinces</h4>
          <p className="text-sm text-gray-500 mt-0.5">Manage province codes and region linking</p>
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
              <TableHeader className="w-24">Code</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader className="w-48">Region</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-28">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-400">Loading...</TableCell></TableRow>
            ) : (
              <>
                {addForm !== null && (
                  <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                    <TableCell><span className="font-mono text-xs text-gray-400 px-2">auto</span></TableCell>
                    <TableCell><input autoFocus value={addForm.Code} onChange={e => setAddForm(f => f && ({ ...f, Code: e.target.value }))} placeholder="Code *" className={inp('add')} /></TableCell>
                    <TableCell><input value={addForm.Name} onChange={e => setAddForm(f => f && ({ ...f, Name: e.target.value }))} placeholder="Province name *" className={inp('add')} /></TableCell>
                    <TableCell>
                      <select value={addForm.RegionParticipantId}
                        onChange={e => setAddForm(f => f && ({ ...f, RegionParticipantId: e.target.value }))}
                        className={sel('add')}>
                        <option value="">— Select Region —</option>
                        {regions.map(r => <option key={r.Id} value={r.ParticipantId}>{r.Name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell />
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd}
                          disabled={!addForm.Code.trim() || !addForm.Name.trim() || !addForm.RegionParticipantId}>
                          <CheckIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {pageData.length === 0 && !addForm ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-400">No records found.</TableCell></TableRow>
                ) : pageData.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    {editId === item.Id ? (
                      <>
                        <TableCell><span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.Id}</span></TableCell>
                        <TableCell><input value={editForm.Code} onChange={e => setEditForm(f => ({ ...f, Code: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell><input value={editForm.Name} onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell>
                          <select value={editForm.RegionParticipantId}
                            onChange={e => setEditForm(f => ({ ...f, RegionParticipantId: e.target.value }))}
                            className={sel('edit')}>
                            <option value="">— Select Region —</option>
                            {regions.map(r => <option key={r.Id} value={r.ParticipantId}>{r.Name}</option>)}
                          </select>
                        </TableCell>
                        <TableCell className="text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${
                              isActive(item)
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-100 text-gray-500 border-gray-300'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isActive(item) ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {isActive(item) ? 'Active' : 'Inactive'}
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
                        <TableCell><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.Code}</span></TableCell>
                        <TableCell className="font-medium text-gray-900">{item.Name}</TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-gray-700">{regionName(item.RegionParticipantId)}</span>
                          <span className="ml-1 font-mono text-xs text-gray-400">({item.RegionParticipantId})</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => requestToggleActive(item)}
                            title={isActive(item) ? 'Click to deactivate' : 'Click to activate'}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer transition-colors shadow-sm ${
                              isActive(item)
                                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isActive(item) ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {isActive(item) ? 'Active' : 'Inactive'}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="red" className="p-1.5" onClick={() => confirmDelete(item)}><TrashIcon className="h-3.5 w-3.5" /></Button>
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

export default ProvinceTable;
