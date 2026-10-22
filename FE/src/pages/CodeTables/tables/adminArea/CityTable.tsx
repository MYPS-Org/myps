import React from 'react';
import type { AdminAreaCity } from '../../Model.d';
import { useAdminAreaContext } from '../../AdminAreaContext';
import AdminAreaTable, { type AdminAreaColumn } from './AdminAreaTable';

const columns: AdminAreaColumn<AdminAreaCity>[] = [
  { header: 'Id', className: 'w-16', text: r => String(r.Id),
    render: r => <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{r.Id}</span> },
  { header: 'Code', className: 'w-24', text: r => r.Code ?? '',
    render: r => <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{r.Code}</span> },
  { header: 'Name', text: r => r.Name, render: r => <span className="font-medium text-gray-900">{r.Name}</span> },
];

// From AAMS: no add / rename / delete; only the province it belongs to can change (UAT S04-TC022).
const CityTable: React.FC = () => {
  const { data } = useAdminAreaContext();
  const provinces = data?.Provinces ?? [];
  const provinceName = (code: string) => provinces.find(p => p.Code === code)?.Name ?? '';
  return (
    <AdminAreaTable title="Cities / Municipalities" description="City codes and province linking" code="AdminAreaCity" label="City/Municipality"
      rows={data?.Cities ?? []} columns={columns}
      link={{
        header: 'Province', field: 'ProvinceCode',
        options: provinces.map(p => ({ value: p.Code, label: p.Name })),
        text: r => provinceName(r.ProvinceCode),
        render: r => (
      <>
        <span className="text-xs font-medium text-gray-700">{provinceName(r.ProvinceCode)}</span>
        <span className="ml-1 font-mono text-xs text-gray-400">({r.ProvinceCode})</span>
      </>
    ),
      }} />
  );
};

export default CityTable;
