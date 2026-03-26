import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

interface ValidationDateData {
  id: number;
  fundingYear: number;
  startDate: string;
  endDate: string;
}

// Replace with API call: GET /codetable/validationdates
const SAMPLE_DATA: ValidationDateData[] = [
  { id: 1, fundingYear: 2016, startDate: '1/1/2016', endDate: '6/30/2016' },
  { id: 2, fundingYear: 2017, startDate: '1/1/2017', endDate: '6/30/2017' },
  { id: 3, fundingYear: 2018, startDate: '1/1/2018', endDate: '6/30/2018' },
  { id: 4, fundingYear: 2019, startDate: '1/1/2019', endDate: '12/31/2019' },
  { id: 5, fundingYear: 2020, startDate: '1/1/2020', endDate: '12/31/2021' },
  { id: 6, fundingYear: 2021, startDate: '1/1/2021', endDate: '12/31/2022' },
  { id: 7, fundingYear: 2022, startDate: '1/1/2022', endDate: '12/31/2023' },
  { id: 8, fundingYear: 2023, startDate: '1/1/2023', endDate: '12/31/2024' },
  { id: 9, fundingYear: 2024, startDate: '1/1/2024', endDate: '12/31/2025' },
];

interface FormState { fundingYear: number; startDate: string; endDate: string; }
const EMPTY_FORM: FormState = { fundingYear: new Date().getFullYear(), startDate: '', endDate: '' };

const ValidationDatesTable: React.FC = () => {
  const [data, setData] = useState<ValidationDateData[]>(SAMPLE_DATA);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const confirm = useConfirmDialog();
  const currentYear = new Date().getFullYear();

  const isCurrentYear = (year: number) => year === currentYear;
  const isPastYear = (endDate: string) => {
    const end = new Date(endDate);
    return end < new Date();
  };

  const startEdit = (item: ValidationDateData) => {
    setEditId(item.id);
    setEditForm({ fundingYear: item.fundingYear, startDate: item.startDate, endDate: item.endDate });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = () => {
    setData(prev => prev.map(r => r.id === editId ? { ...r, ...editForm } : r));
    // TODO: PATCH /codetable/validationdates/{editId}
    cancelEdit();
  };
  const saveAdd = () => {
    if (!addForm) return;
    const nextId = data.length > 0 ? Math.max(...data.map(r => r.id)) + 1 : 1;
    setData(prev => [...prev, { id: nextId, ...addForm }]);
    // TODO: POST /codetable/validationdates
    setAddForm(null);
  };
  const confirmDelete = (id: number) => {
    setData(prev => prev.filter(r => r.id !== id));
    // TODO: DELETE /codetable/validationdates/{id}
    setDeleteConfirmId(null);
  };
  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Validation Date Range',
      fields: [
        { label: 'Funding Year', value: addForm.fundingYear },
        { label: 'Start Date',   value: addForm.startDate },
        { label: 'End Date',     value: addForm.endDate },
      ],
      onConfirm: () => { saveAdd(); confirm.close(); },
    });
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Validation Date Range',
      fields: [
        { label: 'Funding Year', value: editForm.fundingYear },
        { label: 'Start Date',   value: editForm.startDate },
        { label: 'End Date',     value: editForm.endDate },
      ],
      onConfirm: () => { saveEdit(); confirm.close(); },
    });
  };

  const inp = (v: 'add' | 'edit', extra = 'w-full') =>
    `${extra} px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Modification Validation Dates</h4>
          <p className="text-sm text-gray-500 mt-0.5">Defines the valid modification submission windows per funding year</p>
        </div>
        <Button color="indigo" className="flex items-center gap-1 text-sm" onClick={() => setAddForm(EMPTY_FORM)} disabled={!!addForm}>
          <PlusIcon className="h-4 w-4" /> Add Date Range
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-32">Funding Year</TableHeader>
              <TableHeader>Start Date</TableHeader>
              <TableHeader>End Date</TableHeader>
              <TableHeader className="w-24 text-center">Status</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {addForm !== null && (
              <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                <TableCell className="text-xs text-gray-400 italic">New</TableCell>
                <TableCell><input autoFocus type="number" value={addForm.fundingYear} onChange={e => setAddForm(f => f ? { ...f, fundingYear: +e.target.value } : f)} placeholder="Year" className={inp('add', 'w-20')} /></TableCell>
                <TableCell><input value={addForm.startDate} onChange={e => setAddForm(f => f ? { ...f, startDate: e.target.value } : f)} placeholder="e.g. 1/1/2025" className={inp('add')} /></TableCell>
                <TableCell><input value={addForm.endDate} onChange={e => setAddForm(f => f ? { ...f, endDate: e.target.value } : f)} placeholder="e.g. 12/31/2025" className={inp('add')} /></TableCell>
                <TableCell />
                <TableCell>
                  <div className="flex gap-1">
                    <Button color="indigo" className="p-1.5" onClick={requestAdd}><CheckIcon className="h-3.5 w-3.5" /></Button>
                    <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {data.map(item => {
              const past = isPastYear(item.endDate);
              const current = isCurrentYear(item.fundingYear);
              return (
                <TableRow key={item.id} className={editId === item.id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.id}</TableCell>
                  {editId === item.id ? (
                    <>
                      <TableCell><input autoFocus type="number" value={editForm.fundingYear} onChange={e => setEditForm(f => ({ ...f, fundingYear: +e.target.value }))} className={inp('edit', 'w-20')} /></TableCell>
                      <TableCell><input value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} className={inp('edit')} /></TableCell>
                      <TableCell><input value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} className={inp('edit')} /></TableCell>
                      <TableCell />
                      <TableCell>
                        <div className="flex gap-1">
                          <Button color="amber" className="p-1.5" onClick={requestEdit}><CheckIcon className="h-3.5 w-3.5" /></Button>
                          <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <span className={`font-semibold text-sm ${current ? 'text-indigo-700' : 'text-gray-700'}`}>
                          {item.fundingYear}
                          {current && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Current</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{item.startDate}</TableCell>
                      <TableCell className="text-sm text-gray-600">{item.endDate}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                          !past ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {!past ? 'Open' : 'Closed'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Delete?</span>
                            <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item.id)}>Yes</Button>
                            <Button color="zinc" className="px-2 py-1 text-xs" onClick={() => setDeleteConfirmId(null)}>No</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="red" className="p-1.5" onClick={() => setDeleteConfirmId(item.id)}><TrashIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{data.length} record(s)</p>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default ValidationDatesTable;
