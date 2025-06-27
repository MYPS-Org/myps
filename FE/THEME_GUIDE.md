# Theme System Usage Guide

## Overview
Your theme system is now set up to use **class-based** theming instead of device preferences. This means:
- **Default Theme**: Light mode (always starts with light theme)
- **User Control**: Users can manually switch between light and dark themes
- **Persistence**: Theme choice is saved in localStorage
- **No Auto-Detection**: Does not check or follow system/device theme preferences

## Key Features

### 1. Theme Context
- Located in: `src/contexts/ThemeContext.tsx`
- Provides: `theme`, `toggleTheme()`, `setTheme()`
- Default: Always starts with 'light' theme

### 2. Theme Toggle Component
- Located in: `src/components/ThemeToggle.tsx`
- Added to: AppNavbar (top-right corner)
- Shows: Sun icon (in dark mode) or Moon icon (in light mode)

### 3. Settings Page
- Located in: `src/pages/Settings/Settings.tsx`
- Features: Radio buttons for theme selection + live preview
- Route: `/settings`

## How to Use Dark Mode Classes

### Basic Pattern
```tsx
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
```

### Common Examples
```tsx
// Backgrounds
bg-white dark:bg-gray-800
bg-gray-50 dark:bg-gray-900
bg-gray-100 dark:bg-gray-800

// Text Colors
text-gray-900 dark:text-white
text-gray-600 dark:text-gray-300
text-gray-500 dark:text-gray-400

// Borders
border-gray-200 dark:border-gray-700
border-gray-300 dark:border-gray-600

// Hover States
hover:bg-gray-50 dark:hover:bg-gray-700
hover:text-gray-900 dark:hover:text-white

// Color Variants (for cards, alerts, etc.)
bg-blue-50 dark:bg-blue-900/20
text-blue-900 dark:text-blue-100
border-blue-200 dark:border-blue-800
```

### Transitions
Add smooth transitions:
```tsx
className="transition-colors duration-200"
```

## Component Examples

### Card Component
```tsx
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
    Card Title
  </h3>
  <p className="text-gray-600 dark:text-gray-300">
    Card content text
  </p>
</div>
```

### Button Component
```tsx
<button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors duration-200">
  Button Text
</button>
```

### Input Component
```tsx
<input 
  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
  placeholder="Enter text..."
/>
```

## Implementation Notes

1. **Default Behavior**: Always starts with light theme
2. **No System Detection**: Ignores `prefers-color-scheme`
3. **Manual Control**: Users must explicitly choose dark mode
4. **Persistent**: Choice saved in localStorage as 'theme'
5. **Class-Based**: Uses Tailwind's `dark:` prefix system

## Testing

Navigate to `/settings` to:
- Test theme switching with radio buttons
- See live preview of theme changes
- Verify persistence across page reloads

The theme toggle button is also available in the top navigation bar for quick switching.
