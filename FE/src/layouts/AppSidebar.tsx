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
FolderOpenIcon,
BriefcaseIcon,
ArrowPathIcon,
RectangleGroupIcon,
TableCellsIcon,
UsersIcon,
ServerStackIcon,
UserIcon,
UserGroupIcon,
DocumentChartBarIcon,
CalendarDaysIcon,
} from '@heroicons/react/20/solid'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext' // for getting data friom context
import { MainResource } from '@MainResource';
import protectedRoutes from '../components/Routes'

export default function SideBar() {
const { user, ViewAccess, logout } = useAuth();
const navigate = useNavigate();

const handleLogout = async () => {
	try {
		await logout();
		navigate('/login', { replace: true });
	} catch (error) {
		console.error('Logout failed:', error);
		alert('Logout failed. Please try again.');
	}
}

// For now, you can manually set which item should be current
// Change this to your actual routing logic or pass it as a prop
const currentPath = (localStorage.getItem('currentPath') != undefined) ? localStorage.getItem('currentPath') : '/dashboard'
	return (
		<Sidebar>
		<SidebarHeader>
			<Dropdown>
			<DropdownButton as={SidebarItem} className="">
				<Avatar src={MainResource.Images.ReportLogo} />
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
					<SidebarLabel className="text-gray-500">{user?.UserGroupNames.join(', ') || 'no role'}</SidebarLabel>
				</SidebarItem>
			<SidebarDivider>
			</SidebarDivider>
				<SidebarItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/dashboard')?.RouteName || '')} href="/dashboard" current={currentPath === '/dashboard'}>
					<HomeIcon />
					<SidebarLabel className="text-gray-500">Dashboard</SidebarLabel>
				</SidebarItem>
				<SidebarItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/programs')?.RouteName || '')} href="/programs" current={currentPath === '/programs'}>
					<FolderOpenIcon />
					<SidebarLabel className="text-gray-500">Programs</SidebarLabel>
				</SidebarItem>
				<SidebarItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/projects')?.RouteName || '')} href="/projects" current={currentPath === '/projects'}>
					<BriefcaseIcon />
					<SidebarLabel className="text-gray-500">Projects</SidebarLabel>
				</SidebarItem>
				<SidebarItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/lumpsum')?.RouteName || '')} href="/lumpsum" current={currentPath === '/lumpsum'}>
					<BriefcaseIcon />
					<SidebarLabel className="text-gray-500">Lump Sum</SidebarLabel>
				</SidebarItem>
				<SidebarItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/revision')?.RouteName || '')} href="/revision" current={currentPath === '/revision'}>
					<ArrowPathIcon />
					<SidebarLabel className="text-gray-500">Revision</SidebarLabel>
				</SidebarItem>
				<SidebarItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/project-groups')?.RouteName || '')} href="/project-groups" current={currentPath === '/project-groups'}>
					<RectangleGroupIcon />
					<SidebarLabel className="text-gray-500">Project Groups</SidebarLabel>
				</SidebarItem>	
				{/* <SidebarItem href="/program-stages" current={currentPath === '/program-stages'}>	
					<Square2StackIcon />
					<SidebarLabel className="text-gray-500">Program Stages</SidebarLabel>
			</SidebarItem> */}
			{/* Multi-Year (documents/plans/multi-year-phase-1-portfolio-module.md): RDIP, UDIP and PIP portfolios. */}
			<SidebarDropdown
				hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/multi-year/portfolios')?.RouteName || '')}
				label="Multi-Year"
				defaultOpen={false}
				className="text-gray-500"
				>
				<CalendarDaysIcon />
				<SidebarDropdownItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/multi-year/portfolios')?.RouteName || '')} href="/multi-year/portfolios" current={currentPath === '/multi-year/portfolios'}>
					<SidebarLabel>Portfolios</SidebarLabel>
				</SidebarDropdownItem>
			</SidebarDropdown>
			<SidebarItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/reports')?.RouteName || '')} href="/reports" current={currentPath === '/reports'}>
				<DocumentChartBarIcon />
				<SidebarLabel className="text-gray-500">Reports</SidebarLabel>
			</SidebarItem>
			<SidebarDropdown
				hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/settings')?.RouteName || '') && !ViewAccess.includes(protectedRoutes.find(x => x.path == '/code-tables')?.RouteName || '') && !ViewAccess.includes(protectedRoutes.find(x => x.path == '/settings/security')?.RouteName || '') && !ViewAccess.includes(protectedRoutes.find(x => x.path == '/user-management')?.RouteName || '') && !ViewAccess.includes(protectedRoutes.find(x => x.path == '/infrastructure-management')?.RouteName || '')}
				label="Settings"
				defaultOpen={false}
				className="text-gray-500"
				>
				<Cog6ToothIcon />
				<SidebarDropdownItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/code-tables')?.RouteName || '')} href="/code-tables" current={currentPath === '/code-tables'}>
					<TableCellsIcon />
					<SidebarLabel>Code Tables</SidebarLabel>
				</SidebarDropdownItem>
				{/* <SidebarDropdownItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/settings/security')?.RouteName || '')} href="/settings/security" current={currentPath === '/settings/security'}>
					<ShieldCheckIcon />
					<SidebarLabel>Security</SidebarLabel>
				</SidebarDropdownItem> */}
				<SidebarDropdownItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/user-management')?.RouteName || '')} href="/user-management" current={currentPath === '/user-management'}>
					<UsersIcon />
					<SidebarLabel>User Management</SidebarLabel>
				</SidebarDropdownItem>
				<SidebarDropdownItem hidden={!ViewAccess.includes(protectedRoutes.find(x => x.path == '/infrastructure-management')?.RouteName || '')} href="/infrastructure-management" current={currentPath === '/infrastructure-management'}>
					<ServerStackIcon />
					<SidebarLabel>Infra Management</SidebarLabel>
				</SidebarDropdownItem>
			</SidebarDropdown>
			</SidebarSection>
			<SidebarSpacer />
			<SidebarSection>
			{/* <SidebarItem href="/support" current={currentPath === '/support'}>
				<QuestionMarkCircleIcon />
				<SidebarLabel>Support</SidebarLabel>
			</SidebarItem> */}
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