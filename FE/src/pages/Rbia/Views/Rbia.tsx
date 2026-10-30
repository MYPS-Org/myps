"use-client";
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/16/solid';
import RoadList from "../components/Road";
import RoadSectionList from "../components/RoadSection";
import BridgeList from "../components/Bridge";
import ImportDialog from '../Dialogs/ImportDialog';
import { getInfraCounts } from './../Service';
import { useAuth } from '../../../contexts/AuthContext';
import { isRestrictedUser } from '../../../contexts/userScope';

// Simple Badge component
const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ${className}`}>
        {children}
    </span>
);

const Rbia: React.FC = () => {
    const [selectedTab, setSelectedTab] = useState<'roads' | 'roadSections' | 'bridges'>('roads');
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    // The RBIA / AAMS / IOMS imports are for PS Admin (S06-TC015/TC016). They run in the GIS service,
    // which does not check MYPS permissions, so district and regional users (DEO / RO) get no Import button.
    const { user } = useAuth();
    const canImport = !isRestrictedUser(user);
    const [roadCount, setRoadCount] = useState(0);
    const [roadSectionCount, setRoadSectionCount ] = useState(0);
    const [bridgeCount, setBridgeCount] = useState(0);
    // Bumped after an import so the active list remounts and re-fetches the imported rows.
    const [listRefreshKey, setListRefreshKey] = useState(0);

    const fetchInfraCounts = useCallback(async () => {
        try {
            const counts = await getInfraCounts();
            setRoadCount(counts.Data.Roads);
            setRoadSectionCount(counts.Data.RoadSections);
            setBridgeCount(counts.Data.Bridge);
        } catch (error) {
            console.error('Error fetching infrastructure counts:', error);
        }
    }, []);

    useEffect(() => {
        fetchInfraCounts();
    }, [fetchInfraCounts]);

    const handleImported = () => {
        fetchInfraCounts();
        setListRefreshKey((k) => k + 1);
    };

    // Function to handle tab switching
    const getTableData = async (tabName: 'roads' | 'roadSections' | 'bridges') => {
        console.log('Switching to tab:', tabName);
        setSelectedTab(tabName);
        
        // TODO: Add data fetching logic here if needed
        // The individual components will handle their own data through API calls
    };

    // Render Tab Button component. No icons: the stack / office building / arrows glyphs
    // did not stand for roads, sections or bridges (S06-TC001-P001 remark).
    const TabButton = ({ 
        label, 
        value, 
        count,
    }: { 
        label: string; 
        value: 'roads' | 'roadSections' | 'bridges'; 
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
                {canImport && (
                <button
                    onClick={() => setImportDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm"
                >
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    Import
                </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-2 p-1 bg-white shadow-md rounded-lg">
                <TabButton 
                    label="Roads" 
                    value="roads" 
                    count={roadCount} 
                />
                <TabButton 
                    label="Road Sections" 
                    value="roadSections" 
                    count={roadSectionCount} 
                />
                <TabButton 
                    label="Bridges" 
                    value="bridges" 
                    count={bridgeCount} 
                />
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {selectedTab === 'roads' && <RoadList key={listRefreshKey} />}
                {selectedTab === 'roadSections' && <RoadSectionList key={listRefreshKey} />}
                {selectedTab === 'bridges' && <BridgeList key={listRefreshKey} />}
            </div>

            {/* Import Dialog */}
            <ImportDialog
                isOpen={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                onImported={handleImported}
            />
        </div>
    );
};

export default Rbia;