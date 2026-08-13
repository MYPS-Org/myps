"use client"
import { useState } from 'react'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '../components/tailwindui/navbar'
import { /*InboxIcon,*/ MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import GlobalSearchDialog from '../pages/GlobalSearch/GlobalSearchDialog'
// import ThemeToggle from '../components/ThemeToggle'

export default function NavBar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return (
    <>
      <Navbar>
        {/* <Link href="/" aria-label="Home">
          <Logo className="size-10 sm:size-8" />
        </Link> */}
        <NavbarSpacer />
        <NavbarSection>
          {/* <NavbarItem>
            <ThemeToggle />
          </NavbarItem> */}
          <NavbarItem aria-label="Search" onClick={() => setIsSearchOpen(true)}>
            <MagnifyingGlassIcon />
          </NavbarItem>
          {/* <NavbarItem href="/inbox" aria-label="Inbox">
            <InboxIcon />
          </NavbarItem> */}
        </NavbarSection>
      </Navbar>

      <GlobalSearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  )
}