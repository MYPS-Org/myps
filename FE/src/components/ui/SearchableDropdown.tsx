import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface Option {
  value: string | number;
  label: string;
  key?: string | number;
}

interface SearchableDropdownProps {
  options: Option[];
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  allowClear?: boolean;
  searchPlaceholder?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  error = false,
  allowClear = false,
  searchPlaceholder = "Search..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive filtered options without setState (avoids infinite re-render loop)
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        portalRef.current && !portalRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recalculate position and close on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const updatePos = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    };
    const close = (e: Event) => {
      // Don't close when scrolling inside the portal dropdown itself
      if (portalRef.current && e.target instanceof Node && portalRef.current.contains(e.target)) return;
      setIsOpen(false);
      setSearchTerm('');
    };

    updatePos();
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  /*  Loose == so '16' finds 16 -- but an EMPTY value is no selection at all. With == alone,
      '' found an option whose value is 0 ('' == 0 is true), so the Sub-Category list, which
      holds a PAPKey 0 row, showed "PROGRAM OF WORKS/BUDGET COST" as chosen on an empty form
      (S07-TC003-P001). */
  const selectedOption = value === '' || value === undefined || value === null
    ? undefined
    : options.find(option => option.value == value);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(prev => {
        if (!prev && triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
        return !prev;
      });
      setSearchTerm('');
    }
  };

  const handleOptionSelect = (optionValue: string | number) => {
    console.log('SearchableDropdown - Option selected:', optionValue, typeof optionValue);
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setSearchTerm('');
  };

  const baseClasses = `
    w-full min-w-0 overflow-hidden box-border mt-1 border rounded-md
    ${error ? 'border-red-500' : 'border-gray-300'}
    ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white hover:border-gray-400'}
    ${className}
  `.trim();

  return (
    <div className="relative w-full" ref={triggerRef}>
      <div
        className={baseClasses}
        onClick={handleToggle}
      >
        <div className="flex items-center overflow-hidden px-3 py-2">
          <div className="flex-1 min-w-0">
            {/* title: a long label (a Sub-Category's runs past 100 characters) is cut off here. */}
            <span
              className={`block overflow-hidden text-ellipsis whitespace-nowrap ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}
              title={selectedOption?.label}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <div className="flex items-center ml-2 flex-shrink-0">
            {allowClear && selectedOption && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 mr-1"
              >
                ×
              </button>
            )}
            <ChevronDownIcon 
              className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </div>

      {isOpen && !disabled && ReactDOM.createPortal(
        <div
          ref={portalRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
          className="bg-white border border-gray-300 rounded-md shadow-lg"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.key || option.value}
                  className={`
                    px-3 py-2 text-sm cursor-pointer hover:bg-gray-100
                    ${option.value === value ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}
                  `}
                  onClick={() => handleOptionSelect(option.value)}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableDropdown;