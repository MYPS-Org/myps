import React, { useId } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Badge } from '../../../components/tailwindui/badge';
import type { MembershipStatus, PortfolioStatus } from '../Model.d';
import { STATUS_NAMES } from '../utils';

/** The Multi-Year dialogs' shell, the same markup the Lump Sum dialogs use. */
export const ModuleDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  width?: 'max-w-md' | 'max-w-lg' | 'max-w-2xl' | 'max-w-4xl';
  children: React.ReactNode;
  footer: React.ReactNode;
}> = ({ open, onClose, title, width = 'max-w-lg', children, footer }) => (
  <Dialog open={open} onClose={onClose} className="relative z-50">
    <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel className={`mx-auto w-full ${width} max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl`}>
        <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">{title}</DialogTitle>
        <div className="space-y-4">{children}</div>
        <div className="mt-6 flex justify-end gap-3">{footer}</div>
      </DialogPanel>
    </div>
  </Dialog>
);

const STATUS_COLORS: Record<MembershipStatus, 'zinc' | 'blue' | 'amber' | 'green' | 'red'> = {
  1: 'blue',
  2: 'amber',
  3: 'green',
  4: 'zinc',
  5: 'red',
};

export const MembershipStatusBadge: React.FC<{ status: MembershipStatus }> = ({ status }) => (
  <Badge color={STATUS_COLORS[status]}>{STATUS_NAMES[status]}</Badge>
);

export const PortfolioStatusBadge: React.FC<{ status: PortfolioStatus }> = ({ status }) =>
  status === 1 ? <Badge color="green">Open</Badge> : <Badge color="zinc">Closed, read-only</Badge>;

/** A labelled form field. A native input / select / textarea child is tied to its label
 *  (htmlFor), so screen readers and getByLabel find it; a custom control keeps its own. */
export const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string }> = ({
  label,
  required,
  hint,
  children,
  className = '',
}) => {
  const generatedId = useId();
  const native = React.isValidElement<{ id?: string }>(children) && typeof children.type === 'string';
  const id = native ? children.props.id ?? generatedId : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {native ? React.cloneElement(children, { id }) : children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
};

export const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed';
