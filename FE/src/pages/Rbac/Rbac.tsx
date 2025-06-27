'use-client'
import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

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

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/tailwindui/table'

const Profile: React.FC = () => {
	const [SelectedTab, setSelectedTab] = useState("Users")
	const [Users, setUsers] = useState([
		{ id: 0, name: 'Tito Mic', email: 'markybarbie@gmail.com', access: 'Police' },
		{ id: 1, name: 'Tito Gee', email: 'boatbet@gmail.com', access: 'Gamer' }
	])

	const [Permission, setPermission] = useState([
		{ id: 0, name: 'Daddy N', Position: 'System Analyst', access: 'IT' },
		{ id: 1, name: 'Tito Mondz', Position: 'GIS Pwogwamer', access: 'Gamer' }

	])
	const [UserGroup, setUserGroup] = useState([
		{ id: 0, Position: 'Tamvay', Employee: 'Yes', Role: 'Unemployed' },
		{ id: 1, Position: 'Takatak Boy', Employee: 'Yes', Role: 'Unemployed' }
	])
	return (
	<div>
		<Heading level={1} className="dark:text-white">User Permission</Heading>
		<Navbar>
			<NavbarDivider className="max-lg:hidden" />
			<NavbarSection className="max-lg:hidden">
				<NavbarItem className='!cursor-pointer' onClick={() => {
					setSelectedTab("Users")
				}} current={SelectedTab=="Users"} >
					Users
				</NavbarItem>

				<NavbarItem onClick={() => {
					setSelectedTab("Permission")
				}} current={SelectedTab=="Permission"} >
					Permission
				</NavbarItem>

				<NavbarItem onClick={() => {
					setSelectedTab("UserGroup")
				}} current={SelectedTab=="UserGroup"} >
					User Group
				</NavbarItem>

			</NavbarSection>
		</Navbar>
		{SelectedTab == 'Users'&&
		<Table>
      		<TableHead>
				<TableRow>
				<TableHeader>Name</TableHeader>
				<TableHeader>Email</TableHeader>
				<TableHeader>Role</TableHeader>
				</TableRow>
			</TableHead>
			<TableBody>
				{Users.map((user) => (
				<TableRow key={user.id}>
					<TableCell className="font-medium">{user.name}</TableCell>
					<TableCell>{user.email}</TableCell>
					<TableCell className="text-zinc-500">{user.access}</TableCell>
				</TableRow>
				))}
			</TableBody>
		</Table>}

		{SelectedTab == 'Permission'&&
		<Table>
      		<TableHead>
				<TableRow>
				<TableHeader>Name</TableHeader>
				<TableHeader>Position</TableHeader>
				<TableHeader>Role</TableHeader>
				</TableRow>
			</TableHead>
			<TableBody>
				{Permission.map((each) => (
				<TableRow key={each.id}>
					<TableCell className="font-medium">{each.name}</TableCell>
					<TableCell>{each.Position}</TableCell>
					<TableCell className="text-zinc-500">{each.access}</TableCell>
				</TableRow>
				))}
			</TableBody>
		</Table>}

		{SelectedTab == 'UserGroup'&&
		<Table>
      		<TableHead>
				<TableRow>
				<TableHeader>Position</TableHeader>
				<TableHeader>Employee</TableHeader>
				<TableHeader>Role</TableHeader>
				</TableRow>
			</TableHead>
			<TableBody>
				{UserGroup.map((each) => (
				<TableRow key={each.id}>
					<TableCell className="font-medium">{each.Position}</TableCell>
					<TableCell>{each.Employee}</TableCell>
					<TableCell className="text-zinc-500">{each.Role}</TableCell>
				</TableRow>
				))}
			</TableBody>
		</Table>}		
	</div>
);
};

export default Profile;