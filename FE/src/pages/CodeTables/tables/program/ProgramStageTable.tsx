import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ProgramEnums } from '../../Model.d';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'ProgramStage';

interface FormState { NameId: number; Name: string; Description: string; }
const EMPTY_FORM: FormState = { NameId: 0, Name: '', Description: '' };

const ProgramStageTable: React.FC = () => {
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const [search, setSearch]                 = useState('');
  const [addForm, setAddForm]               = useState<FormState | null>(null);
  const [editId, setEditId]                 = useState<number | null>(null);
  const [editForm, setEditForm]             = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const confirm                             = useConfirmDialog();

  const data: ProgramEnums[] = codeTableData?.ProgramStages ?? [];
  const filtered = data.filter(r => r.Name.toLowerCase().includes(search.toLowerCase()));

  const startEdit = (r: ProgramEnums) => {
    setEditId(r.Id);
    setEditForm({ NameId: r.NameId, Name: r.Name, Description: r.Description ?? '' });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: ProgramEnums) => {
    const currentActive = item.IsActive !== false;
    const nextActive = !currentActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Program Stage',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Name', value: item.Name },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: item.Id, NameId: item.NameId, Name: item.Name, Description: item.Description, IsActive: nextActive }));
          showToast({ type: 'success', message: `Program stage ${nextActive ? 'activated' : 'deactivated'}.` });
          await refetch();
        } catch (error) {
          // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
          if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to update active status.' });
        }
        confirm.close();
      },
    });
  };

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Program Stage',
      fields: [
        { label: 'Name',         value: addForm.Name },
        { label: 'Description',  value: addForm.Description, optional: true },
      ],
      onConfirm: async () => {
        try {
          // Created active (the toggle shows it right away). No NameId: the server assigns the next one.
          await updateCodeTable(CODE, 0, JSON.stringify({ ...addForm, NameId: 0, IsActive: true }));
          showToast({ type: 'success', message: 'Program stage added.' });
          await refetch();
        } catch (error) {
          // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
          if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to add program stage.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = () => {
    confirm.request({
      mode: 'edit',
      tableName: 'Program Stage',
      fields: [
        { label: 'Name',         value: editForm.Name },
        { label: 'Description',  value: editForm.Description, optional: true },
      ],
      onConfirm: async () => {
        try {
          // IsActive is not on the form: send the current value or the edit would deactivate the row.
          const original = data.find(r => r.Id === editId);
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editForm, IsActive: original?.IsActive !== false }));
          showToast({ type: 'success', message: 'Program stage updated.' });
          await refetch();
        } catch (error) {
          // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
          if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to update program stage.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (payload: ProgramEnums) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Program stage deleted.' });
      await refetch();
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to delete program stage.' });
    }
    setDeleteConfirmId(null);
  };

  const inp = (v: 'add' | 'edit') =>
    `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${
      v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Program Stage</h4>
          <p className="text-sm text-gray-500 mt-0.5">Budget program stages (e.g., RDIP, PIP, GAA)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52" />
          </div>
          {/* 2026-10-29: no Add. The stages are fixed by the system (stage order, Project ID
              prefixes); a stage added here could not be used, and the API now refuses it. */}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-16">Id</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
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
                    <TableCell><span className="font-mono text-xs text-gray-400 px-2">auto</span></TableCell>
                    <TableCell>
                      <textarea autoFocus value={addForm.Name}
                        onChange={e => setAddForm(f => f ? { ...f, Name: e.target.value } : f)}
                        placeholder="Stage name *" rows={2} className={inp('add')} />
                    </TableCell>
                    <TableCell>
                      <textarea value={addForm.Description}
                        onChange={e => setAddForm(f => f ? { ...f, Description: e.target.value } : f)}
                        placeholder="Description (optional)" rows={2} className={inp('add')} />
                    </TableCell>
                    <TableCell />
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd}
                          disabled={!addForm.Name.trim()}>
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
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400">No records found.</TableCell>
                  </TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.Id} className={editId === item.Id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    {editId === item.Id ? (
                      <>
                        <TableCell><span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.Id}</span></TableCell>
                        <TableCell>
                          <textarea value={editForm.Name}
                            onChange={e => setEditForm(f => ({ ...f, Name: e.target.value }))}
                            rows={2} className={inp('edit')} />
                        </TableCell>
                        <TableCell>
                          <textarea value={editForm.Description}
                            onChange={e => setEditForm(f => ({ ...f, Description: e.target.value }))}
                            placeholder="Description (optional)" rows={2} className={inp('edit')} />
                        </TableCell>
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
                            <Button color="amber" className="p-1.5" onClick={requestEdit}
                              disabled={!editForm.Name.trim()}>
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
                        <TableCell className="font-medium text-gray-900">{item.Name}</TableCell>
                        <TableCell className="text-gray-600">{item.Description || <span className="text-gray-300 italic">—</span>}</TableCell>
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
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-red-600 font-medium">Delete?</span>
                              <Button color="red" className="p-1" onClick={() => confirmDelete(item)}>
                                <CheckIcon className="h-3 w-3" />
                              </Button>
                              <Button color="zinc" className="p-1" onClick={() => setDeleteConfirmId(null)}>
                                <XMarkIcon className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button color='zinc' className="p-1 text-gray-400 hover:text-amber-600" onClick={() => startEdit(item)}>
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button color='red' className="p-1 text-gray-400 hover:text-red-600" onClick={() => setDeleteConfirmId(item.Id)}>
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

export default ProgramStageTable;
