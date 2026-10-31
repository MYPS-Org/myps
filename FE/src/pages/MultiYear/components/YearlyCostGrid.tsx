// =============================================================================
// YearlyCostGrid — a multi-year project's yearly costs.
//
// Editable: one row per planned year (Year, Amount), added and removed freely;
// the server is the judge (MultiYearCostRules) and refuses zero amounts, repeated
// years and years outside Start / End, and warns past the horizon. The same
// checks run first in the browser (../rules.ts, checkYearlyCosts).
// Read-only: every year with its flag. In Phase 1 every year is Planned; year
// locking (Phase 3) adds Locked years, shown read-only beside the open ones
// (MY-PRJ-12).
// =============================================================================

import React from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Badge } from '../../../components/tailwindui/badge';
import { Button } from '../../../components/tailwindui/button';
import type { YearAmount } from '../Model.d';
import { formatPeso } from '../utils';

interface EditableProps {
  rows: YearAmount[];
  onChange: (rows: YearAmount[]) => void;
  startYear: number;
  endYear: number | null;
  disabled?: boolean;
}

export const EditableYearlyCostGrid: React.FC<EditableProps> = ({ rows, onChange, startYear, endYear, disabled }) => {
  const nextYear = () => {
    const last = rows.length ? Math.max(...rows.map((r) => r.Year)) + 1 : startYear;
    return endYear ? Math.min(last, endYear) : last;
  };
  const update = (index: number, patch: Partial<YearAmount>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const total = rows.reduce((sum, r) => sum + (Number(r.Amount) || 0), 0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Year</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Planned Cost (₱)</th>
            <th className="px-4 py-2 w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="px-4 py-2">
                <input
                  type="number"
                  aria-label={`Year ${index + 1}`}
                  min={startYear}
                  max={endYear ?? 2100}
                  value={row.Year}
                  disabled={disabled}
                  onChange={(e) => update(index, { Year: Number(e.target.value) })}
                  className="w-28 px-2 py-1 border border-gray-300 rounded-md disabled:bg-gray-100"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  aria-label={`Planned cost for year ${index + 1}`}
                  min={0}
                  step="0.01"
                  value={Number.isFinite(row.Amount) ? row.Amount : ''}
                  disabled={disabled}
                  onChange={(e) => update(index, { Amount: e.target.value === '' ? NaN : Number(e.target.value) })}
                  className="w-48 px-2 py-1 border border-gray-300 rounded-md text-right disabled:bg-gray-100"
                />
              </td>
              <td className="px-4 py-2 text-right">
                {!disabled && (
                  <button
                    type="button"
                    title="Remove this year"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-4 text-center text-gray-500">No planned years yet.</td>
            </tr>
          )}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="px-4 py-2 font-medium text-gray-700">Total</td>
            <td className="px-4 py-2 font-semibold text-gray-900">{formatPeso(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      {!disabled && (
        <div className="px-4 py-2 border-t border-gray-200">
          <Button plain type="button" onClick={() => onChange([...rows, { Year: nextYear(), Amount: NaN }])}>
            <PlusIcon className="w-4 h-4" />
            Add Year
          </Button>
        </div>
      )}
    </div>
  );
};

export const YearlyCostTable: React.FC<{ rows: { Year: number; Amount: number; Status: string; BeforeStart?: boolean }[] }> = ({ rows }) => (
  <table className="min-w-full divide-y divide-gray-200 text-sm border border-gray-200 rounded-lg">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-2 text-left font-medium text-gray-700">Year</th>
        <th className="px-4 py-2 text-right font-medium text-gray-700">Amount</th>
        <th className="px-4 py-2 text-left font-medium text-gray-700">Year is</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {rows.map((row) => (
        <tr key={row.Year}>
          <td className="px-4 py-2">{row.Year}</td>
          <td className="px-4 py-2 text-right">{formatPeso(row.Amount)}</td>
          <td className="px-4 py-2">
            {row.Status === 'Locked' ? <Badge color="zinc">Locked</Badge> : <Badge color="blue">Planned</Badge>}
            {row.BeforeStart && <Badge color="amber" className="ml-2">Before the start year: re-plan it</Badge>}
          </td>
        </tr>
      ))}
    </tbody>
    <tfoot className="bg-gray-50">
      <tr>
        <td className="px-4 py-2 font-medium text-gray-700">Total</td>
        <td className="px-4 py-2 text-right font-semibold">{formatPeso(rows.reduce((s, r) => s + r.Amount, 0))}</td>
        <td />
      </tr>
    </tfoot>
  </table>
);
