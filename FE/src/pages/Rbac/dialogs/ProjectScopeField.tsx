import React from 'react';
import { PROJECT_SCOPES } from '../projectScope';

interface ProjectScopeFieldProps {
  value: number;
  onChange: (value: number) => void;
}

/** The group's Project visibility: which projects its members see (2026-10-31, set per group). */
const ProjectScopeField: React.FC<ProjectScopeFieldProps> = ({ value, onChange }) => {
  const current = PROJECT_SCOPES.find((s) => s.value === value) ?? PROJECT_SCOPES[0];
  return (
    <div>
      <label htmlFor="projectScope" className="block text-sm font-medium text-gray-700 mb-1">
        Project visibility
      </label>
      <select
        id="projectScope"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
      >
        {PROJECT_SCOPES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">{current.hint}</p>
      <p className="text-xs text-gray-400 mt-1">
        A user in several groups sees the widest: All projects wins, and Own region and Own district office add up.
      </p>
    </div>
  );
};

export default ProjectScopeField;
