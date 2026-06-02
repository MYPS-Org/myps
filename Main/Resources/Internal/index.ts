/// <reference types="vite/client" />

// =============================================================================
//  MainResource
//
//  Central asset registry consumed by the React frontend.
//
//  Usage anywhere in FE/src:
//      import { MainResource } from '@MainResource';
//
//      <img src={MainResource.Images.ReportLogo} alt="logo" />
//      const html = MainResource.Templates.EmailTemplate;
//      const xlsxUrl = MainResource.Templates.ImportProjectTemplate;
//      const sqlUrl  = MainResource.SQLScripts.PCMA;
//
//  Notes
//  -----
//  - Images and binary files (.xlsm, .sql) are imported as URLs. Vite
//    fingerprints them at build time and copies them into the output bundle.
//  - The HTML template is imported with `?raw` so the file contents are
//    inlined as a string — useful for mail/preview rendering on the client.
//  - To add a new resource, drop the file under the appropriate sub-folder
//    and add an import + entry below. Keep keys PascalCase to match the
//    "tag-like" usage convention.
// =============================================================================

// ---------- Images ----------
import ReportLogo from './Images/ReportLogo.png';

// ---------- Templates ----------
import EmailTemplate from './Templates/EmailTemplate.tmpl.html?raw';
import ImportProjectTemplate from './Templates/ImportProjectTemplate.xlsm?url';

// ---------- SQL Scripts ----------
import PCMA from './SQLScripts/PCMA.sql?url';

export const MainResource = {
    Images: {
        /** Report logo (PNG) — used in PDF report headers and brand marks. */
        ReportLogo,
    },
    Templates: {
        /** Raw HTML text of EmailTemplate.tmpl.html for client-side templating. */
        EmailTemplate,
        /** URL to ImportProjectTemplate.xlsm — link as `<a href={...} download>`. */
        ImportProjectTemplate,
    },
    SQLScripts: {
        /** URL to PCMA.sql. Fetch with `fetch(MainResource.SQLScripts.PCMA)` if needed. */
        PCMA,
    },
} as const;

export type MainResourceType = typeof MainResource;
