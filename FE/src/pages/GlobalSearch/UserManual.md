# Global Search — User Manual

**Global Search** lets you find any project, program, or infrastructure record instantly from anywhere in the application — without leaving the page you are on.

---

## Opening Global Search

Click the **magnifying glass icon (🔍)** in the top navigation bar.

A search dialog opens as an overlay on top of the current page.

---

## The Search Dialog

The dialog has three sections:

```
┌──────────────────────────────────────────────────────────────┐
│  🔍  Global Search                                      [✕]  │
├──────────────────────────────────────────────────────────────┤
│  Search By                Value                  [🔍 Search] │
│  [ Select category… ▼ ]   [ Enter search value… ]           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Results appear here                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| Section | Purpose |
|---------|---------|
| **Search By** dropdown | Choose what type of record to search for |
| **Value** input | Type the text you want to find |
| **Search** button | Run the search |
| **Results area** | Scrollable table of matching records |

---

## Step-by-Step: Running a Search

### Step 1 — Choose a Category

Click the **Search By** dropdown. The list loads from the server when the dialog opens (you may see "Loading…" briefly).

Available categories:

| Category | Finds records by… | Example values |
|----------|------------------|----------------|
| **Project ID** | The project's unique ID | `2024`, `DPWH-001`, `2024-DPWH-001` |
| **Alternate ID** | An alternate project identifier | `ALT-2024` |
| **Description** | Words in the project description | `road construction`, `bridge`, `flood` |
| **UACS** | UACS (Unified Accounts Code Structure) code | `2122`, `212202000` |
| **Program Name** | Name of a program | `infrastructure`, `DPWH` |
| **Roads** | Road name | `national highway`, `marcos` |
| **Road Section** | Road section identifier | `RS-001` |
| **Bridge** | Bridge name | `marcos bridge`, `pasig` |

### Step 2 — Enter a Value

Click the **Value** input field and type your search term.

- You do **not** need to type the full text — partial matches work.
- `road` will match "National Road", "Road Construction Program", etc.
- Search is **case-insensitive** — `DPWH`, `dpwh`, and `Dpwh` all return the same results.

> The Value field is disabled (grayed out) until you select a category.

### Step 3 — Click Search

Click the blue **Search** button. The button shows "Searching…" while the request runs.

> The Search button stays disabled until both a category is selected and a value is entered.

---

## Reading the Results

Matching records appear in a table below the search form.

### Column headers

Column headers are generated automatically based on what the server returns for the selected category.

**Project categories** (Project ID, Alternate ID, Description, UACS) return:

| ProjectId | Description | ProgramName | StageName | Region |
|-----------|-------------|-------------|-----------|--------|
| 2024-001 | Construction of Road… | DPWH Infra | GAA | Region III |

**Program Name** returns:

| ProgramId | Name | StageName | YearStart | Status |
|-----------|------|-----------|-----------|--------|
| 12 | DPWH Infrastructure Program | GAA | 2024 | Active |

**Roads** returns: `RoadId`, `RoadName`, `Region`, `Length`

**Road Section** returns: `RoadSectionId`, `RoadName`, `Region`, `RoadLength`

**Bridge** returns: `BridgeId`, `BridgeName`, `Region`, `Length`

### Result title

A short summary line appears above the table (e.g. "Projects matching '2024' — 15 records").

### 50-result limit

If exactly **50 rows** appear, an amber notice is shown:

> *(capped at 50 — refine your search)*

This means more matching records exist on the server. Add more characters to your search value to narrow the results.

### No results

If nothing matches:

> **No results found**  
> No records found for *[selected category]*.

Try a shorter or different search term.

---

## Going to a Record (View Link)

For **Project ID**, **Alternate ID**, **Description**, **UACS**, and **Program Name** categories, each result row has a **View ↗** button on the right.

- Click **View ↗** to open that record's detail page.
- The search dialog closes automatically when you navigate.
- Use the browser back button to return to the previous page.

> **Roads**, **Road Section**, and **Bridge** do not have a View link yet — this is pending.

---

## Changing Your Search

- **Change category** — Select a different option from the Search By dropdown. The previous results and value are cleared automatically.
- **New value, same category** — Edit the Value field and click Search again.
- **Start over** — Close and reopen the dialog; all state is reset.

---

## Closing the Dialog

- Click the **✕** button (top-right corner), or
- Click the dark backdrop outside the dialog.

All state (selected category, entered value, results) is cleared when the dialog closes.

---

## Tips

| Tip | Detail |
|-----|--------|
| **Partial search works** | Type `2024` to find all projects with "2024" anywhere in the ID |
| **Broad first, narrow down** | Start with 2–3 characters; if you get the 50-result cap, add more |
| **Case doesn't matter** | All searches are case-insensitive |
| **Category change clears results** | Switching categories resets the value and results table |
| **Dialog doesn't interrupt your work** | The page behind it is unaffected; close to return to where you were |