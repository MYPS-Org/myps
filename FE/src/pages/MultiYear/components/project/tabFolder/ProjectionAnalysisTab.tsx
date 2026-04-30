import React, { useState } from 'react';
import { Tab } from '@headlessui/react';
import ComponentProjectionTab from './ComponentProjectionTab';
import type { ComponentCostWithYears } from '../../../Model.d';

interface ProjectionAnalysisTabProps {
  componentCosts: ComponentCostWithYears[];
  projectId?: string;
  multiYearProjectId?: string;
}

const ProjectionAnalysisTab: React.FC<ProjectionAnalysisTabProps> = ({
  componentCosts,
  projectId,
  multiYearProjectId
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const tabs = [
    {
      name: 'Component',
      id: 'component',
      component: (
        <ComponentProjectionTab
          componentCosts={componentCosts}
          projectId={projectId}
          multiYearProjectId={multiYearProjectId}
        />
      )
    },
    {
      name: 'Schedule',
      id: 'schedule',
      component: <div className="p-4 text-gray-500">Schedule analysis coming soon...</div>
    },
    {
      name: 'Targets',
      id: 'targets', 
      component: <div className="p-4 text-gray-500">Targets analysis coming soon...</div>
    },
    {
      name: 'Work Items',
      id: 'workitems',
      component: <div className="p-4 text-gray-500">Work Items analysis coming soon...</div>
    },
    {
      name: 'Funding',
      id: 'funding',
      component: <div className="p-4 text-gray-500">Funding analysis coming soon...</div>
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Multi-Year Planning Scheduling</h2>
        <p className="text-sm text-gray-600 mt-1">
          Compare your multi-year project estimates with actual annual budget allocations from linked projects
        </p>
      </div>

      <Tab.Group selectedIndex={selectedIndex} onChange={setSelectedIndex}>
        <Tab.List className="flex space-x-1 bg-gray-50 p-1 rounded-none border-b">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-60 ${
                  selected
                    ? 'bg-white text-blue-600 shadow border border-gray-200'
                    : 'text-gray-500 hover:bg-white/[0.12] hover:text-gray-700'
                }`
              }
            >
              {tab.name}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels>
          {tabs.map((tab, idx) => (
            <Tab.Panel key={idx} className="focus:outline-none">
              {tab.component}
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default ProjectionAnalysisTab;