import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAdminAreaContext } from '../../AdminAreaContext';
import { updateCodeTable } from '../../Service';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { useConfirmDialog } from '../../dialogs/useConfirmDialog';

/*  Admin Areas come from AAMS (UAT S04-TC020..TC024): MYPS must not add, rename or delete them.
    Every table is read-only except, where `link` is given, the one field that links a row to its
    parent (a province's region, a city's province, ...). The API enforces the same rule. */

export interface AdminAreaColumn<T> {
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
  /** Text the search box matches against. */
  text: (row: T) => string;
}

export interface AdminAreaLink<T> {
  header: string;
  /** The row property holding the parent's key, e.g. RegionParticipantId. */
  field: keyof T & string;
  options: { value: string; label: string }[];
  render: (row: T) => React.ReactNode;
  text: (row: T) => string;
}

interface AdminAreaTableProps<T extends { Id: number; Deprecated?: boolean }> {
  title: string;
  description: string;
  /** UpdateCodeTable code, e.g. "AdminAreaProvince". */
  code: string;
  /** Singular, for the confirm dialog and toasts. */
  label: string;
  rows: T[];
  columns: AdminAreaColumn<T>[];
  link?: AdminAreaLink<T>;
  /** Show the (read-only) Active badge; DEO rows carry no Deprecated flag. */
  showActive?: boolean;
}

const ITEMS_PER_PAGE = 15;

function AdminAreaTable<T extends { Id: number; Deprecated?: boolean }>({
  title, description, code, label, rows, columns, link, showActive = true,
}: AdminAreaTableProps<T>) {
  const { loading, refetch } = useAdminAreaContext();
  const { showToast } = useToast();
  const confirm = useConfirmDialog();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editId, setEditId] = useState<number | null>(null);
  const [linkValue, setLinkValue] = useState('');

  const q = search.toLowerCase();
  const filtered = rows.filter(r =>
    columns.some(c => c.text(r).toLowerCase().includes(q)) || (link?.text(r).toLowerCase().includes(q) ?? false)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const colCount = columns.length + (link ? 1 : 0) + (showActive ? 1 : 0) + (link ? 1 : 0);

  const startEdit = (row: T) => {
    if (!link) return;
    setEditId(row.Id);
    setLinkValue(String(row[link.field] ?? ''));
  };

  const requestSave = (row: T) => {
    if (!link) return;
    const optionLabel = link.options.find(o => o.value === linkValue)?.label ?? linkValue;
    const nameColumn = columns.find(c => c.header === 'Name');
    confirm.request({
      mode: 'edit',
      tableName: label,
      fields: [
        { label: 'Name', value: nameColumn ? nameColumn.text(row) : String(row.Id) },
        { label: link.header, value: optionLabel },
      ],
      onConfirm: async () => {
        try {
          // Send the stored row with only the link changed: the API refuses any other change.
          await updateCodeTable(code, 1, JSON.stringify({ ...row, [link.field]: linkValue }));
          showToast({ type: 'success', message: `${label} updated.` });
          await refetch();
        } catch {
          showToast({ type: 'error', message: `Failed to update ${label.toLowerCase()}.` });
        }
        confirm.close();
        setEditId(null);
      },
    });
  };

  const activeBadge = (row: T) => {
    const active = row.Deprecated !== true;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${
        active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-300'
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
        {active ? 'Active' : 'Inactive'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Maintained in AAMS{link ? `; only the ${link.header.toLowerCase()} link can be changed here.` : ' — read-only.'}
          </p>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search..." value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              {columns.map(c => <TableHeader key={c.header} className={c.className}>{c.header}</TableHeader>)}
              {link && <TableHeader className="w-56">{link.header}</TableHeader>}
              {showActive && <TableHeader className="w-24 text-center">Active</TableHeader>}
              {link && <TableHeader className="w-24">Actions</TableHeader>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={colCount} className="text-center py-10 text-gray-400">Loading...</TableCell></TableRow>
            ) : pageData.length === 0 ? (
              <TableRow><TableCell colSpan={colCount} className="text-center py-10 text-gray-400">No records found.</TableCell></TableRow>
            ) : pageData.map(row => {
              const editing = editId === row.Id;
              return (
                <TableRow key={row.Id} className={editing ? 'bg-amber-50 border-l-4 border-amber-400' : undefined}>
                  {columns.map(c => <TableCell key={c.header}>{c.render(row)}</TableCell>)}
                  {link && (
                    <TableCell>
                      {editing ? (
                        <select autoFocus value={linkValue} onChange={e => setLinkValue(e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 bg-white border-amber-300 focus:ring-amber-500">
                          <option value="">— Select {link.header} —</option>
                          {link.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : link.render(row)}
                    </TableCell>
                  )}
                  {showActive && <TableCell className="text-center">{activeBadge(row)}</TableCell>}
                  {link && (
                    <TableCell>
                      {editing ? (
                        <div className="flex gap-1">
                          <Button color="amber" className="p-1.5" onClick={() => requestSave(row)}
                            disabled={!linkValue || linkValue === String(row[link.field] ?? '')}>
                            <CheckIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button color="zinc" className="p-1.5" onClick={() => setEditId(null)}><XMarkIcon className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <Button color="zinc" className="p-1.5" onClick={() => startEdit(row)} title={`Change ${link.header.toLowerCase()}`}>
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
          <div className="flex items-center gap-2">
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
}

export default AdminAreaTable;
