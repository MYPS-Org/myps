"use client"
import { useState } from 'react'
import { Navbar, NavbarItem, NavbarLabel, NavbarSection, NavbarSpacer } from '../components/tailwindui/navbar'
import { /*InboxIcon,*/ MagnifyingGlassIcon, MegaphoneIcon } from '@heroicons/react/20/solid'
import GlobalSearchDialog from '../pages/GlobalSearch/GlobalSearchDialog'
import ChangelogDialog from '../components/changelog/ChangelogDialog'
import { hasUnseenChanges, markChangesSeen } from '../components/changelog/changelogs'
// import ThemeToggle from '../components/ThemeToggle'

export default function NavBar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  const [hasUnseen, setHasUnseen] = useState(hasUnseenChanges)

  const openChangelog = () => {
    markChangesSeen()
    setHasUnseen(false)
    setIsChangelogOpen(true)
  }

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
          <NavbarItem aria-label="Changelogs" onClick={openChangelog}>
            <MegaphoneIcon />
            <NavbarLabel>Changelogs</NavbarLabel>
            {hasUnseen && (
              <span className="absolute left-6 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" />
            )}
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
      <ChangelogDialog
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
    </>
  )
}
