import React from 'react';
import { motion } from 'framer-motion';
import { BanknotesIcon, ChartBarIcon, FolderIcon, WalletIcon } from '@heroicons/react/24/outline';

export interface KpiData {
  totalBudget: number;
  activeProjects: number;
  publishedProjects: number;
  publishableProjects: number;
  revisedProjects: number;
  lsWalletReleased: number;
  lsWalletTotal: number;
  publicationRate: number;
}

interface Props { data: KpiData; isLoading: boolean; onCardClick?: (type: string) => void }

const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 2 }).format(value);

const DashboardKpiCards: React.FC<Props> = ({ data, isLoading, onCardClick }) => {
  const walletPercent = data.lsWalletTotal > 0 ? Math.min(100, Math.round(data.lsWalletReleased / data.lsWalletTotal * 100)) : 0;
  const cards = [
    { key: 'budget', title: 'FY Infrastructure Budget', value: money(data.totalBudget), detail: 'Component cost schedule', icon: BanknotesIcon },
    { key: 'projects', title: 'Projects in selected FY', value: data.activeProjects.toLocaleString(), detail: `${data.revisedProjects} revised · ${data.publishableProjects} publishable`, icon: FolderIcon },
    { key: 'lswallet', title: 'LS Itemized Amount', value: money(data.lsWalletReleased), detail: `${walletPercent}% of ${money(data.lsWalletTotal)}`, icon: WalletIcon },
    { key: 'publication', title: 'Publication Rate', value: `${data.publicationRate.toFixed(1)}%`, detail: `${data.publishedProjects} of ${data.activeProjects} projects`, icon: ChartBarIcon },
  ] as const;

  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
    {cards.map((card) => <motion.button key={card.key} whileHover={{ y: -4 }} onClick={() => onCardClick?.(card.key)} className="text-left bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{card.title}</span><span className="p-2.5 rounded-xl bg-gray-100 text-gray-500"><card.icon className="w-5 h-5" /></span></div>
      {isLoading ? <div className="mt-4 h-7 w-28 rounded bg-gray-100 animate-pulse" /> : <div className="mt-3 text-2xl font-bold tracking-tight text-gray-900">{card.value}</div>}
      <div className="mt-2 text-xs text-gray-500">{card.detail}</div>
    </motion.button>)}
  </div>;
};

export default DashboardKpiCards;
