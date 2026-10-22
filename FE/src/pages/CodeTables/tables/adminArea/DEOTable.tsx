import React from 'react';
import type { AdminAreaDEO } from '../../Model.d';
import { useAdminAreaContext } from '../../AdminAreaContext';
import AdminAreaTable, { type AdminAreaColumn } from './AdminAreaTable';

const columns: AdminAreaColumn<AdminAreaDEO>[] = [
  { header: 'Id', className: 'w-16', text: r => String(r.Id),
    render: r => <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{r.Id}</span> },
  { header: 'Name', text: r => r.Name, render: r => <span className="font-medium text-gray-900">{r.Name}</span> },
];

// From AAMS: no add / rename / delete; only the region a DEO belongs to can change (UAT S04-TC024).
const DEOTable: React.FC = () => {
  const { data } = useAdminAreaContext();
  const regions = data?.Regions ?? [];
  const regionName = (id?: string) => regions.find(r => r.ParticipantId === id)?.Name ?? '';
  // The province by name (it showed the bare province code, e.g. 74 for Abra).
  const provinces = data?.Provinces ?? [];
  const provinceName = (code?: string | null) => (code ? provinces.find(p => p.Code === code)?.Name ?? code : '');
  const deoColumns: AdminAreaColumn<AdminAreaDEO>[] = [
    ...columns,
    { header: 'Province', className: 'w-44', text: r => provinceName(r.ProvinceCode),
      render: r => <span className="text-sm text-gray-700">{provinceName(r.ProvinceCode)}</span> },
  ];
  return (
    <AdminAreaTable title="District Engineering Offices (DEOs)" description="District engineering offices and region linking"
      code="AdminAreaDEO" label="DEO" rows={data?.DEOs ?? []} columns={deoColumns} showActive={false}
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

export default DEOTable;
