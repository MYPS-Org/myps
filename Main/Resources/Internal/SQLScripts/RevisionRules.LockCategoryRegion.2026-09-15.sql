/*
=============================================================================
 RevisionRules.LockCategoryRegion.2026-09-15.sql
=============================================================================
 Purpose: Correct 16 active dbo.tRevisionRules rows that still mark Category
          and/or Region as editable during a Formal Revision -- now dead,
          misleading configuration since Helpers/Functions.cs's
          UpdateRevisionData already refuses to apply either field
          unconditionally (see documents/docs/engineering/
          MYPS_CATEGORY_LOCKED_POST_CREATION_AND_SUBCATEGORY_FIX.md).

 Why this matters even though the code-level guard already blocks the
 change: the Modification form's Category/Region fields are still shown as
 EDITABLE for these 16 revision-reason/status combinations (isFieldEditable
 reads this same JSON). A user can fill in a new value, submit, see a
 success message, and have nothing actually change -- silently. This script
 makes the configuration match the enforced reality, closing that UX gap.

 Scope: exactly the 16 row Ids already identified and documented, not a
 broad WHERE JSON_VALUE(...) = 'true' match that could silently pick up
 unrelated rows added later.

 SAFETY: additive-in-spirit -- flips two boolean JSON keys on 16 existing
 rows, touches no other data, no schema change. Confirmed live-exploited by
 zero historical revisions (see the audit doc/plan this script came from --
 the code-level guard has no live customer-facing regression to worry
 about here). Idempotent: re-running this against already-corrected rows is
 a harmless no-op (JSON_MODIFY to the same value).

 RUN VIA sqlcmd, NOT a plain SSMS query window (unless SQLCMD Mode is on) --
 the ":on error exit" line below is a sqlcmd scripting directive.
=============================================================================
*/

:on error exit

USE myps_db_dev;
GO

SET NOCOUNT ON;
GO

PRINT '=== BEFORE: current state of the 16 rows ===';
SELECT Id, ReasonId, PCMA_Status, Package_Status, IsActive,
       JSON_VALUE(Field, '$.ProjectDetailsRules.Category') AS CategoryEditable,
       JSON_VALUE(Field, '$.ProjectDetailsRules.Region')   AS RegionEditable
FROM dbo.tRevisionRules
WHERE Id IN (1, 76, 92, 322, 324, 326, 328, 346, 348, 350, 352, 354, 356, 358, 360, 369)
ORDER BY Id;
GO

UPDATE dbo.tRevisionRules
SET Field = JSON_MODIFY(
                JSON_MODIFY(Field, '$.ProjectDetailsRules.Category', CAST(0 AS BIT)),
                '$.ProjectDetailsRules.Region', CAST(0 AS BIT)
            )
WHERE Id IN (1, 76, 92, 322, 324, 326, 328, 346, 348, 350, 352, 354, 356, 358, 360, 369)
  AND IsActive = 1;
GO

PRINT '=== AFTER: verify all 16 rows now read false/false ===';
SELECT Id, ReasonId, PCMA_Status, Package_Status, IsActive,
       JSON_VALUE(Field, '$.ProjectDetailsRules.Category') AS CategoryEditable,
       JSON_VALUE(Field, '$.ProjectDetailsRules.Region')   AS RegionEditable
FROM dbo.tRevisionRules
WHERE Id IN (1, 76, 92, 322, 324, 326, 328, 346, 348, 350, 352, 354, 356, 358, 360, 369)
ORDER BY Id;
GO

PRINT '=== Sanity: re-run the full live-database sweep, expect ZERO rows now ===';
SELECT Id, ReasonId, PCMA_Status, Package_Status,
       JSON_VALUE(Field, '$.ProjectDetailsRules.Category') AS CategoryEditable,
       JSON_VALUE(Field, '$.ProjectDetailsRules.Region')   AS RegionEditable
FROM dbo.tRevisionRules
WHERE IsActive = 1
  AND (JSON_VALUE(Field, '$.ProjectDetailsRules.Category') = 'true'
    OR JSON_VALUE(Field, '$.ProjectDetailsRules.Region') = 'true');
GO
