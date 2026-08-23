import React, { useMemo, useState } from "react";
import type { Activity, TransactionLog } from '../Model.d';

interface ActivitySectionProps {
  activities: Activity[];
  transactionLogs?: TransactionLog[];
}

type FilterType = 'all' | 'create' | 'update' | 'delete';

// ─── helpers ────────────────────────────────────────────────────────────────

function tryParseJSON(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function relativeTime(dateString: string | null): string {
  if (!dateString) return '-';
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function fullDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function normaliseType(type: string | null | undefined): 'create' | 'update' | 'delete' | 'other' {
  if (!type) return 'other';
  const t = type.toLowerCase();
  if (t === 'create' || t === 'insert') return 'create';
  if (t === 'update' || t === 'modify') return 'update';
  if (t === 'delete') return 'delete';
  return 'other';
}

// ─── sub-components ──────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; dot: string; badge: string; border: string; bg: string }> = {
  create: {
    label: 'Created',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700 ring-green-200',
    border: 'border-l-green-400',
    bg: 'bg-white',
  },
  update: {
    label: 'Updated',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 ring-blue-200',
    border: 'border-l-blue-400',
    bg: 'bg-white',
  },
  delete: {
    label: 'Deleted',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 ring-red-200',
    border: 'border-l-red-400',
    bg: 'bg-white',
  },
  other: {
    label: 'Action',
    dot: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-700 ring-gray-200',
    border: 'border-l-gray-300',
    bg: 'bg-white',
  },
};

const TypeIcon: React.FC<{ type?: string }> = ({ type }) => {
  const t = normaliseType(type);
  if (t === 'create') return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  );
  if (t === 'update') return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
  if (t === 'delete') return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
};

// Smart diff: for updates show only changed fields; for create/delete show all fields
const DiffView: React.FC<{ log: TransactionLog }> = ({ log }) => {
  const t = normaliseType(log.TypeOfTransaction);
  const oldObj = tryParseJSON(log.OldValue);
  const newObj = tryParseJSON(log.NewValue);

  // JSON-based diff (update with both sides parseable)
  if (t === 'update' && oldObj && newObj) {
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    const changedKeys = allKeys.filter(k => String(oldObj[k] ?? '') !== String(newObj[k] ?? ''));
    if (changedKeys.length === 0) return <p className="text-xs text-gray-400 italic">No field-level changes detected.</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider">
              <th className="text-left px-3 py-1.5 font-semibold w-1/4">Field</th>
              <th className="text-left px-3 py-1.5 font-semibold w-[37.5%]">Before</th>
              <th className="text-left px-3 py-1.5 font-semibold w-[37.5%]">After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {changedKeys.map(key => (
              <tr key={key} className="hover:bg-gray-50/60">
                <td className="px-3 py-2 font-medium text-gray-600">{key}</td>
                <td className="px-3 py-2">
                  <span className="inline-block bg-red-50 text-red-700 rounded px-1.5 py-0.5 border border-red-100 max-w-full break-all">
                    {String(oldObj[key] ?? '—')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-block bg-green-50 text-green-700 rounded px-1.5 py-0.5 border border-green-100 max-w-full break-all">
                    {String(newObj[key] ?? '—')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // DELETE — show old record
  if (t === 'delete' && oldObj) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Deleted record</p>
        <div className="rounded border border-red-100 bg-red-50 divide-y divide-red-100">
          {Object.entries(oldObj).map(([k, v]) => (
            <div key={k} className="flex px-3 py-1.5 text-xs">
              <span className="font-medium text-gray-600 w-32 shrink-0">{k}</span>
              <span className="text-red-700 break-all">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // CREATE — show new record
  if (t === 'create' && newObj) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">New record</p>
        <div className="rounded border border-green-100 bg-green-50 divide-y divide-green-100">
          {Object.entries(newObj).map(([k, v]) => (
            <div key={k} className="flex px-3 py-1.5 text-xs">
              <span className="font-medium text-gray-600 w-32 shrink-0">{k}</span>
              <span className="text-green-700 break-all">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Plain-text fallback side-by-side
  return (
    <div className="grid grid-cols-2 gap-3">
      {log.OldValue && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Before</p>
          <pre className="text-xs bg-red-50 border border-red-100 text-red-700 rounded p-2 whitespace-pre-wrap break-all">{log.OldValue}</pre>
        </div>
      )}
      {log.NewValue && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">After</p>
          <pre className="text-xs bg-green-50 border border-green-100 text-green-700 rounded p-2 whitespace-pre-wrap break-all">{log.NewValue}</pre>
        </div>
      )}
    </div>
  );
};

const LogCard: React.FC<{ log: TransactionLog }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const t = normaliseType(log.TypeOfTransaction);
  const meta = TYPE_META[t];
  const hasChanges = !!(log.OldValue || log.NewValue);

  return (
    <div className={`rounded-lg border border-gray-100 border-l-4 ${meta.border} ${meta.bg} shadow-sm overflow-hidden`}>
      {/* Card header */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Type badge */}
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${meta.badge} shrink-0 mt-0.5`}>
          <TypeIcon type={log.TypeOfTransaction} />
          {meta.label}
        </span>

        {/* Middle: table + column + user */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {log.AffectedTable && (
              <span className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                {log.AffectedTable}
                {log.AffectedColumn && log.AffectedColumn !== log.AffectedTable && (
                  <span className="text-gray-400">.{log.AffectedColumn}</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            {log.CreatedBy && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                {log.CreatedBy}
              </span>
            )}
            <span title={fullDate(log.CreatedDate)} className="cursor-default flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              {relativeTime(log.CreatedDate)}
              <span className="text-gray-300">·</span>
              {fullDate(log.CreatedDate)}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        {hasChanges && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mt-0.5"
          >
            {expanded ? 'Hide' : 'Changes'}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20" fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Diff panel */}
      {expanded && hasChanges && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60">
          <DiffView log={log} />
        </div>
      )}
    </div>
  );
};

// ─── main component ──────────────────────────────────────────────────────────

const ActivitySection: React.FC<ActivitySectionProps> = ({ activities, transactionLogs = [] }) => {
  const [activeTab, setActiveTab] = useState<'activities' | 'logs'>('logs');
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  // counts per type
  const counts = useMemo(() => ({
    all: transactionLogs.length,
    create: transactionLogs.filter(l => normaliseType(l.TypeOfTransaction) === 'create').length,
    update: transactionLogs.filter(l => normaliseType(l.TypeOfTransaction) === 'update').length,
    delete: transactionLogs.filter(l => normaliseType(l.TypeOfTransaction) === 'delete').length,
  }), [transactionLogs]);

  const visibleLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactionLogs
      .filter(l => filter === 'all' || normaliseType(l.TypeOfTransaction) === filter)
      .filter(l => {
        if (!q) return true;
        return (
          l.AffectedTable?.toLowerCase().includes(q) ||
          l.AffectedColumn?.toLowerCase().includes(q) ||
          l.CreatedBy?.toLowerCase().includes(q) ||
          l.TypeOfTransaction?.toLowerCase().includes(q) ||
          l.OldValue?.toLowerCase().includes(q) ||
          l.NewValue?.toLowerCase().includes(q)
        );
      })
      // newest first
      .slice()
      .sort((a, b) => (b.CreatedDate ? new Date(b.CreatedDate).getTime() : 0) - (a.CreatedDate ? new Date(a.CreatedDate).getTime() : 0));
  }, [transactionLogs, filter, search]);

  const FILTER_TABS: { key: FilterType; label: string; countKey: FilterType; color: string }[] = [
    { key: 'all',    label: 'All',     countKey: 'all',    color: 'text-gray-700 border-gray-700',  },
    { key: 'create', label: 'Created', countKey: 'create', color: 'text-green-700 border-green-600' },
    { key: 'update', label: 'Updated', countKey: 'update', color: 'text-blue-700 border-blue-600'   },
    { key: 'delete', label: 'Deleted', countKey: 'delete', color: 'text-red-700 border-red-600'     },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Transaction Logs</h2>
          <p className="text-xs text-gray-400 mt-0.5">{counts.all} total entries</p>
        </div>

        {/* Tab Navigation (Activities / Logs) */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'logs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Logs
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'activities' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Activities
          </button>
        </div>
      </div>

      {activeTab === 'logs' ? (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Search by table, column, user, or value…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-1 mb-4 border-b border-gray-100 pb-3">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  filter === tab.key
                    ? `${tab.color} bg-white ring-1 ring-inset ${tab.color.replace('text-', 'ring-').replace('border-', 'ring-')}`
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === tab.key ? 'bg-gray-100' : 'bg-gray-100 text-gray-500'
                }`}>
                  {counts[tab.countKey]}
                </span>
              </button>
            ))}
          </div>

          {/* Log cards */}
          <div className="space-y-2.5">
            {visibleLogs.map(log => (
              <LogCard key={log.Id} log={log} />
            ))}

            {visibleLogs.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-3 opacity-40" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h7a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium">No logs found</p>
                {search && <p className="text-xs mt-1">Try adjusting your search or filter.</p>}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {activities.map(activity => (
            <div key={activity.Id} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex-1">
                <p className="text-sm text-gray-800">{activity.Description}</p>
                <p className="text-xs text-gray-400 mt-0.5">{activity.Date}</p>
              </div>
            </div>
          ))}

          {activities.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm font-medium">No activities recorded yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActivitySection;