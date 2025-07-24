import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import type { RoadSections, Bridge, FCS, OtherInfra, InfraData } from '../Model.d';

interface AddInfraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (infraId: string, infraName: string, infraType: string) => void;
  initialData?: InfraData;
  mode?: 'add' | 'edit';
}

const AddInfraDialog: React.FC<AddInfraDialogProps> = ({ 
  isOpen, 
  onClose, 
  onAdd, 
  initialData,
  mode = 'add' 
}) => {
  const [activeTab, setActiveTab] = useState<'road' | 'bridge' | 'fcs' | 'other'>('road');
  const [selectedInfra, setSelectedInfra] = useState<{
    id: string;
    name: string;
    type: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedInfra(null);
      setSearchTerm('');
      setActiveTab('road');
    }
  }, [isOpen]);

  const handleClose = () => {
    setSelectedInfra(null);
    setSearchTerm('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInfra) {
      onAdd(selectedInfra.id, selectedInfra.name, selectedInfra.type);
      handleClose();
    } else {
      alert('Please select an infrastructure item');
    }
  };

  const handleInfraSelect = (id: string, name: string, type: string) => {
    setSelectedInfra({ id, name, type });
  };

  const tabs = [
    { id: 'road', label: 'Road Sections', icon: '' },
    { id: 'bridge', label: 'Bridges', icon: '' },
    { id: 'fcs', label: 'FCS', icon: '' },
    { id: 'other', label: 'Other Infrastructure', icon: '' },
  ];

  const filterData = (data: any[], searchFields: string[]) => {
    if (!searchTerm) return data;
    return data.filter(item =>
      searchFields.some(field =>
        item[field]?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  };

  const renderRoadSections = () => {
    const filteredData = filterData(initialData?.RoadSections || [], ['SectionId', 'CDOName', 'RoadId']);
    
    return (
      <div className="space-y-4">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Select</TableHeader>
              <TableHeader>Section ID</TableHeader>
              <TableHeader>Road ID</TableHeader>
              <TableHeader>CDO Name</TableHeader>
              <TableHeader>Length (km)</TableHeader>
              <TableHeader>Network Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((road) => (
              <TableRow key={road.Id}>
                <TableCell>
                  <input
                    type="radio"
                    name="infraSelection"
                    value={road.SectionId}
                    checked={selectedInfra?.id === road.SectionId}
                    onChange={() => handleInfraSelect(road.SectionId, `${road.CDOName} - ${road.RoadId}`, 'Road Section')}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{road.SectionId}</TableCell>
                <TableCell>{road.RoadId}</TableCell>
                <TableCell>{road.CDOName}</TableCell>
                <TableCell>{road.SectionLength}</TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    road.NetworkStatus === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {road.NetworkStatus === 1 ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderBridges = () => {
    const filteredData = filterData(initialData?.Bridges || [], ['BridgeId', 'BridgeName', 'Location']);
    
    return (
      <div className="space-y-4">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Select</TableHeader>
              <TableHeader>Bridge ID</TableHeader>
              <TableHeader>Bridge Name</TableHeader>
              <TableHeader>Location</TableHeader>
              <TableHeader>Length (m)</TableHeader>
              <TableHeader>Width (m)</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((bridge) => (
              <TableRow key={bridge.Id}>
                <TableCell>
                  <input
                    type="radio"
                    name="infraSelection"
                    value={bridge.BridgeId}
                    checked={selectedInfra?.id === bridge.BridgeId}
                    onChange={() => handleInfraSelect(bridge.BridgeId, bridge.BridgeName, 'Bridge')}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{bridge.BridgeId}</TableCell>
                <TableCell>{bridge.BridgeName}</TableCell>
                <TableCell>{bridge.Location}</TableCell>
                <TableCell>{bridge.Length}</TableCell>
                <TableCell>{bridge.Width}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderFCS = () => {
    const filteredData = filterData(initialData?.FCS || [], ['FCSId', 'FCSName', 'Location']);
    
    return (
      <div className="space-y-4">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Select</TableHeader>
              <TableHeader>FCS ID</TableHeader>
              <TableHeader>FCS Name</TableHeader>
              <TableHeader>Location</TableHeader>
              <TableHeader>Capacity</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((fcs) => (
              <TableRow key={fcs.Id}>
                <TableCell>
                  <input
                    type="radio"
                    name="infraSelection"
                    value={fcs.FCSId}
                    checked={selectedInfra?.id === fcs.FCSId}
                    onChange={() => handleInfraSelect(fcs.FCSId, fcs.FCSName, 'FCS')}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{fcs.FCSId}</TableCell>
                <TableCell>{fcs.FCSName}</TableCell>
                <TableCell>{fcs.Location}</TableCell>
                <TableCell>{fcs.Capacity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderOtherInfra = () => {
    const filteredData = filterData(initialData?.OtherInfra || [], ['InfraId', 'InfraName', 'InfraType', 'Location']);
    
    return (
      <div className="space-y-4">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Select</TableHeader>
              <TableHeader>Infra ID</TableHeader>
              <TableHeader>Infra Name</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Location</TableHeader>
              <TableHeader>Description</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((infra) => (
              <TableRow key={infra.Id}>
                <TableCell>
                  <input
                    type="radio"
                    name="infraSelection"
                    value={infra.InfraId}
                    checked={selectedInfra?.id === infra.InfraId}
                    onChange={() => handleInfraSelect(infra.InfraId, infra.InfraName, infra.InfraType)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{infra.InfraId}</TableCell>
                <TableCell>{infra.InfraName}</TableCell>
                <TableCell>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {infra.InfraType}
                  </span>
                </TableCell>
                <TableCell>{infra.Location}</TableCell>
                <TableCell className="max-w-xs truncate">{infra.Description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'road':
        return renderRoadSections();
      case 'bridge':
        return renderBridges();
      case 'fcs':
        return renderFCS();
      case 'other':
        return renderOtherInfra();
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {mode === 'add' ? 'Select Infrastructure' : 'Edit Infrastructure Selection'}
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {renderTabContent()}
          </div>

          {/* Selected Info */}
          {selectedInfra && (
            <div className="px-6 py-3 bg-orange-50 border-t border-orange-200">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-orange-900">Selected:</span>
                <span className="text-sm text-orange-800">
                  {selectedInfra.type} - {selectedInfra.name} ({selectedInfra.id})
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <Button type="button" color="zinc" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="button" 
              color="orange" 
              onClick={handleSubmit}
              disabled={!selectedInfra}
            >
              {mode === 'add' ? 'Add Infrastructure' : 'Update Selection'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddInfraDialog;