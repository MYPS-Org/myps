	import { Avatar } from '../components/tailwindui/avatar'
import {
Dropdown,
DropdownButton,
DropdownDivider,
DropdownItem,
DropdownLabel,
DropdownMenu,
} from '../components/tailwindui/dropdown'
import {
Sidebar,
SidebarBody,
SidebarFooter,
SidebarHeader,
SidebarItem,
SidebarLabel,
SidebarSection,
SidebarSpacer,
SidebarDropdown,
SidebarDropdownItem,
} from '../components/tailwindui/sidebar'
import {
ArrowRightStartOnRectangleIcon,
ChevronDownIcon,
} from '@heroicons/react/16/solid'
import {
Cog6ToothIcon,
HomeIcon,
QuestionMarkCircleIcon,
Square2StackIcon,
FolderIcon,
CalendarDateRangeIcon,
} from '@heroicons/react/20/solid'
import { authService } from '../pages/login/Service' // Adjust the import path as necessary
import Logo from '../assets/img/logo.png' // Adjust the import path as necessary

// If using React Router, you can import useLocation
// import { useLocation } from 'react-router-dom'

const handleLogout = async () => {
	try {
		await authService.logout();
		window.location.href = '/login';
	} catch (error) {
		console.error('Logout failed:', error);
		alert('Logout failed. Please try again.');
	}
}

export default function SideBar() {
// If using React Router, uncomment this to get current path
// const location = useLocation()
// const currentPath = location.pathname

// For now, you can manually set which item should be current
// Change this to your actual routing logic or pass it as a prop
const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard'
	return (
		<Sidebar>
		<SidebarHeader>
			<Dropdown>
			<DropdownButton as={SidebarItem} className="mb-2.5">
				<Avatar src={Logo} />
				<SidebarLabel className="text-gray-500">MYPS</SidebarLabel>
				<ChevronDownIcon />
			</DropdownButton>
			<DropdownMenu className="min-w-64" anchor="bottom start">
				<DropdownDivider />
				<DropdownItem href="/profile">
					<Avatar slot="icon" src="/tailwind-logo.svg" />
					<DropdownLabel>Profile</DropdownLabel>
				</DropdownItem>
				<DropdownItem onClick={handleLogout}>
					<ArrowRightStartOnRectangleIcon />
					<DropdownLabel>Log out</DropdownLabel>
				</DropdownItem>
				{/* <DropdownDivider />
				<DropdownItem href="/teams/create">
					<PlusIcon />
					<DropdownLabel>New team&hellip;</DropdownLabel>
				</DropdownItem> */}
			</DropdownMenu>
			</Dropdown>
		</SidebarHeader>
		<SidebarBody>
			<SidebarSection>
			<SidebarItem href="/dashboard" current={currentPath === '/dashboard'}>
				<HomeIcon />
				<SidebarLabel className="text-gray-500">Dashboard</SidebarLabel>
			</SidebarItem>
			<SidebarItem href="/programs" current={currentPath === '/programs'}>
				<FolderIcon />
				<SidebarLabel className="text-gray-500">Programs</SidebarLabel>
			</SidebarItem>
			<SidebarItem href="/projects" current={currentPath === '/projects'}>
				<Square2StackIcon />
				<SidebarLabel className="text-gray-500">Projects</SidebarLabel>
			</SidebarItem>
			<SidebarItem href="/mult-year" current={currentPath === '/mult-year'}>
				<CalendarDateRangeIcon />
				<SidebarLabel className="text-gray-500">Mult-Year</SidebarLabel>
			</SidebarItem>
			<SidebarDropdown
				label="Settings"
				defaultOpen={false}
				className="text-gray-500"
				>
				<Cog6ToothIcon />
				<SidebarDropdownItem href="/settings/general" current={currentPath === '/settings/general'}>
					<SidebarLabel>General</SidebarLabel>
				</SidebarDropdownItem>
				<SidebarDropdownItem href="/settings/security" current={currentPath === '/settings/security'}>
					<SidebarLabel>Security</SidebarLabel>
				</SidebarDropdownItem>
				<SidebarDropdownItem href="/rbac" current={currentPath === '/rbac'}>
					<SidebarLabel>User Management</SidebarLabel>
				</SidebarDropdownItem>
			</SidebarDropdown>
			</SidebarSection>
			<SidebarSpacer />
			<SidebarSection>
			<SidebarItem href="/support" current={currentPath === '/support'}>
				<QuestionMarkCircleIcon />
				<SidebarLabel>Support</SidebarLabel>
			</SidebarItem>
			{/* <SidebarItem href="/changelog">
				<SparklesIcon />
				<SidebarLabel>Changelog</SidebarLabel>
			</SidebarItem> */}
			</SidebarSection>
		</SidebarBody>
		<SidebarFooter>
			<Dropdown>
			{/* <DropdownButton as={SidebarItem}>
				<span className="flex min-w-0 items-center gap-3">
				<Avatar src="/profile-photo.jpg" className="size-10" square alt="" />
				<span className="min-w-0">
					<span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">Erica</span>
					<span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
					erica@example.com
					</span>
				</span>
				</span>
				<ChevronUpIcon />
			</DropdownButton> */}
			{/* <DropdownMenu className="min-w-64" anchor="top start">
				<DropdownItem href="/my-profile">
				<UserIcon />
				<DropdownLabel>My profile</DropdownLabel>
				</DropdownItem>
				<DropdownItem href="/settings">
				<Cog8ToothIcon />
				<DropdownLabel>Settings</DropdownLabel>
				</DropdownItem>
				<DropdownDivider />
				<DropdownItem href="/privacy-policy">
				<ShieldCheckIcon />
				<DropdownLabel>Privacy policy</DropdownLabel>
				</DropdownItem>
				<DropdownItem href="/share-feedback">
				<LightBulbIcon />
				<DropdownLabel>Share feedback</DropdownLabel>
				</DropdownItem>
				<DropdownDivider />
				<DropdownItem href="/logout">
				<ArrowRightStartOnRectangleIcon />
				<DropdownLabel>Sign out</DropdownLabel>
				</DropdownItem>
			</DropdownMenu> */}
			</Dropdown>
		</SidebarFooter>
		</Sidebar>
	)
	}