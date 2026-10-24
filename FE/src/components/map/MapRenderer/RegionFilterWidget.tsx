import React, { useState } from 'react';
import { Checkbox } from '../../tailwindui/checkbox';
import type { RegionFilterWidgetProps } from './types';

// Shared header row: title on the left, collapse/expand arrow on the right. Used by both modes
// so a minimized widget still shows an obvious "Regions" label + reopen affordance instead of
// disappearing entirely. The whole row is the click target (not just the small arrow) -- the
// arrow itself has no onClick of its own, since clicking it would otherwise fire the toggle
// twice (once on the button, once bubbling up to the row) and net out to no change.
const CollapseHeader: React.FC<{ isCollapsed: boolean; onToggle: () => void }> = ({
  isCollapsed,
  onToggle,
}) => (
  <div
    onClick={onToggle}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    }}
    aria-label={isCollapsed ? 'Expand region filter' : 'Minimize region filter'}
    title={isCollapsed ? 'Expand' : 'Minimize'}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: isCollapsed ? 0 : '8px',
      cursor: 'pointer',
    }}
  >
    <span style={{ fontWeight: 'bold' }}>Regions</span>
    <span
      aria-hidden="true"
      style={{
        fontSize: '14px',
        lineHeight: 1,
        padding: '2px 4px',
        marginLeft: '12px',
        color: '#6b7280',
      }}
    >
      {isCollapsed ? '▸' : '▾'}
    </span>
  </div>
);

const RegionFilterWidget: React.FC<RegionFilterWidgetProps> = ({
  regions,
  selectedRegions,
  mode,
  onToggle,
  onSelect,
  onFlyTo,
  onSelectAll,
  onClearAll,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (regions.length === 0) {
    return null;
  }

  // For dropdown mode: derive controlled value
  const dropdownValue =
    selectedRegions.size !== 1 ? '__all__' : Array.from(selectedRegions)[0];

  if (mode === 'dropdown') {
    return (
      <div
        style={{
          position: 'absolute',
          top: '10px',
          // MapLibre's own NavigationControl + FullscreenControl (useMapLibreMap.ts) are also
          // anchored 'top-right', a ~39px-wide column flush against the map's right edge with a
          // higher native stacking order than our zIndex: 1 -- at right: '10px' our panel's own
          // right edge (where this collapse toggle lives) rendered directly underneath that
          // column, invisible but still present in the DOM. Clearing it horizontally avoids any
          // z-index fight.
          right: '54px',
          // Fixed width (not content-driven) so the panel never grows past the map container's
          // edge -- without this, a long region label (e.g. "Bangsamoro Autonomous Region In
          // Muslim Mindanao") stretched the box wide enough that the map's own overflow-hidden
          // clipped it, taking the collapse toggle (pushed to the row's far right by
          // justify-content: space-between) off-screen along with the label text.
          width: '260px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1,
          fontSize: '12px',
        }}
      >
        <CollapseHeader isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((prev) => !prev)} />
        {!isCollapsed && (
          <select
            value={dropdownValue}
            onChange={(e) => onSelect(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <option value="__all__">All Regions</option>
            {regions.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.label}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  // Checkbox mode
  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        // See the matching comment in the dropdown-mode branch above re: clearing MapLibre's
        // own top-right NavigationControl/FullscreenControl column.
        right: '54px',
        // Fixed width -- see the matching comment in the dropdown-mode branch above.
        width: '260px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: 1,
        fontSize: '12px',
      }}
    >
      <CollapseHeader isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((prev) => !prev)} />
      {!isCollapsed && (
        <>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '6px',
              fontSize: '11px',
            }}
          >
            <button
              type="button"
              onClick={onSelectAll}
              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#2563eb' }}
            >
              Select All
            </button>
            <span style={{ color: '#d1d5db' }}>|</span>
            <button
              type="button"
              onClick={onClearAll}
              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#2563eb' }}
            >
              Clear All
            </button>
          </div>
          {/* Scoped to just the list (not the header) and capped lower than before (160px vs the
              old 340px) -- this is an opaque box floating directly on the interactive map, so
              whatever it covers is unclickable for as long as it's expanded there. A smaller,
              scroll-sooner footprint keeps less of the map blocked for programs with a long
              region list; collapsing it the rest of the way is a manual action (the arrow above)
              now that auto-collapse-on-idle has been removed -- it kept collapsing out from
              under users who were actively scrolling/clicking inside it. */}
          <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
            {/* A plain div, not a <label> -- a native <label> wrapping both the checkbox AND
                the text would make clicking the text ALSO toggle the checkbox (default browser
                behavior for any click inside a label), fighting with the text's own click-to-fly
                handler below. Checkbox toggling still works because the Checkbox component is
                clicked directly, independent of any wrapping element. */}
            {regions.map((region) => (
              <div
                key={region.slug}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <Checkbox
                  checked={selectedRegions.has(region.slug)}
                  onChange={() => onToggle(region.slug)}
                  className="mr-2"
                />
                <span
                  onClick={() => onFlyTo(region.slug)}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    background: region.color,
                    marginRight: '8px',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  title={`Zoom to ${region.label}`}
                />
                {/* minWidth: 0 lets a flex child actually shrink below its content size so
                    text-overflow: ellipsis can kick in instead of forcing the row (and the
                    panel) wider than the fixed 260px. Clicking the label text flies the camera
                    to this region instead of toggling visibility (the checkbox still does that)
                    -- scattered regions on a nationwide program are otherwise only reachable by
                    manually panning/zooming to find them. */}
                <span
                  onClick={() => onFlyTo(region.slug)}
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    cursor: 'pointer',
                  }}
                  title={`Zoom to ${region.label}`}
                >
                  {region.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default RegionFilterWidget;
