'use client'

import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import { LayoutGroup, motion, AnimatePresence } from 'framer-motion'
import React, { forwardRef, useId, useState } from 'react'
import { TouchTarget } from './button'
import { Link } from './link'

export function Sidebar({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return <nav {...props} className={clsx(className, 'flex h-full min-h-0 flex-col')} />
}

export function SidebarHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-col border-b border-zinc-950/5 p-4 [&>[data-slot=section]+[data-slot=section]]:mt-2.5'
      )}
    />
  )
}

export function SidebarBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-1 flex-col overflow-y-auto p-4 [&>[data-slot=section]+[data-slot=section]]:mt-8'
      )}
    />
  )
}

export function SidebarFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-col border-t border-zinc-950/5 p-4 [&>[data-slot=section]+[data-slot=section]]:mt-2.5'
      )}
    />
  )
}

export function SidebarSection({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  let id = useId()

  return (
    <LayoutGroup id={id}>
      <div {...props} data-slot="section" className={clsx(className, 'flex flex-col gap-0.5')} />
    </LayoutGroup>
  )
}

export function SidebarDivider({ className, ...props }: React.ComponentPropsWithoutRef<'hr'>) {
  return <hr {...props} className={clsx(className, 'my-4 border-t border-zinc-950/5 lg:-mx-4')} />
}

export function SidebarSpacer({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div aria-hidden="true" {...props} className={clsx(className, 'mt-8 flex-1')} />
}

export function SidebarHeading({ className, ...props }: React.ComponentPropsWithoutRef<'h3'>) {
  return (
    <h3 {...props} className={clsx(className, 'mb-1 px-2 text-xs/6 font-medium text-zinc-500')} />
  )
}

export const SidebarItem = forwardRef(function SidebarItem(
  {
    current,
    className,
    children,
    ...props
  }: { current?: boolean; className?: string; children: React.ReactNode } & (
    | Omit<Headless.ButtonProps, 'as' | 'className'>
    | Omit<Headless.ButtonProps<typeof Link>, 'as' | 'className'>
  ),
  ref: React.ForwardedRef<HTMLAnchorElement | HTMLButtonElement>
) {
  let classes = clsx(
    // Base
    'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-base/6 font-medium text-zinc-950 sm:py-2 sm:text-sm/5',
    // Leading icon/icon-only
    '*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-500 sm:*:data-[slot=icon]:size-5',
    // Trailing icon (down chevron or similar)
    '*:last:data-[slot=icon]:ml-auto *:last:data-[slot=icon]:size-5 sm:*:last:data-[slot=icon]:size-4',
    // Avatar
    '*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-6',
    // Hover
    'data-hover:bg-zinc-950/5 data-hover:*:data-[slot=icon]:fill-zinc-950',
    // Active
    'data-active:bg-zinc-950/5 data-active:*:data-[slot=icon]:fill-zinc-950',
    // Current
    'data-current:*:data-[slot=icon]:fill-zinc-950',
    // Dark mode
    
  )

  return (
    <span className={clsx(className, 'relative')}>
      {current && (
        <motion.span
          layoutId="current-indicator"
          className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-zinc-950"
        />
      )}
      {'href' in props ? (
        <Headless.CloseButton
          as={Link}
          {...props}
          className={classes}
          data-current={current ? 'true' : undefined}
          ref={ref}
        >
          <TouchTarget>{children}</TouchTarget>
        </Headless.CloseButton>
      ) : (
        <Headless.Button
          {...props}
          className={clsx('cursor-default', classes)}
          data-current={current ? 'true' : undefined}
          ref={ref}
        >
          <TouchTarget>{children}</TouchTarget>
        </Headless.Button>
      )}
    </span>
  )
})

export function SidebarLabel({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return <span {...props} className={clsx(className, 'truncate')} />
}

// Chevron Icon Component
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
    >
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  )
}

export function SidebarDropdown({
  className,
  children,
  label,
  defaultOpen = false,
  href,
  ...props
}: {
  className?: string
  children: React.ReactNode
  label: React.ReactNode
  defaultOpen?: boolean
  href?: string
} & React.ComponentPropsWithoutRef<'div'>) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Separate dropdown items from icons and other elements
  const dropdownItems: React.ReactElement[] = []
  const iconElements: React.ReactElement[] = []

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      // Check if it's a SidebarDropdownItem component
      if (child.type === SidebarDropdownItem) {
        dropdownItems.push(child)
      } else {
        // Everything else (icons, etc.) goes to the button
        iconElements.push(child)
      }
    }
  })

  // Check if any dropdown item has current=true
  const hasCurrentChild = dropdownItems.some((child) => {
    return child.props && 
           typeof child.props === 'object' && 
           child.props !== null &&
           'current' in child.props && 
           (child.props as any).current === true
  })

  const buttonClasses = clsx(
    // Base - match SidebarItem styling
    'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-base/6 font-medium text-gray-500 sm:py-2 sm:text-sm/5',
    // Leading icon/icon-only - match SidebarItem
    '*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-500 sm:*:data-[slot=icon]:size-5',
    // Trailing icon (down chevron or similar) - match SidebarItem
    '*:last:data-[slot=icon]:ml-auto *:last:data-[slot=icon]:size-5 sm:*:last:data-[slot=icon]:size-4',
    // Avatar - match SidebarItem
    '*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-6',
    // Hover - match SidebarItem
    'data-hover:bg-zinc-950/5 data-hover:*:data-[slot=icon]:fill-zinc-950',
    // Active - match SidebarItem
    'data-active:bg-zinc-950/5 data-active:*:data-[slot=icon]:fill-zinc-950',
    // Current - match SidebarItem
    'data-current:*:data-[slot=icon]:fill-zinc-950',
  )

  return (
    <div {...props} className={clsx(className, 'relative')}>
      {hasCurrentChild && (
        <motion.span
          layoutId="current-indicator"
          className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-zinc-950"
        />
      )}
      {href ? (
        <Headless.CloseButton
          as={Link}
          href={href}
          onClick={() => setIsOpen(!isOpen)}
          className={buttonClasses}
          data-current={hasCurrentChild ? 'true' : undefined}
        >
          <TouchTarget>
            {iconElements.map((icon, index) => 
              React.cloneElement(icon, { 
                key: index, 
                'data-slot': 'icon' 
              } as any)
            )}
            <span className="truncate">{label}</span>
            <ChevronDownIcon
              data-slot="icon"
              className={clsx(
                'ml-auto size-5 transition-transform duration-200 sm:size-4 fill-current',
                isOpen && 'rotate-180'
              )}
            />
          </TouchTarget>
        </Headless.CloseButton>
      ) : (
        <Headless.Button
          onClick={() => setIsOpen(!isOpen)}
          className={buttonClasses}
          data-current={hasCurrentChild ? 'true' : undefined}
        >
          <TouchTarget>
            {iconElements.map((icon, index) => 
              React.cloneElement(icon, { 
                key: index, 
                'data-slot': 'icon' 
              } as any)
            )}
            <span className="truncate">{label}</span>
            <ChevronDownIcon
              data-slot="icon"
              className={clsx(
                'ml-auto size-5 transition-transform duration-200 sm:size-4 fill-current',
                isOpen && 'rotate-180'
              )}
            />
          </TouchTarget>
        </Headless.Button>
      )}
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="ml-6 mt-1 space-y-1 border-l border-zinc-200 pl-4">
              {dropdownItems}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SidebarDropdownItem({
  className,
  children,
  current,
  ...props
}: {
  className?: string
  children: React.ReactNode
  current?: boolean
} & (
  | Omit<Headless.ButtonProps, 'as' | 'className'>
  | Omit<Headless.ButtonProps<typeof Link>, 'as' | 'className'>
)) {
  let classes = clsx(
    // Base
    'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm/5 font-medium text-zinc-700 sm:text-xs/5',
    // Leading icon/icon-only
    '*:data-[slot=icon]:size-4 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-400 sm:*:data-[slot=icon]:size-3.5',
    // Hover
    'data-hover:bg-zinc-950/5 data-hover:text-zinc-950 data-hover:*:data-[slot=icon]:fill-zinc-600',
    // Active
    'data-active:bg-zinc-950/5 data-active:text-zinc-950 data-active:*:data-[slot=icon]:fill-zinc-600',
    // Current
    'data-current:text-zinc-950 data-current:*:data-[slot=icon]:fill-zinc-600'
  )

  return (
    <span className={clsx(className, 'relative')}>
      {current && (
        <motion.span
          layoutId="current-dropdown-indicator"
          className="absolute inset-y-1 -left-28 w-0.5 rounded-full bg-zinc-950"
        />
      )}
      {'href' in props ? (
        <Headless.CloseButton
          as={Link}
          {...props}
          className={classes}
          data-current={current ? 'true' : undefined}
        >
          <TouchTarget>{children}</TouchTarget>
        </Headless.CloseButton>
      ) : (
        <Headless.Button
          {...props}
          className={clsx('cursor-default', classes)}
          data-current={current ? 'true' : undefined}
        >
          <TouchTarget>{children}rine?</TouchTarget>
        </Headless.Button>
      )}
    </span>
  )
}
