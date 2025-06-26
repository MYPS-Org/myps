import React from 'react';

import { Heading } from '../../components/tailwindui/heading';
import { Avatar } from '../../components/tailwindui/avatar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '../../components/tailwindui/dropdown'
import { Navbar, NavbarDivider, NavbarItem, NavbarLabel, NavbarSection, NavbarSpacer } from '../../components/tailwindui/navbar'
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


const Profile: React.FC = () => {
	const [SelectedTab, setSelectedTab] = useState("Users")
  return (
	<div>
	  	<Heading level={1} className="mb-6">User Permission</Heading>
		<Navbar>
			<NavbarDivider className="max-lg:hidden" />
			<NavbarSection className="max-lg:hidden">
				<NavbarItem onClick={() => {
					setSelectedTab("Users")
				}} {SelectedTab == "Users" && current}>
					Users
				</NavbarItem>

				<NavbarItem href="/events">
					Permission
				</NavbarItem>

				<NavbarItem href="/orders">
					User Group
				</NavbarItem>

			</NavbarSection>
		</Navbar>

	</div>
  );
};

export default Profile;