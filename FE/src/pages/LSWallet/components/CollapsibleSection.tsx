import React from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isOpen,
  onToggle,
  children,
}) => (
  <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
    <div
      className="flex justify-between items-center px-4 py-4 cursor-pointer border-b"
      onClick={onToggle}
    >
      <h3 className="text-lg font-semibold leading-7 text-gray-900">{title}</h3>
      {isOpen ? (
        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
      ) : (
        <ChevronRightIcon className="h-5 w-5 text-gray-500" />
      )}
    </div>
    {isOpen && <div className="px-4 py-6 sm:p-8">{children}</div>}
  </div>
);

export default CollapsibleSection;
