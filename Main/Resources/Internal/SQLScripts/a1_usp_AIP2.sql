/*
    a1_usp_AIP2 -- current definition, behind all four AIP reports (AIP Official, AIP Executive,
    AIP Official without LD, AIP Executive 2).

    The first current-definition checkpoint of this proc. Taken from the live definition on
    myps_db_dev (OBJECT_DEFINITION, 2026-10-31), which carries every fix recorded in the
    a1_usp_AIP2_backup_* files in this folder, plus the #424 change marked in the x CTE below.
    Supersedes the a1_usp_AIP2 block that Reports.CrystalReportSQLFixes.sql used to hold.

    Deployment note: there is no migration runner that applies scripts in this folder
    automatically -- run this by hand against each target database (myps_db_dev, UAT) before the
    fix takes effect there. Rollback: the previous definition is this text with
    "SUM(pmwl.PhysicalTarget) AS target_amount" and an inner JOIN to tProjectMajorWorkLocations
    in the x CTE.
*/

SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE [dbo].[a1_usp_AIP2]
(
    @yearstart  INT,
    @programid  VARCHAR(300),
    @region     VARCHAR(50) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET QUOTED_IDENTIFIER ON;

;WITH LatestProgStage AS
    (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY StageId DESC, Id DESC) AS rn
        FROM dbo.tProgramStages
        WHERE StageId BETWEEN 1 AND 7 -- BP..GAA-R progression only; excludes RBP/RDIP/PIP/TF/TF-R (NameId 8,9,11,12,13), which are separate planning tracks, not "later than GAA-R"
    ),
    LatestProgRev AS
    (
        SELECT pr.*, ROW_NUMBER() OVER (PARTITION BY pr.ProgramFK ORDER BY pr.Id DESC) AS rn
        FROM dbo.tProgramRevisions pr
        JOIN LatestProgStage ps ON ps.RevisionId = pr.Id AND ps.rn = 1
    ),
    pcs AS
    (
        SELECT
            pcc.Id                   AS ComponentCostId,
            pcc.ProjectRevisionFK,
            pcc.ComponentId          AS component,
            -- 2026-09-08 fix: was pcc.Description directly (NVARCHAR(MAX), max_length=-1). Crystal
            -- Reports' OLE DB/ADO schema introspection (Map Fields / Verify Database) has a
            -- documented problem enumerating MAX-length columns from a stored proc result set --
            -- confirmed live: this field and Project_Description below (both MAX-length) were the
            -- only 2 columns in this proc's entire output not appearing in Crystal's Map Fields
            -- dialog. Bounded to NVARCHAR(500) -- no exact legacy precedent for this specific length
            -- (componentname wasn't wrapped in a CAST in the legacy script), chosen as a safe cap
            -- for what's a short label, not narrative text.
            CAST(pcc.Description AS NVARCHAR(500))     AS componentname,
            pcc.Total,
            pccpy.Amount             AS cost,
            pccpy.UACS               AS pmsid,
            pccpy.Year               AS year,
            pccpy.DateOfApproval     AS DateOfApproval
        FROM dbo.[tProjectComponentCost] pcc
        JOIN dbo.[tProjectComponentCostPerYear] pccpy
            ON  pccpy.ComponentCostFK = pcc.Id
            AND pccpy.IsDeleted       = 0
            --temporary comment
            AND pccpy.Amount         <> 0
            -- 2026-09-10, operator-requested, TEMPORARY ("for now"): commented out, not deleted.
            -- Was "AND pccpy.UACS IS NOT NULL" -- excluded any component/year row with a real
            -- Amount but no recorded UACS budget-classification code from this CTE entirely
            -- (INNER JOIN semantics: the whole row vanished, not just its UACS field).
            --
            -- Quantified impact (2026-09-10 code-behavior-audit, full detail in the Obsidian vault
            -- Risk Register): system-wide this predicate excluded only 124 of 3,531,875 per-year
            -- rows (0.004%) -- the dominant exclusion cause is "Amount = 0" (90% of rows, untouched
            -- by this change). Of the 25 project revisions that showed Component_Cost = NULL under
            -- the old filter, only 2 had this predicate as their specific cause; the other 23 have
            -- zero nonzero-Amount rows at all and are unaffected either way.
            --
            -- Net effect of commenting this out: those ~124 rows now surface with a real
            -- Component_Cost, but their UACS_PAP_Code / uacs output columns (sourced from this same
            -- pccpy.UACS) are genuinely NULL for those rows -- this does not manufacture a UACS code
            -- that doesn't exist, it just stops hiding the row entirely for lacking one.
            --
            -- Original recommendation was NOT to make this change (negligible gain, moves which
            -- field is blank rather than eliminating blank data) -- operator explicitly requested it
            -- anyway, framed as temporary. Rollback: uncomment the line below, or restore from
            -- Main/Resources/Internal/SQLScripts/a1_usp_AIP2_backup_pre_uacs_filter_comment_out_20260910.sql.
            -- AND pccpy.UACS IS NOT NULL
        WHERE pcc.IsDeleted = 0
    ),
    x AS
    (
        SELECT
            pmwi.ComponentCostFK,
            pmwi.YearOfWork              AS activity_year,
            pmwi.WorkTypeFK,
            -- 2026-10-31 fix (S08-TC003, #424): a Major Item with NO work location prints its Type of
            -- Work and Target Unit with a Physical Target of 0. The INNER JOIN below dropped such an
            -- item from x altogether, so all three columns were blank for that component and year
            -- while its cost still printed. A location whose PhysicalTarget is NULL stays blank (it
            -- is missing data, not a 0). Target_Amount stays float, nullable: the .rpt bindings of
            -- the four AIP reports are unchanged.
            CASE WHEN COUNT(pmwl.Id) = 0 THEN 0 ELSE SUM(pmwl.PhysicalTarget) END AS target_amount,
            MAX(pmwl.TargetUnit)         AS target_unit
        FROM dbo.[tProjectMajorWorkItem] pmwi
        LEFT JOIN dbo.[tProjectMajorWorkLocations] pmwl
            ON  pmwl.WorkItemFK = pmwi.Id
            AND pmwl.IsDeleted  = 0
        WHERE pmwi.IsDeleted = 0
        GROUP BY pmwi.ComponentCostFK, pmwi.YearOfWork, pmwi.WorkTypeFK
    )
    SELECT DISTINCT
        prog_rev.Name                               AS Program_Description,
        cat.CategoryName                            AS Project_Category,
        RTRIM(p.ProjectId)                          AS Project_Id,
        ar.Name					                    AS RO,
        --deo.RegionName                            AS RO,

        (CASE RIGHT(p.ProjectId, 2)
            WHEN 'LS' THEN 'National Capital Region'
            ELSE deo.Name
         END)                                     AS DEO,

        -- 2026-09-08 fix: bounded to NVARCHAR(2000), matching legacy's explicit
        -- CAST(pd.description AS VARCHAR(2000)) -- was ISNULL(p.Description,'') alone, which stayed
        -- NVARCHAR(MAX) (max_length=-1) since p.Description is declared MAX at the table level.
        -- Confirmed live: this was the field that stopped showing in Crystal's Map Fields dialog.
        CAST(ISNULL(p.Description, '') AS NVARCHAR(2000)) AS Project_Description,

        ou.Name                                    AS Operating_Unit,
        io.Name                                     AS Implementing_Office,
        ld.Name                                     AS Legislative_District,

        pcs.component                               AS Component_Id,
        pcs.cost                                     AS Component_Cost,
        PAP.ThrustDescription                       AS Thrust,

        pcs.component                               AS Activity_Component_Id,
        --x.ComponentCostFK                           AS Activity_Component_Id,
        pcs.pmsid                                   AS UACS_PAP_Code,
        sow.Description                             AS Type_Of_Work,
        sow.Measure                                 AS Target_Unit,
        --x.target_unit                               AS Target_Unit,
        x.target_amount                             AS Target_Amount,

        ops.Description                              AS stage_desc,

        (CASE rw.Name
            WHEN 'Regionwide' THEN 'Regionwide'
            WHEN 'Regionwide AIP ignores DEO' THEN 'Regionwide'
            ELSE 'Non Regionwide'
         END)                                       AS raw,

        (CASE rw.Name
            WHEN 'Regionwide' THEN 'zzzRegionwide'
            WHEN 'Regionwide AIP ignores DEO' THEN 'zzzRegionwide'
            ELSE ld.Name
         END)                                       AS rw_ld,

        (CASE rw.Name
            WHEN 'Regionwide' THEN
                CASE RIGHT(p.ProjectId, 2)
                    WHEN 'LS' THEN 'National Capital Region'
          ELSE deo.Name
                END
            WHEN 'Regionwide AIP ignores DEO' THEN ''
            ELSE
                CASE RIGHT(p.ProjectId, 2)
                    WHEN 'LS' THEN 'National Capital Region'
                    ELSE deo.Name
                END
         END)                                       AS rw_deo,

        (CASE WHEN LEFT(rw.Name, 3) <> 'Reg' THEN NULL ELSE rw.Name END) AS rw_flag,

        p.ProjectId                                 AS projectid,
        p.ProgramId                                 AS programid,
        prog.StartYear                              AS yearstart,

        pcs.DateOfApproval                          AS date_of_approval,
        pcs.componentname                            AS componentname,
        pcma.date_of_approval                       AS date_modify,

        PAP.SequenceNumber                           AS Seq_no,

        (CASE WHEN pcs.DateOfApproval IS NOT NULL THEN 'MYOA' ELSE '' END) AS myoa,
        pcs.pmsid                                    AS uacs

    FROM dbo.[tProjectRevisions] p

    JOIN dbo.[tPrograms] prog
        ON  prog.ProgramPK  = p.ProgramFK
        AND prog.StartYear  = @yearstart
        AND p.ProgramId IN (SELECT TRIM(value)
                                FROM STRING_SPLIT(@programid, ','))
        --AND p.ProgramId     = @programid
        AND RIGHT(p.ProjectId, 2) <> 'NP'
        AND p.IsDeleted     = 0
        AND (@region IS NULL OR p.Region = @region)

    JOIN LatestProgRev prog_rev
        ON  prog_rev.ProgramFK = p.ProgramFK AND prog_rev.rn = 1

    JOIN dbo.[tOptionProjectCategory] cat
        ON  cat.CategoryId = p.Category

    LEFT JOIN dbo.[vAdminDEO] deo
        ON  deo.ParticipantId = p.DEO

    LEFT JOIN dbo.[vAdminImplementingOffice] io
        ON  io.ParticipantId = p.ImplementingOffice

    LEFT JOIN dbo.[vAdminOperatingUnit] ou
        ON  ou.ParticipantId = p.OperatingUnit

    LEFT JOIN dbo.[tOptionAdminAreaCongressionalDistrict] ld
        ON  ld.Code = p.LegislativeDistrict

    LEFT JOIN dbo.[tOptionAdminAreaRegion] ar
        ON  ar.ParticipantId = p.Region

    LEFT JOIN dbo.[tOptionRegionWide] rw
        ON  rw.NameId = p.RegionWide
    LEFT JOIN pcs
        ON  pcs.ProjectRevisionFK = p.Id

    LEFT JOIN x
        ON  x.ComponentCostFK = pcs.ComponentCostId
        AND x.activity_year   = pcs.year

    LEFT JOIN dbo.[tOptionScopeOfWork] sow
        ON  sow.Enum = x.WorkTypeFK

    LEFT JOIN LatestProgStage progstage
        ON  progstage.ProgramFK = prog.ProgramPK AND progstage.rn = 1

    LEFT JOIN dbo.[tOptionProgramStage] ops
        ON  ops.NameId = progstage.StageId

    LEFT JOIN dbo.[tOptionProjectThrustList] PAP
        ON  PAP.PAPKey = p.Thrust

    LEFT JOIN dbo.[pcma_project_modify] pcma
        ON  pcma.projectid = p.ProjectId
        AND pcma.programid = p.ProgramId
        AND pcma.is_publish = 1
        AND pcma.reasons_for_rm IN ('1','2','3','4','5','6','7','8','9','10','11','12','13','14')

    --WHERE (@region IS NULL OR deo.RegionName = @region)

    ORDER BY PAP.SequenceNumber;

END
GO
