import React from 'react';
import type { AdminAreaDEO } from '../../Model.d';
import { useAdminAreaContext } from '../../AdminAreaContext';
import AdminAreaTable, { type AdminAreaColumn } from './AdminAreaTable';

const columns: AdminAreaColumn<AdminAreaDEO>[] = [
  { header: 'Id', className: 'w-16', text: r => String(r.Id),
    render: r => <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{r.Id}</span> },
  { header: 'Participant ID', className: 'w-36', text: r => r.ParticipantId ?? '',
    render: r => <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{r.ParticipantId}</span> },
  { header: 'Name', text: r => r.Name, render: r => <span className="font-medium text-gray-900">{r.Name}</span> },
  { header: 'Province', className: 'w-44', text: r => r.ProvinceCode ?? '',
    render: r => <span className="font-mono text-xs text-gray-600">{r.ProvinceCode ?? ''}</span> },
];

// From AAMS: no add / rename / delete; only the region a DEO belongs to can change (UAT S04-TC024).
const DEOTable: React.FC = () => {
  const { data } = useAdminAreaContext();
  const regions = data?.Regions ?? [];
  const regionName = (id?: string) => regions.find(r => r.ParticipantId === id)?.Name ?? '';
  return (
    <AdminAreaTable title="District Engineering Offices (DEOs)" description="DEO participant IDs and region linking"
      code="AdminAreaDEO" label="DEO" rows={data?.DEOs ?? []} columns={columns} showActive={false}
      link={{
        header: 'Region', field: 'RegionParticipantId',
        options: regions.map(r => ({ value: r.ParticipantId, label: r.Name })),
        text: r => regionName(r.RegionParticipantId),
        render: r => (
      <>
        <span className="text-xs font-medium text-gray-700">{regionName(r.RegionParticipantId)}</span>
        <span className="ml-1 font-mono text-xs text-gray-400">({r.RegionParticipantId ?? ''})</span>
      </>
    ),
      }} />
  );
};

export default DEOTable;
