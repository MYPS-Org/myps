import React from 'react';
import type { LumpSumStage } from '../Model.d';

interface LumpSumStatusBadgeProps {
  stage: LumpSumStage;
  className?: string;
}

/*  A COLOUR PER STAGE, AND A FALLBACK THAT ACTUALLY RENDERS.

    This map used to be a Record over a five-member union, so any stage outside
    it — every Trust Fund stage, which is what all the sample data is — indexed
    to undefined and produced a badge with no classes at all: black text on a
    transparent background, unreadable and looking like a rendering fault. The
    database has twelve stages and gains more by configuration, so the map is
    partial by design and unknown stages fall back to neutral. */
const STAGE_COLORS: Record<string, string> = {
  RDIP: 'bg-slate-100 text-slate-800 border-slate-200',
  PIP: 'bg-slate-100 text-slate-800 border-slate-200',
  RBP: 'bg-slate-100 text-slate-800 border-slate-200',
  BP: 'bg-slate-100 text-slate-800 border-slate-200',
  NEP: 'bg-blue-100 text-blue-800 border-blue-200',
  HGAB: 'bg-amber-100 text-amber-800 border-amber-200',
  GAA: 'bg-orange-100 text-orange-800 border-orange-200',
  'GAA-R': 'bg-green-100 text-green-800 border-green-200',
  TF: 'bg-orange-100 text-orange-800 border-orange-200',
  'TF-R': 'bg-green-100 text-green-800 border-green-200',
};

const FALLBACK = 'bg-gray-100 text-gray-700 border-gray-200';

const LumpSumStatusBadge: React.FC<LumpSumStatusBadgeProps> = ({ stage, className = '' }) => {
  if (!stage) return null;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        STAGE_COLORS[stage] ?? FALLBACK
      } ${className}`}
    >
      {stage}
    </span>
  );
};

export default LumpSumStatusBadge;
