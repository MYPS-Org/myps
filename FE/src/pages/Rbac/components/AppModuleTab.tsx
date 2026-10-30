import React, { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/16/solid';
import { CheckIcon, XMarkIcon, ChevronDownIcon, ChevronRightIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import type { AppModules, AppModuleFilter } from '../Model.d';
import type { ListPager } from '../useRbac';
import { addAppModule, updateAppModule, deleteAppModule, callSyncPermissions, callSyncViewPermissions } from '../service';
import protectedRoutes from '../../../components/Routes';
import { useToast } from '../../../components/toaster/ToasterContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type ControllerItem = { ControllerName: string; Linked: boolean };
type ViewItem = { RouteName: string; Linked: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseControllers = (str?: string): ControllerItem[] => {
	if (!str) return [];
	try { return JSON.parse(str); } catch { return []; }
};

const parseViews = (str?: string): ViewItem[] => {
	if (!str) return [];
	try { return JSON.parse(str); } catch { return []; }
};

// ── Toggle ────────────────────────────────────────────────────────────────────
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
	<button
		type="button"
		disabled={disabled}
		onClick={() => !disabled && onChange(!value)}
		className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
			value ? 'bg-indigo-600' : 'bg-gray-300'
		} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
	>
		<span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-4' : 'translate-x-0'}`} />
	</button>
);

// ── Module Links Editor ────────────────────────────────────────────────────────
const ModuleLinksEditor: React.FC<{
	controllers: ControllerItem[];
	views: ViewItem[];
	onChange?: (controllers: ControllerItem[], views: ViewItem[]) => void;
}> = ({ controllers, views, onChange }) => {
	const readOnly = !onChange;
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

	const linkedControllers = controllers.filter(c => c.Linked).length;
	const linkedViews = views.filter(v => v.Linked).length;

	const setController = (name: string, linked: boolean) =>
		onChange?.(controllers.map(c => c.ControllerName === name ? { ...c, Linked: linked } : c), views);

	const setView = (name: string, linked: boolean) =>
		onChange?.(controllers, views.map(v => v.RouteName === name ? { ...v, Linked: linked } : v));

	return (
		<div className="space-y-1.5">
			{/* Controllers */}
			<div className="border border-gray-200 rounded-lg overflow-hidden">
				<button type="button" onClick={() => toggle('controllers')}
					className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700">
					<span className="flex items-center gap-1.5">
						{expanded['controllers'] ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
						Controllers
					</span>
					<span className="text-xs font-normal text-gray-400">{linkedControllers} / {controllers.length} linked</span>
				</button>
				{expanded['controllers'] && (
					<div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
						{controllers.map(c => (
							<div key={c.ControllerName} className="flex items-center justify-between gap-2">
								<span className="text-xs text-gray-600 font-mono truncate">{c.ControllerName}</span>
								<Toggle value={c.Linked} onChange={v => setController(c.ControllerName, v)} disabled={readOnly} />
							</div>
						))}
					</div>
				)}
			</div>

			{/* Views */}
			<div className="border border-gray-200 rounded-lg overflow-hidden">
				<button type="button" onClick={() => toggle('views')}
					className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700">
					<span className="flex items-center gap-1.5">
						{expanded['views'] ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
						Views
					</span>
					<span className="text-xs font-normal text-gray-400">{linkedViews} / {views.length} linked</span>
				</button>
				{expanded['views'] && (
					<div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
						{views.map(v => (
							<div key={v.RouteName} className="flex items-center justify-between gap-2">
								<span className="text-xs text-gray-600 font-mono truncate">{v.RouteName}</span>
								<Toggle value={v.Linked} onChange={val => setView(v.RouteName, val)} disabled={readOnly} />
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

// ── Edit form ─────────────────────────────────────────────────────────────────
interface EditForm {
	ModuleName: string;
	Description: string;
	controllers: ControllerItem[];
	views: ViewItem[];
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface AppModuleTableProps {
	pager: ListPager<AppModuleFilter, AppModules>;
}

export const AppModuleTable: React.FC<AppModuleTableProps> = ({ pager }) => {
	const { data, isLoading } = pager;
	// null = none editing, 0 = adding a new row
	const [editId, setEditId] = useState<number | null>(null);
	const [editForm, setEditForm] = useState<EditForm>({ ModuleName: '', Description: '', controllers: [], views: [] });
	const [expandedId, setExpandedId] = useState<number | null>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState('');
	const [isSyncingApi, setIsSyncingApi] = useState(false);
	const [isSyncingViews, setIsSyncingViews] = useState(false);
	const { showToast } = useToast();

	const handleSyncApi = async () => {
		setIsSyncingApi(true);
		try {
			const res = await callSyncPermissions();
			showToast({ message: (res?.Data as any)?.Message || 'API permissions synced.', type: 'success' });
		} catch (err: any) {
			console.error('Sync API error:', err);
		} finally {
			setIsSyncingApi(false);
		}
	};

	const handleSyncViews = async () => {
		setIsSyncingViews(true);
		try {
			const payload = protectedRoutes
				.filter(r => r.path)
				.map(({ RouteName, path }) => ({ RouteName, path: path! }));
			const res = await callSyncViewPermissions(payload);
			showToast({ message: (res?.Data as any)?.Message || 'Route permissions synced.', type: 'success' });
		} catch (err: any) {
			console.error('Sync views error:', err);
		} finally {
			setIsSyncingViews(false);
		}
	};

	// Use the first existing row as a template for controller/view lists (all unlinked)
	const getTemplate = () => {
		const first = data.lists[0];
		return {
			controllers: first ? parseControllers(first.Controllers).map(c => ({ ...c, Linked: false })) : [],
			views: first ? parseViews(first.Views).map(v => ({ ...v, Linked: false })) : [],
		};
	};

	const startAdd = () => {
		const tpl = getTemplate();
		setEditId(0);
		setEditForm({ ModuleName: '', Description: '', ...tpl });
		setExpandedId(null);
		setDeleteConfirmId(null);
		setError('');
	};

	const startEdit = (item: AppModules) => {
		setEditId(item.Id);
		setEditForm({
			ModuleName: item.ModuleName,
			Description: item.Description ?? '',
			controllers: parseControllers(item.Controllers),
			views: parseViews(item.Views),
		});
		setExpandedId(null);
		setDeleteConfirmId(null);
		setError('');
	};

	const cancelEdit = () => {
		setEditId(null);
		setError('');
	};

	const handleSave = async () => {
		if (!editForm.ModuleName.trim()) {
			setError('Module name is required.');
			return;
		}
		setIsSaving(true);
		setError('');
		try {
			const payload: AppModules = {
				Id: editId ?? 0,
				ModuleName: editForm.ModuleName.trim(),
				Description: editForm.Description.trim() || undefined,
				Controllers: JSON.stringify(editForm.controllers),
				Views: JSON.stringify(editForm.views),
				ControllerCount: editForm.controllers.filter(c => c.Linked).length,
				ViewCount: editForm.views.filter(v => v.Linked).length,
			};
			if (editId === 0) {
				// 2026-10-30: AddAppModule answers with a message, not the new row, so the row used to get
				// Id = Date.now() and its Edit/Delete then named a module that does not exist. Re-read
				// page 1 (the new module has the highest Id) to get the real one.
				await addAppModule(payload);
				pager.applyFilters(pager.currentFilters ?? { ModuleName: '' });
				showToast({ message: 'Module added successfully.', type: 'success' });
			} else {
				await updateAppModule(payload);
				pager.refresh();
				showToast({ message: 'Module updated successfully.', type: 'success' });
			}
			setEditId(null);
		} catch (err: any) {
			setError(err.Message || 'Failed to save module.');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (item: AppModules) => {
		setIsSaving(true);
		try {
			await deleteAppModule(item);
			if (data.lists.length <= 1 && data.page > 1) pager.goPrevious();
			else pager.refresh();
			setDeleteConfirmId(null);
			showToast({ message: 'Module deleted successfully.', type: 'success' });
		} catch (err: any) {
			setError(err.Message || 'Failed to delete module.');
		} finally {
			setIsSaving(false);
		}
	};

	const toggleExpand = (id: number) => setExpandedId(prev => prev === id ? null : id);

	const inp = 'w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 border-amber-300 focus:ring-amber-500';

	return (
		<div className="overflow-hidden">
			{/* Header */}
			<div className="px-6 py-4 border-b border-gray-200">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-medium text-gray-900">App Modules</h3>
						<p className="text-sm text-gray-500 mt-0.5">{data.total} module{data.total !== 1 ? 's' : ''}</p>
					</div>
					<div className="flex items-center gap-2">
						<Button color="white" onClick={handleSyncViews} disabled={isSyncingViews || editId !== null}>
							<ArrowPathIcon className={`w-4 h-4 mr-1 ${isSyncingViews ? 'animate-spin' : ''}`} />
							{isSyncingViews ? 'Syncing...' : 'Sync Routes'}
						</Button>
						<Button color="white" onClick={handleSyncApi} disabled={isSyncingApi || editId !== null}>
							<ArrowPathIcon className={`w-4 h-4 mr-1 ${isSyncingApi ? 'animate-spin' : ''}`} />
							{isSyncingApi ? 'Syncing...' : 'Sync API'}
						</Button>
						{editId === null && (
							<Button color="blue" onClick={startAdd}>
								<PlusIcon className="w-4 h-4 mr-1" />
								Add Module
							</Button>
						)}
					</div>
				</div>
				{error && (
					<div className="mt-2 bg-red-50 border border-red-200 rounded-md px-3 py-2">
						<p className="text-sm text-red-600">{error}</p>
					</div>
				)}
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
							<TableHeader className="text-gray-500">Actions</TableHeader>
						</TableRow>
					</TableHead>
					<TableBody>
						{/* ── Add new row ───────────────────────────────── */}
						{editId === 0 && (
							<React.Fragment>
								<TableRow className="bg-amber-50 border-l-4 border-amber-400">
									<TableCell>
										<input
											autoFocus
											value={editForm.ModuleName}
											onChange={e => setEditForm(f => ({ ...f, ModuleName: e.target.value }))}
											placeholder="Module name"
											className={inp}
										/>
									</TableCell>
									<TableCell>
										<input
											value={editForm.Description}
											onChange={e => setEditForm(f => ({ ...f, Description: e.target.value }))}
											placeholder="Description (optional)"
											className={inp}
										/>
									</TableCell>
									<TableCell className="text-xs text-gray-400 align-middle">
										{editForm.controllers.filter(c => c.Linked).length} / {editForm.controllers.length} linked
									</TableCell>
									<TableCell className="text-xs text-gray-400 align-middle">
										{editForm.views.filter(v => v.Linked).length} / {editForm.views.length} linked
									</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button color="amber" className="p-1.5" onClick={handleSave} disabled={isSaving}>
												<CheckIcon className="h-3.5 w-3.5" />
											</Button>
											<Button color="zinc" className="p-1.5" onClick={cancelEdit} disabled={isSaving}>
												<XMarkIcon className="h-3.5 w-3.5" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell colSpan={5} className="bg-slate-50 px-6 pb-5 pt-2 border-t border-gray-100">
										<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
											Controllers & Views — toggle to link
										</p>
										<ModuleLinksEditor
											controllers={editForm.controllers}
											views={editForm.views}
											onChange={(c, v) => setEditForm(f => ({ ...f, controllers: c, views: v }))}
										/>
									</TableCell>
								</TableRow>
							</React.Fragment>
						)}

						{/* ── Data rows ────────────────────────────────── */}
						{data.lists.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="text-center py-8 text-sm text-gray-500">
									No modules found
								</TableCell>
							</TableRow>
						) : (
							data.lists.map((module, index) => {
								const isEditing = editId === module.Id;
								const isExpanded = expandedId === module.Id;
								const controllers = isEditing ? editForm.controllers : parseControllers(module.Controllers);
								const views = isEditing ? editForm.views : parseViews(module.Views);
								const linkedControllers = controllers.filter(c => c.Linked).length;
								const linkedViews = views.filter(v => v.Linked).length;

								return (
									<React.Fragment key={module.Id}>
										<TableRow
							onClick={() => !isEditing && toggleExpand(module.Id)}
							className={`${isEditing ? 'bg-amber-50 border-l-4 border-amber-400' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-50 ${!isEditing ? 'cursor-pointer' : ''}`}
						>
											<TableCell>
												{isEditing ? (
													<input
														autoFocus
														value={editForm.ModuleName}
														onChange={e => setEditForm(f => ({ ...f, ModuleName: e.target.value }))}
														className={inp}
													/>
												) : (
													<div className="font-medium text-gray-900">{module.ModuleName}</div>
												)}
											</TableCell>
											<TableCell>
												{isEditing ? (
													<input
														value={editForm.Description}
														onChange={e => setEditForm(f => ({ ...f, Description: e.target.value }))}
														placeholder="Description (optional)"
														className={inp}
													/>
												) : (
													<div className="text-gray-500">{module.Description ?? '—'}</div>
												)}
											</TableCell>
											<TableCell>
												<div className="text-xs text-gray-600 flex items-center gap-1 whitespace-nowrap">
													{(isExpanded || isEditing) ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
													{linkedControllers} / {controllers.length} linked
												</div>
											</TableCell>
											<TableCell>
												<div className="text-xs text-gray-600 flex items-center gap-1 whitespace-nowrap">
													{(isExpanded || isEditing) ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
													{linkedViews} / {views.length} linked
												</div>
											</TableCell>
											<TableCell onClick={e => e.stopPropagation()}>
												{isEditing ? (
													<div className="flex gap-1">
														<Button color="amber" className="p-1.5" onClick={handleSave} disabled={isSaving}>
															<CheckIcon className="h-3.5 w-3.5" />
														</Button>
														<Button color="zinc" className="p-1.5" onClick={cancelEdit} disabled={isSaving}>
															<XMarkIcon className="h-3.5 w-3.5" />
														</Button>
													</div>
												) : deleteConfirmId === module.Id ? (
													<div className="flex gap-1 items-center">
														<span className="text-xs text-red-600 mr-1">Delete?</span>
														<Button color="red" className="p-1.5" onClick={() => handleDelete(module)} disabled={isSaving}>
															<CheckIcon className="h-3.5 w-3.5" />
														</Button>
														<Button color="zinc" className="p-1.5" onClick={() => setDeleteConfirmId(null)} disabled={isSaving}>
															<XMarkIcon className="h-3.5 w-3.5" />
														</Button>
													</div>
												) : (
													<div className="flex items-center gap-1">
														<button
															onClick={() => startEdit(module)}
															className="p-1 text-gray-400 hover:text-orange-600 rounded"
															title="Edit"
														>
															<PencilIcon className="w-4 h-4" />
														</button>
														<button
															onClick={() => { setDeleteConfirmId(module.Id); setExpandedId(null); setEditId(null); }}
															className="p-1 text-gray-400 hover:text-red-600 rounded"
															title="Delete"
														>
															<TrashIcon className="w-4 h-4" />
														</button>
													</div>
												)}
											</TableCell>
										</TableRow>

										{/* ── Expandable links panel ──────────── */}
										{(isExpanded || isEditing) && (
											<TableRow>
												<TableCell colSpan={5} className="bg-slate-50 px-6 pb-5 pt-2 border-t border-gray-100">
													<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
														Controllers & Views {isEditing ? '— toggle to edit' : '— read only'}
													</p>
													<ModuleLinksEditor
														controllers={isEditing ? editForm.controllers : controllers}
														views={isEditing ? editForm.views : views}
														onChange={isEditing ? (c, v) => setEditForm(f => ({ ...f, controllers: c, views: v })) : undefined}
													/>
												</TableCell>
											</TableRow>
										)}
									</React.Fragment>
								);
							})
						)}
					</TableBody>
				</Table>
			)}

			<PaginationBar
				currentPage={data.page}
				totalPages={data.totalPages}
				hasPrevious={pager.hasPrevious}
				hasNext={pager.hasNext}
				onGoToPage={pager.goToPage}
				onNext={pager.goNext}
				onPrevious={pager.goPrevious}
				onFirst={pager.goFirst}
				onLast={pager.goLast}
				isLoading={pager.isLoading}
			/>

			<div className="mb-3.5 text-center">
				{data.lists.length > 0 ? (
					<p className="text-sm text-gray-500">
						{/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
						Showing {data.limit * (data.page - 1) + 1} to{' '}
						{Math.min(data.limit * data.page, data.total)} of {data.total} modules
						*/}
					</p>
				) : (
					<p className="text-sm text-gray-500">No modules found</p>
				)}
			</div>
		</div>
	);
};

