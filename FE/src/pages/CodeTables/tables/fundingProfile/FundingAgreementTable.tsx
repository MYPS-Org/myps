import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AgreementEnum } from '../../../Project/Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'FundingAgreement';

interface FormState { SourceOrg: string; Code: string; Name: string; FinancingSourceSegmentCode: string; }
const EMPTY_FORM: FormState = { SourceOrg: '', Code: '', Name: '', FinancingSourceSegmentCode: '' };

const inp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${
    v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
  }`;

const FundingAgreementTable: React.FC = () => {
  const { data: codeTableData, loading } = useCodeTableContext();
  const [search, setSearch]                 = useState('');
  const [addForm, setAddForm]               = useState<FormState | null>(null);
  const [editId, setEditId]                 = useState<number | null>(null);
  const [editForm, setEditForm]             = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const confirm                             = useConfirmDialog();

  const data: AgreementEnum[] = codeTableData?.FundingAgreements ?? [];
  const filtered = data.filter(r =>
    r.Name.toLowerCase().includes(search.toLowerCase()) ||
    r.Code.toLowerCase().includes(search.toLowerCase()) ||
    r.SourceOrg.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (r: AgreementEnum) => {
    setEditId(r.Id);
    setEditForm({
      SourceOrg: r.SourceOrg,
      Code: r.Code,
      Name: r.Name,
      FinancingSourceSegmentCode: r.FinancingSourceSegmentCode,
    });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Funding Agreement',
      fields: [
        { label: 'Source Org',       value: addForm.SourceOrg, mono: true },
        { label: 'Code',             value: addForm.Code, mono: true },
        { label: 'Name',             value: addForm.Name },
        { label: 'Fin. Seg. Code',   value: addForm.FinancingSourceSegmentCode, optional: true },
      ],
      onConfirm: async () => {
        await updateCodeTable(CODE, 0, JSON.stringify(addForm));
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Funding Agreement',
      fields: [
        { label: 'Source Org',       value: editForm.SourceOrg, mono: true },
        { label: 'Code',             value: editForm.Code, mono: true },
        { label: 'Name',             value: editForm.Name },
        { label: 'Fin. Seg. Code',   value: editForm.FinancingSourceSegmentCode, optional: true },
      ],
      onConfirm: async () => {
        await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm }));
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (id: number) => {
    await updateCodeTable(CODE, 2, JSON.stringify({ Id: id }));
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Funding Agreement</h4>
          <p className="text-sm text-gray-500 mt-0.5">Loan / grant agreements tied to a funding source organization</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
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
              <TableHeader className="w-28">Source Org</TableHeader>
              <TableHeader className="w-28">Code</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader className="w-40">Fin. Seg. Code</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
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
                    <TableCell><span className="font-mono text-xs text-gray-400 px-2">auto</span></TableCell>
                    <TableCell>
                      <input autoFocus type="text" value={addForm.SourceOrg}
                        onChange={e => setAddForm(f => f ? { ...f, SourceOrg: e.target.value } : f)}
                        placeholder="Source org *" className={inp('add')} />
                    </TableCell>
                    <TableCell>
                      <input type="text" value={addForm.Code}
                        onChange={e => setAddForm(f => f ? { ...f, Code: e.target.value } : f)}
                        placeholder="Code *" className={inp('add')} />
                    </TableCell>
                    <TableCell>
                      <textarea value={addForm.Name}
                        onChange={e => setAddForm(f => f ? { ...f, Name: e.target.value } : f)}
                        placeholder="Agreement name *" rows={2} className={inp('add')} />
                    </TableCell>
                    <TableCell>
                      <input type="text" value={addForm.FinancingSourceSegmentCode}
                        onChange={e => setAddForm(f => f ? { ...f, FinancingSourceSegmentCode: e.target.value } : f)}
                        placeholder="Fin. segment code" className={inp('add')} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd}
                          disabled={!addForm.SourceOrg.trim() || !addForm.Code.trim() || !addForm.Name.trim()}>
                          <CheckIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}>
                          <XMarkIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.length === 0 && !addForm ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-400">No records found.</TableCell>
                  </TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    {editId === item.Id ? (
                      <>
                        <TableCell><span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.Id}</span></TableCell>
                        <TableCell>
                          <input type="text" value={editForm.SourceOrg}
                            onChange={e => setEditForm(f => ({ ...f, SourceOrg: e.target.value }))}
                            className={inp('edit')} />
                        </TableCell>
                        <TableCell>
                          <input type="text" value={editForm.Code}
                            onChange={e => setEditForm(f => ({ ...f, Code: e.target.value }))}
                            className={inp('edit')} />
                        </TableCell>
                        <TableCell>
                          <textarea value={editForm.Name}
                            onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))}
                            rows={2} className={inp('edit')} />
                        </TableCell>
                        <TableCell>
                          <input type="text" value={editForm.FinancingSourceSegmentCode}
                            onChange={e => setEditForm(f => ({ ...f, FinancingSourceSegmentCode: e.target.value }))}
                            className={inp('edit')} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="amber" className="p-1.5" onClick={requestEdit}
                              disabled={!editForm.SourceOrg.trim() || !editForm.Code.trim() || !editForm.Name.trim()}>
                              <CheckIcon className="h-3.5 w-3.5" />
                            </Button>
                            <Button color="zinc" className="p-1.5" onClick={cancelEdit}>
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell><span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.Id}</span></TableCell>
                        <TableCell className="font-mono text-sm text-gray-700">{item.SourceOrg}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {item.Code}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">{item.Name}</TableCell>
                        <TableCell className="font-mono text-xs text-gray-600">{item.FinancingSourceSegmentCode || <span className="text-gray-300 italic">—</span>}</TableCell>
                        <TableCell>
                          {deleteConfirmId === item.Id ? (
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-red-600 font-medium">Delete?</span>
                              <Button color="red" className="p-1" onClick={() => confirmDelete(item.Id)}>
                                <CheckIcon className="h-3 w-3" />
                              </Button>
                              <Button color="zinc" className="p-1" onClick={() => setDeleteConfirmId(null)}>
                                <XMarkIcon className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button plain className="p-1 text-gray-400 hover:text-amber-600" onClick={() => startEdit(item)}>
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button plain className="p-1 text-gray-400 hover:text-red-600" onClick={() => setDeleteConfirmId(item.Id)}>
                                <TrashIcon className="h-4 w-4" />
                              </Button>
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
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default FundingAgreementTable;
