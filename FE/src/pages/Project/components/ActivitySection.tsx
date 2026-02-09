import React, { useState } from "react";
import type { Activity, TransactionLog } from '../Model.d';

interface ActivitySectionProps {
  activities: Activity[];
  transactionLogs?: TransactionLog[];
}

const ActivitySection: React.FC<ActivitySectionProps> = ({ activities, transactionLogs = [] }) => {
  const [activeTab, setActiveTab] = useState<'activities' | 'logs'>('logs');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTransactionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'create':
      case 'insert':
        return '';
      case 'update':
      case 'modify':
        return '';
      case 'delete':
        return '';
      default:
        return '';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'create':
      case 'insert':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'update':
      case 'modify':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'delete':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const parseOldValue = (oldValue: string) => {
    try {
      return JSON.parse(oldValue);
    } catch {
      return oldValue;
    }
  };

  const renderTransactionDetails = (log: TransactionLog) => {
    const oldData = parseOldValue(log.OldValue);
    
    return (
      <div className="mt-2 p-3 bg-white rounded border">
        <div className="text-xs text-gray-600 mb-2">
          <span className="font-medium">Table:</span> {log.AffectedTable} | 
          <span className="font-medium ml-2">Column:</span> {log.AffectedColumn}
        </div>
        
        {log.TypeOfTransaction.toLowerCase() === 'delete' && oldData && typeof oldData === 'object' ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-700">Deleted Record:</p>
            <div className="text-xs bg-red-50 p-2 rounded border-l-4 border-red-400">
              {Object.entries(oldData).map(([key, value]) => (
                <div key={key} className="flex">
                  <span className="font-medium text-gray-600 w-24">{key}:</span>
                  <span className="text-gray-800">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {log.OldValue && (
              <div>
                <p className="text-xs font-medium text-gray-700">Old Value:</p>
                <p className="text-xs bg-red-50 p-2 rounded border-l-4 border-red-400">
                  {log.OldValue}
                </p>
              </div>
            )}
            {log.NewValue && (
              <div>
                <p className="text-xs font-medium text-gray-700">New Value:</p>
                <p className="text-xs bg-green-50 p-2 rounded border-l-4 border-green-400">
                  {log.NewValue}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Project Activities</h2>
        
        {/* Tab Navigation */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {/* <button
            onClick={() => setActiveTab('activities')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'activities'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Activities ({activities.length})
          </button> */}
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Transaction Logs ({transactionLogs.length})
          </button>
        </div>
      </div>
      
      <div className="space-y-4">
        {activeTab === 'activities' ? (
          <>
            {activities.map(activity => (
              <div key={activity.Id} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.Description}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.Date}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {activities.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No activities recorded yet.
              </div>
            )}
          </>
        ) : (
          <>
            {transactionLogs.map(log => (
              <div key={log.Id} className={`p-4 rounded-lg border ${getTransactionColor(log.TypeOfTransaction)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-lg">{getTransactionIcon(log.TypeOfTransaction)}</span>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">
                          {log.TypeOfTransaction}
                        </span>
                        <span className="text-xs bg-white bg-opacity-70 px-2 py-1 rounded">
                          {log.TransactionId}
                        </span>
                      </div>
                      <p className="text-xs mt-1 opacity-75">
                        {formatDate(log.CreatedDate)}
                        {log.CreatedBy && ` • by ${log.CreatedBy}`}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Expandable details */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium hover:underline">
                    View Details
                  </summary>
                  {renderTransactionDetails(log)}
                </details>
              </div>
            ))}
            
            {transactionLogs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No transaction logs available.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivitySection;