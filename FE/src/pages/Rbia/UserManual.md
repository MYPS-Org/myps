# Infrastructure Administration — User Manual

## Overview

**Infrastructure Administration** (RBIA) is the module where you manage the future road network inventory — roads, road sections, and bridges. This data forms the base layer for planning projects and tracking infrastructure across the country.

The module is organized around a three-level hierarchy:

```
Road  ──►  Road Section  ──►  Bridge
```

A road is the highest-level entity. It is divided into road sections. Each road section can have bridges. When you add a road section, you must link it to an existing road. When you add a bridge, you must link it to an existing road section.

---

## Navigating the Module

When you open the module, you see three tabs at the top:

| Tab | What it shows |
|---|---|
| Roads | All future national roads |
| Road Sections | All future road sections linked to those roads |
| Bridges | All future bridges linked to road sections |

Each tab shows a count badge with the total number of records in the system. Use the tabs to switch between the three levels of the hierarchy.

---

## Common Table Actions

Every tab's table has the same core controls:

- **Search bar** — type and press Enter or click Search to filter by the main identifier.
- **Filter button** — open the filter dialog for more specific criteria. The button turns orange when a filter is active.
- **Clear Filter / X button** — remove the current filter and reload all records.
- **Pagination** — navigate pages using Previous / Next at the bottom of the table.
- **Sort** — click a column header to sort the whole list by it (not just the page shown); click again to reverse. An arrow marks the sorted column, and paging keeps that order. Clear Filter also clears the sort.

---

## Roads Tab

### What is a Road?

A future national road is the top-level infrastructure entity. Roads have a classification (Primary, Secondary, or Tertiary) and a unique Road ID that follows a standard format.

Roads, sections and bridges migrated from **RBIA** are view-only: their rows show an **RBIA** badge instead of the Edit and Delete buttons. Only infrastructure created in MYPS can be edited or deleted. You can still add a section to an RBIA road, or a bridge to an RBIA section.

### The Road ID Format

Road IDs follow this format: **`FR{5-digit-number}{IslandCode}`**

- `FR` — prefix for Future Roads
- 5 digits — the next free number, zero-padded (e.g., `00001`). MYPS generates it; you do not type it.
- Island Code — the alphabetic code for the island group (e.g., `LZ` for Luzon, `VS` for Visayas)

Example: `FR00001LZ`

### Roads Table Columns

| Column | Description |
|---|---|
| Road ID | Unique identifier (displayed as a blue badge) |
| Road Name | Name of the road |
| Classification | Road class (green badge): Primary, Secondary, Tertiary |
| Actions | Edit, Delete (MYPS roads only; RBIA roads show an **RBIA** badge), and Add Section buttons |

### Adding a Road

1. Click the **Add Road** button (blue, top-right of the Roads table).
2. Select the **Island** (Luzon, Visayas or Mindanao). The Road ID is generated when you save, and the success message shows it.
3. Enter the **Road Name**.
4. Select the **Classification** from the dropdown.
5. Click **Create Road**.

### Editing a Road

1. Click the yellow pencil icon on the road's row.
2. Update the name or classification. The Road ID is shown read-only.
3. Click **Save**.

### Deleting a Road

1. Click the red trash icon on the road's row.
2. A confirmation dialog appears. Type `delete` in the confirmation field.
3. Click **Confirm Delete**. The road is removed immediately.

> **Warning:** Deleting a road also removes it from the system permanently. Ensure there are no active road sections linked to it before deleting.

### Searching and Filtering Roads

- **Inline search**: Type in the search box next to the table header and press Enter. This searches by Road Name.
- **Filter dialog**: Click the orange **Filter** button to filter by Road ID, Road Name, or Classification. Leave a field empty to include all results for that field. Click **Apply Filters** to confirm.
- **Clear**: Click the red **Clear Filter** button or the **Clear** button inside the filter dialog to reset.

### Adding a Road Section from a Road

Each road row has a blue **+ Add Section** button. Click it to open the Add Road Section dialog with the Road ID pre-filled. This is the primary way to create new road sections — the standalone "Add Road Section" option in the Road Sections tab is disabled.

---

## Road Sections Tab

### What is a Road Section?

A road section is a defined segment of a road, with a measured length and an assigned Engineering District Office (DEO). Each section belongs to exactly one parent road.

### The Road Section ID Format

Road Section IDs follow this format: **`FS{5-digit-number}{IslandCode}`**

- `FS` — prefix for Future Sections
- 5 digits — the next free number. MYPS generates it; you do not type it. It skips every number a project already refers to.
- Island Code — the last two letters of the parent Road ID

### Road Sections Table Columns

| Column | Description |
|---|---|
| Section Road ID | Unique section identifier (purple badge) |
| Road ID | Parent road identifier (blue badge) |
| Length (m) | Road section length in metres |
| Engineering District | DEO responsible for this section (orange badge) |
| Actions | Edit, Delete, and Add Bridge buttons |

### How to Add a Road Section

Road sections can only be added from the **Roads tab**. Find the road you want to add a section to and click its blue **+ Add Section** button.

The dialog opens with the parent road pre-filled:
1. Enter the **Length** in metres.
2. Select the **Engineering District** (DEO) from the dropdown.
3. Click **Create Road Section**.

The Section Road ID is generated when you save, and the success message shows it.

### Editing a Road Section

1. On the Road Sections tab, click the yellow pencil icon on the section's row.
2. Update the parent road, length or engineering district. The Section Road ID is read-only: it keeps its number, and if you pick a road on another island its island code changes with it (its bridges' IDs follow).
3. Click **Update Road Section**.

### Deleting a Road Section

1. Click the red trash icon on the section's row.
2. Type `delete` in the confirmation field.
3. Click **Confirm Delete**.

### Searching and Filtering Road Sections

- **Inline search**: Searches by Section Road ID.
- **Filter dialog**: Filters by Road ID, Section Road ID, and Engineering District (DEO). DEO is selected from a searchable dropdown.

### Adding a Bridge from a Road Section

Each road section row has a blue **+ Add Bridge** button. Click it to open the Add Bridge dialog with the Road Section pre-filled.

---

## Bridges Tab

### What is a Bridge?

A bridge is a structure on a road section. It records the starting position (chainage), the bridge length, the number of carriage ways, and the overall width.

### The Bridge ID Format

Bridge IDs follow this format: **`FB{5-digit-number}{IslandCode}`**

- `FB` — prefix for Future Bridges
- 5 digits — the next free number. MYPS generates it; you do not type it. It skips every number a project already refers to.
- Island Code — the last two letters of the parent Road Section ID

### Bridges Table Columns

| Column | Description |
|---|---|
| Section Road ID | Parent road section ID (blue badge) |
| Bridge Name | Name of the bridge |
| Bridge ID | Unique bridge identifier (purple badge) |
| From (m) | Starting chainage from the section start |
| Length (m) | Bridge length in metres |
| Carriage Way | Number of carriageways (blue badge, shows "N Way") |
| Actions | Edit and Delete buttons |

### How to Add a Bridge

Bridges can only be added from the **Road Sections tab**. Find the road section and click its blue **+ Add Bridge** button.

The dialog opens with the parent road section pre-filled:
1. Enter the **Bridge Name** (required).
2. Enter the **From** value — the chainage (in metres) from the start of the road section.
3. Enter the **Length** in metres.
4. Enter the **Carriageway Width** in metres.
5. Click **Create Bridge**.

The Bridge ID is generated when you save, and the success message shows it.

### Editing a Bridge

1. On the Bridges tab, click the yellow pencil icon on the bridge's row.
2. Update the fields as needed. The Bridge ID is read-only (its island code follows the road section you pick).
3. Click **Update Bridge**.

### Deleting a Bridge

1. Click the red trash icon on the bridge's row.
2. Type `delete` in the confirmation field.
3. Click **Confirm Delete**.

### Searching and Filtering Bridges

- **Inline search**: Searches by Bridge Name.
- **Filter dialog**: Filters by Section Road ID, Bridge ID, and Bridge Name.

---

## Importing Data from External Sources

The **Import** button (blue, top-right of the page) lets you pull infrastructure data from the RBIA Geographic Information System (GIS) and from administrative reference tables.

### When to Use Import

Use the import function when:
- You are setting up the module for the first time and need to pull in existing road network data from RBIA.
- The GIS system has been updated with new roads, sections, or bridges and you want to sync those changes here.
- Reference tables (DEO list, administrative divisions) are out of date.

### Import Groups

| Group | Items | Status |
|---|---|---|
| Road Network from RBIA | Roads | Available |
| Road Network from RBIA | Road Sections | Available |
| Road Network from RBIA | Bridges | Available |
| Road Network from RBIA | Region | Pending (UI present, not yet wired) |
| Admin Areas | City/Municipality, Legislative District | Pending |
| Internal Org | DEO, Implementing Office | Pending |

### How to Import

1. Click the **Import** button (top-right of the page, blue with upload icon).
2. The import dialog shows three groups. Expand or check each group.
3. Use the group-level checkbox to select all items in a group at once. The checkbox will show a dash (−) when only some items in the group are checked.
4. Check the individual items you want to import.
5. Click **Start Import**.
6. The system calls the RBIA GIS API for each selected item. Wait for the dialog to close.

> Note: Only Roads, Road Sections, and Bridges are currently connected to the GIS. The other items (Region, City/Municipality, DEO, Implementing Office) show in the dialog but will not import yet.

---

## Typical Workflows

### Full Infrastructure Setup (Road → Section → Bridge)

1. Go to the **Roads tab**.
2. Click **Add Road**. Enter the Road ID, name, and classification. Save.
3. On the new road's row, click **+ Add Section**.
4. Enter the section number, DEO, and length. Save.
5. On the **Road Sections tab**, find the new section. Click **+ Add Bridge**.
6. Enter the bridge number, name, chainage, length, and carriage ways. Save.

### Importing Existing Road Network

1. Click **Import** (top-right).
2. Check **Roads**, **Road Sections**, and **Bridges** (all under the "Road Network from RBIA" group).
3. Click **Start Import**. The system will pull all records from the GIS system.
4. After import, the tab counts will update on the next page refresh.

### Updating a Road Name or Classification

1. Go to the **Roads tab**.
2. Use the search box or filter to find the road.
3. Click the yellow pencil icon on that row.
4. Edit the name or classification.
5. Click **Save**.

### Checking Which Sections Belong to a Road

1. Go to the **Road Sections tab**.
2. Click **Filter**.
3. Enter the Road ID in the **Road ID** field.
4. Click **Apply Filters**. Only sections belonging to that road are shown.

### Checking Which Bridges Belong to a Section

1. Go to the **Bridges tab**.
2. Click **Filter**.
3. Enter the Road Section ID in the **Section Road ID** field.
4. Click **Apply Filters**. Only bridges on that section are shown.

---

## Quick Reference

| Task | Where |
|---|---|
| Add a road | Roads tab → Add Road button |
| Add a road section | Roads tab → "+ Add Section" on a road row |
| Add a bridge | Road Sections tab → "+ Add Bridge" on a section row |
| Edit any record | Click yellow pencil on any row |
| Delete any record | Click red trash on any row → type "delete" → confirm |
| Filter records | Click Filter button (orange = filter active) |
| Clear filter | Click red "Clear Filter" button |
| Import from GIS | Click Import button (blue, top-right) |