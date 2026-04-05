import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/16/solid';
import type { vUserGroups, UserGroupDropdowns, UpdateUserGroupPayload, PermissionActions } from '../Model.d';
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
// CheckboxSelect — collapsible panel with search + checkboxes
// ---------------------------------------------------------------------------
interface CheckboxSelectProps<T> {
  label: string;
  items: T[];
  selectedIds: number[];
  getId: (item: T) => number;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | undefined;
  groupBy?: (item: T) => string;
  onToggle: (id: number) => void;
  onToggleGroup?: (groupKey: string) => void;
  placeholder?: string;
}

function CheckboxSelect<T>({
  label,
  items,
  selectedIds,
  getId,
  getLabel,
  getSubLabel,
  groupBy,
  onToggle,
  onToggleGroup,
  placeholder = 'Search...',
}: CheckboxSelectProps<T>) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    return (
      getLabel(item).toLowerCase().includes(q) ||
      (getSubLabel?.(item) || '').toLowerCase().includes(q) ||
      (groupBy?.(item) || '').toLowerCase().includes(q)
    );
  });

  // Build grouped structure if groupBy provided
  const grouped: Record<string, T[]> | null = groupBy
    ? filtered.reduce((acc, item) => {
        const key = groupBy(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {} as Record<string, T[]>)
    : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-gray-50 cursor-pointer select-none hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            {selectedIds.length} selected
          </span>
          {items.length > 0 && (
            <span className="text-xs text-gray-400">of {items.length}</span>
          )}
        </div>
        {open ? (
          <ChevronUpIcon className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {open && (
        <div>
          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100 bg-white">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900"
              />
            </div>
          </div>

          {/* Items */}
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {grouped ? (
              Object.keys(grouped).length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-gray-400">No items found</div>
              ) : (
                Object.entries(grouped).map(([groupKey, groupItems]) => {
                  const groupIds = groupItems.map(getId);
                  const allSelected = groupIds.every(id => selectedIds.includes(id));
                  const someSelected = groupIds.some(id => selectedIds.includes(id));
                  return (
                    <div key={groupKey}>
                      {/* Controller header row */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50/80 hover:bg-gray-100 cursor-pointer"
                        onClick={() => onToggleGroup?.(groupKey)}
                      >
                        <IndeterminateCheckbox
                          checked={allSelected}
                          indeterminate={someSelected && !allSelected}
                          onChange={() => onToggleGroup?.(groupKey)}
                        />
                        <span className="text-xs font-semibold text-gray-600">{groupKey}</span>
                        <span className="ml-auto text-xs text-gray-400">
                          {groupIds.filter(id => selectedIds.includes(id)).length}/{groupIds.length}
                        </span>
                      </div>
                      {/* Action rows */}
                      {groupItems.map(item => (
                        <div
                          key={getId(item)}
                          className="flex items-center gap-2 pl-8 pr-3 py-1.5 hover:bg-blue-50 cursor-pointer"
                          onClick={() => onToggle(getId(item))}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(getId(item))}
                            onChange={() => onToggle(getId(item))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="text-xs text-gray-700">{getLabel(item)}</span>
                          {getSubLabel?.(item) && (
                            <span className="text-xs text-gray-400 truncate ml-1">— {getSubLabel(item)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              )
            ) : (
              filtered.length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-gray-400">No items found</div>
              ) : (
                filtered.map(item => (
                  <div
                    key={getId(item)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer"
                    onClick={() => onToggle(getId(item))}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(getId(item))}
                      onChange={() => onToggle(getId(item))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="text-xs text-gray-700">{getLabel(item)}</span>
                    {getSubLabel?.(item) && (
                      <span className="text-xs text-gray-400 truncate ml-1">— {getSubLabel(item)}</span>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
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
// Main dialog
// ---------------------------------------------------------------------------
const UpdateGroupDialog: React.FC<UpdateGroupDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  group,
  dropdowns,
}) => {
  const { showToast } = useToast();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [actionIds, setActionIds] = useState<number[]>([]);
  const [viewIds, setViewIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form state whenever the dialog opens for a group
  useEffect(() => {
    if (isOpen && group) {
      setGroupName(group.GroupName || '');
      setDescription(group.Description || '');
      // Pre-select existing assignments (empty until backend populates the view)
      setActionIds(group.PermissionActionIds ?? []);
      setViewIds(group.PermissionViewIds ?? []);
      setError('');
    }
  }, [isOpen, group]);

  // ---- toggle helpers ----
  const toggleActionId = (id: number) =>
    setActionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleViewId = (id: number) =>
    setViewIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAllActionsInController = (controllerName: string) => {
    const ids = dropdowns.PermissionActions
      .filter(a => a.ControllerName === controllerName)
      .map(a => a.Id);
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

            {/* API Permissions — PermissionActionIds */}
            <CheckboxSelect<PermissionActions>
              label="API Permissions"
              items={dropdowns.PermissionActions}
              selectedIds={actionIds}
              getId={a => a.Id}
              getLabel={a => a.ActionName}
              getSubLabel={a => a.Description}
              groupBy={a => a.ControllerName}
              onToggle={toggleActionId}
              onToggleGroup={toggleAllActionsInController}
              placeholder="Search by controller or action..."
            />

            {/* Route Permissions — PermissionViewIds */}
            <CheckboxSelect<import('../Model.d').PermissionViews>
              label="Route Permissions"
              items={dropdowns.PermissionViews}
              selectedIds={viewIds}
              getId={v => v.Id}
              getLabel={v => v.RoutePath}
              getSubLabel={v => v.Description}
              onToggle={toggleViewId}
              placeholder="Search by route path..."
            />

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