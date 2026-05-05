import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import {
  PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import type { ThrustEnum } from '../../../Project/Model.d';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';
import { updateCodeTable } from '../../Service';
import { useCodeTableContext } from '../../CodeTableContext';
import { useToast } from '../../../../components/toaster/ToasterContext';

const CODE = 'ProjectThrust';

interface FormState {
  PAPKey: number; ProgramName: string; SubProgramName: string;
  ActivityName: string; SequenceNumber: number;
  ThrustDescription: string; InfrastructureType: string;
  ValidFromDate: number; ValidToDate: number;
}
const EMPTY_FORM: FormState = {
  PAPKey: 0, ProgramName: '', SubProgramName: '',
  ActivityName: '', SequenceNumber: 0,
  ThrustDescription: '', InfrastructureType: '',
  ValidFromDate: new Date().getFullYear(), ValidToDate: 0,
};

const ThrustTable: React.FC = () => {
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const [editId, setEditId]            = useState<number | null>(null);
  const [editForm, setEditForm]        = useState<FormState>(EMPTY_FORM);
  const [addForm, setAddForm]          = useState<FormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [search, setSearch]            = useState('');
  const confirm                        = useConfirmDialog();

  const rows: ThrustEnum[] = (codeTableData?.ProjectThrusts ?? []) as ThrustEnum[];

  const filtered = rows.filter(r =>
    r.ProgramName.toLowerCase().includes(search.toLowerCase()) ||
    r.SubProgramName.toLowerCase().includes(search.toLowerCase()) ||
    (r.InfrastructureType ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.ThrustDescription.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (r: ThrustEnum) => {
    setEditId(r.Id);
    setEditForm({
      PAPKey: r.PAPKey, ProgramName: r.ProgramName, SubProgramName: r.SubProgramName,
      ActivityName: r.ActivityName, SequenceNumber: r.SequenceNumber,
      ThrustDescription: r.ThrustDescription, InfrastructureType: r.InfrastructureType ?? '',
      ValidFromDate: r.ValidFromDate, ValidToDate: r.ValidToDate,
    });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async () => {
    try {
      await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm, InfrastructureType: editForm.InfrastructureType || undefined }));
      showToast({ type: 'success', message: 'Thrust updated successfully.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to update thrust.' });
    }
    cancelEdit();
  };
  const saveAdd = async () => {
    if (!addForm) return;
    try {
      await updateCodeTable(CODE, 0, JSON.stringify({ ...addForm, InfrastructureType: addForm.InfrastructureType || undefined }));
      showToast({ type: 'success', message: 'Thrust added successfully.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to add thrust.' });
    }
    setAddForm(null);
  };
  const confirmDelete = async (payload: ThrustEnum) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Thrust deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete thrust.' });
    }
    setDeleteConfirmId(null);
  };

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Thrust / PAP',
      fields: [
        { label: 'PAP Key',       value: addForm.PAPKey,                                  mono: true },
        { label: 'Program',       value: addForm.ProgramName },
        { label: 'Sub-Program',   value: addForm.SubProgramName,                          optional: true },
        { label: 'Activity',      value: addForm.ActivityName,                            optional: true },
        { label: 'Seq #',         value: addForm.SequenceNumber },
        { label: 'Description',   value: addForm.ThrustDescription },
        { label: 'Infra Type',    value: addForm.InfrastructureType,                      optional: true },
        { label: 'Valid From',    value: addForm.ValidFromDate },
        { label: 'Valid To',      value: addForm.ValidToDate === 0 ? 'Present' : addForm.ValidToDate },
      ],
      onConfirm: () => { saveAdd(); confirm.close(); },
    });
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Thrust / PAP',
      fields: [
        { label: 'PAP Key',       value: editForm.PAPKey,                                 mono: true },
        { label: 'Program',       value: editForm.ProgramName },
        { label: 'Sub-Program',   value: editForm.SubProgramName,                         optional: true },
        { label: 'Activity',      value: editForm.ActivityName,                           optional: true },
        { label: 'Seq #',         value: editForm.SequenceNumber },
        { label: 'Description',   value: editForm.ThrustDescription },
        { label: 'Infra Type',    value: editForm.InfrastructureType,                     optional: true },
        { label: 'Valid From',    value: editForm.ValidFromDate },
        { label: 'Valid To',      value: editForm.ValidToDate === 0 ? 'Present' : editForm.ValidToDate },
      ],
      onConfirm: () => { saveEdit(); confirm.close(); },
    });
  };

  const inp = (color: 'add' | 'edit', extraClass = 'w-full') =>
    `${extraClass} px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${color === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Thrust / PAP</h4>
          <p className="text-sm text-gray-500 mt-0.5">Program Attributable Programs and associated thrusts used in project classification</p>
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
              <TableHeader className="w-20">PAP Key</TableHeader>
              <TableHeader>Program Name</TableHeader>
              <TableHeader>Sub-Program</TableHeader>
              <TableHeader>Activity</TableHeader>
              <TableHeader className="w-16 text-center">Seq #</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Infra Type</TableHeader>
              <TableHeader className="w-20 text-center">Valid From</TableHeader>
              <TableHeader className="w-20 text-center">Valid To</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10">
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
                    <TableCell><input autoFocus type="number" value={addForm.PAPKey} onChange={e => setAddForm(f => f ? { ...f, PAPKey: +e.target.value } : f)} placeholder="Key" className={inp('add', 'w-16')} /></TableCell>
                    <TableCell><textarea value={addForm.ProgramName} onChange={e => setAddForm(f => f ? { ...f, ProgramName: e.target.value } : f)} placeholder="Program name..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.SubProgramName} onChange={e => setAddForm(f => f ? { ...f, SubProgramName: e.target.value } : f)} placeholder="Sub-program..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.ActivityName} onChange={e => setAddForm(f => f ? { ...f, ActivityName: e.target.value } : f)} placeholder="Activity..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell><input type="number" value={addForm.SequenceNumber} onChange={e => setAddForm(f => f ? { ...f, SequenceNumber: +e.target.value } : f)} placeholder="0" className={inp('add', 'w-14')} /></TableCell>
                    <TableCell><textarea value={addForm.ThrustDescription} onChange={e => setAddForm(f => f ? { ...f, ThrustDescription: e.target.value } : f)} placeholder="Description..." rows={3} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.InfrastructureType} onChange={e => setAddForm(f => f ? { ...f, InfrastructureType: e.target.value } : f)} placeholder="Infra type..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell><input type="number" value={addForm.ValidFromDate} onChange={e => setAddForm(f => f ? { ...f, ValidFromDate: +e.target.value } : f)} placeholder="Year" className={inp('add', 'w-16')} /></TableCell>
                    <TableCell><input type="number" value={addForm.ValidToDate} onChange={e => setAddForm(f => f ? { ...f, ValidToDate: +e.target.value } : f)} placeholder="0=now" className={inp('add', 'w-16')} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd}><CheckIcon className="h-3.5 w-3.5" /></Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.length === 0 && !addForm ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-10 text-gray-400">No records found.</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    {editId === item.Id ? (
                      <>
                        <TableCell><input autoFocus type="number" value={editForm.PAPKey} onChange={e => setEditForm(f => ({ ...f, PAPKey: +e.target.value }))} className={inp('edit', 'w-16')} /></TableCell>
                        <TableCell><textarea value={editForm.ProgramName} onChange={e => setEditForm(f => ({ ...f, ProgramName: e.target.value }))} placeholder="Program..." rows={2} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.SubProgramName} onChange={e => setEditForm(f => ({ ...f, SubProgramName: e.target.value }))} placeholder="Sub-program..." rows={2} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.ActivityName} onChange={e => setEditForm(f => ({ ...f, ActivityName: e.target.value }))} placeholder="Activity..." rows={2} className={inp('edit')} /></TableCell>
                        <TableCell><input type="number" value={editForm.SequenceNumber} onChange={e => setEditForm(f => ({ ...f, SequenceNumber: +e.target.value }))} className={inp('edit', 'w-14')} /></TableCell>
                        <TableCell><textarea value={editForm.ThrustDescription} onChange={e => setEditForm(f => ({ ...f, ThrustDescription: e.target.value }))} rows={3} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.InfrastructureType} onChange={e => setEditForm(f => ({ ...f, InfrastructureType: e.target.value }))} placeholder="Infra type..." rows={2} className={inp('edit')} /></TableCell>
                        <TableCell><input type="number" value={editForm.ValidFromDate} onChange={e => setEditForm(f => ({ ...f, ValidFromDate: +e.target.value }))} className={inp('edit', 'w-16')} /></TableCell>
                        <TableCell><input type="number" value={editForm.ValidToDate} onChange={e => setEditForm(f => ({ ...f, ValidToDate: +e.target.value }))} placeholder="0=now" className={inp('edit', 'w-16')} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="amber" className="p-1.5" onClick={requestEdit}><CheckIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell><span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.PAPKey}</span></TableCell>
                        <TableCell className="text-sm font-medium text-gray-900 max-w-[180px] truncate" title={item.ProgramName}>{item.ProgramName}</TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[150px] truncate" title={item.SubProgramName || ''}>{item.SubProgramName || '—'}</TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[120px] truncate" title={item.ActivityName || ''}>{item.ActivityName || '—'}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600">{item.SequenceNumber}</TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-xs truncate" title={item.ThrustDescription}>{item.ThrustDescription}</TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[120px] truncate" title={item.InfrastructureType ?? ''}>{item.InfrastructureType ?? '—'}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600">{item.ValidFromDate}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600">{item.ValidToDate === 0 ? 'Present' : item.ValidToDate}</TableCell>
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

export default ThrustTable;
