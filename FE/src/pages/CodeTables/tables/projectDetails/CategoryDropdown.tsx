import React from 'react';
import type { CategoryEnum } from '../../../Project/Model.d';

interface CategoryDropdownProps {
  value?: number | string;
  onChange?: (value: number) => void;
  categories: CategoryEnum[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

/**
 * Reusable select component for ProjectDetails.Category.
 * Pass CategoryEnum[] from ProjectEnums.Categories as `categories`.
 *
 * @example
 * <CategoryDropdown
 *   value={form.Category}
 *   onChange={v => setForm(f => ({ ...f, Category: v }))}
 *   categories={projectEnums.Categories}
 * />
 */
const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  value = '',
  onChange,
  categories,
  placeholder = '— Select Category —',
  disabled = false,
  className = '',
  id,
  name,
}) => {
  return (
    <select
      id={id}
      name={name}
      value={value}
      disabled={disabled}
      onChange={e => onChange?.(Number(e.target.value))}
      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition ${className}`}
    >
      <option value="">{placeholder}</option>
      {categories.map(c => (
        <option key={c.Id} value={c.Id}>
          {c.CategoryId ? `[${c.CategoryId}] ` : ''}{c.CategoryName}
        </option>
      ))}
    </select>
  );
};

export default CategoryDropdown;
