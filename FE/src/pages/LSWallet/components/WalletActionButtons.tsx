// =============================================================================
// WalletActionButtons.tsx — thin consumer of the declarative action config
//
// Renders a row of action buttons from a WalletAction[] or ItemizedProjectAction[].
// Filters to only .show === true entries, then renders Button with disabled
// state and title tooltip for disabledReason — matching the tooltip convention
// used in Project/components/WorkLocationTable.tsx (~line 592).
// =============================================================================

import React from 'react';
import { Button } from '../../../components/tailwindui/button';
import type { WalletAction, ItemizedProjectAction, WalletActionColor } from '../utils/walletActions';

// Map WalletActionColor to the Button component's color prop
const colorMap: Record<WalletActionColor, 'green' | 'orange' | 'amber' | 'red' | 'blue' | 'zinc'> = {
  green: 'green',
  orange: 'orange',
  amber: 'amber',
  red: 'red',
  blue: 'blue',
  zinc: 'zinc',
};

interface WalletActionButtonsProps {
  actions: WalletAction[] | ItemizedProjectAction[];
  size?: 'xs' | 'sm' | 'md';
}

const WalletActionButtons: React.FC<WalletActionButtonsProps> = ({
  actions,
  size = 'sm',
}) => {
  const visibleActions = actions.filter(a => a.show);

  if (visibleActions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visibleActions.map((action, idx) => (
        <span
          key={`${action.label}-${idx}`}
          title={action.disabled && action.disabledReason ? action.disabledReason : undefined}
          className="inline-flex"
        >
          <Button
            color={colorMap[action.color]}
            disabled={action.disabled}
            onClick={!action.disabled ? action.onClick : undefined}
            className={size === 'xs' ? 'text-xs px-2 py-1' : undefined}
          >
            {action.label}
          </Button>
        </span>
      ))}
    </div>
  );
};

export default WalletActionButtons;
