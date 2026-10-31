// =============================================================================
// Code Tables > Multi-Year: the planning code lists a portfolio membership uses
// (MY-PFL-14, -15). Served by MultiYearController (ShowMultiYearCodeLists /
// SaveMultiYearCodeListItem), not by CodeTableController.
//
// Each value has Valid From / Valid To years (0 = no limit) and Active. It can be
// picked when it is Active OR valid for the membership's start year. There is no
// Delete: a value is RETIRED (Active off, or a Valid To year) so the memberships
// that chose it keep it. A value in use cannot be renamed; retire it and add a
// new one instead.
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../../components/tailwindui/button';
import { Badge } from '../../../../components/tailwindui/badge';
import { useToast } from '../../../../components/toaster/ToasterContext';
import { useAuth } from '../../../../contexts/AuthContext';
import type { CodeListItem, CodeListName, MultiYearCodeLists } from '../../../MultiYear/Model.d';
import * as Service from '../../../MultiYear/Service';
import { validityLabel } from '../../../MultiYear/utils';
import { Field, INPUT_CLASS, ModuleDialog } from '../../../MultiYear/components/Shared';
import ValidityStatusFilters from '../projectDetails/ValidityStatusFilters';
import { matchesValidityStatus, type StatusFilter, type ValidityFilter } from '../projectDetails/validityStatusFilter';

const NAME_LIMIT: Record<CodeListName, number> = {
  BasisForImplementation: 150,
  NedaProjectStatus: 150,
  ReadinessLevel: 150,
  RdpOutcome: 250,
  RdpOutput: 250,
};

const thisYear = new Date().getFullYear();
const isCurrentlyValid = (item: CodeListItem) =>
  (!item.ValidFromYear || item.ValidFromYear <= thisYear) && (!item.ValidToYear || item.ValidToYear >= thisYear);

type Draft = Omit<CodeListItem, 'InUse'>;
const EMPTY: Draft = { Id: 0, Name: '', Description: '', ValidFromYear: 0, ValidToYear: 0, IsActive: true, OutcomeId: null };

const MultiYearCodeListTable: React.FC<{ list: CodeListName; title: string }> = ({ list, title }) => {
  const { showToast } = useToast();
  const { can } = useAuth();
  const [lists, setLists] = useState<MultiYearCodeLists | null>(null);
  const [validity, setValidity] = useState<ValidityFilter>('All');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [draft, setDraft] = useState<Draft | null>(null);
  const canSave = can('MultiYear', 'SaveMultiYearCodeListItem');

  useEffect(() => {
    Service.fetchCodeLists().then((r) => setLists(r.Data)).catch(() => undefined);
  }, []);

  const rows = useMemo(
    () => (lists?.[list] ?? []).filter((row) => matchesValidityStatus({ IsActive: row.IsActive, IsCurrentlyValid: isCurrentlyValid(row) }, validity, status)),
    [lists, list, validity, status],
  );
  const outcomeName = (id?: number | null) => lists?.RdpOutcome.find((o) => o.Id === id)?.Name ?? '–';

  const save = async () => {
    if (!draft) return;
    const name = draft.Name.trim();
    if (!name) {
      showToast({ type: 'error', message: 'Enter the name.' });
      return;
    }
    if (list === 'RdpOutput' && !draft.OutcomeId) {
      showToast({ type: 'error', message: 'Choose the RDP outcome this output belongs to.' });
      return;
    }
    if (draft.ValidFromYear && draft.ValidToYear && draft.ValidFromYear > draft.ValidToYear) {
      showToast({ type: 'error', message: 'Valid From cannot be after Valid To.' });
      return;
    }
    try {
      const response = await Service.saveCodeListItem(list, { ...draft, Name: name });
      showToast({ type: 'success', message: response.Data.Message });
      setLists(response.Data.Lists);
      setDraft(null);
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to save the value. Please try again.' });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">Retire a value with Active off or a Valid To year; values are never deleted.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ValidityStatusFilters validity={validity} onValidityChange={setValidity} status={status} onStatusChange={setStatus} />
          {canSave && (
            <Button color="green" onClick={() => setDraft({ ...EMPTY })}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {list === 'RdpOutput' && <th className="px-4 py-2 text-left font-medium text-gray-700">Outcome</th>}
            <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Description</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Valid</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.Id}>
              {list === 'RdpOutput' && <td className="px-4 py-2">{outcomeName(row.OutcomeId)}</td>}
              <td className="px-4 py-2">
                {row.Name}
                {row.InUse && <span className="ml-2 text-xs text-gray-500">in use</span>}
              </td>
              <td className="px-4 py-2 text-gray-600">{row.Description ?? ''}</td>
              <td className="px-4 py-2">{validityLabel(row)}</td>
              <td className="px-4 py-2">{row.IsActive ? <Badge color="green">Active</Badge> : <Badge color="zinc">Inactive</Badge>}</td>
              <td className="px-4 py-2 text-right">
                {canSave && (
                  <button type="button" title="Edit" className="text-gray-400 hover:text-blue-600" onClick={() => setDraft({ ...row, Description: row.Description ?? '' })}>
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {lists && rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No values{validity !== 'All' || status !== 'All' ? ' match the filters' : ' yet'}.</td>
            </tr>
          )}
        </tbody>
      </table>

      {draft && (
        <ModuleDialog
          open={!!draft}
          onClose={() => setDraft(null)}
          title={draft.Id ? `Edit — ${title}` : `Add — ${title}`}
          width="max-w-md"
          footer={
            <>
              <Button outline onClick={() => setDraft(null)}>Cancel</Button>
              <Button color="green" onClick={save}>Save</Button>
            </>
          }
        >
          {list === 'RdpOutput' && (
            <Field label="Outcome" required>
              <select className={INPUT_CLASS} value={draft.OutcomeId ?? ''} onChange={(e) => setDraft({ ...draft, OutcomeId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Select</option>
                {lists?.RdpOutcome.map((o) => <option key={o.Id} value={o.Id}>{o.Name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Name" required>
            <input className={INPUT_CLASS} maxLength={NAME_LIMIT[list]} value={draft.Name} onChange={(e) => setDraft({ ...draft, Name: e.target.value })} />
          </Field>
          <Field label="Description">
            <input className={INPUT_CLASS} maxLength={250} value={draft.Description ?? ''} onChange={(e) => setDraft({ ...draft, Description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valid From" hint="0 = no start.">
              <input type="number" min={0} max={2100} className={INPUT_CLASS} value={draft.ValidFromYear} onChange={(e) => setDraft({ ...draft, ValidFromYear: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Valid To" hint="0 = no end.">
              <input type="number" min={0} max={2100} className={INPUT_CLASS} value={draft.ValidToYear} onChange={(e) => setDraft({ ...draft, ValidToYear: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={draft.IsActive} onChange={(e) => setDraft({ ...draft, IsActive: e.target.checked })} />
            Active
          </label>
        </ModuleDialog>
      )}
    </div>
  );
};

export const BasisForImplementationTable: React.FC = () => <MultiYearCodeListTable list="BasisForImplementation" title="Basis for Implementation" />;
export const NedaProjectStatusTable: React.FC = () => <MultiYearCodeListTable list="NedaProjectStatus" title="NEDA Project Status" />;
export const ReadinessLevelTable: React.FC = () => <MultiYearCodeListTable list="ReadinessLevel" title="Readiness Level" />;
export const RdpOutcomeTable: React.FC = () => <MultiYearCodeListTable list="RdpOutcome" title="RDP Results Matrix: Outcomes" />;
export const RdpOutputTable: React.FC = () => <MultiYearCodeListTable list="RdpOutput" title="RDP Results Matrix: Outputs" />;
