import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCodeTableContext } from '../../CodeTableContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';

const CODE = 'RevisionHeader';

const inp = () =>
  'w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 resize-none border-amber-300 focus:ring-amber-500';

const RevisionHeaderTable: React.FC = () => {
  const { data: codeTableData, loading, refetch } = useCodeTableContext();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = (codeTableData?.RevisionHeaders ?? []) as any[];
  const columns: string[] = data.length > 0 ? Object.keys(data[0]) : [];
  const editableColumns = columns.filter(c => c !== 'Id');

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

  const saveEdit = async () => {
    try {
      await updateCodeTable(CODE, 1, JSON.stringify({ Id: editId, ...editRow }));
      showToast({ type: 'success', message: 'Revision Header updated.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to update revision header.' });
    }
    cancelEdit();
  };

  const confirmDelete = async (id: number) => {
    try {
      await updateCodeTable(CODE, 2, JSON.stringify({ Id: id }));
      showToast({ type: 'success', message: 'Revision Header deleted.' });
      await refetch();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete revision header.' });
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Revision Headers</h4>
          <p className="text-sm text-gray-500 mt-0.5">Header-level metadata and configuration for revision records</p>
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
                <TableHeader className="w-28">Actions</TableHeader>
              </TableRow>
            </TableHead>
          )}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-10">
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
                <TableCell colSpan={columns.length + 1} className="text-center py-10 text-gray-400">No records found.</TableCell>
              </TableRow>
            ) : filtered.map((item, idx) => {
              const isEditing = editId === (item['Id'] as number);
              return (
                <TableRow key={item['Id'] ?? idx} className={isEditing ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  {isEditing ? (
                    <>
                      <TableCell><span className="font-mono text-xs text-gray-400">{item['Id']}</span></TableCell>
                      {editableColumns.map(col => (
                        <TableCell key={col}>
                          <input value={editRow[col] ?? ''} onChange={e => setEditRow(r => ({ ...r, [col]: e.target.value }))} className={inp()} />
                        </TableCell>
                      ))}
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
                            : String(item[col])}
                        </TableCell>
                      ))}
                      <TableCell>
                        {deleteConfirmId === item['Id'] ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Delete?</span>
                            <Button color="red" className="px-2 py-1 text-xs" onClick={() => confirmDelete(item['Id'] as number)}>Yes</Button>
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
    </div>
  );
};

export default RevisionHeaderTable;
