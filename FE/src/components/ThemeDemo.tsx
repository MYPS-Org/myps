import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeDemo: React.FC = () => {
 const { theme } = useTheme();

 return (
 <div className="p-6 space-y-4">
 <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 ">
 <h2 className="text-xl font-bold text-gray-900 mb-2">
 Current Theme: {theme}
 </h2>
 <p className="text-gray-600 ">
 This component demonstrates how the theme system works. The colors automatically 
 change based on the selected theme.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 ">
 <h3 className="font-semibold text-blue-900 mb-2">Primary Colors</h3>
 <p className="text-blue-700 ">
 This card uses blue color variants that work in both light and dark modes.
 </p>
 </div>

 <div className="bg-green-50 p-4 rounded-lg border border-green-200 ">
 <h3 className="font-semibold text-green-900 mb-2">Success Colors</h3>
 <p className="text-green-700 ">
 Success states with proper contrast in both themes.
 </p>
 </div>

 <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 ">
 <h3 className="font-semibold text-yellow-900 mb-2">Warning Colors</h3>
 <p className="text-yellow-700 ">
 Warning states that remain readable in both themes.
 </p>
 </div>

 <div className="bg-red-50 p-4 rounded-lg border border-red-200 ">
 <h3 className="font-semibold text-red-900 mb-2">Error Colors</h3>
 <p className="text-red-700 ">
 Error states with proper visibility in both themes.
 </p>
 </div>
 </div>

 <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 ">
 <h3 className="font-semibold text-purple-900 mb-2">Gradient Examples</h3>
 <p className="text-purple-700 ">
 Even gradients can be theme-aware using the prefix system.
 </p>
 </div>
 </div>
 );
};

export default ThemeDemo;
