import React from 'react';
import { motion } from 'framer-motion';
import {
  BanknotesIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  FolderIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import { AnimatedCurrency, AnimatedNumber } from './AnimatedCounter';
import { useDashboardTheme } from '../DashboardTheme';
import type { DashboardRevisionSummary } from '../Service';

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

interface Props {
  data: KpiData;
  /** Live projection of dbo.fRevisionQueue -- the same source as the /revision page. */
  revisions?: DashboardRevisionSummary;
  isLoading: boolean;
  onCardClick?: (type: string) => void;
}

export const DashboardKpiCards: React.FC<Props> = ({ data, revisions, isLoading, onCardClick }) => {
  const { isLight } = useDashboardTheme();

  const reviewCount = revisions?.ForReview ?? 0;
  const approvalCount = revisions?.ForApproval ?? 0;
  const pendingRevisions = reviewCount + approvalCount;
  const revisionTotal = revisions?.Total ?? 0;

  const walletPercent =
    data.lsWalletTotal > 0
      ? Math.min(100, Math.round((data.lsWalletReleased / data.lsWalletTotal) * 100))
      : 0;

  const cards = [
    {
      key: 'budget',
      title: 'FY Infrastructure Budget',
      subtitle: 'Component Cost Schedules',
      renderValue: () => (
        <AnimatedCurrency
          value={data.totalBudget}
          compact={true}
          className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
        />
      ),
      detail: `${data.activeProjects.toLocaleString()} active project investments`,
      badge: 'Portfolio Outlay',
      badgeColor: isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: BanknotesIcon,
      accentColor: 'from-blue-600 to-indigo-600',
      iconBg: isLight ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      barColor: 'bg-blue-600',
      barPercent: 100,
    },
    {
      key: 'projects',
      title: 'Active Portfolio Projects',
      subtitle: 'Fiscal Year Pipeline Scope',
      renderValue: () => (
        <div className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
          <AnimatedNumber value={data.activeProjects} />
        </div>
      ),
      detail: `${data.revisedProjects.toLocaleString()} revised · ${data.publishableProjects.toLocaleString()} publishable`,
      badge: `${data.publishedProjects.toLocaleString()} Published`,
      badgeColor: isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: FolderIcon,
      accentColor: 'from-amber-500 to-amber-600',
      iconBg: isLight ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      barColor: 'bg-amber-500',
      barPercent: data.activeProjects > 0 ? Math.round((data.publishedProjects / data.activeProjects) * 100) : 0,
    },
    {
      key: 'lswallet',
      title: 'Lump Sum (LS) Itemized',
      subtitle: 'Sub-project Allocations',
      renderValue: () => (
        <AnimatedCurrency
          value={data.lsWalletReleased}
          compact={true}
          className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
        />
      ),
      detail: `${walletPercent}% released of ₱${(data.lsWalletTotal / 1e9).toFixed(2)}B total`,
      badge: `${walletPercent}% Itemized`,
      badgeColor: isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: WalletIcon,
      accentColor: 'from-indigo-600 to-violet-600',
      iconBg: isLight ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      barColor: 'bg-indigo-600',
      barPercent: walletPercent,
    },
    {
      key: 'publication',
      title: 'Publication Compliance',
      subtitle: 'Transparency Portal Readiness',
      renderValue: () => (
        <div className={`text-2xl sm:text-3xl font-black tracking-tight flex items-baseline gap-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
          <AnimatedNumber value={data.publicationRate} formatter={(v) => v.toFixed(1)} />
          <span className={`text-lg font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>%</span>
        </div>
      ),
      detail: `${data.publishedProjects.toLocaleString()} of ${data.activeProjects.toLocaleString()} published`,
      badge: 'GAA Compliance',
      badgeColor: isLight ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: ChartBarIcon,
      accentColor: 'from-emerald-500 to-teal-600',
      iconBg: isLight ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      barColor: 'bg-emerald-500',
      barPercent: data.publicationRate,
    },
    {
      key: 'revisions',
      title: 'Revision Queue',
      subtitle: 'Pending by Group & Office',
      renderValue: () => (
        <div className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
          <AnimatedNumber value={pendingRevisions} />
        </div>
      ),
      detail: `${reviewCount.toLocaleString()} for review · ${approvalCount.toLocaleString()} for approval`,
      badge: `${revisionTotal.toLocaleString()} in queue`,
      badgeColor: isLight ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: ClipboardDocumentCheckIcon,
      accentColor: 'from-purple-600 to-fuchsia-600',
      iconBg: isLight ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      barColor: 'bg-purple-600',
      barPercent: revisionTotal > 0 ? Math.round((pendingRevisions / revisionTotal) * 100) : 0,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
      {cards.map((card) => (
        <motion.button
          key={card.key}
          whileHover={{ y: -4, transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onCardClick?.(card.key)}
          className={`relative text-left rounded-2xl p-5 border shadow-md hover:shadow-xl transition-all duration-200 group overflow-hidden ${
            isLight
              ? 'bg-white border-slate-200/90 text-slate-800'
              : 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 border-slate-800 text-slate-100'
          }`}
        >
          {/* Top colored accent line */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${card.accentColor}`} />

          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={`text-xs font-bold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {card.title}
              </span>
              <span className={`text-[11px] font-medium mt-0.5 block ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                {card.subtitle}
              </span>
            </div>
            <span className={`p-2.5 rounded-xl border ${card.iconBg} shadow-xs flex-shrink-0`}>
              <card.icon className="w-5 h-5" />
            </span>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className={`h-8 w-32 rounded-lg animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`} />
            ) : (
              card.renderValue()
            )}
          </div>

          {/* Sub-detail & Badge */}
          <div className={`flex items-center justify-between mt-3 pt-3 border-t text-xs ${isLight ? 'border-slate-100' : 'border-slate-800/80'}`}>
            <span className={`font-medium truncate max-w-[170px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {card.detail}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${card.badgeColor}`}>
              {card.badge}
            </span>
          </div>

          {/* Mini progress meter */}
          <div className={`mt-2.5 w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
            <motion.div
              className={`h-full rounded-full ${card.barColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(2, card.barPercent))}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </motion.button>
      ))}
    </div>
  );
};

export default DashboardKpiCards;
