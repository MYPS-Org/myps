import React, { useMemo } from 'react';

interface LumpSumBalanceWidgetProps {
  total: number;
  itemized: number;
  remaining: number;
  /**
   * How far `total` and `remaining` ALREADY include unsaved funding changes
   * (a pending Replenish, a pending line removal). The caller adds it in before
   * passing the figures — this widget does no arithmetic on the balance, by the
   * 2026-09-06 decision that the atom mirrors the view and never computes — and
   * this prop only says so on screen. Non-zero renders the marker.
   */
  pendingDelta?: number;
  currencyLocale?: string;
}

const LumpSumBalanceWidget: React.FC<LumpSumBalanceWidgetProps> = ({
  total,
  itemized,
  remaining,
  pendingDelta = 0,
  currencyLocale = 'en-PH',
}) => {
  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString(currencyLocale)}`;
  };

  const unsavedMarker = pendingDelta !== 0 && (
    <div className="text-xs text-amber-700 mt-1" data-unsaved-marker>
      includes {pendingDelta > 0 ? '+' : '−'}
      {formatCurrency(Math.abs(pendingDelta))} unsaved
    </div>
  );

  const usagePercentage = useMemo(() => {
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (itemized / total) * 100));
  }, [itemized, total]);

  const getProgressBarColor = useMemo(() => {
    if (remaining <= 0) return 'bg-red-500';
    if (remaining <= total * 0.2) return 'bg-orange-500';
    return 'bg-blue-500';
  }, [remaining, total]);

  const getCardStatusColor = useMemo(() => {
    if (remaining <= 0) {
      return 'bg-red-50 text-red-900';
    }
    if (remaining <= total * 0.2) {
      return 'bg-orange-50 text-orange-900';
    }
    return 'bg-blue-50 text-blue-900';
  }, [remaining, total]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-colors duration-200">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-gray-50 text-center">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {formatCurrency(total)}
          </div>
          {unsavedMarker}
        </div>

        <div className="p-4 rounded-lg bg-gray-50 text-center">
          <div className="text-sm text-gray-600">Itemized</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {formatCurrency(itemized)}
          </div>
        </div>

        <div className={`p-4 rounded-lg text-center ${getCardStatusColor}`}>
          <div className="text-sm font-medium">Remaining</div>
          <div className="text-lg font-semibold mt-1">
            {formatCurrency(remaining)}
          </div>
          {unsavedMarker}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Usage</span>
          <span>{Math.round(usagePercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor}`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default LumpSumBalanceWidget;
