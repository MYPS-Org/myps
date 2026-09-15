/*
=============================================================================
 Project.RevertCategoryDesync.BP01026495LZ.2026-09-15.sql
=============================================================================
 OPTIONAL. Not required by the Category-lock fix (which only prevents this
 going forward) and not run automatically by anything. This is the single
 confirmed live project whose Category no longer matches its own ProjectId's
 allocated range -- see documents/docs/engineering/
 MYPS_CATEGORY_LOCKED_POST_CREATION_AND_SUBCATEGORY_FIX.md and the
 accompanying historical-impact audit plan for the full evidence.

 WHAT HAPPENED (reconstructed from dbo.tTransactionLog, not guessed):
   Created originally with Category = 17 (OO2: Protect Lives and Properties
   Against Major Floods) -- whose range, 20001-30000, correctly contains
   this project's embedded ProjectId sequence, 26495. Correct at creation.

   On 2026-09-11, user jimeneznr made two edits within about 40 seconds via
   the direct-edit path (now closed by this session's fix):
     18:43:50  Category: 17 (OO2: Protect Lives...)      -> 16 (OO1: Ensure Safe...)
     18:43:50  Thrust:   Construction/Maintenance of Flood Mitigation
                          Structures and Drainage Systems
                          -> Rehabilitation/Reconstruction/Upgrading of
                          Damaged Paved Roads
     18:44:28  Category: 16 (OO1: Ensure Safe...)         -> 22 (Contingent Fund)  [CURRENT]
     18:44:28  Thrust:   Rehabilitation/Reconstruction/Upgrading of Damaged
                          Paved Roads
                          -> Fund Subsidies for Contingencies             [CURRENT]

 THIS SCRIPT REVERTS BOTH Category AND Thrust to their pre-edit values (17
 and the original Thrust text above) -- restoring exactly the state that was
 correct when the project was created and that matches its permanent,
 never-regenerated ProjectId. It does NOT touch anything else.

 THE OPERATOR SHOULD DECIDE, NOT ASSUME, BEFORE RUNNING THIS:
   jimeneznr's edit might have been a genuine, wanted business correction,
   not a mistake -- this script only knows the edit created an ID/Category
   mismatch, not the intent behind it. If "Contingent Fund" is now the
   operationally correct classification for this project, do NOT run this
   script; leave the current value and treat the mismatch as a documented,
   accepted exception instead.

 RUN VIA sqlcmd, NOT a plain SSMS query window (unless SQLCMD Mode is on).
=============================================================================
*/

:on error exit

USE myps_db_dev;
GO

SET NOCOUNT ON;
GO

PRINT '=== BEFORE: current Category/Thrust for BP01026495LZ ===';
SELECT pr.Id, pr.ProjectFK, pr.Category, c.CategoryName, pr.Thrust, t.ThrustDescription
FROM dbo.tProjectRevisions pr
LEFT JOIN dbo.tOptionProjectCategory c ON c.CategoryId = pr.Category
LEFT JOIN dbo.tOptionProjectThrustList t ON t.PAPKey = pr.Thrust
WHERE pr.ProjectFK = 'BP01026495LZ';
GO

-- Guard: only proceed if the row is still in the exact state this script expects
-- (Category = 22, Contingent Fund) -- refuses to touch it if something else has
-- changed it again since this script was written, rather than blindly overwriting.
IF NOT EXISTS (
    SELECT 1 FROM dbo.tProjectRevisions WHERE ProjectFK = 'BP01026495LZ' AND Category = 22
)
BEGIN
    THROW 51000, 'ABORTED: BP01026495LZ''s Category is no longer 22 (Contingent Fund) -- something else has changed it since this script was written. Re-investigate before reverting.', 1;
END
GO

UPDATE dbo.tProjectRevisions
SET Category = 17,
    Thrust = (SELECT PAPKey FROM dbo.tOptionProjectThrustList WHERE ThrustDescription = 'Construction/ Maintenance of Flood Mitigation Structures and Drainage Systems')
WHERE ProjectFK = 'BP01026495LZ';
GO

PRINT '=== AFTER: verify the revert ===';
SELECT pr.Id, pr.ProjectFK, pr.Category, c.CategoryName, pr.Thrust, t.ThrustDescription
FROM dbo.tProjectRevisions pr
LEFT JOIN dbo.tOptionProjectCategory c ON c.CategoryId = pr.Category
LEFT JOIN dbo.tOptionProjectThrustList t ON t.PAPKey = pr.Thrust
WHERE pr.ProjectFK = 'BP01026495LZ';
GO

PRINT '=== Sanity: confirm the range now matches (expect Sequence BETWEEN Minimum AND Maximum) ===';
SELECT
    pr.ProjectFK,
    CAST(SUBSTRING(pr.ProjectFK, LEN(pr.ProjectFK) - 6, 5) AS INT) AS Sequence,
    c.Minimum, c.Maximum
FROM dbo.tProjectRevisions pr
JOIN dbo.tOptionProjectCategory c ON c.CategoryId = pr.Category
WHERE pr.ProjectFK = 'BP01026495LZ';
GO
