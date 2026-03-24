import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

interface ModCategoryData {
  id: number;
  codeGroupId: number;
  codeDescription: string;
  sequenceNo: number;
  obsoleteFlag: number;
}

// Replace with API call: GET /codetable/revisioncategories
const SAMPLE_DATA: ModCategoryData[] = [
  { id: 1, codeGroupId: 1, codeDescription: 'Category A - Typographical Error', sequenceNo: 1, obsoleteFlag: 1 },
  { id: 2, codeGroupId: 2, codeDescription: 'Category B - Change in Station Limits, due to increase or decrease in budget', sequenceNo: 2, obsoleteFlag: 1 },
  { id: 3, codeGroupId: 3, codeDescription: 'Category C - Change in Location', sequenceNo: 3, obsoleteFlag: 1 },
  { id: 4, codeGroupId: 4, codeDescription: 'Category D - Change in Operating Unit (OU)', sequenceNo: 4, obsoleteFlag: 1 },
  { id: 5, codeGroupId: 5, codeDescription: 'Category E - Due to the Occurrence of Calamity', sequenceNo: 5, obsoleteFlag: 1 },
  { id: 6, codeGroupId: 6, codeDescription: 'Adjustment', sequenceNo: 6, obsoleteFlag: 0 },
  { id: 7, codeGroupId: 7, codeDescription: 'Change in Authority to Implement', sequenceNo: 7, obsoleteFlag: 0 },
  { id: 8, codeGroupId: 8, codeDescription: 'Non-Implementable - For Reversion', sequenceNo: 8, obsoleteFlag: 0 },
  { id: 9, codeGroupId: 8, codeDescription: 'Non-Implementable - Abandonment For Savings', sequenceNo: 12, obsoleteFlag: 0 },
  { id: 10, codeGroupId: 8, codeDescription: 'Non-Implementable - Delisted', sequenceNo: 13, obsoleteFlag: 0 },
  { id: 11, codeGroupId: 9, codeDescription: 'Termination', sequenceNo: 9, obsoleteFlag: 0 },
  { id: 12, codeGroupId: 10, codeDescription: 'Additional Funding', sequenceNo: 10, obsoleteFlag: 0 },
  { id: 13, codeGroupId: 11, codeDescription: 'For Savings - Partial Unutilized Balance', sequenceNo: 11, obsoleteFlag: 0 },
  { id: 14, codeGroupId: 12, codeDescription: 'Change in Funding', sequenceNo: 14, obsoleteFlag: 0 },
  { id: 15, codeGroupId: 13, codeDescription: 'Mode of Implementation', sequenceNo: 15, obsoleteFlag: 0 },
  { id: 16, codeGroupId: 14, codeDescription: 'Multi-Year Costing Changes', sequenceNo: 16, obsoleteFlag: 0 },
  { id: 17, codeGroupId: 15, codeDescription: 'Expired Funding', sequenceNo: 17, obsoleteFlag: 0 },
  { id: 18, codeGroupId: 16, codeDescription: 'Change of Creditor', sequenceNo: 18, obsoleteFlag: 0 },
];

type StatusFilter = 'all' | 'active' | 'obsolete';

interface FormState { codeGroupId: number; codeDescription: string; sequenceNo: number; obsoleteFlag: number; }
const EMPTY_FORM: FormState = { codeGroupId: 0, codeDescription: '', sequenceNo: 0, obsoleteFlag: 0 };

const ModificationCategoryTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [data, setData] = useState<ModCategoryData[]>(SAMPLE_DATA);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const confirm = useConfirmDialog();

  const filtered = data.filter(item => {
    const matchSearch = item.codeDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.codeGroupId).includes(searchTerm);
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.obsoleteFlag === 0) ||
      (statusFilter === 'obsolete' && item.obsoleteFlag === 1);
    return matchSearch && matchStatus;
  });

  const startEdit = (item: ModCategoryData) => {
    setEditId(item.id);
    setEditForm({ codeGroupId: item.codeGroupId, codeDescription: item.codeDescription, sequenceNo: item.sequenceNo, obsoleteFlag: item.obsoleteFlag });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = () => {
    setData(prev => prev.map(r => r.id === editId ? { ...r, ...editForm } : r));
    // TODO: PATCH /codetable/revisioncategories/{editId}
    cancelEdit();
  };
  const saveAdd = () => {
    if (!addForm) return;
    const nextId = data.length > 0 ? Math.max(...data.map(r => r.id)) + 1 : 1;
    setData(prev => [{ id: nextId, ...addForm }, ...prev]);
    // TODO: POST /codetable/revisioncategories
    setAddForm(null);
  };
  const confirmDelete = (id: number) => {
    setData(prev => prev.filter(r => r.id !== id));
    // TODO: DELETE /codetable/revisioncategories/{id}
    setDeleteConfirmId(null);
  };

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Modification Category',
      fields: [
        { label: 'Group ID',     value: addForm.codeGroupId,    mono: true },
        { label: 'Description',  value: addForm.codeDescription },
        { label: 'Seq No',       value: addForm.sequenceNo },
        { label: 'Status',       value: addForm.obsoleteFlag === 0 ? 'Active' : 'Obsolete' },
      ],
      onConfirm: () => { saveAdd(); confirm.close(); },
    });
  };
  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Modification Category',
      fields: [
        { label: 'Group ID',     value: editForm.codeGroupId,    mono: true },
        { label: 'Description',  value: editForm.codeDescription },
        { label: 'Seq No',       value: editForm.sequenceNo },
        { label: 'Status',       value: editForm.obsoleteFlag === 0 ? 'Active' : 'Obsolete' },
      ],
      onConfirm: () => { saveEdit(); confirm.close(); },
    });
  };

  const inp = (v: 'add' | 'edit', extra = 'w-full') =>
    `${extra} px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Modification Category</h4>
          <p className="text-sm text-gray-500 mt-0.5">Categories used to classify the type of project revision</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {(['all', 'active', 'obsolete'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 capitalize transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button color="indigo" className="flex items-center gap-1 text-sm" onClick={() => setAddForm(EMPTY_FORM)} disabled={!!addForm}>
            <PlusIcon className="h-4 w-4" /> Add Category
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-28">Group ID</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader className="w-24 text-center">Seq No</TableHeader>
              <TableHeader className="w-24 text-center">Status</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {addForm !== null && (
              <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                <TableCell className="text-xs text-gray-400 italic">New</TableCell>
                <TableCell><input autoFocus type="number" value={addForm.codeGroupId} onChange={e => setAddForm(f => f ? { ...f, codeGroupId: +e.target.value } : f)} placeholder="Group ID" className={inp('add', 'w-20')} /></TableCell>
                <TableCell><textarea value={addForm.codeDescription} onChange={e => setAddForm(f => f ? { ...f, codeDescription: e.target.value } : f)} placeholder="Description..." rows={3} className={inp('add')} /></TableCell>
                <TableCell><input type="number" value={addForm.sequenceNo} onChange={e => setAddForm(f => f ? { ...f, sequenceNo: +e.target.value } : f)} placeholder="0" className={inp('add', 'w-16')} /></TableCell>
                <TableCell>
                  <select value={addForm.obsoleteFlag} onChange={e => setAddForm(f => f ? { ...f, obsoleteFlag: +e.target.value } : f)} className={inp('add')}>
                    <option value={0}>Active</option>
                    <option value={1}>Obsolete</option>
                  </select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button color="indigo" className="p-1.5" onClick={requestAdd}><CheckIcon className="h-3.5 w-3.5" /></Button>
                    <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {filtered.length === 0 && !addForm ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              filtered.map(item => (
                <TableRow key={item.id} className={editId === item.id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.id}</TableCell>
                  {editId === item.id ? (
                    <>
                      <TableCell><input autoFocus type="number" value={editForm.codeGroupId} onChange={e => setEditForm(f => ({ ...f, codeGroupId: +e.target.value }))} className={inp('edit', 'w-20')} /></TableCell>
                      <TableCell><textarea value={editForm.codeDescription} onChange={e => setEditForm(f => ({ ...f, codeDescription: e.target.value }))} rows={3} className={inp('edit')} /></TableCell>
                      <TableCell><input type="number" value={editForm.sequenceNo} onChange={e => setEditForm(f => ({ ...f, sequenceNo: +e.target.value }))} className={inp('edit', 'w-16')} /></TableCell>
                      <TableCell>
                        <select value={editForm.obsoleteFlag} onChange={e => setEditForm(f => ({ ...f, obsoleteFlag: +e.target.value }))} className={inp('edit')}>
                          <option value={0}>Active</option>
                          <option value={1}>Obsolete</option>
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
                      <TableCell>
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.codeGroupId}</span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-900 max-w-xs truncate" title={item.codeDescription}>{item.codeDescription}</TableCell>
                      <TableCell className="text-center text-sm text-gray-600">{item.sequenceNo}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                          item.obsoleteFlag === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {item.obsoleteFlag === 0 ? 'Active' : 'Obsolete'}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{filtered.length} record(s) found</p>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default ModificationCategoryTable;
