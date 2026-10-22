import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

// Must match the server's switch ("RevisionDocuments"): with the singular, every edit and delete
// was refused as "Invalid Code".
const CODE = 'RevisionDocuments';

// Only SecondSegmentName and Description are saved as typed. RevisionGroupId / CategoryId are keys shown with their
// names below, and IsActive has its own toggle, so they are not free-text fields.
const EDITABLE_COLUMNS = ['SecondSegmentName', 'Description'];

const inp = () =>
  'w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none border-amber-300 focus:ring-amber-500';

const RevisionDocumentTable: React.FC = () => {
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = (codeTableData?.RevisionDocuments ?? []) as any[];
  const columns: string[] = data.length > 0 ? Object.keys(data[0]).filter(c => c !== 'IsActive') : [];
  const editableColumns = columns.filter(c => EDITABLE_COLUMNS.includes(c));

  // Bare numbers meant nothing to a reader: show the header / category name next to the id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headers = (codeTableData?.RevisionHeaders ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories = (codeTableData?.RevisionCategories ?? []) as any[];
  const display = (col: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '';
    if (col === 'RevisionGroupId') {
      const name = headers.find(h => h.RevisionGroupId === value)?.RevisionName;
      return name ? `${name} (${value})` : String(value);
    }
    if (col === 'CategoryId') {
      const name = categories.find(c => c.CategoryId === value)?.CategoryName;
      return name ? `${name} (${value})` : String(value);
    }
    return String(value);
  };

  const filtered = search
    ? data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
    : data;

  const startEdit = (item: Record<string, unknown>) => {
    setEditId(item['Id'] as number);
    const row: Record<string, string> = {};
    editableColumns.forEach(c => { row[c] = String(item[c] ?? ''); });
    setEditRow(row);
    setDeleteConfirmId(null);
  };
  const cancelEdit = () => setEditId(null);

  const requestToggleActive = (item: Record<string, unknown>) => {
    const currentActive = item['IsActive'] !== false;
    const nextActive = !currentActive;
    confirm.request({
      mode: 'edit',
      tableName: 'Revision Document',
      fields: [
        { label: 'Action', value: nextActive ? 'Activate' : 'Deactivate' },
      ],
      onConfirm: async () => {
        try {
          await updateCodeTable(CODE, 1, JSON.stringify({ ...item, IsActive: nextActive }));
          showToast({ type: 'success', message: `Revision document ${nextActive ? 'activated' : 'deactivated'}.` });
          await refetch();
        } catch {
          showToast({ type: 'error', message: 'Failed to update active status.' });
        }
        confirm.close();
      },
    });
  };

  const saveEdit = async () => {
    try {
      const original = data.find(r => r['Id'] === editId);
      await updateCodeTable(CODE, 1, JSON.stringify({ ...original, ...editRow, Id: editId }));
      showToast({ type: 'success', message: 'Revision Document updated.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to update revision document.' });
    }
    cancelEdit();
  };

  const confirmDelete = async (payload: Record<string, unknown>) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify(payload));
      showToast({ type: 'success', message: 'Revision Document deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete revision document.' });
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Revision Documents</h4>
          <p className="text-sm text-gray-500 mt-0.5">Document types required or referenced during revision processing</p>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          {columns.length > 0 && (
            <TableHead>
              <TableRow>
                {columns.map(col => <TableHeader key={col}>{col}</TableHeader>)}
                <TableHeader className="w-24 text-center">Active</TableHeader>
                <TableHeader className="w-28">Actions</TableHeader>
              </TableRow>
            </TableHead>
          )}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="text-center py-10">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="text-center py-10 text-gray-400">No records found.</TableCell>
              </TableRow>
            ) : filtered.map((item, idx) => {
              const isEditing = editId === (item['Id'] as number);
              return (
                <TableRow key={item['Id'] ?? idx} className={isEditing ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  {isEditing ? (
                    <>
                      {columns.map(col => (
                        <TableCell key={col}>
                          {editableColumns.includes(col)
                            ? <input value={editRow[col] ?? ''} onChange={e => setEditRow(r => ({ ...r, [col]: e.target.value }))} className={inp()} />
                            : <span className="text-xs text-gray-500">{display(col, item[col])}</span>}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${
                          item['IsActive'] !== false
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-300'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${item['IsActive'] !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {item['IsActive'] !== false ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button color="amber" className="p-1.5" onClick={saveEdit}><CheckIcon className="h-3.5 w-3.5" /></Button>
                          <Button color="zinc" className="p-1.5" onClick={cancelEdit}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      {columns.map(col => (
                        <TableCell key={col} className="text-sm text-gray-700">
                          {item[col] === null || item[col] === undefined || item[col] === ''
                            ? <span className="text-gray-300 italic">&mdash;</span>
                            : display(col, item[col])}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <button
                          onClick={() => requestToggleActive(item as Record<string, unknown>)}
                          title={item['IsActive'] !== false ? 'Click to deactivate' : 'Click to activate'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer transition-colors shadow-sm ${
                            item['IsActive'] !== false
                              ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                              : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${item['IsActive'] !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {item['IsActive'] !== false ? 'Active' : 'Inactive'}
                        </button>
                      </TableCell>
                      <TableCell>
                        {deleteConfirmId === item['Id'] ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Delete?</span>
                            <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item as Record<string, unknown>)}>Yes</Button>
                            <Button color="zinc" className="px-2 py-1 text-xs" onClick={() => setDeleteConfirmId(null)}>No</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <Button color="zinc" className="p-1.5" onClick={() => startEdit(item as Record<string, unknown>)}><PencilIcon className="h-3.5 w-3.5" /></Button>
                            <Button color="red" className="p-1.5" onClick={() => setDeleteConfirmId(item['Id'] as number)}><TrashIcon className="h-3.5 w-3.5" /></Button>
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
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
};

export default RevisionDocumentTable;
