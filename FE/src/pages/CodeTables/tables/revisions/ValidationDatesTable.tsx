import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import type { RevisionValidationDate } from '../../Model.d';

// S04-TC016 (2026-10-30): this screen used to show built-in sample rows and change only the page.
// Now each row is saved (tOptionRevisionValidationDate), and a NEW revision request for a project
// whose program year has an active row is accepted only between its Start and End dates
// (RevisionController.RequestRevision). A year with no row has no window.
const CODE = 'RevisionValidationDates';

interface FormState { FundingYear: number; StartDate: string; EndDate: string; }
const EMPTY_FORM: FormState = { FundingYear: new Date().getFullYear(), StartDate: '', EndDate: '' };

/** "2025-01-01T00:00:00" -> "2025-01-01", the value a date input takes. */
const toInput = (value: string | undefined) => (value ? value.slice(0, 10) : '');
/** "2025-01-01T00:00:00" -> "January 1, 2025". */
const toDisplay = (value: string) =>
  new Date(`${toInput(value)}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Open, Not open yet or Closed, today against the window (dates as yyyy-mm-dd compare as text). */
const windowState = (row: RevisionValidationDate) => {
  const today = todayInput();
  if (today < toInput(row.StartDate)) return 'Not open yet';
  if (today > toInput(row.EndDate)) return 'Closed';
  return 'Open';
};

const ValidationDatesTable: React.FC = () => {
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const data: RevisionValidationDate[] = codeTableData?.RevisionValidationDates ?? [];
  const currentYear = new Date().getFullYear();

  /** The problem with a form, or null when it can be saved. */
  const problem = (form: FormState) => {
    if (!form.FundingYear || form.FundingYear < 2000 || form.FundingYear > 2100) return 'Enter a Funding Year between 2000 and 2100.';
    if (!form.StartDate || !form.EndDate) return 'Enter both the Start Date and the End Date.';
    if (form.StartDate > form.EndDate) return 'The Start Date is after the End Date.';
    return null;
  };

  const fields = (form: FormState) => [
    { label: 'Funding Year', value: form.FundingYear },
    { label: 'Start Date',   value: form.StartDate ? toDisplay(form.StartDate) : '' },
    { label: 'End Date',     value: form.EndDate ? toDisplay(form.EndDate) : '' },
  ];

  const save = async (type: 0 | 1, json: object, success: string, failure: string) => {
    try {
      await updateCodeTable(CODE, type, JSON.stringify(json));
      showToast({ type: 'success', message: success });
      await refetch();
      return true;
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: failure });
      return false;
    }
  };

  const requestAdd = () => {
    if (!addForm) return;
    const error = problem(addForm);
    if (error) { showToast({ type: 'error', message: error }); return; }
    confirm.request({
      mode: 'add',
      tableName: 'Validation Date Range',
      fields: fields(addForm),
      onConfirm: async () => {
        // Created active: it applies to new revision requests straight away.
        if (await save(0, { ...addForm, IsActive: true }, 'Validation date range added.', 'Failed to add the validation date range.')) setAddForm(null);
        confirm.close();
      },
    });
  };

  const startEdit = (item: RevisionValidationDate) => {
    setEditId(item.Id);
    setEditForm({ FundingYear: item.FundingYear, StartDate: toInput(item.StartDate), EndDate: toInput(item.EndDate) });
    setDeleteConfirmId(null);
  };

  const requestEdit = () => {
    const error = problem(editForm);
    if (error) { showToast({ type: 'error', message: error }); return; }
    const original = data.find(r => r.Id === editId);
    confirm.request({
      mode: 'edit',
      tableName: 'Validation Date Range',
      fields: fields(editForm),
      onConfirm: async () => {
        // IsActive is not on the form: send the row's current value.
        if (await save(1, { Id: editId, ...editForm, IsActive: original?.IsActive !== false }, 'Validation date range updated.', 'Failed to update the validation date range.')) setEditId(null);
        confirm.close();
      },
    });
  };

  const requestToggleActive = (item: RevisionValidationDate) => {
    const nextActive = item.IsActive === false;
    confirm.request({
      mode: 'edit',
      tableName: 'Validation Date Range',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Funding Year', value: item.FundingYear },
      ],
      onConfirm: async () => {
        await save(1, { Id: item.Id, FundingYear: item.FundingYear, StartDate: toInput(item.StartDate), EndDate: toInput(item.EndDate), IsActive: nextActive },
          `Validation date range ${nextActive ? 'activated' : 'deactivated'}.`, 'Failed to update active status.');
        confirm.close();
      },
    });
  };

  const confirmDelete = async (item: RevisionValidationDate) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify({ Id: item.Id }));
      showToast({ type: 'success', message: 'Validation date range deleted.' });
      await refetch();
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to delete the validation date range.' });
    }
    setDeleteConfirmId(null);
  };

  const inp = (v: 'add' | 'edit', extra = 'w-full') =>
    `${extra} px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

  const stateBadge: Record<string, string> = {
    'Open': 'bg-green-50 text-green-700 border-green-200',
    'Not open yet': 'bg-blue-50 text-blue-700 border-blue-200',
    'Closed': 'bg-gray-100 text-gray-500 border-gray-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Modification Validation Dates</h4>
          <p className="text-sm text-gray-500 mt-0.5">
            A new revision request for a project is accepted only between the Start and End dates of its program year. A year with no row has no limit.
          </p>
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
              <TableHeader className="w-28 text-center">Window</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {addForm !== null && (
              <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                <TableCell className="text-xs text-gray-400 italic">New</TableCell>
                <TableCell><input autoFocus type="number" value={addForm.FundingYear} onChange={e => setAddForm(f => f ? { ...f, FundingYear: +e.target.value } : f)} placeholder="Year" className={inp('add', 'w-24')} /></TableCell>
                <TableCell><input type="date" value={addForm.StartDate} onChange={e => setAddForm(f => f ? { ...f, StartDate: e.target.value } : f)} className={inp('add')} /></TableCell>
                <TableCell><input type="date" value={addForm.EndDate} onChange={e => setAddForm(f => f ? { ...f, EndDate: e.target.value } : f)} className={inp('add')} /></TableCell>
                <TableCell />
                <TableCell />
                <TableCell>
                  <div className="flex gap-1">
                    <Button color="indigo" className="p-1.5" onClick={requestAdd}><CheckIcon className="h-3.5 w-3.5" /></Button>
                    <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-gray-400">Loading...</TableCell></TableRow>
            ) : data.length === 0 && !addForm ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-gray-500">No validation date ranges. Revisions can be requested at any time.</TableCell></TableRow>
            ) : data.map(item => {
              const state = windowState(item);
              const current = item.FundingYear === currentYear;
              return (
                <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.Id}</TableCell>
                  {editId === item.Id ? (
                    <>
                      <TableCell><input autoFocus type="number" value={editForm.FundingYear} onChange={e => setEditForm(f => ({ ...f, FundingYear: +e.target.value }))} className={inp('edit', 'w-24')} /></TableCell>
                      <TableCell><input type="date" value={editForm.StartDate} onChange={e => setEditForm(f => ({ ...f, StartDate: e.target.value }))} className={inp('edit')} /></TableCell>
                      <TableCell><input type="date" value={editForm.EndDate} onChange={e => setEditForm(f => ({ ...f, EndDate: e.target.value }))} className={inp('edit')} /></TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell>
                        <div className="flex gap-1">
                          <Button color="amber" className="p-1.5" onClick={requestEdit}><CheckIcon className="h-3.5 w-3.5" /></Button>
                          <Button color="zinc" className="p-1.5" onClick={() => setEditId(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <span className={`font-semibold text-sm ${current ? 'text-indigo-700' : 'text-gray-700'}`}>
                          {item.FundingYear}
                          {current && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Current</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{toDisplay(item.StartDate)}</TableCell>
                      <TableCell className="text-sm text-gray-600">{toDisplay(item.EndDate)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${stateBadge[state]}`}>{state}</span>
                      </TableCell>
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
                          <div className="flex gap-1.5">
                            <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="red" className="p-1.5" onClick={() => setDeleteConfirmId(item.Id)}><TrashIcon className="h-3.5 w-3.5" /></Button>
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
