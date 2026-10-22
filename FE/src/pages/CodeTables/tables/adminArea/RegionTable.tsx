import React from 'react';
import type { AdminAreaRegion } from '../../Model.d';
import { useAdminAreaContext } from '../../AdminAreaContext';
import AdminAreaTable, { type AdminAreaColumn } from './AdminAreaTable';

const columns: AdminAreaColumn<AdminAreaRegion>[] = [
  { header: 'Id', className: 'w-16', text: r => String(r.Id),
    render: r => <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{r.Id}</span> },
  { header: 'Code', className: 'w-32', text: r => r.Code ?? '',
    render: r => <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{r.Code}</span> },
  { header: 'Name', text: r => r.Name, render: r => <span className="font-medium text-gray-900">{r.Name}</span> },
  { header: 'Participant ID', className: 'w-36', text: r => r.ParticipantId ?? '',
    render: r => <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{r.ParticipantId}</span> },
  { header: 'Island Code', className: 'w-24', text: r => r.IslandCode, render: r => <span className="font-mono text-xs text-gray-600">{r.IslandCode}</span> },
];

// Regions come from AAMS and have no parent to re-link: fully read-only (UAT S04-TC020).
const RegionTable: React.FC = () => {
  const { data } = useAdminAreaContext();
  return (
    <AdminAreaTable title="Regions" description="Region codes and participant IDs" code="AdminAreaRegion" label="Region"
      rows={data?.Regions ?? []} columns={columns} />
  );
};

export default RegionTable;
