import { Avatar } from '../components/tailwindui/avatar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '../components/tailwindui/dropdown'
import { Navbar, NavbarDivider, NavbarItem, NavbarLabel, NavbarSection, NavbarSpacer } from '../components/tailwindui/navbar'
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  Cog8ToothIcon,
  LightBulbIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/16/solid'
import { InboxIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import ThemeToggle from '../components/ThemeToggle'

export default function NavBar() {
  return (
    <Navbar>
      {/* <Link href="/" aria-label="Home">
        <Logo className="size-10 sm:size-8" />
      </Link> */}
      <NavbarSpacer />
      <NavbarSection>
        <NavbarItem>
          <ThemeToggle />
        </NavbarItem>
        <NavbarItem href="/search" aria-label="Search">
          <MagnifyingGlassIcon />
        </NavbarItem>
        <NavbarItem href="/inbox" aria-label="Inbox">
          <InboxIcon />
        </NavbarItem>
      </NavbarSection>
    </Navbar>
  )
}