import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import type maplibregl from 'maplibre-gl';
import type { BoundsAndCentroid } from './geoJsonUtils';
import type { RegionConfig } from './types';

interface ExportPdfWidgetProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
  /** Shown as the PDF's header line and used to build its filename. */
  title?: string;
  /** All configured regions (not just checked ones) -- iterated in this order for the
   *  per-region detail pages. */
  regions: RegionConfig[];
  /** Which regions are currently checked -- only these get their own detail page. */
  selectedRegions: Set<string>;
  /** The same setter the Regions checkbox panel uses. Driven directly during a 'byRegion'
   *  export to isolate one region at a time -- see handleExport's own comment on why. */
  setSelectedRegions: (regions: Set<string>) => void;
  /** Same lookup MapRenderer.tsx's click-to-fly uses -- see its own doc comment. */
  getRegionBounds: (slug: string) => BoundsAndCentroid | null;
}

type ExportMode = 'current' | 'byRegion';

const pad2 = (n: number) => String(n).padStart(2, '0');

// Resolves once the map has fully redrawn after a camera change (tiles loaded, no pending
// render) -- capturing right after fitBounds/jumpTo without this risks a half-loaded frame,
// since those calls return before the new view has actually finished rendering. Races a
// timeout too: a camera change that doesn't actually move anything (e.g. already there) can
// leave the map considering itself already idle, with no new 'idle' event to wait for.
//
// Also waits one more animation frame past 'idle' -- without it, a page captured right after
// idle fires can still catch a transitional frame (seen in practice: the first per-region page,
// jumping from the zoomed-out overview to a specific region's bounds, occasionally captured
// mid-jump). 'idle' means MapLibre considers its own work done; the extra rAF makes sure the
// browser has actually painted that result before toDataURL() reads the canvas back.
function waitForIdle(map: maplibregl.Map, timeoutMs = 2500): Promise<void> {
  return new Promise((resolve) => {
    const settle = () => requestAnimationFrame(() => resolve());
    const timer = setTimeout(settle, timeoutMs);
    map.once('idle', () => {
      clearTimeout(timer);
      settle();
    });
  });
}

// setSelectedRegions() is a React state update -- it doesn't take effect synchronously. The
// double-rAF is a standard trick for "wait until the resulting re-render has actually
// committed to the DOM/map": the first rAF fires after React has committed (browsers run
// React's commit + effects before the next paint), and waiting one more frame on top covers
// MapLibre's own setData()/setLayoutProperty() calls (triggered by those effects) actually
// being reflected when the canvas is next read.
function waitTwoFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

// Bottom-left -- the one corner none of the other floating widgets (basemap switcher top-left,
// zoom/fullscreen controls + Regions panel top-right) already occupy.
const ExportPdfWidget: React.FC<ExportPdfWidgetProps> = ({
  mapRef,
  title,
  regions,
  selectedRegions,
  setSelectedRegions,
  getRegionBounds,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    // Capture phase + a microtask delay isn't needed here since this effect only attaches
    // AFTER the menu-opening click has already finished bubbling (effects run post-render).
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMenuOpen]);

  const handleExport = async (mode: ExportMode) => {
    const map = mapRef.current;
    if (!map || isExporting) return;

    setIsMenuOpen(false);
    setIsExporting(true);
    setProgress('');
    // Saved so the live map ends up exactly where the user left it, not wherever the last
    // per-region page happened to leave the camera -- the loop below moves it around a lot.
    const originalCamera = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
    // Same idea for the region selection -- 'byRegion' mode narrows it to one region at a
    // time while generating each page (see below), and needs to end up back at whatever the
    // user actually had checked, not stuck on whichever region happened to be exported last.
    const originalSelectedRegions = selectedRegions;

    try {
      // Relies on preserveDrawingBuffer: true (useMapLibreMap.ts) -- without it WebGL has
      // already cleared this frame's drawing buffer by the time a click handler runs, and
      // toDataURL() would come back blank instead of the rendered map.
      const canvas = map.getCanvas();

      // Page orientation follows the map's own aspect ratio (most map containers are wider
      // than tall) rather than a fixed portrait/landscape guess, so the image always fills the
      // page edge-to-edge instead of leaving large blank margins on one axis. The canvas's own
      // CSS size doesn't change as the camera moves around (only its content does), so one
      // orientation, computed once, is correct for every page in this document.
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 24;

      // Captures whatever the map currently shows into the CURRENT page of `doc`, with a
      // header line above it. Shared by the overview page and every per-region detail page
      // below so the "fit image into page, centered, preserving aspect ratio" math only lives
      // once.
      const capturePage = (pageTitle: string | undefined, timestamp: Date) => {
        const headerHeight = pageTitle ? 28 : 0;
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2 - headerHeight;

        const imageAspect = canvas.width / canvas.height;
        const areaAspect = availableWidth / availableHeight;
        let drawWidth: number;
        let drawHeight: number;
        if (imageAspect > areaAspect) {
          drawWidth = availableWidth;
          drawHeight = drawWidth / imageAspect;
        } else {
          drawHeight = availableHeight;
          drawWidth = drawHeight * imageAspect;
        }
        const x = margin + (availableWidth - drawWidth) / 2;
        const y = margin + headerHeight + (availableHeight - drawHeight) / 2;

        if (pageTitle) {
          doc.setFontSize(14);
          doc.text(pageTitle, margin, margin + 14);
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(timestamp.toLocaleString(), margin, margin + headerHeight - 2);
          doc.setTextColor(0);
        }

        doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawWidth, drawHeight);
      };

      // Captured once and reused for the overview page's header + the filename below, so they
      // can't drift apart by the few ms between separate `new Date()` calls. Per-region pages
      // below get their own fresh timestamp each, since real time passes while they're
      // generated (each one waits on tiles to load).
      //
      // Waits for idle here too, same reasoning as the per-region jumps below -- the button can
      // be clicked before the map's OWN initial load (or a basemap switch, or the tail of a
      // user-driven pan) has actually finished settling, and capturing mid-transition produces
      // a near-blank page.
      await waitForIdle(map);
      const exportStartedAt = new Date();
      capturePage(title, exportStartedAt);

      // 'byRegion' only: one additional page per CHECKED region, zoomed into that region's own
      // extent so its real lines and points are actually visible -- at the overview's
      // zoomed-out scale, real line geometry is only a few pixels long by design (see
      // LINE_REPRESENTATIVE_POINT_MAX_ZOOM), which is why the dots/clusters exist there
      // instead. 'current' mode is just the one page above, exactly what was on screen when
      // the button was clicked -- the original, simpler export this grew out of.
      if (mode === 'byRegion') {
        const checked = regions.filter((r) => selectedRegions.has(r.slug));
        for (let i = 0; i < checked.length; i++) {
          const region = checked[i];
          setProgress(`${i + 1}/${checked.length}`);

          const result = getRegionBounds(region.slug);
          if (!result) continue; // nothing in this region to show a detail page for

          // Isolate this region before capturing its page -- without this, any OTHER checked
          // region whose own data happens to be geographically close (or whose bounds overlap
          // this one's) stays visible too, since only the CAMERA was moving per page, not
          // which regions were shown. Driving the same selectedRegions state the Regions
          // checkbox panel uses reuses the exact filtering this app already relies on to hide
          // a region when its checkbox is off, rather than reimplementing it here.
          setSelectedRegions(new Set([region.slug]));
          await waitTwoFrames();

          const { bounds, centroid } = result;
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 });
          } else {
            map.jumpTo({ center: centroid, zoom: 12 });
          }
          await waitForIdle(map);

          doc.addPage();
          capturePage(title ? `${title} — ${region.label}` : region.label, new Date());
        }
      }

      const safeName = (title ?? 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      // Local date + time (not UTC -- matches the header lines above), colons swapped for
      // dashes since ':' isn't valid in a Windows filename. Down to the second so exporting
      // the same program twice in a row doesn't silently overwrite the first download.
      const datePart = `${exportStartedAt.getFullYear()}-${pad2(exportStartedAt.getMonth() + 1)}-${pad2(exportStartedAt.getDate())}`;
      const timePart = `${pad2(exportStartedAt.getHours())}-${pad2(exportStartedAt.getMinutes())}-${pad2(exportStartedAt.getSeconds())}`;
      doc.save(`${safeName || 'map'}-${datePart}_${timePart}.pdf`);
    } finally {
      // Instant (duration: 0) -- the user is looking at a finished PDF at this point, not the
      // map, so there's no reason to animate back into place.
      map.jumpTo(originalCamera);
      setSelectedRegions(originalSelectedRegions);
      setIsExporting(false);
      setProgress('');
    }
  };

  const checkedCount = regions.filter((r) => selectedRegions.has(r.slug)).length;
  // No regionConfig at all (e.g. the Project-level map) means "by region" has no meaning here
  // -- skip the menu and keep the original one-click export instead of offering a choice with
  // only one real option.
  const hasRegions = regions.length > 0;

  return (
    <div ref={widgetRef} style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 1 }}>
      {isMenuOpen && hasRegions && !isExporting && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '6px',
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            fontSize: '12px',
            overflow: 'hidden',
            width: '220px',
          }}
        >
          <button
            type="button"
            onClick={() => handleExport('current')}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontWeight: 600 }}>Current view</div>
            <div style={{ color: '#6b7280' }}>Exactly what&apos;s on screen now</div>
          </button>
          <button
            type="button"
            onClick={() => handleExport('byRegion')}
            disabled={checkedCount === 0}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              cursor: checkedCount === 0 ? 'default' : 'pointer',
              color: checkedCount === 0 ? '#9ca3af' : '#374151',
            }}
          >
            <div style={{ fontWeight: 600 }}>By region</div>
            <div style={{ color: checkedCount === 0 ? '#9ca3af' : '#6b7280' }}>
              Overview + one page per checked region
              {checkedCount > 0 ? ` (${checkedCount})` : ' -- no regions checked'}
            </div>
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => (hasRegions ? setIsMenuOpen((prev) => !prev) : handleExport('current'))}
        disabled={isExporting}
        title="Export map as PDF"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '6px 10px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: '12px',
          border: 'none',
          cursor: isExporting ? 'default' : 'pointer',
          opacity: isExporting ? 0.6 : 1,
          color: '#374151',
        }}
      >
        {isExporting ? `Exporting${progress ? ` ${progress}` : '…'}` : hasRegions ? '⬇ Export PDF ▾' : '⬇ Export PDF'}
      </button>
    </div>
  );
};

export default ExportPdfWidget;
