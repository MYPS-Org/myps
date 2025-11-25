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
SidebarDivider,
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
// CalendarDateRangeIcon,
UserIcon,
UserGroupIcon
} from '@heroicons/react/20/solid'
import { authService } from '../pages/login/Service' // for getting the service logout
import { useAuth } from '../contexts/AuthContext' // for getting data friom context
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

const { user } = useAuth();

// For now, you can manually set which item should be current
// Change this to your actual routing logic or pass it as a prop
const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard'
	return (
		<Sidebar>
		<SidebarHeader>
			<Dropdown>
			<DropdownButton as={SidebarItem} className="">
				<Avatar src={Logo} />
				<SidebarLabel className="text-gray-500">MYPS</SidebarLabel>
				<ChevronDownIcon />
			</DropdownButton>
			<DropdownMenu className="min-w-64" anchor="bottom start">
				<DropdownDivider />
				{/* <DropdownItem href="/profile">
					<Avatar slot="icon" src="/tailwind-logo.svg" />
					<DropdownLabel>Profile</DropdownLabel>
				</DropdownItem> */}
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
			<SidebarItem>
				<UserIcon />
				<SidebarLabel className="text-gray-500">{user?.Name || 'no name'}</SidebarLabel>
			</SidebarItem>
			<SidebarItem>
				<UserGroupIcon />
				<SidebarLabel className="text-gray-500">{user?.UserRole || 'no role'}</SidebarLabel>
			</SidebarItem>
			<SidebarDivider>
			</SidebarDivider>
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
			<SidebarItem href="/revision" current={currentPath === '/revision'}>
				<Square2StackIcon />
				<SidebarLabel className="text-gray-500">Revision</SidebarLabel>
			</SidebarItem>
			<SidebarItem href="/project-groups" current={currentPath === '/project-groups'}>
				<Square2StackIcon />
				<SidebarLabel className="text-gray-500">Project Groups</SidebarLabel>
			</SidebarItem>	
			{/* <SidebarItem href="/program-stages" current={currentPath === '/program-stages'}>	
				<Square2StackIcon />
				<SidebarLabel className="text-gray-500">Program Stages</SidebarLabel>
			</SidebarItem> */}
			<SidebarDropdown
				label="Multi-Year Management"
				defaultOpen={false}
				className="text-gray-500"
				>
				<Cog6ToothIcon />
				<SidebarDropdownItem href="/multiyear/programs" current={currentPath === '/multiyear/programs'}>
					<SidebarLabel>Programs</SidebarLabel>
				</SidebarDropdownItem>
				<SidebarDropdownItem href="/multiyear/projects" current={currentPath === '/multiyear/projects'}>
					<SidebarLabel>Projects</SidebarLabel>
				</SidebarDropdownItem>
			</SidebarDropdown>
			<SidebarDropdown
				label="Settings"
				defaultOpen={false}
				className="text-gray-500"
				>
				<Cog6ToothIcon />
				<SidebarDropdownItem href="/code-tables" current={currentPath === '/code-tables'}>
					<SidebarLabel>Code Tables</SidebarLabel>
				</SidebarDropdownItem>
				<SidebarDropdownItem href="/settings/security" current={currentPath === '/settings/security'}>
					<SidebarLabel>Security</SidebarLabel>
				</SidebarDropdownItem>
				<SidebarDropdownItem href="/user-management" current={currentPath === '/user-management'}>
					<SidebarLabel>User Management</SidebarLabel>
				</SidebarDropdownItem>
				<SidebarDropdownItem href="/infrastructure-management" current={currentPath === '/infrastructure-management'}>
					<SidebarLabel>Infra Management</SidebarLabel>
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