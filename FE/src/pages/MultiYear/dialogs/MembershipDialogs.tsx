// =============================================================================
// Set a project's status in a portfolio (MY-PFL-11, -13) and edit its planning
// fields there (MY-PFL-14). The statuses offered are the ones the server lists
// for the membership (AllowedStatuses, from the status diagram); completed or
// cancelled locks the membership, so the dialog says so before it is set.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { MembershipFields, MembershipStatus, PlanningFormOptions } from '../Model.d';
import * as Service from '../Service';
import { STATUS_NAMES } from '../utils';
import MembershipFieldsEditor from '../components/MembershipFieldsEditor';
import { Field, INPUT_CLASS, ModuleDialog } from '../components/Shared';

const toastIfSilent = (error: unknown, showToast: ReturnType<typeof useToast>['showToast'], action: string) => {
  if (!(error as { Message?: string } | undefined)?.Message) {
    showToast({ type: 'error', message: `Failed to ${action}. Please try again.` });
  }
};

export const MembershipStatusDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  memberId: number;
  projectId: string;
  current: MembershipStatus;
  allowed: MembershipStatus[];
  onSaved: () => void;
}> = ({ open, onClose, memberId, projectId, current, allowed, onSaved }) => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<MembershipStatus | ''>('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setStatus(allowed.length === 1 ? allowed[0] : '');
      setReason('');
    }
  }, [open, allowed]);

  const submit = async () => {
    if (!status) {
      showToast({ type: 'error', message: 'Choose the new status.' });
      return;
    }
    try {
      const response = await Service.setMembershipStatus(memberId, status, reason.trim());
      showToast({ type: 'success', message: response.Data.Message });
      onSaved();
    } catch (error) {
      toastIfSilent(error, showToast, 'set the status');
    }
  };

  return (
    <ModuleDialog
      open={open}
      onClose={onClose}
      title={`Set Status — ${projectId}`}
      width="max-w-md"
      footer={
        <>
          <Button outline onClick={onClose}>Cancel</Button>
          <Button color="red" onClick={submit} disabled={!status}>Set {status ? STATUS_NAMES[status] : 'Status'}</Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">Now: <strong>{STATUS_NAMES[current]}</strong></p>
      <Field label="New status" required>
        <select className={INPUT_CLASS} value={status} onChange={(e) => setStatus(e.target.value ? (Number(e.target.value) as MembershipStatus) : '')}>
          <option value="">Select</option>
          {allowed.map((s) => <option key={s} value={s}>{STATUS_NAMES[s]}</option>)}
        </select>
      </Field>
      <Field label="Reason">
        <textarea className={INPUT_CLASS} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        <span>A completed or cancelled project can no longer be edited in this portfolio, and the status cannot be undone.</span>
      </div>
    </ModuleDialog>
  );
};

export const EditMembershipDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  memberId: number;
  title: string;
  saved: MembershipFields;
  startYear: number;
  canEditStartYear: boolean;
  options: PlanningFormOptions;
  onSaved: () => void;
}> = ({ open, onClose, memberId, title, saved, startYear, canEditStartYear, options, onSaved }) => {
  const { showToast } = useToast();
  const [fields, setFields] = useState<MembershipFields>(saved);
  const [year, setYear] = useState(startYear);

  useEffect(() => {
    if (open) {
      setFields(saved);
      setYear(startYear);
    }
  }, [open, saved, startYear]);

  const submit = async () => {
    if (fields.McaScore !== null && (fields.McaScore < 0 || fields.McaScore > 100)) {
      showToast({ type: 'error', message: 'MCA Score must be between 0 and 100.' });
      return;
    }
    try {
      const response = await Service.updateMembership({ ...fields, MemberId: memberId, StartYear: canEditStartYear ? year : undefined });
      showToast({ type: 'success', message: response.Data.Message });
      onSaved();
    } catch (error) {
      toastIfSilent(error, showToast, 'save the planning fields');
    }
  };

  return (
    <ModuleDialog
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-2xl"
      footer={
        <>
          <Button outline onClick={onClose}>Cancel</Button>
          <Button color="green" onClick={submit}>Save</Button>
        </>
      }
    >
      {canEditStartYear && (
        <Field label="Start Year" hint="Changeable only while the project is New in this portfolio.">
          <input type="number" min={1990} max={2100} className={INPUT_CLASS} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </Field>
      )}
      <MembershipFieldsEditor value={fields} onChange={setFields} options={options} year={year} saved={saved} />
    </ModuleDialog>
  );
};
