import React from 'react';
import type { WalletStage } from '../Model.d';

interface WalletStatusBadgeProps {
  stage: WalletStage;
  className?: string;
}

const WalletStatusBadge: React.FC<WalletStatusBadgeProps> = ({ stage, className = '' }) => {
  const stageColors: Record<WalletStage, string> = {
    'BP': 'bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
    'NEP': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
    'HGAB': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700',
    'GAA': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700',
    'GAA-R': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  };

  const colorClass = stageColors[stage];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${className}`}>
      {stage}
    </span>
  );
};

export default WalletStatusBadge;
