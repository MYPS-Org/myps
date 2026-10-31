// =============================================================================
// Create Portfolio and Open Next Term (MY-PFL-01, -03 … -06).
// Both are offered only to users granted the action (seeded to Admin and AUC);
// the server re-checks the grant, the owner and the term.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { MultiYearFilterOptions, Portfolio, PortfolioKind } from '../Model.d';
import * as Service from '../Service';
import { KIND_DESCRIPTIONS, KIND_NAMES, termLabel } from '../utils';
import { Field, INPUT_CLASS, ModuleDialog } from '../components/Shared';

const toastIfSilent = (error: unknown, showToast: ReturnType<typeof useToast>['showToast'], action: string) => {
  // The interceptor already toasted any refusal that carried a Message (FE/CLAUDE.md).
  if (!(error as { Message?: string } | undefined)?.Message) {
    showToast({ type: 'error', message: `Failed to ${action}. Please try again.` });
  }
};

export const CreatePortfolioDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  options: MultiYearFilterOptions;
  onCreated: (portfolioId: number) => void;
}> = ({ open, onClose, options, onCreated }) => {
  const { showToast } = useToast();
  const [kind, setKind] = useState<PortfolioKind>(1);
  const [owner, setOwner] = useState('');
  const [start, setStart] = useState<number>(options.CurrentYear);

  useEffect(() => {
    if (open) {
      setKind(1);
      setOwner('');
      setStart(options.CurrentYear);
    }
  }, [open, options.CurrentYear]);

  const owners = kind === 1 ? options.Regions : kind === 2 ? options.Clusters : [];
  const kinds = ([1, 2, 3] as PortfolioKind[]).filter((k) => k !== 3 || options.CanSeePip);

  const submit = async () => {
    if (kind !== 3 && !owner) {
      showToast({ type: 'error', message: kind === 1 ? 'Choose the region the RDIP belongs to.' : 'Choose the UPMO cluster the UDIP belongs to.' });
      return;
    }
    if (!Number.isInteger(start) || start < options.FirstTermStartYear || start > options.LastTermStartYear) {
      showToast({ type: 'error', message: `The term must start between ${options.FirstTermStartYear} and ${options.LastTermStartYear}.` });
      return;
    }
    try {
      const response = await Service.createPortfolio({ Kind: kind, OwnerParticipantId: kind === 3 ? null : owner, TermStartYear: start });
      showToast({ type: 'success', message: response.Data.Message });
      onCreated(response.Data.PortfolioId);
    } catch (error) {
      toastIfSilent(error, showToast, 'create the portfolio');
    }
  };

  return (
    <ModuleDialog
      open={open}
      onClose={onClose}
      title="Create Portfolio"
      footer={
        <>
          <Button outline onClick={onClose}>Cancel</Button>
          <Button color="green" onClick={submit}>Create</Button>
        </>
      }
    >
      <Field label="Portfolio" required hint={KIND_DESCRIPTIONS[kind]}>
        <select className={INPUT_CLASS} value={kind} onChange={(e) => { setKind(Number(e.target.value) as PortfolioKind); setOwner(''); }}>
          {kinds.map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
        </select>
      </Field>
      {kind !== 3 && (
        <Field label={kind === 1 ? 'Region' : 'UPMO Cluster'} required>
          <select className={INPUT_CLASS} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Select</option>
            {owners.map((o) => <option key={o.ParticipantId} value={o.ParticipantId}>{o.Name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Term Start Year" required hint={Number.isInteger(start) ? `The term is always six years: ${termLabel(start)}.` : undefined}>
        <input
          type="number"
          className={INPUT_CLASS}
          min={options.FirstTermStartYear}
          max={options.LastTermStartYear}
          value={Number.isFinite(start) ? start : ''}
          onChange={(e) => setStart(Number(e.target.value))}
        />
      </Field>
      <p className="text-sm text-gray-500">
        To continue an existing portfolio into its next term, open that portfolio and use Open Next Term instead, so its unfinished projects are carried forward.
      </p>
    </ModuleDialog>
  );
};

export const OpenNextTermDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  portfolio: Portfolio;
  termHasEnded: boolean;
  onOpened: (portfolioId: number) => void;
}> = ({ open, onClose, portfolio, termHasEnded, onOpened }) => {
  const { showToast } = useToast();
  const next = termLabel(portfolio.TermStartYear + 6);

  const submit = async () => {
    try {
      const response = await Service.openNextTerm(portfolio.Id);
      showToast({ type: 'success', message: response.Data.Message });
      onOpened(response.Data.PortfolioId);
    } catch (error) {
      toastIfSilent(error, showToast, 'open the next term');
    }
  };

  return (
    <ModuleDialog
      open={open}
      onClose={onClose}
      title="Open Next Term"
      footer={
        <>
          <Button outline onClick={onClose}>Cancel</Button>
          <Button color="green" onClick={submit}>Open {next}</Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">
        This opens <strong>{portfolio.KindName} {portfolio.OwnerName ? `${portfolio.OwnerName} ` : ''}{next}</strong>.
      </p>
      <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
        <li>Every project that is not completed or cancelled is carried into the new term, with its status and planning fields.</li>
        <li>Completed and cancelled projects stay in {portfolio.Term}.</li>
        <li>{portfolio.Name} becomes closed and read-only. It cannot be reopened.</li>
      </ul>
      {!termHasEnded && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <span>The term {portfolio.Term} has not ended yet.</span>
        </div>
      )}
    </ModuleDialog>
  );
};
