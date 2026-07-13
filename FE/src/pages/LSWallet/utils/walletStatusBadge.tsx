import React from 'react';
import type { WalletStage } from '../Model.d';

interface WalletStatusBadgeProps {
  stage: WalletStage;
  className?: string;
}

const WalletStatusBadge: React.FC<WalletStatusBadgeProps> = ({ stage, className = '' }) => {
  const stageColors: Record<WalletStage, string> = {
    'BP': 'bg-slate-100 text-slate-800 border-slate-200',
    'NEP': 'bg-blue-100 text-blue-800 border-blue-200',
    'HGAB': 'bg-amber-100 text-amber-800 border-amber-200',
    'GAA': 'bg-orange-100 text-orange-800 border-orange-200',
    'GAA-R': 'bg-green-100 text-green-800 border-green-200',
  };

  const colorClass = stageColors[stage];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${className}`}>
      {stage}
    </span>
  );
};

export default WalletStatusBadge;
