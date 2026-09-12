# Lump Sum — User Manual

## What a Lump Sum Project is

A **Lump Sum Project** holds a budget that has been approved as a single amount
before the individual works are known. You create the project with its
allocation, then **itemize** it: import the specific projects that will spend it.
Each imported project draws its cost from the allocation, and the Lump Sum
Project shows you what is left.

It is a real project, not a special container. It appears in its program's
project list like any other, and its Project ID ends in **LS**.

**It is edited only here.** The Projects module shows a Lump Sum Project but
will not let you change it, and it cannot be put through a revision. Everything
about it — its details, its funding, its allocation — is changed on this page.

Three figures describe it at all times:

| | |
|---|---|
| **Total** | the whole allocation — the same figure as the Funding Profile adds up to |
| **Itemized** | what the imported projects have drawn from it |
| **Remaining** | what is still available to itemize |

The **Total** rises only when you add funding or **Replenish**; it never falls.
The **Remaining** falls as you import projects and rises again when you delete
one. Both are shown on the Lump Sum component in the Component Cost section, as
**Allocation** and **Remaining**.

---

## Finding them

Click **Lump Sum** in the left menu.

### The list

| Column | Meaning |
|---|---|
| Project ID | The generated ID. A Lump Sum Project's always ends in `LS` |
| Description | What you named it |
| Program | The program it belongs to |
| Category | Its project category |
| Stage | The stage it is at — this follows its program and cannot be set here |
| Allocation / Remaining | The full amount, and what is still free |
| Itemized | How many projects have been imported into it |
| Created | When it was created |

### Narrowing the list

Filter by **program**, **stage**, **category** or **budget year**, and search
free text against the description. The programme list only offers programs that
actually hold a Lump Sum Project, so a filter can never return an empty grid for
lack of one.

**You only see projects in your own region.** If the list is empty and you
expected entries, that is the most likely reason.

---

## Creating one

Click **Add Lump Sum Project**.

The program list offers only programs that are still open. A program that has been
**Approved** at GAA-R is not listed, and the system refuses to create a Lump Sum Project in
one — see *Approved program* below.

### Required

You cannot save without these. If one is missing you will be told which, one at
a time, in the order they appear on the form:

- **Program** — choosing it fills in Start Year and Current Stage, neither of
  which you can edit
- **Category** — the Project ID is generated from it
- **Sub-Category**
- **Operating Unit**
- **Description** — how the project is identified in every list
- **Regionwide**
- **Origin**
- **Originating Agency**
- **Allocation**, and the **Funding Source** and **Funding Agreement** it comes
  from

### Optional

**Alternate ID** is the only optional field on the form. The location and office
fields an ordinary project asks for (Region, Province, City/Municipality,
Legislative District, District Engineering Office, Implementing Office) and the
implementation-readiness fields are not asked for at all: a Lump Sum Project
covers a programme rather than a site, so they stay blank.

### What happens on save

The allocation becomes the cost of the project's Lump Sum component — the amount
itemization draws down — and is recorded with one funding line for the full
value. Further lines are added by **Replenish**, which is the only way to raise
the allocation.

You are taken to the new project's page.

---

## The project page

The balance panel shows Total, Itemized and Remaining, with a usage bar.

Below it, four sections you can expand or collapse: **Program Details**,
**Project Details**, **Funding Profile** and **Component Cost**. Edit anything
you need and click **Save Lump Sum Project**.

**Project Details shows only what a Lump Sum Project needs**: Project ID,
Alternate ID, Category, Sub-Category, Description, Operating Unit, Regionwide,
Origin and Originating Agency, plus the **OA Project Code (UACS)**, which is
typed here. The location, office and implementation-readiness fields an
ordinary project carries are not shown here — a Lump Sum Project covers a
programme, not a site. If a project was created with values in those fields,
they are kept unchanged when you save; you can still see them by opening the
project from the Projects list, read-only.

**The Funding Profile is where the money came from, and it is read-only.** The
source, agreement and amount of each line are shown but cannot be typed over:
the first line is written when you create the project and every later one is
added by **Replenish**, which is the only way to raise the allocation. You can
still **remove** a line — a line recorded against the wrong source has to be
removable, since it can no longer be corrected in place — but a removal that
would take the allocation below what your imported projects already draw is
refused when you save.

**Every line can be removed, including the last one.** A project created with a
single line under the wrong agreement is the ordinary case, and removing that
line is the only way to correct it. When you save with no lines left, the
project's allocation becomes **zero** — it keeps its place in the module and its
Lump Sum component, and **Replenish** puts a correct line back, asking you for
the Funding Source and Agreement outright because there is no longer a line to
copy them from. Nothing is lost: an allocation with nothing itemized against it
is only a number, and you cannot empty a project that has imported projects
drawing on it.

**Tier is not asked for.** A Lump Sum Project is recorded as **Tier 1**
automatically when it is created, and keeps that on every save.

**UACS is entered here, on Project Details**, when you create the project or
any time after. It is optional. The code is kept on the component's yearly rows
and shown read-only in the **Component Cost** dialog; every project you itemize
inherits it. Clearing the box and saving removes the code. If the project already
has itemized projects, a note under the box reminds you that they keep the code
they were given when they were imported.

**Once a project has been itemized, its fields are locked.** As soon as one
project has been imported into it, the Project Details fields and the Component
Cost become read-only. A blue note at the top of the form says how many itemized
projects are holding it. The reason is that those details are what the imported
projects were built from — the category their IDs came from, the description they
are listed against.

**Funding lines are the exception: you can still remove one.** A line recorded
against the wrong source cannot be typed over, so removing it is the only way to
correct it, and that has to stay possible on a project that already has imported
projects. The one line you cannot remove there is **the line the project was
created with** — its Delete is greyed out, and hovering says why — because that is
the allocation the imported projects were brought in against. Every line added by
a **Replenish** can go. Save stays available so the removal takes effect, and it
carries nothing else, since every other field is locked. A removal that would drop
the allocation below what the imported projects already draw is refused.

**Replenish still works**, so you can always add money to an itemized project — and it
keeps working when the program is Approved, too;
the new line shows as unsaved until you press Save, the same as anywhere else.
And the lock is not permanent: delete every imported project and the fields are
editable again straight away — including that first funding line.

**Itemization in progress.** While someone is importing into this project, an
amber banner names them and Save, Replenish, Import and Delete are disabled for
everyone else. This clears within moments of the import finishing. If you do
save at the same instant, the system refuses with "being itemized or saved by
someone else" — wait a moment and try again.

**Approved program.** Once the program this project belongs to has been **Approved** at
GAA-R, a red banner at the top names it and two things change:

- The project's **details and Component Cost become read-only**, the same way they do when
  the project has imported projects — and the system refuses a change to them regardless of
  what the screen shows, naming the field it would have changed.
- **Delete Lump Sum Project is unavailable.** Hovering it explains why. The system refuses
  the deletion regardless of what the screen shows.

Everything else works as usual. **Replenish**, **Import Itemized Projects**, **Save**,
removing a funding line and deleting an imported project all stay available, because
GAA-R is the stage that work is done at. If the program is approved while you have the
page open, the change appears the next time you return to the tab; a funding change you
had not yet saved stays on screen marked **Unsaved** and you can still save it. Both
restrictions lift when the program is set back to Working.

> You cannot reduce the allocation below what has already been itemized. Delete
> the imported projects first, then reduce the funding.

### Component Cost

A Lump Sum Project holds exactly one component — the allocation itself. It is
created with the project, so there is **no Add Component and no Delete**: a
second one would be money the funding does not cover, and removing the only one
would leave nothing to itemize against. Open it with the pencil to edit its
Description. Everything else is filled in for you and shown read-only:

| Field | Where it comes from |
|---|---|
| **Component Type** | Always *Lump Sum* |
| **Component ID** | Always `LS` |
| **Year** | The program's start year |
| **Allocation** | The whole allocation — the same figure as the Funding Profile adds up to |
| **Remaining** | What is left to itemize — reduced as projects are imported, restored when one is deleted, raised by Replenish |
| **Start Date** | 1 January of that year |
| **End Date** | 31 December of that year |

To change the **Allocation**, change the funding — add a line in the Funding
Profile or use **Replenish**. Neither figure is typed in here.

You fill in one thing: the **Description**. The **UACS** is shown for reference
and is entered on **Project Details**.

### UACS

Enter the OA Project Code once, on Project Details. Every project you itemize
from this Lump Sum Project **inherits it automatically** — you do not enter it
again for the children, and a UACS in your import workbook is ignored in favour
of the parent's.

> Set the UACS **before** you import. Children take a copy at the moment they are
> imported, so changing it afterwards does not reach the projects already created.

### Actions

**Replenish** and **Import Itemized Projects** are only available while the
project is at **GAA-R** — the "with Revisions" stage. At any other stage
the buttons are visible but disabled, and hovering explains why. This is
not a display rule: the system refuses the operation regardless of what the
screen shows.

**Delete Lump Sum Project** is additionally unavailable while the project's program is
**Approved** at GAA-R. Replenish, Import and Save are not affected by that. See
*Approved program* above.

---

## Replenishing

**This is the only way to add funds.** The Funding Profile table itself is
read-only, so a Lump Sum Project's allocation rises here or not at all.

**Nothing is saved until you press Save Lump Sum Project.** Confirming the
Replenish dialog adds the new line to the Funding Profile table marked
**Unsaved**, on an amber row. The table's Total Amount, every line's percentage
share, and the **Total** and **Remaining** figures at the top of the page all
move at once, with a note under each saying how much of the figure is unsaved.
Press **Save Lump Sum Project** to apply the change; the marker clears and the
figures become the saved ones. To undo instead, click **Discard funding
changes** beside the table's totals — nothing is sent. You can replenish more
than once before saving; each top-up counts from the total the previous one
left.

While a funding change is pending, **Import Itemized Projects** and the
per-project **Delete** are unavailable — both reload the project from the
server and would drop the change. Save or discard first. Leaving the page,
refreshing it or closing the tab asks you to confirm.

Enter the **new total**, not the increase — the difference is added as a new
funding line, and existing lines' amounts are never modified. On save, the same
difference is added to the Lump Sum component's **Allocation** and to its
**Remaining**, so the figures stay in step: the funding lines add up to the
allocation, and the remaining balance is that allocation less what the imported
projects have drawn. On a project with nothing itemized yet, all three read the
same number.

You may choose the **Funding Source** and **Funding Agreement** the new line
carries. Left blank, it copies the funding line the project was created with. If
you choose a different source, also choose its agreement. Each line's
percentage share is re-derived so the shares still add up to 100.

You cannot lower an allocation this way. If you enter a figure at or below the
current total it is refused. The save that carries a new line is refused if the
project is not at **GAA-R**, in the same way Replenish itself is.

---

## Importing itemized projects

This is the only way to itemize. **You cannot attach an existing project** to a
Lump Sum Project; importing creates new ones.

**Use the same workbook as a Program import.** Download it from the Programs
module (**Download Template**), fill in the four sheets — PROJECT DETAILS,
FUNDING PROFILE, COMPONENT DETAILS, MAJOR ITEMS OF WORK — and pick values from
the dropdowns. The dropdowns hold names, and names are what the import
understands; a workbook filled with codes, or built in another tool, is
refused.

1. Click **Import Itemized Projects**. If the project cannot be itemized right
   now, you are told why instead of the dialog opening.
2. Drop in your workbook, or browse for it. What you see in the tabs is a
   preview of what the file contains; the check that matters happens when you
   click Import.
3. Review the tabs — Projects, Funding, Components, Cost/Year, Major Items,
   Locations — and the Errors tab if there is one.
4. Check the banner: it shows the remaining allocation. If the workbook totals
   more than that, Import is blocked and the shortfall is named.
5. Click Import. The workbook is checked against the same rules as a Program
   import, every sheet at once.

**A project that fails is left out; the rest are imported.** Each project in the
workbook stands on its own: if any of its rows has a real problem — a wrong
required value, a location whose parts disagree, a Major Item dated before the
program starts — that project and all its rows are refused, and every other
project is imported. The Errors tab lists the refused project's rows with the
reason, and **Download error workbook** gives you just those rows back with the
problem cells annotated and the dropdowns in place. Correct them there and import
that file; only the refused projects are in it, so nothing is imported twice. The
window stays open until you click **Done**, so you can read both the Errors and
the Warnings tabs.

If **no** project in the workbook passes, the import is refused as a whole and
nothing is saved.

**A row with a minor problem is imported, and reported.** An optional value the
system cannot read — a date, Rank, a coordinate, a chainage, a length — is
imported as **blank**; one it can read but that is out of range — a coordinate
outside the country, an end date before its start — is imported **as you typed
it**. Either way the project is created and the Import window stays open on a
**Warnings** tab listing every such row, with **Download warning report** for
the same list as a file. Correct them on the project itself, in **Projects**.

This is not the same as a refusal. A required value that is missing or wrong
still refuses that project, and a warned row belonging to a refused project is
not imported either — the project goes in whole or not at all.

A Description that already exists in the Program is reported the same way, after
the import, not refused.

**Every imported project needs a Region and a Category.** The Region decides the
island code in its generated Project ID, and the Category is what the ID is
generated from. A row missing either is refused by name. The Legislative
District matters too: Province is worked out from it, and City, Region and
DEO must agree with that Province.

Imported projects take their island code from their own Region, so they do
**not** end in `LS` — only the parent does.

Each imported project's **Alternate ID** is set to the parent Lump Sum
Project's Project ID, so the project it was carved from is visible on the
project itself. The Project ID column in the workbook is only used to tie the
four sheets together while the file is checked; it is not kept.

They inherit the parent's **UACS**. A UACS column in the workbook is accepted but
ignored; the parent's value is used. This replaces the old behaviour, where a
differing UACS was reported as an error.

Once imported, a child is an ordinary project: you edit it in the **Projects**
module like any other. Only the parent is confined to this one. In the
**Itemized Projects** list, each Project ID is a link that opens that project's
details page in Projects.

Each project is imported whole or not at all. A workbook can come back partly
imported — the projects that passed are in, the ones that failed are in the
error workbook — but no single project is ever half-created.

---

## Deleting

### An imported project

Use **Delete Project** on its row. Its cost returns to the Lump Sum Project's
remaining allocation immediately.

A **published** project cannot be deleted here — cancel it through **Programs**,
which is where publishing is managed.

### A Lump Sum Project

Use **Delete Lump Sum Project**. One of three things happens, and you are told
which:

| | |
|---|---|
| **Removed** | It had no history — deleted outright |
| **Marked deleted** | It had history — kept for the record, hidden from lists |
| **Refused** | It still has imported projects. Remove those first |

---

## Activity

Expand **Activity** for a dated list of what happened: creation, the last
change, each project itemized from it, and any that were published.

It is built from the record's own created and last-changed stamps, so only the
**most recent** change to each record appears. The panel says so. It is not a
full audit trail.

---

## What this module does not do

- **Publishing.** Lump Sum never publishes anything. It shows whether an
  imported project is published, and refuses to delete one that is, but the act
  belongs to **Programs**.
- **Revision requests and approvals.** These are not part of Lump Sum, and a
  Lump Sum Project cannot be put through one at all — the request is refused.
  Its allocation moves through **Replenish** and itemization instead.
- **Editing an imported project's draw after import.** The workbook is where its
  cost is set. To change it, delete the project and import it again.
- **Changing the stage.** A Lump Sum Project follows its program's stage.

---

## If something is refused

The message names the reason and, where money is involved, the figures. Read it
before retrying — nearly every refusal is one of:

- a required field is empty
- the project is not at GAA-R
- you are deleting a Lump Sum Project, or creating one, in a program that is Approved at
  GAA-R — set the program back to Working first
- someone else is itemizing or saving it at that moment — wait and retry
- the import totals more than the remaining allocation
- the project still has imported projects attached
- the project is outside your region
