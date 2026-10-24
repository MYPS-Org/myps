import React from 'react';
import type { AdminAreaProvince } from '../../Model.d';
import { useAdminAreaContext } from '../../AdminAreaContext';
import AdminAreaTable, { type AdminAreaColumn } from './AdminAreaTable';

const columns: AdminAreaColumn<AdminAreaProvince>[] = [
  { header: 'Id', className: 'w-16', text: r => String(r.Id),
    render: r => <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{r.Id}</span> },
  { header: 'Code', className: 'w-24', text: r => r.Code ?? '',
    render: r => <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{r.Code}</span> },
  { header: 'Name', text: r => r.Name, render: r => <span className="font-medium text-gray-900">{r.Name}</span> },
];

// From AAMS: no add / rename / delete; only the region a province belongs to can change (UAT S04-TC021).
const ProvinceTable: React.FC = () => {
  const { data } = useAdminAreaContext();
  const regions = data?.Regions ?? [];
  const regionName = (id: string) => regions.find(r => r.ParticipantId === id)?.Name ?? '';
  return (
    <AdminAreaTable title="Provinces" description="Province codes and region linking" code="AdminAreaProvince" label="Province"
      rows={data?.Provinces ?? []} columns={columns}
      link={{
        header: 'Region', field: 'RegionParticipantId',
        options: regions.map(r => ({ value: r.ParticipantId, label: r.Name })),
        text: r => regionName(r.RegionParticipantId),
        render: r => (
      <>
        <span className="text-xs font-medium text-gray-700">{regionName(r.RegionParticipantId)}</span>
      </>
    ),
      }} />
  );
};

export default ProvinceTable;
