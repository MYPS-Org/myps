import React, { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface CheckboxItem {
  id: any;
  name: string;
  groupType?: string;
  [key: string]: any;
}

interface CheckboxListProps {
  title: string;
  items: CheckboxItem[];
  selectedIds: any[];
  onToggle: (id: any) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  groupBy?: string; // Property name to group by (e.g., 'OrgType')
  idKey?: string; // Property name for the ID (default: 'id')
  nameKey?: string; // Property name for the name (default: 'name')
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  maxVisibleChips?: number; // Max selected chips to show before collapsing into "+N more" (default: 12)
}

const CheckboxList: React.FC<CheckboxListProps> = ({
  title,
  items,
  selectedIds = [],
  onToggle,
  onSelectAll,
  onClearAll,
  groupBy,
  idKey = 'id',
  nameKey = 'name',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items available',
  disabled = false,
  maxVisibleChips = 12,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected items shown as chips below the header so they're visible without
  // expanding the dropdown.
  const selectedItems = useMemo(
    () => items.filter(item => selectedIds.includes(item[idKey] ?? '')),
    [items, selectedIds, idKey]
  );

  // Group items if groupBy is provided
  const groupedItems = useMemo(() => {
    if (!groupBy) return { 'All': items };
    
    return items.reduce((acc, item) => {
      const groupType = item[groupBy] || 'Other';
      if (!acc[groupType]) {
        acc[groupType] = [];
      }
      acc[groupType].push(item);
      return acc;
    }, {} as {[key: string]: CheckboxItem[]});
  }, [items, groupBy]);

  // Filter items based on search term
  const filteredGroupedItems = useMemo(() => {
    if (!searchTerm) return groupedItems;
    
    const filtered: {[key: string]: CheckboxItem[]} = {};
    Object.keys(groupedItems).forEach((groupType) => {
      const filteredItems = groupedItems[groupType].filter(item =>
        item[nameKey]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item[idKey]?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filteredItems.length > 0) {
        filtered[groupType] = filteredItems;
      }
    });
    return filtered;
  }, [groupedItems, searchTerm, idKey, nameKey]);

  // Helper function to check if all items in a group are selected
  const isGroupSelected = (groupType: string): boolean => {
    const groupItems = groupedItems[groupType] || [];
    return groupItems.length > 0 && groupItems.every(item => 
      selectedIds.includes(item[idKey] ?? '')
    );
  };

  // Helper function to check if some items in a group are selected
  const isGroupPartiallySelected = (groupType: string): boolean => {
    const groupItems = groupedItems[groupType] || [];
    return groupItems.some(item => 
      selectedIds.includes(item[idKey] ?? '')
    ) && !isGroupSelected(groupType);
  };

  // Helper function to toggle all items in a group
  const handleGroupToggle = (groupType: string) => {
    const groupItems = groupedItems[groupType] || [];
    const groupItemIds = groupItems.map(item => item[idKey] ?? '');
    
    if (isGroupSelected(groupType)) {
      // Remove all group items
      groupItemIds.forEach(id => {
        if (selectedIds.includes(id)) {
          onToggle(id);
        }
      });
    } else {
      // Add all group items
      groupItemIds.forEach(id => {
        if (!selectedIds.includes(id)) {
          onToggle(id);
        }
      });
    }
  };

  const hasNoResults = Object.keys(filteredGroupedItems).length === 0 && searchTerm;
  const hasNoItems = items.length === 0;

  return (
    <div className="mb-6 border border-gray-300 rounded-lg">
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none transition-colors duration-200"
          disabled={disabled}
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform duration-200" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform duration-200" />
          )}
          {title}
          <span className={`ml-2 text-xs font-normal ${
            selectedIds.length > 0 
              ? 'text-blue-600 bg-blue-100 px-2 py-1 rounded-full' 
              : 'text-gray-500'
          }`}>
            {selectedIds.length > 0 
              ? `${selectedIds.length} selected`
              : 'None selected'
            }
          </span>
        </button>
        {isExpanded && !disabled && (
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 border-b border-gray-200 bg-white">
          {selectedItems.slice(0, maxVisibleChips).map((item) => {
            const itemId = item[idKey];
            return (
              <span
                key={itemId}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200"
              >
                {item[nameKey]}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onToggle(itemId ?? '')}
                    className="text-blue-400 hover:text-blue-600 focus:outline-none"
                    aria-label={`Remove ${item[nameKey]}`}
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })}
          {selectedItems.length > maxVisibleChips && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500">
              +{selectedItems.length - maxVisibleChips} more
            </span>
          )}
        </div>
      )}

      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="p-4">
          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
              maxLength={100}
              disabled={disabled}
            />
          </div>

          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
            {hasNoItems && (
              <div className="text-center py-4 text-gray-500 text-sm">
                {emptyMessage}
              </div>
            )}

            {!hasNoItems && !hasNoResults && Object.keys(filteredGroupedItems).map((groupType) => {
              const showGroupHeader = groupBy && Object.keys(groupedItems).length > 1;
              
              return (
                <div key={groupType} className="mb-4 last:mb-0">
                  {showGroupHeader && (
                    <div className="flex items-center mb-2 pb-2 border-b border-gray-200">
                      <input
                        type="checkbox"
                        id={`group-${groupType}`}
                        checked={isGroupSelected(groupType)}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate = isGroupPartiallySelected(groupType);
                          }
                        }}
                        onChange={() => handleGroupToggle(groupType)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled={disabled}
                      />
                      <label
                        htmlFor={`group-${groupType}`}
                        className="ml-2 text-sm font-semibold text-gray-800 cursor-pointer"
                      >
                        {groupType}
                      </label>
                    </div>
                  )}
                  
                  <div className={showGroupHeader ? 'ml-4 space-y-2' : 'space-y-2'}>
                    {filteredGroupedItems[groupType].map((item) => {
                      const itemId = item[idKey];
                      const itemName = item[nameKey];
                      
                      return (
                        <div key={itemId} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`item-${itemId}`}
                            checked={selectedIds.includes(itemId ?? '')}
                            onChange={() => onToggle(itemId ?? '')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled={disabled}
                          />
                          <label
                            htmlFor={`item-${itemId}`}
                            className="ml-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900"
                          >
                            {itemName}
                            {/* {item[idKey] && (
                              <span className="ml-1 text-xs text-gray-500">
                                ({item[idKey]})
                              </span>
                            )} */}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {hasNoResults && (
              <div className="text-center py-4 text-gray-500 text-sm">
                No results found for "{searchTerm}"
              </div>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-1">
            Selected: {selectedIds.length} {items.length > 0 ? `of ${items.length}` : ''} items
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckboxList;
