'use client'

import clsx from 'clsx'
import type React from 'react'
import { createContext, useContext, useState } from 'react'
import { Link } from './link'

// Types for NavPills
type NavPillOption = {
  value: string
  label: string
  count?: number
  disabled?: boolean
}

type NavPillsProps = {
  options: NavPillOption[]
  selectedValue?: string
  onChange?: (value: string) => void
  label?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'pills' | 'underline'
}

type MultiSelectNavPillsProps = {
  options: NavPillOption[]
  selectedValues?: string[]
  onChange?: (values: string[]) => void
  label?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'pills' | 'underline'
  showClearAll?: boolean
}

// Sorting icons
function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function ChevronUpDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
  )
}

// NavPills Component for filtering
export function NavPills({
  options,
  selectedValue,
  onChange,
  label,
  className,
  size = 'md',
  variant = 'pills'
}: NavPillsProps) {
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base'
  }

  const getVariantClasses = (isSelected: boolean, isDisabled: boolean) => {
    if (isDisabled) {
      return 'cursor-not-allowed opacity-50 text-zinc-400 bg-zinc-100'
    }

    switch (variant) {
      case 'pills':
        return isSelected
          ? 'bg-blue-100 text-blue-700 border-blue-200'
          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 border-zinc-200'
      
      case 'underline':
        return isSelected
          ? 'text-blue-600 border-b-2 border-blue-600 bg-transparent'
          : 'text-zinc-600 hover:text-zinc-900 bg-transparent border-b-2 border-transparent hover:border-zinc-300'
      
      default: // 'default'
        return isSelected
          ? 'bg-blue-600 text-white'
          : 'bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-300'
    }
  }

  return (
    <div className={clsx('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
        const isSelected = selectedValue === option.value
        const isDisabled = option.disabled || false

        return (
          <button
            key={option.value}
            onClick={() => !isDisabled && onChange?.(option.value)}
            disabled={isDisabled}
            className={clsx(
              'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-200 focus:outline-none',
              sizeClasses[size],
              getVariantClasses(isSelected, isDisabled),
              variant !== 'underline' && 'border'
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className={clsx(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
                isSelected 
                  ? variant === 'pills' 
                    ? 'bg-blue-200 text-blue-800' 
                    : 'bg-blue-500 text-white'
                  : 'bg-zinc-200 text-zinc-600'
              )}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
      </div>
    </div>
  )
}

// Multi-Select NavPills Component for filtering with multiple selections
export function MultiSelectNavPills({
  options,
  selectedValues = [],
  onChange,
  label,
  className,
  size = 'md',
  variant = 'pills',
  showClearAll = true
}: MultiSelectNavPillsProps) {
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base'
  }

  const handleToggle = (value: string) => {
    if (!onChange) return
    
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value]
    
    onChange(newValues)
  }

  const handleClearAll = () => {
    if (!onChange) return
    onChange([])
  }

  const getVariantClasses = (isSelected: boolean, isDisabled: boolean) => {
    if (isDisabled) {
      return 'cursor-not-allowed opacity-50 text-zinc-400 bg-zinc-100'
    }

    switch (variant) {
      case 'pills':
        return isSelected
          ? 'bg-blue-100 text-blue-700 border-blue-200'
          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 border-zinc-200'
      
      case 'underline':
        return isSelected
          ? 'text-blue-600 border-b-2 border-blue-600 bg-transparent'
          : 'text-zinc-600 hover:text-zinc-900 bg-transparent border-b-2 border-transparent hover:border-zinc-300'
      
      default: // 'default'
        return isSelected
          ? 'bg-blue-600 text-white'
          : 'bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-300'
    }
  }

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2 m-4">
      {label && (
        <label className="text-md font-medium text-blue-500">
          {label} :
        </label>
      )}
        {options.map((option) => {
        const isSelected = selectedValues.includes(option.value)
        const isDisabled = option.disabled || false

        return (
          <button
            key={option.value}
            onClick={() => !isDisabled && handleToggle(option.value)}
            disabled={isDisabled}
            className={clsx(
              'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-200',
              sizeClasses[size],
              getVariantClasses(isSelected, isDisabled),
              variant !== 'underline' && 'border'
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className={clsx(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
                isSelected 
                  ? variant === 'pills' 
                    ? 'bg-blue-200 text-blue-800' 
                    : 'bg-blue-500 text-white'
                  : 'bg-zinc-200 text-zinc-600'
              )}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
      {showClearAll && selectedValues.length > 0 && (
        <button
          onClick={handleClearAll}
          className={clsx(
            'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
            sizeClasses[size],
            'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
          )}
        >
          <span>Clear All</span>
        </button>
      )}
      </div>
    </div>
  )
}

const TableContext = createContext<{ bleed: boolean; dense: boolean; grid: boolean; striped: boolean }>({
  bleed: false,
  dense: false,
  grid: false,
  striped: false,
})

export function Table({
  bleed = false,
  dense = false,
  grid = false,
  striped = false,
  className,
  children,
  ...props
}: { bleed?: boolean; dense?: boolean; grid?: boolean; striped?: boolean } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <TableContext.Provider value={{ bleed, dense, grid, striped } as React.ContextType<typeof TableContext>}>
      <div className="flow-root">
        <div {...props} className={clsx(className, '-mx-(--gutter) overflow-x-auto whitespace-nowrap')}>
          <div className={clsx('inline-block min-w-full align-middle', !bleed && 'sm:px-(--gutter)')}>
            <table className="min-w-full text-left text-sm/6 text-zinc-950">{children}</table>
          </div>
        </div>
      </div>
    </TableContext.Provider>
  )
}

export function TableHead({ className, ...props }: React.ComponentPropsWithoutRef<'thead'>) {
  return <thead {...props} className={clsx(className, 'text-center text-zinc-500')} />
}

export function TableBody(props: React.ComponentPropsWithoutRef<'tbody'>) {
  return <tbody {...props} />
}

const TableRowContext = createContext<{ href?: string; target?: string; title?: string }>({
  href: undefined,
  target: undefined,
  title: undefined,
})

export function TableRow({
  href,
  target,
  title,
  className,
  ...props
}: { href?: string; target?: string; title?: string } & React.ComponentPropsWithoutRef<'tr'>) {
  let { striped } = useContext(TableContext)

  return (
    <TableRowContext.Provider value={{ href, target, title } as React.ContextType<typeof TableRowContext>}>
      <tr
        {...props}
        className={clsx(
          className,
          href &&
            'has-[[data-row-link][data-focus]]:outline-2 has-[[data-row-link][data-focus]]:-outline-offset-2 has-[[data-row-link][data-focus]]:outline-blue-500',
          striped && 'even:bg-zinc-950/2.5',
          href && striped && 'hover:bg-zinc-950/5',
          href && !striped && 'hover:bg-zinc-950/2.5'
        )}
      />
    </TableRowContext.Provider>
  )
}

export function TableHeader({ 
  className, 
  sortable = false,
  sortDirection,
  justify = 'between', //default
  onSort,
  children,
  ...props 
}: { 
  sortable?: boolean;
  sortDirection?: 0 | 1 | null; // 0 = asc, 1 = desc, null = no sort
  justify?: 'start' | 'end' | 'center' | 'between';
  onSort?: (direction: 0 | 1) => void;
} & React.ComponentPropsWithoutRef<'th'>) {
  let { bleed, grid } = useContext(TableContext)

  const handleSort = () => {
    if (!sortable || !onSort) return
    
    // Cycle through: null -> asc (0) -> desc (1) -> null
    if (sortDirection === null) {
      onSort(0) // Set to ascending
    } else if (sortDirection === 0) {
      onSort(1) // Set to descending
    } else {
      onSort(0) // Reset to ascending (or you could set to null for no sort)
    }
  }

  const getSortIcon = () => {
    if (!sortable) return null
    
    if (sortDirection === 0) {
      return <ChevronUpIcon className="ml-2 h-4 w-4" />
    } else if (sortDirection === 1) {
      return <ChevronDownIcon className="ml-2 h-4 w-4" />
    } else {
      return <ChevronUpDownIcon className="ml-2 h-4 w-4 opacity-50" />
    }
  }

  const getJustifyClass = () => {
    switch (justify) {
      case 'start':
        return 'justify-start';
      case 'end':
        return 'justify-end';
      case 'center':
        return 'justify-center';
      default:
        return 'justify-between';
    }
  }

  return (
    <th
      {...props}
      className={clsx(
        className,
        'border-b border-b-zinc-950/10 px-4 py-2 font-medium first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
        grid && 'border-l border-l-zinc-950/5 first:border-l-0',
        !bleed && 'sm:first:pl-1 sm:last:pr-1',
        sortable && 'cursor-pointer select-none hover:bg-zinc-50 transition-colors'
      )}
      onClick={handleSort}
    >
      <div className={clsx("flex items-center", getJustifyClass())}>
        <span>{children}</span>
        {/* Centred headers skip the idle up/down glyph, but show the arrow of the active sort. */}
        {sortable && (justify !== "center" || sortDirection === 0 || sortDirection === 1) && getSortIcon()}
      </div>
    </th>
  )
}

export function TableCell({ className, children, ...props }: React.ComponentPropsWithoutRef<'td'>) {
  let { bleed, dense, grid, striped } = useContext(TableContext)
  let { href, target, title } = useContext(TableRowContext)
  let [cellRef, setCellRef] = useState<HTMLElement | null>(null)

  return (
    <td
      ref={href ? setCellRef : undefined}
      {...props}
      className={clsx(
        className,
        'relative px-4 first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
        !striped && 'border-b border-zinc-950/5',
        grid && 'border-l border-l-zinc-950/5 first:border-l-0',
        dense ? 'py-1' : 'py-4',
        !bleed && 'sm:first:pl-1 sm:last:pr-1'
      )}
    >
      {href && (
        <Link
          data-row-link
          href={href}
          target={target}
          aria-label={title}
          tabIndex={cellRef?.previousElementSibling === null ? 0 : -1}
          className="absolute inset-0 focus:outline-hidden"
        />
      )}
      {children}
    </td>
  )
}

// Convenience component that combines NavPills with Table
export function FilterableTable({
  filterOptions,
  selectedFilter,
  onFilterChange,
  filterClassName,
  filterSize = 'md',
  filterVariant = 'pills',
  label,
  children,
  ...tableProps
}: {
  filterOptions: NavPillOption[]
  selectedFilter?: string
  onFilterChange?: (value: string) => void
  filterClassName?: string
  filterSize?: 'sm' | 'md' | 'lg'
  filterVariant?: 'default' | 'pills' | 'underline'
  label?: string
} & React.ComponentPropsWithoutRef<typeof Table>) {
  return (
    <div className="space-y-4">
      <NavPills
        options={filterOptions}
        selectedValue={selectedFilter}
        onChange={onFilterChange}
        label={label}
        className={filterClassName}
        size={filterSize}
        variant={filterVariant}
      />
      <Table {...tableProps}>
        {children}
      </Table>
    </div>
  )
}

// Multi-Select Filterable Table component that combines MultiSelectNavPills with Table
export function MultiSelectFilterableTable({
  filterOptions,
  selectedFilters,
  onFilterChange,
  filterClassName,
  filterSize = 'md',
  filterVariant = 'pills',
  showClearAll = true,
  children,
  label,
  ...tableProps
}: {
  filterOptions: NavPillOption[]
  selectedFilters?: string[]
  onFilterChange?: (values: string[]) => void
  filterClassName?: string
  filterSize?: 'sm' | 'md' | 'lg'
  filterVariant?: 'default' | 'pills' | 'underline'
  showClearAll?: boolean
  label?: string
} & React.ComponentPropsWithoutRef<typeof Table>) {
  return (
    <div className="space-y-4">
      <MultiSelectNavPills
        options={filterOptions}
        selectedValues={selectedFilters}
        onChange={onFilterChange}
        label={label}
        className={filterClassName}
        size={filterSize}
        variant={filterVariant}
        showClearAll={showClearAll}
      />
      <Table {...tableProps}>
        {children}
      </Table>
    </div>
  )
}
