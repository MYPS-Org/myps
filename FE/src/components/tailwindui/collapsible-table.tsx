'use client'

import clsx from 'clsx'
import React from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from './table'

export type CollapsibleTableColumn<T> = {
  header: React.ReactNode
  headerClassName?: string
  className?: string
  justify?: 'start' | 'end' | 'center' | 'between'
  render: (row: T, ctx: { isExpanded: boolean; toggleExpand: () => void }) => React.ReactNode
}

export interface CollapsibleTableProps<T> {
  columns: CollapsibleTableColumn<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  isRowExpanded: (row: T) => boolean
  onToggleRow: (row: T) => void
  renderExpandedContent?: (row: T) => React.ReactNode
  className?: string
  striped?: boolean
  emptyMessage?: string
}

// Generic table that supports an optional expandable/collapsible row underneath each row
export function CollapsibleTable<T>({
  columns,
  data,
  rowKey,
  isRowExpanded,
  onToggleRow,
  renderExpandedContent,
  className,
  striped,
  emptyMessage = 'No records found'
}: CollapsibleTableProps<T>) {
  return (
    <Table className={className} striped={striped}>
      <TableHead>
        <TableRow>
          {columns.map((col, i) => (
            <TableHeader key={i} className={col.headerClassName} justify={col.justify}>
              {col.header}
            </TableHeader>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center py-4 text-gray-500">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row, idx) => {
            const expanded = isRowExpanded(row)
            const ctx = { isExpanded: expanded, toggleExpand: () => onToggleRow(row) }

            return (
              <React.Fragment key={rowKey(row, idx)}>
                <TableRow>
                  {columns.map((col, ci) => (
                    <TableCell key={ci} className={col.className}>
                      {col.render(row, ctx)}
                    </TableCell>
                  ))}
                </TableRow>
                {expanded && renderExpandedContent && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="p-0 bg-gray-50/50 border-t border-gray-200">
                      {renderExpandedContent(row)}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

// Standard chevron + label toggle button used to expand/collapse a row
export function ExpandToggleButton({
  label,
  isExpanded,
  onClick,
  className
}: {
  label: React.ReactNode
  isExpanded: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={clsx('flex items-center text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors', className)}
    >
      {isExpanded ? (
        <ChevronDownIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform" />
      ) : (
        <ChevronRightIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform" />
      )}
      {label}
    </button>
  )
}

// Standard panel wrapper for the content shown when a row is expanded
export function ExpandedPanel({
  title,
  badge,
  children
}: {
  title: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {badge !== undefined && (
          <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">{badge}</span>
        )}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">{children}</div>
    </div>
  )
}
