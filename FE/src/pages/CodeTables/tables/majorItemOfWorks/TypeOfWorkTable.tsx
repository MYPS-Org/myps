import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeader
} from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

const CODE = 'ProjectScopeOfWork';

interface TypeOfWork {
  id: number;        // real ScopeOfWorkEnum.Id
  infraType: string;
  majorWorkCategory: string;
  typeOfWork: string;
  measure: number;
  dataType: 'Integer' | 'Real';
  minAmount: number | null;
  maxAmount: number | null;
  isActive?: boolean;
}

interface FormState {
  infraType: string;
  workCategory: string;
  description: string;
  measure: number;
  minAmount: string;
  maxAmount: string;
}
const EMPTY_FORM: FormState = { infraType: '', workCategory: '', description: '', measure: 0, minAmount: '', maxAmount: '' };

const formatAmount = (val: number | null) => val === null ? <span className="text-gray-400">—</span> : <span>{val.toLocaleString()}</span>;

const inp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

const numInp = (v: 'add' | 'edit') =>
  `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${v === 'add' ? 'border-indigo-300 focus:ring-indigo-500' : 'border-amber-300 focus:ring-amber-500'}`;

const TypeOfWorkTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInfraType, setSelectedInfraType] = useState('');
  const [selectedWorkCategory, setSelectedWorkCategory] = useState('');
  const [filteredData, setFilteredData] = useState<TypeOfWork[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [addForm, setAddForm] = useState<FormState | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const itemsPerPage = 15;
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();

  // Flatten ScopeOfWorks into one row per infra-type entry, using real ScopeOfWorkEnum.Id
  const allData = useMemo<TypeOfWork[]>(() => {
    const scopes = codeTableData?.ScopeOfWorks ?? [];
    const rows: TypeOfWork[] = [];
    for (const s of scopes) {
      const infraTypes = Array.isArray(s.InfraType) ? s.InfraType : [String(s.InfraType)];
      for (const infra of infraTypes) {
        rows.push({
          id: s.Id,
          infraType: infra,
          majorWorkCategory: s.WorkCategory,
          typeOfWork: s.Description,
          measure: s.Measure,
          dataType: s.Measure === 0 ? 'Integer' : 'Real',
          minAmount: s.MinAmount ?? null,
          maxAmount: s.MaxAmount ?? null,
          isActive: s.IsActive,
        });
      }
    }
    return rows;
  }, [codeTableData]);

  const uniqueInfraTypes = useMemo(() => [...new Set(allData.map(d => d.infraType))].sort(), [allData]);
  const uniqueWorkCategories = useMemo(() => [...new Set(allData.map(d => d.majorWorkCategory))].sort(), [allData]);

  useEffect(() => {
    let filtered = allData;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.typeOfWork.toLowerCase().includes(lower) ||
        d.infraType.toLowerCase().includes(lower) ||
        d.majorWorkCategory.toLowerCase().includes(lower)
      );
    }
    if (selectedInfraType) filtered = filtered.filter(d => d.infraType === selectedInfraType);
    if (selectedWorkCategory) filtered = filtered.filter(d => d.majorWorkCategory === selectedWorkCategory);
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedInfraType, selectedWorkCategory, allData]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const pageData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startEdit = (item: TypeOfWork) => {
    setEditId(item.id);
    setEditForm({
      infraType: item.infraType,
      workCategory: item.majorWorkCategory,
      description: item.typeOfWork,
      measure: item.measure,
      minAmount: item.minAmount !== null ? String(item.minAmount) : '',
      maxAmount: item.maxAmount !== null ? String(item.maxAmount) : '',
    });
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: TypeOfWork) => {
    const currentActive = item.isActive !== false;
    const nextActive = !currentActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Type of Work',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
        { label: 'Type of Work', value: item.typeOfWork },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ Id: item.id, InfraType: [item.infraType], WorkCategory: item.majorWorkCategory, Description: item.typeOfWork, Measure: item.measure, MinAmount: item.minAmount, MaxAmount: item.maxAmount, IsActive: nextActive }));
          showToast({ type: 'success', message: `Type of work ${nextActive ? 'activated' : 'deactivated'}.` });
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
      tableName: 'Type of Work',
      fields: [
        { label: 'Infra Type',    value: addForm.infraType },
        { label: 'Work Category', value: addForm.workCategory },
        { label: 'Description',   value: addForm.description },
        { label: 'Measure',       value: addForm.measure === 0 ? 'Integer (0)' : 'Real (1)' },
        { label: 'Min Amount',    value: addForm.minAmount || '—' },
        { label: 'Max Amount',    value: addForm.maxAmount || '—' },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 0, JSON.stringify({
            InfraType: [addForm.infraType],
            WorkCategory: addForm.workCategory,
            Description: addForm.description,
            Measure: addForm.measure,
            MinAmount: addForm.minAmount !== '' ? Number(addForm.minAmount) : null,
            MaxAmount: addForm.maxAmount !== '' ? Number(addForm.maxAmount) : null,
          }));
          showToast({ type: 'success', message: 'Type of work added successfully.' });
          await refetch();
        } catch (error) {
          // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
          if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to add type of work.' });
        }
        confirm.close();
        setAddForm(null);
      },
    });
  };

  const requestEdit = (item: TypeOfWork) => {
    confirm.request({
      mode: 'edit',
      tableName: 'Type of Work',
      fields: [
        { label: 'Infra Type',    value: editForm.infraType },
        { label: 'Work Category', value: editForm.workCategory },
        { label: 'Description',   value: editForm.description },
        { label: 'Measure',       value: editForm.measure === 0 ? 'Integer (0)' : 'Real (1)' },
        { label: 'Min Amount',    value: editForm.minAmount || '—' },
        { label: 'Max Amount',    value: editForm.maxAmount || '—' },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({
            Id: item.id,
            InfraType: [editForm.infraType],
            WorkCategory: editForm.workCategory,
            Description: editForm.description,
            Measure: editForm.measure,
            MinAmount: editForm.minAmount !== '' ? Number(editForm.minAmount) : null,
            MaxAmount: editForm.maxAmount !== '' ? Number(editForm.maxAmount) : null,
          }));
          showToast({ type: 'success', message: 'Type of work updated successfully.' });
          await refetch();
        } catch (error) {
          // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
          if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to update type of work.' });
        }
        confirm.close();
        cancelEdit();
      },
    });
  };

  const confirmDelete = async (payload: TypeOfWork) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Type of work deleted.' });
      await refetch();
    } catch (error) {
      // The httpClient interceptor already toasted the API's reason; toast only when it stayed silent.
      if (!(error as { Message?: string } | undefined)?.Message) showToast({ type: 'error', message: 'Failed to delete type of work.' });
    }
    setDeleteConfirmId(null);
  };

  const addF = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setAddForm(f => f ? { ...f, [field]: field === 'measure' ? Number(e.target.value) : e.target.value } : f);

  const editF = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setEditForm(f => ({ ...f, [field]: field === 'measure' ? Number(e.target.value) : e.target.value }));

  const addValid = addForm ? addForm.infraType.trim() && addForm.workCategory.trim() && addForm.description.trim() : false;
  const editValid = editForm.infraType.trim() && editForm.workCategory.trim() && editForm.description.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Type of Work</h4>
          <p className="text-sm text-gray-500 mt-0.5">Specific work type definitions with measurement units and quantity limits</p>
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
          <select
            value={selectedWorkCategory}
            onChange={e => setSelectedWorkCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Work Categories</option>
            {uniqueWorkCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button color="indigo" className="flex items-center gap-1 text-sm" onClick={() => setAddForm(EMPTY_FORM)} disabled={!!addForm}>
            <PlusIcon className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Infrastructure Type</TableHeader>
              <TableHeader>Work Category</TableHeader>
              <TableHeader>Type of Work</TableHeader>
              <TableHeader className="w-20 text-center">Data Type</TableHeader>
              <TableHeader className="w-24 text-center">Min</TableHeader>
              <TableHeader className="w-24 text-center">Max</TableHeader>
              <TableHeader className="w-24 text-center">Active</TableHeader>
              <TableHeader className="w-32">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
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
                    <TableCell><textarea autoFocus value={addForm.infraType} onChange={addF('infraType')} placeholder="Infra type..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.workCategory} onChange={addF('workCategory')} placeholder="Work category..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell><textarea value={addForm.description} onChange={addF('description')} placeholder="Type of work..." rows={2} className={inp('add')} /></TableCell>
                    <TableCell>
                      <select value={addForm.measure} onChange={addF('measure')} className={numInp('add')}>
                        <option value={0}>Integer</option>
                        <option value={1}>Real</option>
                      </select>
                    </TableCell>
                    <TableCell><input type="number" value={addForm.minAmount} onChange={addF('minAmount')} placeholder="Min..." className={numInp('add')} /></TableCell>
                    <TableCell><input type="number" value={addForm.maxAmount} onChange={addF('maxAmount')} placeholder="Max..." className={numInp('add')} /></TableCell>
                    <TableCell />
                    <TableCell>
                      <div className="flex gap-1">
                        <Button color="indigo" className="p-1.5" onClick={requestAdd} disabled={!addValid}><CheckIcon className="h-3.5 w-3.5" /></Button>
                        <Button color="zinc" className="p-1.5" onClick={() => setAddForm(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {pageData.length === 0 && !addForm ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-gray-500">No records found.</TableCell>
                  </TableRow>
                ) : (
                  pageData.map((item, idx) => (
                    <TableRow key={`${item.id}-${item.infraType}-${idx}`} className={editId === item.id ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                      {editId === item.id ? (
                        <>
                          <TableCell><textarea autoFocus value={editForm.infraType} onChange={editF('infraType')} rows={2} className={inp('edit')} /></TableCell>
                          <TableCell><textarea value={editForm.workCategory} onChange={editF('workCategory')} rows={2} className={inp('edit')} /></TableCell>
                          <TableCell><textarea value={editForm.description} onChange={editF('description')} rows={2} className={inp('edit')} /></TableCell>
                          <TableCell>
                            <select value={editForm.measure} onChange={editF('measure')} className={numInp('edit')}>
                              <option value={0}>Integer</option>
                              <option value={1}>Real</option>
                            </select>
                          </TableCell>
                          <TableCell><input type="number" value={editForm.minAmount} onChange={editF('minAmount')} className={numInp('edit')} /></TableCell>
                          <TableCell><input type="number" value={editForm.maxAmount} onChange={editF('maxAmount')} className={numInp('edit')} /></TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${
                              item.isActive !== false
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-100 text-gray-500 border-gray-300'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${item.isActive !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {item.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button color="amber" className="p-1.5" onClick={() => requestEdit(item)} disabled={!editValid}><CheckIcon className="h-3.5 w-3.5" /></Button>
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
                          <TableCell className="max-w-[160px]"><span className="block truncate text-sm text-gray-700" title={item.majorWorkCategory}>{item.majorWorkCategory}</span></TableCell>
                          <TableCell className="max-w-[200px]"><span className="block truncate text-sm text-gray-900" title={item.typeOfWork}>{item.typeOfWork}</span></TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                              item.dataType === 'Integer'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-green-50 text-green-700 border-green-200'
                            }`}>
                              {item.dataType}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-sm">{formatAmount(item.minAmount)}</TableCell>
                          <TableCell className="text-center text-sm">{formatAmount(item.maxAmount)}</TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => requestToggleActive(item)}
                              title={item.isActive !== false ? 'Click to deactivate' : 'Click to activate'}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer transition-colors shadow-sm ${
                                item.isActive !== false
                                  ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${item.isActive !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {item.isActive !== false ? 'Active' : 'Inactive'}
                            </button>
                          </TableCell>
                          <TableCell>
                            {deleteConfirmId === item.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-red-600">Delete?</span>
                                <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item)}>Yes</Button>
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
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        {/* Client doesn't want the "Showing X of Y entries" summary — commented out, not deleted.
        <span>
          Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
        </span>
        */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        )}
      </div>
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default TypeOfWorkTable;
