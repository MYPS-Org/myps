"use-client";
import React, { useState } from 'react';
import { 
  RectangleStackIcon, 
  BuildingOffice2Icon, 
  ArrowsPointingOutIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/16/solid';
import RoadList from "../components/Road";
import RoadSectionList from "../components/RoadSection";
import BridgeList from "../components/Bridge";
import ImportDialog from '../Dialogs/ImportDialog';

// Simple Badge component
const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ${className}`}>
        {children}
    </span>
);

const Rbia: React.FC = () => {
    const [selectedTab, setSelectedTab] = useState<'roads' | 'roadSections' | 'bridges'>('roads');
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    // For now, we'll show static counts until we implement proper data fetching for all tabs
    // TODO: Replace with actual API calls when roadSections and bridges components are updated
    const roadsCount = 0; // Will be updated by the Road component
    const roadSectionsCount = 0; // Placeholder
    const bridgesCount = 0; // Placeholder

    // Function to handle tab switching
    const getTableData = async (tabName: 'roads' | 'roadSections' | 'bridges') => {
        console.log('Switching to tab:', tabName);
        setSelectedTab(tabName);
        
        // TODO: Add data fetching logic here if needed
        // The individual components will handle their own data through API calls
    };

    // Render Tab Button component
    const TabButton = ({ 
        label, 
        value, 
        icon: Icon, 
        count,
    }: { 
        label: string; 
        value: 'roads' | 'roadSections' | 'bridges'; 
        icon: React.ComponentType<{ className?: string }>; 
        count: number;
    }) => (
        <button
            onClick={() => { if(selectedTab !== value) getTableData(value); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                selectedTab === value
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'cursor-pointer text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
        >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
            <Badge className="ml-2">{count}</Badge>
        </button>
    );

    return (
        <div className="max-w-10xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Infrastructure Administration</h1>
                    <p className="text-gray-600">Manage future roads, road sections, and bridges</p>
                </div>

                {/* Import Button */}
                <button
                    onClick={() => setImportDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm"
                >
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    Import
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-2 p-1 bg-white shadow-md rounded-lg">
                <TabButton 
                    label="Roads" 
                    value="roads" 
                    icon={RectangleStackIcon} 
                    count={roadsCount} 
                />
                <TabButton 
                    label="Road Sections" 
                    value="roadSections" 
                    icon={BuildingOffice2Icon} 
                    count={roadSectionsCount} 
                />
                <TabButton 
                    label="Bridges" 
                    value="bridges" 
                    icon={ArrowsPointingOutIcon} 
                    count={bridgesCount} 
                />
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {selectedTab === 'roads' && <RoadList />}
                {selectedTab === 'roadSections' && <RoadSectionList />}
                {selectedTab === 'bridges' && <BridgeList />}
            </div>

            {/* Import Dialog */}
            <ImportDialog
                isOpen={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
            />
        </div>
    );
};

export default Rbia;