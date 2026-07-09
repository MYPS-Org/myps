import React, { useMemo } from 'react';

interface WalletBalanceWidgetProps {
  total: number;
  used: number;
  available: number;
  currencyLocale?: string;
}

const WalletBalanceWidget: React.FC<WalletBalanceWidgetProps> = ({
  total,
  used,
  available,
  currencyLocale = 'en-PH',
}) => {
  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString(currencyLocale)}`;
  };

  const usagePercentage = useMemo(() => {
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (used / total) * 100));
  }, [used, total]);

  const getProgressBarColor = useMemo(() => {
    if (available <= 0) return 'bg-red-500 dark:bg-red-600';
    if (available <= total * 0.2) return 'bg-orange-500 dark:bg-orange-600';
    return 'bg-blue-500 dark:bg-blue-600';
  }, [available, total]);

  const getCardStatusColor = useMemo(() => {
    if (available <= 0) {
      return 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100';
    }
    if (available <= total * 0.2) {
      return 'bg-orange-50 dark:bg-orange-900/20 text-orange-900 dark:text-orange-100';
    }
    return 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100';
  }, [available, total]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
            {formatCurrency(total)}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">Used</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
            {formatCurrency(used)}
          </div>
        </div>

        <div className={`p-4 rounded-lg text-center ${getCardStatusColor}`}>
          <div className="text-sm font-medium">Available</div>
          <div className="text-lg font-semibold mt-1">
            {formatCurrency(available)}
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Usage</span>
          <span>{Math.round(usagePercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor}`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default WalletBalanceWidget;
