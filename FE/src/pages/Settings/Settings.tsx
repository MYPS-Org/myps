import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Heading } from '../../components/tailwindui/heading';
import ThemeDemo from '../../components/ThemeDemo';

const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Heading level={1} className="mb-8 text-gray-900 dark:text-white">
        Settings
      </Heading>

      {/* Theme Settings Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Theme Preferences
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Choose your preferred theme. Your selection will be saved automatically.
        </p>

        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-gray-900 dark:text-white">Light Theme</span>
            </div>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <span className="text-gray-900 dark:text-white">Dark Theme</span>
            </div>
          </label>
        </div>

        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>Currently selected:</strong> {theme === 'light' ? 'Light' : 'Dark'} theme
          </p>
        </div>
      </div>

      {/* Theme Demo Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Theme Preview
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          See how different components look in the current theme.
        </p>
        <ThemeDemo />
      </div>
    </div>
  );
};

export default Settings;
