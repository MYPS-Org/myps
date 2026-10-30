import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { vUserGroups, UserGroupDropdowns, UpdateUserGroupPayload, ModulePermission } from '../Model.d';
import { editUserGroup } from '../service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface UpdateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (groupData: any) => void;
  group: vUserGroups;
  dropdowns: UserGroupDropdowns;
}

// ---------------------------------------------------------------------------
// IndeterminateCheckbox helper
// ---------------------------------------------------------------------------
function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      onClick={e => e.stopPropagation()}
    />
  );
}

// ---------------------------------------------------------------------------
// ModuleAccordion — accordion by module, with API actions + route access
// ---------------------------------------------------------------------------
interface ModuleAccordionProps {
  modules: ModulePermission[];
  actionIds: number[];
  viewIds: number[];
  onToggleAction: (id: number) => void;
  onToggleView: (id: number) => void;
  onToggleAllActionsInController: (controllerName: string) => void;
}

function ModuleAccordion({
  modules,
  actionIds,
  viewIds,
  onToggleAction,
  onToggleView,
  onToggleAllActionsInController,
}: ModuleAccordionProps) {
  const [openModules, setOpenModules] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    modules.forEach(m => {
      const hasGranted =
        m.APIPermissions.some(api => api.Actions.some(a => a.IsGranted)) ||
        m.ViewAccess.some(v => v.IsGranted);
      if (hasGranted) initial.add(m.ModuleName);
    });
    return initial;
  });

  const toggleModule = (name: string) =>
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const expandAll = () => setOpenModules(new Set(modules.map(m => m.ModuleName)));
  const collapseAll = () => setOpenModules(new Set());

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">Module Permissions</span>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={expandAll} className="text-blue-600 hover:text-blue-800 underline">Expand All</button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={collapseAll} className="text-blue-600 hover:text-blue-800 underline">Collapse All</button>
        </div>
      </div>

      <div className="space-y-1.5">
        {modules.map(module => {
          const isOpen = openModules.has(module.ModuleName);
          const allActionIds = module.APIPermissions.flatMap(api => api.Actions.map(a => a.Id));
          const grantedActionCount = allActionIds.filter(id => actionIds.includes(id)).length;
          const totalActionCount = allActionIds.length;
          const allViewIds = module.ViewAccess.map(v => v.Id);
          const grantedViewCount = allViewIds.filter(id => viewIds.includes(id)).length;
          const totalViewCount = allViewIds.length;
          const hasAnyGranted = grantedActionCount > 0 || grantedViewCount > 0;

          return (
            <div
              key={module.ModuleName}
              className={`border rounded-lg overflow-hidden ${hasAnyGranted ? 'border-blue-200' : 'border-gray-200'}`}
            >
              {/* Module header */}
              <div
                className={`flex items-center justify-between px-4 py-2.5 cursor-pointer select-none transition-colors ${
                  hasAnyGranted ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => toggleModule(module.ModuleName)}
              >
                <div className="flex items-center gap-2">
                  {isOpen
                    ? <ChevronUpIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    : <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  }
                  <span className={`text-sm font-semibold ${hasAnyGranted ? 'text-blue-800' : 'text-gray-700'}`}>
                    {module.ModuleName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {totalActionCount > 0 && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      grantedActionCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {grantedActionCount}/{totalActionCount} API
                    </span>
                  )}
                  {totalViewCount > 0 && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      grantedViewCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {grantedViewCount}/{totalViewCount} Routes
                    </span>
                  )}
                  {totalActionCount === 0 && totalViewCount === 0 && (
                    <span className="text-xs text-gray-400 italic">No permissions</span>
                  )}
                </div>
              </div>

              {/* Module body */}
              {isOpen && (
                <div className="bg-white divide-y divide-gray-100">
                  {/* API Permissions */}
                  {module.APIPermissions.some(api => api.Actions.length > 0) && (
                    <div className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">API Permissions</p>
                      <div className="space-y-1.5">
                        {module.APIPermissions.filter(api => api.Actions.length > 0).map(api => {
                          const ctrlIds = api.Actions.map(a => a.Id);
                          const allSelected = ctrlIds.every(id => actionIds.includes(id));
                          const someSelected = ctrlIds.some(id => actionIds.includes(id));
                          return (
                            <div key={api.ControllerName} className="border border-gray-100 rounded-md overflow-hidden">
                              {/* Controller header row */}
                              <div
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                                onClick={() => onToggleAllActionsInController(api.ControllerName)}
                              >
                                <IndeterminateCheckbox
                                  checked={allSelected}
                                  indeterminate={someSelected && !allSelected}
                                  onChange={() => onToggleAllActionsInController(api.ControllerName)}
                                />
                                <span className="text-xs font-semibold text-gray-600">{api.ControllerName}</span>
                                <span className="ml-auto text-xs text-gray-400">
                                  {ctrlIds.filter(id => actionIds.includes(id)).length}/{ctrlIds.length}
                                </span>
                              </div>
                              {/* Action rows */}
                              <div className="divide-y divide-gray-50">
                                {api.Actions.map(action => (
                                  <div
                                    key={action.Id}
                                    className="flex items-center gap-2 pl-8 pr-3 py-1.5 hover:bg-blue-50 cursor-pointer"
                                    onClick={() => onToggleAction(action.Id)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={actionIds.includes(action.Id)}
                                      onChange={() => onToggleAction(action.Id)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      onClick={e => e.stopPropagation()}
                                    />
                                    <span className="text-xs text-gray-700">{action.ActionName}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Route Access */}
                  {module.ViewAccess.length > 0 && (
                    <div className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Route Access</p>
                      <div className="space-y-0.5">
                        {module.ViewAccess.map(view => (
                          <div
                            key={view.Id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-green-50 cursor-pointer"
                            onClick={() => onToggleView(view.Id)}
                          >
                            <input
                              type="checkbox"
                              checked={viewIds.includes(view.Id)}
                              onChange={() => onToggleView(view.Id)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              onClick={e => e.stopPropagation()}
                            />
                            <span className="text-xs font-medium text-gray-700">{view.RouteName}</span>
                            <span className="text-xs text-gray-400 ml-auto truncate max-w-[200px]">{view.RoutePath}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty module */}
                  {!module.APIPermissions.some(api => api.Actions.length > 0) && module.ViewAccess.length === 0 && (
                    <div className="px-4 py-4 text-center text-xs text-gray-400 italic">
                      No permissions defined for this module
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------
const UpdateGroupDialog: React.FC<UpdateGroupDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  group,
  dropdowns: _dropdowns,
}) => {
  const { showToast } = useToast();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [applyFilter, setApplyFilter] = useState(false);
  const [actionIds, setActionIds] = useState<number[]>([]);
  const [viewIds, setViewIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form state whenever the dialog opens for a group
  useEffect(() => {
    if (isOpen && group) {
      setGroupName(group.GroupName || '');
      setDescription(group.Description || '');
      setApplyFilter(group.ApplyFilter ?? false);
      // Derive pre-selected IDs from ModulePermissions where IsGranted === true
      const mods = group.ModulePermissions || [];
      const grantedActionIds = mods.flatMap(m =>
        m.APIPermissions.flatMap(api => api.Actions.filter(a => a.IsGranted).map(a => a.Id))
      );
      const grantedViewIds = mods.flatMap(m =>
        m.ViewAccess.filter(v => v.IsGranted).map(v => v.Id)
      );
      setActionIds(grantedActionIds);
      setViewIds(grantedViewIds);
      setError('');
    }
  }, [isOpen, group]);

  // ---- toggle helpers ----
  const toggleActionId = (id: number) =>
    setActionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleViewId = (id: number) =>
    setViewIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAllActionsInController = (controllerName: string) => {
    const ids = (group?.ModulePermissions || [])
      .flatMap(m => m.APIPermissions)
      .filter(api => api.ControllerName === controllerName)
      .flatMap(api => api.Actions.map(a => a.Id));
    const allSelected = ids.every(id => actionIds.includes(id));
    setActionIds(prev =>
      allSelected
        ? prev.filter(id => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    );
  };

  // ---- submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const payload: UpdateUserGroupPayload = {
        Id: group.Id,
        GroupName: groupName.trim(),
        Description: description.trim() || undefined,
        ApplyFilter: applyFilter,
        PermissionActionIds: actionIds,
        PermissionViewIds: viewIds,
      };
      await editUserGroup(payload);
      showToast({ message: `Group '${groupName.trim()}' updated successfully.`, type: 'success' });
      onSubmit({ id: group.Id, groupName: groupName.trim(), description: description.trim() });
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.Message ||
        err?.Message ||
        'Failed to update group. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Update Group
              <span className="ml-2 text-sm font-normal text-gray-500">— {group?.GroupName}</span>
            </DialogTitle>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Group Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Apply Filter */}
            <div className="flex items-center gap-3">
              <input
                id="applyFilter"
                type="checkbox"
                checked={applyFilter}
                onChange={e => setApplyFilter(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="applyFilter" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                Apply Filter
              </label>
            </div>
            {/* 2026-10-30: vUsers.ApplyFilter is on only when EVERY group of the user has it on. */}
            <p className="text-xs text-gray-400 -mt-2">
              A user in several groups is region-filtered only when all their groups have Apply Filter.
            </p>

            {/* Selection summary */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg text-xs text-gray-500">
              <span className="font-medium text-gray-700">{actionIds.length + viewIds.length}</span>
              {' '}permission{(actionIds.length + viewIds.length) !== 1 ? 's' : ''} selected
              <span className="text-gray-300 mx-1">·</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{actionIds.length} API</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{viewIds.length} Routes</span>
            </div>

            {/* Module Permissions Accordion */}
            {(group?.ModulePermissions?.length ?? 0) > 0 ? (
              <ModuleAccordion
                modules={group.ModulePermissions}
                actionIds={actionIds}
                viewIds={viewIds}
                onToggleAction={toggleActionId}
                onToggleView={toggleViewId}
                onToggleAllActionsInController={toggleAllActionsInController}
              />
            ) : (
              <div className="text-center py-8 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
                No module permissions available for this group.
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button color="zinc" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={isSubmitting || !groupName.trim()}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default UpdateGroupDialog;