import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import type { AppModules } from '../Model.d';

interface AppModuleTableProps {
	data: AppModules[];
	isLoading: boolean;
}

export const AppModuleTable: React.FC<AppModuleTableProps> = ({ data, isLoading }) => {
	return (
		<div className="overflow-hidden">
			<div className="px-6 py-4 border-b border-gray-200">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-medium text-gray-900">App Modules</h3>
					<p className="text-sm text-gray-500">{data.length} module{data.length !== 1 ? 's' : ''}</p>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-16 text-gray-400">Loading...</div>
			) : (
				<Table className="px-5">
					<TableHead>
						<TableRow>
							<TableHeader className="text-gray-500">Module Name</TableHeader>
							<TableHeader className="text-gray-500">Description</TableHeader>
							<TableHeader className="text-gray-500">Controllers</TableHeader>
							<TableHeader className="text-gray-500">Views</TableHeader>
						</TableRow>
					</TableHead>
					<TableBody>
						{data.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="text-center py-8 text-sm text-gray-500">
									No modules found
								</TableCell>
							</TableRow>
						) : (
							data.map((module, index) => (
								<TableRow
									key={module.Id}
									className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
								>
									<TableCell>
										<div className="font-medium text-gray-900">{module.ModuleName}</div>
									</TableCell>
									<TableCell>
										<div className="text-gray-500">{module.Description ?? '—'}</div>
									</TableCell>
									<TableCell>
										<div className="text-gray-700">{module.ControllerCount ?? 0}</div>
									</TableCell>
									<TableCell>
										<div className="text-gray-700">{module.ViewCount ?? 0}</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			)}
		</div>
	);
};

