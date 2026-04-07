import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'ProjectScopeOfWork';

interface WorkCategoryRow {
  id: number;
  sourceId: number; // ScopeOfWorkEnum.Id
  infraType: string;
  category: string;
}

interface FormState { infraType: string; category: string; }
const EMPTY_FORM: FormState = { infraType: '', category: '' };

const inp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

const WorkCategoryTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInfraType, setSelectedInfraType] = useState('');
  const [filteredData, setFilteredData] = useState<WorkCategoryRow[]>([]);
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmSourceId, setDeleteConfirmSourceId] = useState<number | null>(null);
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();

  const allData = useMemo<WorkCategoryRow[]>(() => {
    const scopes = codeTableData?.ScopeOfWorks ?? [];
    const seen = new Set<string>();
    const rows: WorkCategoryRow[] = [];
    let id = 1;
    for (const s of scopes) {
      const infraTypes = Array.isArray(s.InfraType) ? s.InfraType : [String(s.InfraType)];
      for (const infra of infraTypes) {
        const key = `${infra}||${s.WorkCategory}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({ id: id++, sourceId: s.Id, infraType: infra, category: s.WorkCategory });
        }
      }
    }
    return rows;
  }, [codeTableData]);

  const uniqueInfraTypes = useMemo(() => [...new Set(allData.map(d => d.infraType))].sort(), [allData]);

  useEffect(() => {
    let filtered = allData;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.infraType.toLowerCase().includes(lower) || d.category.toLowerCase().includes(lower)
      );
    }
    if (selectedInfraType) filtered = filtered.filter(d => d.infraType === selectedInfraType);
    setFilteredData(filtered);
  }, [searchTerm, selectedInfraType, allData]);

  const startEdit = (row: WorkCategoryRow) => {
    setEditId(row.id);
    setEditForm({ infraType: row.infraType, category: row.category });
    setDeleteConfirmSourceId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestAdd = () => {
    if (!addForm) return;
    confirm.request({
      mode: 'add',
      tableName: 'Work Category',
      fields: [
        { label: 'Infra Type',     value: addForm.infraType },
        { label: 'Work Category',  value: addForm.category },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify({ InfraType: addForm.infraType, WorkCategory: addForm.category }));
          showToast({ type: 'success', message: 'Work category added successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to add work category.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = (row: WorkCategoryRow) => {
    confirm.request({
      mode: 'edit',
      tableName: 'Work Category',
      fields: [
        { label: 'Infra Type',     value: editForm.infraType },
        { label: 'Work Category',  value: editForm.category },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: row.sourceId, InfraType: editForm.infraType, WorkCategory: editForm.category }));
          showToast({ type: 'success', message: 'Work category updated successfully.' });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update work category.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (sourceId: number) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify({ Id: sourceId }));
      showToast({ type: 'success', message: 'Work category deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete work category.' });
    }
    setDeleteConfirmSourceId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Major Work Category</h4>
          <p className="text-sm text-gray-500 mt-0.5">Defines valid work categories per infrastructure type</p>
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
          <select
            value={selectedInfraType}
            onChange={e => setSelectedInfraType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Infra Types</option>
            {uniqueInfraTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
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
              <TableHeader>Infrastructure Type</TableHeader>
              <TableHeader>Work Category</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {addForm !== null && (
                  <TableRow className="bg-indigo-50 border-l-4 border-indigo-400">
                    <TableCell className="text-xs text-gray-400 italic">New</TableCell>
                    <TableCell><textarea autoFocus value={addForm.infraType} onChange={e => setAddForm(f => f ? { ...f, infraType: e.target.value } : f)} placeholder="Infra type..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.category} onChange={e => setAddForm(f => f ? { ...f, category: e.target.value } : f)} placeholder="Work category..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd} disabled={!addForm.infraType.trim() || !addForm.category.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filteredData.length === 0 && !addForm ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-gray-500">No records found.</TableCell></TableRow>
                ) : filteredData.map(item => (
                  <TableRow key={item.id} className={editId === item.id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                    <TableCell className="font-mono text-xs text-gray-500">{item.id}</TableCell>
                    {editId === item.id ? (
                      <>
                        <TableCell><textarea autoFocus value={editForm.infraType} onChange={e => setEditForm(f => ({ ...f, infraType: e.target.value }))} rows={2} className={inp('edit')} /></TableCell>
                        <TableCell><textarea value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} rows={2} className={inp('edit')} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button color="amber" className="p-1.5" onClick={() => requestEdit(item)} disabled={!editForm.infraType.trim() || !editForm.category.trim()}><CheckIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                            {item.infraType}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-900">{item.category}</TableCell>
                        <TableCell>
                          {deleteConfirmSourceId === item.sourceId ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600">Delete?</span>
                              <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item.sourceId)}>Yes</Button>
                              <Button color="zinc" className="px-2 py-1 text-xs" onClick={() => setDeleteConfirmSourceId(null)}>No</Button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <Button color="zinc" className="p-1.5" onClick={() => startEdit(item)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                              <Button color="red" className="p-1.5" onClick={() => setDeleteConfirmSourceId(item.sourceId)}><TrashIcon className="h-3.5 w-3.5" /></Button>
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
      <p className="text-xs text-gray-400">{filteredData.length} record(s) found</p>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default WorkCategoryTable;

