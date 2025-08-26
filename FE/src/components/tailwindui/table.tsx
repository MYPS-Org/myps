'use client'

import clsx from 'clsx'
import type React from 'react'
import { createContext, useContext, useState } from 'react'
import { Link } from './link'

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
        {sortable && justify !== "center" && getSortIcon()}
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
