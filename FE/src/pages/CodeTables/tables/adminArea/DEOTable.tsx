import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AdminAreaDEO, AdminAreaProvince, AdminAreaRegion } from '../../Model.d';
import { useAdminAreaContext } from '../../AdminAreaContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'AdminAreaDEO';

interface FormState {
  GdbId: string;
  Name: string;
  ParticipantId: string;
  ProvinceGdbId: string;
  ProvinceName: string;
  RegionParticipantId: string;
  RegionName: string;
}
const EMPTY_FORM: FormState = {
  GdbId: '', Name: '', ParticipantId: '',
  ProvinceGdbId: '', ProvinceName: '',
  RegionParticipantId: '', RegionName: '',
};

const ITEMS_PER_PAGE = 20;

const DEOTable: React.FC = () => {
  const { data, loading, refetch } = useAdminAreaContext();
  const { showToast } = useToast();
  const [search, setSearch]               = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [currentPage, setCurrentPage]     = useState(1);
  const [addForm, setAddForm]             = useState<FormState | null>(null);
  const [editId, setEditId]               = useState<number | null>(null);
  const [editForm, setEditForm]           = useState<FormState>(EMPTY_FORM);
  const confirm                           = useConfirmDialog();

  const rows: AdminAreaDEO[]           = data?.DEOs ?? [];
  const provinces: AdminAreaProvince[] = data?.Provinces ?? [];
  const regions: AdminAreaRegion[]     = data?.Regions ?? [];

  const filtered = rows.filter(r =>
    (filterProvince === '' || r.ProvinceGdbId === filterProvince) &&
    (r.Name.toLowerCase().includes(search.toLowerCase()) ||
     (r.GdbId ?? '').toLowerCase().includes(search.toLowerCase()) ||
     r.ParticipantId.toLowerCase().includes(search.toLowerCase()))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageData   = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const onSearch         = (v: string) => { setSearch(v); setCurrentPage(1); };
  const onFilterProvince = (v: string) => { setFilterProvince(v); setCurrentPage(1); };

  const applyProvince = (gdbId: string, setter: (fn: (f: FormState) => FormState) => void) => {
    const province = provinces.find(p => p.GdbId === gdbId);
    setter(f => ({ ...f, ProvinceGdbId: gdbId, ProvinceName: province?.Name ?? '' }));
  };

  const applyRegion = (participantId: string, setter: (fn: (f: FormState) => FormState) => void) => {
    const region = regions.find(r => r.ParticipantId === participantId);
    setter(f => ({ ...f, RegionParticipantId: participantId, RegionName: region?.Name ?? '' }));
  };

  const startEdit = (r: AdminAreaDEO) => {
    setEditId(r.Id);
    setEditForm({
      GdbId: r.GdbId ?? '', Name: r.Name, ParticipantId: r.ParticipantId,
      ProvinceGdbId: r.ProvinceGdbId, ProvinceName: r.ProvinceName ?? '',
      RegionParticipantId: r.RegionParticipantId, RegionName: r.RegionName,
    });
  };
  const cancelEdit = () => setEditId(null);

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'DEO',
      fields: [
        { label: 'GDB ID',         value: addForm.GdbId, mono: true, optional: true },
        { label: 'Participant ID', value: addForm.ParticipantId, mono: true },
        { label: 'Name',           value: addForm.Name },
        { label: 'Province',       value: addForm.ProvinceName },
        { label: 'Region',         value: addForm.RegionName },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify(addForm));
          showToast({ type: 'success', message: 'DEO added.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to add DEO.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'DEO',
      fields: [
        { label: 'GDB ID',         value: editForm.GdbId, mono: true, optional: true },
        { label: 'Participant ID', value: editForm.ParticipantId, mono: true },
        { label: 'Name',           value: editForm.Name },
        { label: 'Province',       value: editForm.ProvinceName },
        { label: 'Region',         value: editForm.RegionName },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm }));
          showToast({ type: 'success', message: 'DEO updated.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update DEO.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (payload: AdminAreaDEO) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'DEO deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete DEO.' });
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
          <h4 className="text-lg font-semibold text-gray-900">District Engineering Offices (DEOs)</h4>
          <p className="text-sm text-gray-500 mt-0.5">Manage DEO GDB IDs, participant IDs, and province/region linking</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filterProvince} onChange={e => onFilterProvince(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48">
            <option value="">All Provinces</option>
            {provinces.map(p => <option key={p.Id} value={p.GdbId}>{p.Name}</option>)}
          </select>
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => onSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48" />
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
              <TableHeader className="w-16">Id</TableHeader>
              <TableHeader className="w-32">GDB ID</TableHeader>
              <TableHeader className="w-36">Participant ID</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader className="w-44">Province</TableHeader>
              <TableHeader className="w-44">Region</TableHeader>
              <TableHeader className="w-28">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-gray-400">Loading...</TableCell></TableRow>
            ) : (
              <>
                {addForm !== null && (
                  <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                    <TableCell><span className="font-mono text-xs text-gray-400 px-2">auto</span></TableCell>
                    <TableCell><input autoFocus value={addForm.GdbId} onChange={e => setAddForm(f => f && ({ ...f, GdbId: e.target.value }))} placeholder="GDB ID (opt.)" className={inp('add')} /></TableCell>
                    <TableCell><input value={addForm.ParticipantId} onChange={e => setAddForm(f => f && ({ ...f, ParticipantId: e.target.value }))} placeholder="Participant ID *" className={inp('add')} /></TableCell>
                    <TableCell><input value={addForm.Name} onChange={e => setAddForm(f => f && ({ ...f, Name: e.target.value }))} placeholder="DEO name *" className={inp('add')} /></TableCell>
                    <TableCell>
                      <select value={addForm.ProvinceGdbId}
                        onChange={e => applyProvince(e.target.value, fn => setAddForm(f => f ? fn(f) : f))}
                        className={sel('add')}>
                        <option value="">— Select Province —</option>
                        {provinces.map(p => <option key={p.Id} value={p.GdbId}>{p.Name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select value={addForm.RegionParticipantId}
                        onChange={e => applyRegion(e.target.value, fn => setAddForm(f => f ? fn(f) : f))}
                        className={sel('add')}>
                        <option value="">— Select Region —</option>
                        {regions.map(r => <option key={r.Id} value={r.ParticipantId}>{r.Name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd}
                          disabled={!addForm.Name.trim() || !addForm.ParticipantId.trim() || !addForm.ProvinceGdbId || !addForm.RegionParticipantId}>
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
                        <TableCell><input value={editForm.GdbId} onChange={e => setEditForm(f => ({ ...f, GdbId: e.target.value }))} placeholder="(optional)" className={inp('edit')} /></TableCell>
                        <TableCell><input value={editForm.ParticipantId} onChange={e => setEditForm(f => ({ ...f, ParticipantId: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell><input value={editForm.Name} onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))} className={inp('edit')} /></TableCell>
                        <TableCell>
                          <select value={editForm.ProvinceGdbId}
                            onChange={e => applyProvince(e.target.value, fn => setEditForm(fn))}
                            className={sel('edit')}>
                            <option value="">— Select Province —</option>
                            {provinces.map(p => <option key={p.Id} value={p.GdbId}>{p.Name}</option>)}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select value={editForm.RegionParticipantId}
                            onChange={e => applyRegion(e.target.value, fn => setEditForm(fn))}
                            className={sel('edit')}>
                            <option value="">— Select Region —</option>
                            {regions.map(r => <option key={r.Id} value={r.ParticipantId}>{r.Name}</option>)}
                          </select>
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
                        <TableCell>
                          {item.GdbId
                            ? <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.GdbId}</span>
                            : <span className="text-xs text-gray-400">—</span>}
                        </TableCell>
                        <TableCell><span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{item.ParticipantId}</span></TableCell>
                        <TableCell className="font-medium text-gray-900">{item.Name}</TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-gray-700">{item.ProvinceName ?? '—'}</span>
                          <span className="ml-1 font-mono text-xs text-gray-400">({item.ProvinceGdbId})</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-gray-700">{item.RegionName}</span>
                          <span className="ml-1 font-mono text-xs text-gray-400">({item.RegionParticipantId})</span>
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

      <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
        <span>{filtered.length === 0 ? '0' : `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}`} of {filtered.length} entries</span>
        <div className="flex items-center gap-2">
          <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
          <span>Page {currentPage} of {totalPages}</span>
          <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
        </div>
      </div>

      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default DEOTable;
