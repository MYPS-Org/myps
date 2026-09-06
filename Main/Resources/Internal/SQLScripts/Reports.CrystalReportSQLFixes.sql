/*
    Crystal Report legacy SQL objects -- fixed to run against myps_db_dev

    Context: 7 legacy Crystal Report SPs/views were forwarded by the operator (from a retired
    Sybase Adaptive Server-era MYPS instance) to restore Crystal Report generation via
    CrystalReportService/CrystalReportRenderer.cs, which maps report keys to exactly these
    object names. 6 of the 7 objects already existed on myps_db_dev, translated to the current
    revision-based schema (tProjectRevisions/tProjectComponentCost/etc.) by prior work -- but
    every one of them hardcoded a three-part name to [myps_db], the forbidden/retired database
    (SKL-005/ADR-118), instead of the local myps_db_dev database they're actually deployed on.
    That doesn't error -- myps_db genuinely exists as a sibling database on the same server -- so
    all 5 objects were silently reading from the wrong database. Fixed 2026-09-05, confirmed via
    sys.sql_expression_dependencies (zero remaining cross-database references) and live
    re-execution with real sample data.

    Round 1 fixes (2026-09-05):
      - MYPS_vw_rptRBPSummary: TotalNo/TotalAmount were hardcoded literal 100000 instead of real
        SUM(...) expressions; the OO1 (category 16) branch was missing the ps.StageName='RBP'
        filter the other 3 category branches applied (an inconsistent, apples-to-oranges total).
      - MYPS_vw_rptRBPSummaryTier: its BaseDistinct CTE enumerated DEO/tier combinations from the
        unfiltered RBPBase (no category restriction), so any RBP-stage project in a category
        outside 16/17/18/19/29/30 produced a phantom all-zero row in the rendered report.
        Restricted to WHERE CategoryId IN (16,17,18,19,29,30), matching the effective filtering
        the non-Tier view already had via its UNION-ALL-of-filtered-branches structure.

    Round 2 fixes (2026-09-06) -- triggered by the operator still hitting the AIP "reportType is
    required." frontend gap (reproduced live on https://myps.eptisa-dev.com). Investigation found
    an earlier attempt at that exact frontend fix (PR #114, 2026-08-27) was reverted 32 minutes
    after merging (PR #121, same author, clean total revert, zero explanation in the commit
    message). Reconstructed cause: commit f6745df0 (2026-08-25, ~19 min before PR #114) had just
    documented severe data-correctness bugs in sp_RBP/a1_usp_AIP2/usp_extract_PC_MIOW_list --
    shipping the frontend that exposed those broken report types to real users was the actual
    problem, not the frontend code. Operator confirmed sequencing: SQL fixes first, then frontend.
    Re-verified all three flagged bugs directly against live myps_db_dev before fixing -- all
    three were still present, none had been touched by the round-1 pass above.

      - sp_RBP, a1_usp_AIP2: unconstrained fan-out. Both joined tProgramRevisions/tProgramStages
        on ProgramFK alone, no revision/stage-specific filter. Real programs have up to 7 rows in
        tProgramRevisions per ProgramFK -- every result row was duplicated once per revision, and
        any SUM/COUNT over the join was proportionally inflated (confirmed live: 49-row test case
        collapsed to 1 correct row after the fix, with zero query errors). Fixed by inserting
        LatestProgRev/LatestProgStage CTEs (ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id
        DESC) AS rn) ahead of the existing CTEs, and rewiring the ProgramFK joins to the new CTEs
        with an added "AND <alias>.rn = 1" -- the same "latest revision" pattern already used
        elsewhere in this codebase (e.g. pAllowProjectPublishing's LatestBase CTE), not a new one.
        OPEN QUESTION (not yet resolved, flagged to the operator): "latest by Id DESC" may not be
        the correct semantic for sp_RBP specifically -- the already-fixed MYPS_vw_rptRBPSummary(Tier)
        views instead filter explicitly to StageName='RBP'. sp_RBP's own name suggests it may want
        RBP-stage-specific data rather than "whatever revision/stage is currently latest." Revisit
        if RBP report output looks wrong for a program with an RBP stage that isn't also its most
        recent revision.
      - sp_RBP, a1_usp_AIP2: Target_Amount was mapped to a peso cost column (pccpy.Amount /
        pcs.cost) instead of a physical-quantity column -- a straight duplicate of Component_Cost
        on every row, not a target quantity. Fixed to pmwl.PhysicalTarget (sp_RBP) and
        x.target_amount (a1_usp_AIP2, already computed as SUM(pmwl.PhysicalTarget) in the existing
        x CTE, previously commented out directly below the wrong line).
      - a1_usp_AIP2: the regionwide CASE branches checked WHEN rw.Name = 'Regionwide - AIP ignores
        DEO' (with a dash). Queried dbo.tOptionRegionWide directly -- the real stored value is
        'Regionwide AIP ignores DEO' (no dash, NameId=3). The dash meant that branch could never
        match; any project flagged this way silently fell through to the wrong CASE branch. Fixed
        all 3 occurrences to the real stored string.
      - usp_extract_PC_MIOW_list: restored 5 columns that had been commented out (programid,
        rocode, deo_code, categoryid, io_code) -- the Crystal .rpt template expects them. Restored
        rocode as p.Region (not deo.RegionCode) to stay consistent with what @rocode actually
        filters against, deliberately avoiding the Code-vs-Id mismatch pattern found and fixed the
        same session in FE/src/pages/Reports/Reports.tsx's region dropdown. Also carried the same
        fan-out fix as the two procs above (LatestProgRev CTE, tProgramRevisions join constrained
        to rn = 1) -- confirmed live: 7-row test case (matching a known 7-revision program)
        collapsed to 1 row, zero errors.
      - NOT independently re-verified this pass: whether usp_extract_PC_MIOW_list's @region
        parameter contract (participant-id vs. region name) still silently breaks any remaining
        "legacy-shaped" caller, per the original 2026-08-25 review's specific framing. @rocode was
        confirmed to filter p.Region (a ParticipantId-style value), internally consistent with
        this round's other fixes, but no caller inventory was done to confirm nothing still passes
        a region name here.
      - Every fix in this round got a rollback-only drill (BEGIN TRAN / CREATE OR ALTER / real
        before-vs-after row-count comparison against synthetic and real multi-revision test data /
        ROLLBACK TRAN) before live deployment -- "runs without error" was explicitly treated as
        insufficient evidence, since that is exactly the standard the pre-revert, still-broken code
        was already passing.

    Round 2 correction (2026-09-06, same day) -- the "latest revision by Id DESC, regardless of
    stage" resolution above was itself wrong for sp_RBP and a1_usp_AIP2, caught before it could
    ship to the frontend. dbo.tProgramStages turned out to be a 1:1 tag per revision (linked via
    RevisionId), not an independent fan-out source -- every revision carries exactly one StageName
    from a fixed set (BP, NEP, NEP-E, HGAB, HGAB-I, GAA, GAA-R = NameId 1-7 in dbo.tOptionProgramStage,
    the ordinary budget-cycle progression; RBP = NameId 8, a separate planning track; RDIP/PIP/
    TF/TF-R = NameId 9/11/12/13, also separate). "Latest by revision Id" ignores which track a
    revision belongs to, so a program with an RBP-stage revision that isn't also its highest-Id
    revision (or with no RBP-stage revision at all) would show wrong-stage data mislabeled as RBP.
      - sp_RBP: now filters explicitly to StageName = 'RBP' (matching the already-fixed
        MYPS_vw_rptRBPSummary/Tier views' own StageName='RBP' filter -- this was the established,
        correct precedent the whole time). LatestProgStage CTE filters WHERE StageName='RBP' first;
        LatestProgRev CTE is now defined by joining to that filtered stage row via
        RevisionId = tProgramRevisions.Id, not an independent "latest by Id" scan, so
        Program_Description and stage_desc can never disagree about which revision is shown.
        Verified live: a program with no RBP-stage revision correctly returns 0 rows (was
        previously showing its BP-stage data mislabeled as RBP); a program with a real RBP-stage
        revision correctly returns exactly that revision's rows.
      - a1_usp_AIP2: has no @StageName parameter (nor does the DTO layer feeding it), so an exact
        stage match like sp_RBP's isn't available without expanding scope. Instead, "latest" is now
        resolved via StageId DESC restricted to WHERE StageId BETWEEN 1 AND 7 (the BP..GAA-R
        progression only), explicitly excluding RBP/RDIP/PIP/TF/TF-R (NameId 8/9/11/12/13) from
        being picked as "the latest AIP data" -- those are separate planning tracks, not later
        stages than GAA-R. Verified live: a 7-revision program (BP through GAA-R) correctly dedupes
        to 1 row (picking GAA-R, the true latest-in-progression); a single-BP-stage program still
        correctly returns its 1 row; a program whose only revision is RBP-tagged correctly returns
        0 rows (RBP is not part of the AIP progression).
      - Both fixes drilled the same way as everything else this session: BEGIN TRAN / CREATE OR
        ALTER / real positive-case AND negative-case row evidence against live data / ROLLBACK TRAN,
        then a separate real deployment with live post-deploy verification.

    'RBP' (Regional Budget Proposal) is a real, distinct stage in dbo.tOptionProgramStage
    (NameId=8), separate from 'BP' (Budget Proposal, NameId=1) -- confirmed by the operator
    directly; do not "fix" this to 'BP' if it looks unpopulated in a given environment, that
    reflects sparse dev data, not a translation error.

    sp_RBPSummary (a different, similarly-named proc) was deliberately left untouched -- its live
    signature has diverged from both the legacy original and this Crystal rendering path
    (CrystalReportRenderer.cs calls the VIEW MYPS_vw_rptRBPSummary, never this proc), and its body
    shows active, separate, unrelated in-progress work.

    a1_usp_AIP2's LEFT JOIN to dbo.pcma_project_modify (date_modify/myoa columns) will always
    produce NULL until that table has data -- confirmed 0 rows as of this fix; not a bug in this
    proc, just documenting so it isn't mistaken for a regression later.

    Deployment order: none -- these 5 objects have no dependency on each other or on any other
    script in this folder. Each is deployed independently via CREATE OR ALTER.

    Rollback: each of these 5 objects existed before this fix in a broken (wrong-database or
    logic-bug) state -- there is no "prior good" version to roll back to. If a regression is
    found, fix forward against this file rather than reverting.
*/
CREATE OR ALTER PROCEDURE [dbo].[sp_RBP]







(







    @yearstart  INT,







    @programid  VARCHAR(MAX) = NULL,







    @region     VARCHAR(50)  = NULL







)







AS







BEGIN







    SET NOCOUNT ON;

;WITH LatestProgStage AS

    (

        SELECT *, ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id DESC) AS rn

        FROM dbo.tProgramStages

        WHERE StageName = 'RBP'

    ),

    LatestProgRev AS

    (

        SELECT pr.*, ROW_NUMBER() OVER (PARTITION BY pr.ProgramFK ORDER BY pr.Id DESC) AS rn

        FROM dbo.tProgramRevisions pr

        JOIN LatestProgStage ps ON ps.RevisionId = pr.Id AND ps.rn = 1

    ),

    x AS
    (







        SELECT







            progrev.Name                AS Program_Description,







            cat.CategoryName            AS Project_Category,







            RTRIM(p.ProjectId)          AS Project_Id,







            ar.Name					    AS RO,







            --deo.RegionName              AS RO,







            deo.Name                    AS DEO,







            p.Description               AS Project_Description,   -- old concatenated name + name_extension; new schema has no name_extension equivalent







            ou.Name                     AS Operating_Unit,







            io.Name                     AS Implementing_Office,







            ld.Name                     AS Legislative_District,







            pcc.ComponentId             AS Component_Id,







            pcc.Total                   AS Component_Cost,







            PAP.ThrustDescription       AS Thrust,







            pcc.ComponentId             AS Activity_Component_Id,







            pccpy.UACS                  AS UACS_PAP_Code,







            sow.Description             AS Type_Of_Work,







            sow.Measure                 AS Target_Unit,







            pmwl.PhysicalTarget          AS Target_Amount,







            ops.Description             AS stage_desc,







            rw.Name                     AS rw_flag,







            p.ProjectId                 AS projectid,







            p.ProgramId                 AS programid,







            prog.StartYear              AS yearstart,







            p.MYCAApprovalDate          AS date_of_approval,







            pcc.Description             AS componentname,







            pmwl.DetailedScope          AS dsow,







            pmwl.StartStationLimit      AS start_station_limit,







            pmwl.EndStationLimit        AS end_station_limit,







            pmwl.Length                 AS activity_length,







            pt.Name                     AS tier,







            PAP.SequenceNumber          AS Seq_no,







            p.Rank                      AS rank















        FROM dbo.[tProjectRevisions] p















        JOIN dbo.[tPrograms] prog







            ON  prog.ProgramPK  = p.ProgramFK







            AND prog.StartYear  = @yearstart







            AND p.ProgramId IN (SELECT TRIM(value)







                                FROM STRING_SPLIT(@programid, ','))







            --AND p.ProgramId     IN ('FC6E56AF-A1FE-4951-9027-586CC686E9B9 ', '2E9FA153-3880-479D-9F84-D895D5DC89FD')--(@programid)







            AND RIGHT(p.ProjectId, 2) <> 'NP'







            AND p.IsDeleted     = 0







            AND (@region IS NULL OR p.Region = @region)







        --temp left join







        JOIN LatestProgRev progrev







            ON  progrev.ProgramFK = p.ProgramFK AND progrev.rn = 1















        JOIN dbo.[tProjectComponentCost] pcc







            ON  pcc.ProjectRevisionFK = p.Id







            AND pcc.IsDeleted         = 0















        JOIN dbo.[tProjectComponentCostPerYear] pccpy







            ON  pccpy.ComponentCostFK = pcc.Id







            --temp lang







            --AND pccpy.Year            = prog.StartYear







            AND pccpy.IsDeleted       = 0















        JOIN dbo.[tProjectMajorWorkItem] pmwi







            ON  pmwi.ComponentCostFK = pcc.Id







            AND pmwi.IsDeleted       = 0















        JOIN dbo.[tProjectMajorWorkLocations] pmwl







            ON  pmwl.WorkItemFK = pmwi.Id







            AND pmwl.IsDeleted  = 0















        JOIN dbo.[tOptionScopeOfWork] sow







            ON  sow.Enum = pmwi.WorkTypeFK







        -----------------------------------------------------------







        LEFT JOIN dbo.[vAdminDEO] deo







            ON  deo.ParticipantId = p.DEO







            ----AND (@region IS NULL OR deo.RegionName = @region)







        JOIN dbo.[tOptionProjectCategory] cat







ON  cat.CategoryId = p.Category















        JOIN LatestProgStage progstage







            ON  progstage.ProgramFK = prog.ProgramPK AND progstage.rn = 1















        JOIN dbo.[tOptionProgramStage] ops







            ON  ops.NameId = progstage.StageId







        --------------------------------------------------------------







        LEFT JOIN dbo.[tOptionProjectTier] pt







            ON  pt.NameId = p.Tier















        LEFT JOIN dbo.[tOptionProjectThrustList] PAP







            ON  PAP.PAPKey = p.Thrust















        LEFT JOIN dbo.[vAdminImplementingOffice] io







            ON  io.ParticipantId = p.ImplementingOffice















        LEFT JOIN dbo.[tOptionAdminAreaCongressionalDistrict] ld







            ON  ld.Code = p.LegislativeDistrict















        LEFT JOIN dbo.[tOptionAdminAreaRegion] ar







            ON  ar.ParticipantId = p.Region















        LEFT JOIN dbo.[vAdminOperatingUnit] ou







            ON  ou.ParticipantId = p.OperatingUnit















        LEFT JOIN dbo.[tOptionRegionWide] rw







            ON  rw.NameId = p.RegionWide







    )







    SELECT DISTINCT







        x.Program_Description,







        x.Project_Category,







        x.Project_Id,







        x.RO,







        x.DEO,







        x.Project_Description,







        x.Operating_Unit,







        x.Implementing_Office,







        x.Legislative_District,







        x.Component_Id,







        x.Component_Cost,







        x.Thrust,







        x.Activity_Component_Id,







        x.UACS_PAP_Code,







        x.Type_Of_Work,







        x.Target_Unit,







        x.Target_Amount,







        x.stage_desc,







        x.rw_flag,







        x.projectid,







        x.programid,







        x.yearstart,







        x.date_of_approval,







        x.componentname,







        x.dsow,







        x.start_station_limit,







        x.end_station_limit,







        x.activity_length,







        x.tier,







        x.Seq_no,







        ISNULL(x.rank, 99.9) AS rank,







        COUNT(*) OVER (PARTITION BY x.Project_Id, x.Component_Id) AS CountField







    FROM x







    WHERE x.programid IS NOT NULL







    ORDER BY x.Project_Id, x.Component_Id;















END
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







            pcc.Description          AS componentname,







            pcc.Total,







            pccpy.Amount             AS cost,







            pccpy.UACS               AS pmsid,







            pccpy.Year               AS year







        FROM dbo.[tProjectComponentCost] pcc







        JOIN dbo.[tProjectComponentCostPerYear] pccpy







            ON  pccpy.ComponentCostFK = pcc.Id







            AND pccpy.IsDeleted       = 0







            --temporary comment







            AND pccpy.Amount         <> 0







            AND pccpy.UACS IS NOT NULL







        WHERE pcc.IsDeleted = 0







    ),







    x AS







    (







        SELECT







            pmwi.ComponentCostFK,







            pmwi.YearOfWork              AS activity_year,







            pmwi.WorkTypeFK,







            SUM(pmwl.PhysicalTarget)     AS target_amount,







            MAX(pmwl.TargetUnit)         AS target_unit







        FROM dbo.[tProjectMajorWorkItem] pmwi







        JOIN dbo.[tProjectMajorWorkLocations] pmwl







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















        p.Description                             AS Project_Description,















        ou.Name                                    AS Operating_Unit,







        io.Name                                     AS Implementing_Office,







        ld.Name                                     AS Legislative_District,















        pcs.component                               AS Component_Id,







        pcs.Total                                    AS Component_Cost,







        --pcs.cost                                    AS Component_Cost,







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















        p.MYCAApprovalDate                          AS date_of_approval,







        pcs.componentname                            AS componentname,







        pcma.date_of_approval                       AS date_modify,















        PAP.SequenceNumber                           AS Seq_no,















        (CASE WHEN p.MYCAApprovalDate IS NOT NULL THEN 'MYOA' ELSE '' END) AS myoa,







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

CREATE OR ALTER PROCEDURE [dbo].[usp_extract_PC_MIOW_list]















(















    @programid  VARCHAR(255),















    @categoryid INT,















    @rocode     VARCHAR(20),















    @deocode    VARCHAR(20),















    @io_code    VARCHAR(20)















)















AS















BEGIN















    SET NOCOUNT ON;































    --SELECT















    --    programid_received = '[' + ISNULL(@programid, 'NULL') + ']',















    --    categoryid_received = @categoryid,















    --    rocode_received     = '[' + ISNULL(@rocode, 'NULL') + ']',















    --    deocode_received    = '[' + ISNULL(@deocode, 'NULL') + ']',















    --    io_code_received    = '[' + ISNULL(@io_code, 'NULL') + ']';

;WITH LatestProgRev AS

    (

        SELECT *, ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id DESC) AS rn

        FROM dbo.tProgramRevisions

    ),

    pcs AS
    (















        SELECT















            pcc.Id                  AS ComponentCostId,















            pcc.ProjectRevisionFK,















            pcc.ComponentId          AS component,















            pcc.Total                AS pc_cost,















            pcc.Description          AS componentname,















            MAX(pccpy.UACS)          AS pmsid,















            MIN(pccpy.StartDate)     AS start_date,















            MAX(pccpy.EndDate)       AS end_date















        FROM dbo.[tProjectComponentCost] pcc















        LEFT JOIN dbo.[tProjectComponentCostPerYear] pccpy















            ON  pccpy.ComponentCostFK = pcc.Id















            AND pccpy.IsDeleted       = 0















        WHERE pcc.IsDeleted = 0















        GROUP BY pcc.Id, pcc.ProjectRevisionFK, pcc.ComponentId, pcc.Total, pcc.Description















    ),















    x AS















    (















        SELECT















            pmwi.Id                 AS WorkItemId,















            pmwi.ComponentCostFK,















            pmwi.WorkTypeFK,















            pmwi.InfraTypeFK,















            pmwl.PhysicalTarget      AS target_amount,















            pmwl.DetailedScope       AS dsow,















            pmwl.InfraId             AS infra_id,















            pmwl.StartChainage       AS start_chainage,















            pmwl.EndChainage         AS end_chainage,















            pmwl.Length              AS length,















            pmwl.StartStationLimit   AS start_station_limit,















            pmwl.EndStationLimit     AS end_station_limit,















            pmwl.StartX              AS start_x,















            pmwl.StartY              AS start_y,















            pmwl.EndX                AS end_x,















            pmwl.EndY                AS end_y















        FROM dbo.[tProjectMajorWorkItem] pmwi















        JOIN dbo.[tProjectMajorWorkLocations] pmwl















            ON  pmwl.WorkItemFK = pmwi.Id















            AND pmwl.IsDeleted  = 0















        WHERE pmwi.IsDeleted = 0















    )















    SELECT DISTINCT















        p.ProgramId                          AS programid,















        prog_rev.Name                        AS Program,















        deo.RegionName                       AS Region,















        p.Region                              AS rocode,















        deo.Name                              AS District_Engineering_Office,















        p.DEO                                AS deo_code,















        ld.Name                               AS Legislative_District,















        cm.Name                                AS City_Municipality,















        cat.CategoryName                      AS Category,















        cat.CategoryId                        AS categoryid,















        PAP.ThrustDescription                  AS Thrust,















        po.Name                                 AS Project_Origin,















        p.ProjectId                           AS Project_ID,















        p.Description                          AS Project_Description,















        pcs.component                          AS Project_Component_ID,















        pcs.componentname                      AS Project_Component_Description,















        pcs.pc_cost                            AS Project_Component_Cost,















        SUM(pcs.pc_cost) OVER (PARTITION BY p.Id) AS Project_Cost,















        infra.InfraName                     AS Infra_Type,















        --sow.InfraType                          AS Infra_Type,















        prog.StartYear                        AS Infra_Year,















        sow.Description                 AS Type_of_Work,















        sow.Measure                            AS Unit_of_Measure,















        x.target_amount                        AS Physical_Target,















        NULL                                    AS Dominant,















        x.dsow                                  AS Detail_Scope_of_Work,















        p.AlternateId                           AS Alternate_ID,















        ou.Name                                  AS Operating_Unit,















        p.ImplementingOffice                     AS io_code,















        io.Name                                  AS Implementing_Office,















        x.infra_id                               AS Infra_ID,















        x.start_chainage                         AS Start_Chainage,















        x.end_chainage                           AS End_Chainage,















        x.length                                 AS Length,















        x.start_station_limit                    AS Start_Station_Limit,















        x.end_station_limit                      AS End_Station_Limit,















        x.start_x                                AS Start_X,















        x.start_y                                AS Start_Y,















        x.end_x                                  AS End_X,















        x.end_y                                  AS End_Y































    FROM dbo.[tProjectRevisions] p































    JOIN dbo.[tPrograms] prog















        ON  prog.ProgramPK = p.ProgramFK















        --AND p.ProgramId    = @programid















        AND p.IsDeleted    = 0















        AND p.ProgramId IN (SELECT TRIM(value)















                            FROM STRING_SPLIT(@programid, ','))















        AND (ISNULL(@rocode, '') = '' OR p.Region = @rocode)















        AND (ISNULL(@deocode, '')  = '' OR p.DEO                 = @deocode)















        AND (ISNULL(@io_code, '')  = '' OR p.ImplementingOffice   = @io_code)































    JOIN LatestProgRev prog_rev















        ON  prog_rev.ProgramFK = p.ProgramFK AND prog_rev.rn = 1































    LEFT JOIN dbo.[vAdminDEO] deo















        ON  deo.ParticipantId = p.DEO































    JOIN dbo.[tOptionProjectCategory] cat















        ON  cat.CategoryId = p.Category















        AND (ISNULL(@categoryid, 0) <= 0 OR cat.CategoryId       = @categoryid)































    LEFT JOIN dbo.[tOptionProjectThrustList] PAP















        ON  PAP.PAPKey = p.Thrust































    LEFT JOIN pcs















        ON  pcs.ProjectRevisionFK = p.Id






























    LEFT JOIN x















        ON  x.ComponentCostFK = pcs.ComponentCostId































    LEFT JOIN dbo.[tOptionScopeOfWork] sow















        ON  sow.Enum = x.WorkTypeFK































    LEFT JOIN dbo.[tOptionInfraType] infra















        ON infra.InfraCode = x.InfraTypeFK















    --OUTER APPLY















    --(















    --    SELECT STRING_AGG(it.InfraName, ', ') AS InfraNames















    --    FROM OPENJSON(sow.InfraType) j















    --    JOIN dbo.[tOptionInfraType] it















    --        ON it.InfraCode = j.value















    --) infra































    LEFT JOIN dbo.[vAdminImplementingOffice] io















        ON  io.ParticipantId = p.ImplementingOffice































    LEFT JOIN dbo.[vAdminOperatingUnit] ou















        ON  ou.ParticipantId = p.OperatingUnit































    LEFT JOIN dbo.[tOptionAdminAreaCongressionalDistrict] ld















        ON  ld.Code = p.LegislativeDistrict































    LEFT JOIN dbo.[tOptionAdminAreaCityMunicipality] cm















        ON  cm.Code = p.City































    LEFT JOIN dbo.[tOptionProjectOrigin] po















        ON po.NameId = p.Origin































    --LEFT JOIN dbo.[tOptionAdminAreaRegion] ar















    --    ON ar.ParticipantId = p.Region































    --WHERE















        --p.ProgramId = @programid















        --AND (ISNULL(@rocode, '') = '' OR p.Region = @rocode)















        --AND (ISNULL(@deocode, '')  = '' OR p.DEO                 = @deocode)















        --AND (ISNULL(@io_code, '')  = '' OR p.ImplementingOffice   = @io_code)















        --AND (ISNULL(@categoryid, 0) <= 0 OR cat.CategoryId       = @categoryid)































    ORDER BY deo.RegionName, deo.Name, p.ProjectId, pcs.component;































END
GO

CREATE OR ALTER VIEW dbo.MYPS_vw_rptRBPSummary



AS



    SELECT



        --y.ProgramId,



        y.DEO,



        y.Legislative_District,



        y.RO,



        SUM(y.noProj001)  AS noProj001,



        SUM(y.Amount001)  AS Amount001,



        SUM(y.noProj002)  AS noProj002,



        SUM(y.Amount002)  AS Amount002,



        SUM(y.noProjCSSP) AS noProjCSSP,



        SUM(y.AmountCSSP) AS AmountCSSP,



        SUM(y.noProjLP)   AS noProjLP,



        SUM(y.AmountLP)   AS AmountLP,



        SUM(y.noProj001 + y.noProj002 + y.noProjCSSP + y.noProjLP)   AS TotalNo,



        SUM(y.Amount001 + y.Amount002 + y.AmountCSSP + y.AmountLP)  AS TotalAmount,



        y.tier



    FROM



        (



        -- -- 16 - OO1: Ensure Safe and Reliable National Road System -----------------------------------------------------------



        SELECT xx.ProgramId, xx.DEO, xx.Legislative_District, xx.RO,



            COUNT(xx.Project_Id) AS noProj001, SUM(xx.Component_Cost) AS Amount001,



            0 AS noProj002,   0 AS Amount002,



            0 AS noProjCSSP,  0 AS AmountCSSP,



            0 AS noProjLP,    0 AS AmountLP, xx.tier



        FROM (



            SELECT DISTINCT x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO,



                        SUM(x.Component_Cost) AS Component_Cost, x.tier



            FROM (



                SELECT



                pr.ProgramId                            AS ProgramId,



                pr.ProjectId                            AS Project_Id,



                cc.ComponentId                          AS Activity_Component_Id,



                ISNULL(deo.Name,  pr.DEO)               AS DEO,



                ISNULL(ld.Name,   pr.LegislativeDistrict) AS Legislative_District,



                ISNULL(ar.Name, pr.Region)                     AS RO,



                cc.Total                                AS Component_Cost,



                pt.Name                                 AS tier



                --cat.CategoryName                        AS Project_Category



                FROM dbo.tProjectRevisions      pr



                INNER JOIN dbo.tProjectComponentCost cc



                    ON  cc.ProjectRevisionFK = pr.Id



                    AND cc.IsDeleted         = 0



                INNER JOIN dbo.tProgramStages ps



                    ON ps.ProgramFK = pr.ProgramFK AND ps.StageName = 'RBP'



                    --ps.StageName = 'RBP'



                --INNER JOIN dbo.tOptionProjectCategory cat



                --    ON  cat.CategoryId = pr.Category



                LEFT JOIN dbo.vAdminDEO deo



                    ON  deo.ParticipantId = pr.DEO



                LEFT JOIN dbo.tOptionAdminAreaCongressionalDistrict ld



                    ON  ld.Id = pr.LegislativeDistrict



                LEFT JOIN dbo.[tOptionAdminAreaRegion] ar



                    ON  ar.ParticipantId = pr.Region



                LEFT JOIN dbo.[tOptionProjectTier] pt



                    ON  pt.NameId = pr.Tier







                WHERE pr.IsDeleted = 0 AND



                    pr.Category = 16







                --SELECT DISTINCT x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO,



                --    SUM(x.Component_Cost) AS Component_Cost



                --FROM (



                --    SELECT DISTINCT ProgramId, Project_Id, Activity_Component_Id,



                --        DEO, Legislative_District, RO, Component_Cost



                --    FROM dbo.vw_RBPBaseTable



                --    WHERE Project_Category LIKE 'OO1%'



            ) x



            GROUP BY x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO, x.tier



        ) xx



        GROUP BY xx.ProgramId, xx.DEO, xx.Legislative_District, xx.RO, xx.tier







        UNION ALL







        -- -- 17 - OO2: Protect Lives and Properties Against Major Floods -----------------------------------------------------------



   SELECT xx.ProgramId, xx.DEO, xx.Legislative_District, xx.RO,



            0, 0,



            COUNT(xx.Project_Id) AS noProj002, SUM(xx.Component_Cost) AS Amount002,



            0, 0, 0, 0, xx.tier



        FROM (



 SELECT DISTINCT x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO,



                        SUM(x.Component_Cost) AS Component_Cost, x.tier



            FROM (



                SELECT



                pr.ProgramId                            AS ProgramId,



                pr.ProjectId                            AS Project_Id,



                cc.ComponentId                          AS Activity_Component_Id,



                ISNULL(deo.Name,  pr.DEO)               AS DEO,



                ISNULL(ld.Name,   pr.LegislativeDistrict) AS Legislative_District,



                ISNULL(ar.Name, pr.Region)                     AS RO,



                cc.Total                                AS Component_Cost,



                pt.Name                                 AS tier



                --cat.CategoryName                        AS Project_Category



                FROM dbo.tProjectRevisions      pr



                INNER JOIN dbo.tProjectComponentCost cc



                    ON  cc.ProjectRevisionFK = pr.Id



                    AND cc.IsDeleted         = 0



                INNER JOIN dbo.tProgramStages ps



                    ON ps.ProgramFK = pr.ProgramFK AND



                    ps.StageName = 'RBP'



                --INNER JOIN dbo.tOptionProjectCategory cat



                --    ON  cat.CategoryId = pr.Category



                LEFT JOIN dbo.vAdminDEO deo



                    ON  deo.ParticipantId = pr.DEO



                LEFT JOIN dbo.tOptionAdminAreaCongressionalDistrict ld



                    ON  ld.Id = pr.LegislativeDistrict



                LEFT JOIN dbo.[tOptionAdminAreaRegion] ar



                    ON  ar.ParticipantId = pr.Region



                LEFT JOIN dbo.[tOptionProjectTier] pt



                    ON  pt.NameId = pr.Tier







                WHERE pr.IsDeleted = 0 AND



                    pr.Category = 17







            --SELECT DISTINCT x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO,



            --    SUM(x.Component_Cost) AS Component_Cost



            --FROM (



            --    SELECT DISTINCT ProgramId, Project_Id, Activity_Component_Id,



            --        DEO, Legislative_District, RO, Component_Cost



            --    FROM dbo.vw_RBPBaseTable



            --    WHERE Project_Category LIKE 'OO2%'



            ) x



            GROUP BY x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO, x.tier



        ) xx



        GROUP BY xx.ProgramId, xx.DEO, xx.Legislative_District, xx.RO, xx.tier







        UNION ALL







        -- -- 18 - Convergence and Special Support Program -----------------------------------------------------------



        SELECT xx.ProgramId, xx.DEO, xx.Legislative_District, xx.RO,



            0, 0, 0, 0,



            COUNT(xx.Project_Id) AS noProjCSSP, SUM(xx.Component_Cost) AS AmountCSSP,



            0, 0, xx.tier



        FROM (



            SELECT DISTINCT x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO,



                        SUM(x.Component_Cost) AS Component_Cost, x.tier



            FROM (



                SELECT



                pr.ProgramId                            AS ProgramId,



                pr.ProjectId                            AS Project_Id,



                cc.ComponentId                          AS Activity_Component_Id,



                ISNULL(deo.Name,  pr.DEO)               AS DEO,



                ISNULL(ld.Name,   pr.LegislativeDistrict) AS Legislative_District,



                ISNULL(ar.Name, pr.Region)              AS RO,



                cc.Total                                AS Component_Cost,



                pt.Name   AS tier



                --cat.CategoryName                        AS Project_Category



                FROM dbo.tProjectRevisions      pr



                INNER JOIN dbo.tProjectComponentCost cc



                    ON  cc.ProjectRevisionFK = pr.Id



                    AND cc.IsDeleted         = 0



                INNER JOIN dbo.tProgramStages ps



                    ON ps.ProgramFK = pr.ProgramFK AND



                    ps.StageName = 'RBP'



                --INNER JOIN dbo.tOptionProjectCategory cat



                --    ON  cat.CategoryId = pr.Category



                LEFT JOIN dbo.vAdminDEO deo



                    ON  deo.ParticipantId = pr.DEO



                LEFT JOIN dbo.tOptionAdminAreaCongressionalDistrict ld



                    ON  ld.Id = pr.LegislativeDistrict



                LEFT JOIN dbo.[tOptionAdminAreaRegion] ar



                    ON  ar.ParticipantId = pr.Region



                LEFT JOIN dbo.[tOptionProjectTier] pt



                    ON  pt.NameId = pr.Tier







                WHERE pr.IsDeleted = 0 AND



                    pr.Category = 18







                --SELECT DISTINCT x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO,



                --    SUM(x.Component_Cost) AS Component_Cost



                --FROM (



                --    SELECT DISTINCT ProgramId, Project_Id, Activity_Component_Id,



                --        DEO, Legislative_District, RO, Component_Cost



                --    FROM dbo.vw_RBPBaseTable



                --    WHERE Project_Category = 'Convergence and Special Support Program'



            ) x



            GROUP BY x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO, x.tier



        ) xx



        GROUP BY xx.ProgramId, xx.DEO, xx.Legislative_District, xx.RO, xx.tier







        UNION ALL







        -- -- 19 - Local Program                -----------------------------------------------------------



        SELECT xx.ProgramId, xx.DEO, xx.Legislative_District, xx.RO,



            0, 0, 0, 0, 0, 0,



            COUNT(xx.Project_Id) AS noProjLP, SUM(xx.Component_Cost) AS AmountLP, xx.tier



        FROM (



            SELECT DISTINCT x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO,



                SUM(x.Component_Cost) AS Component_Cost, x.tier



            FROM (



                SELECT



                pr.ProgramId                            AS ProgramId,



                pr.ProjectId                            AS Project_Id,



                cc.ComponentId                          AS Activity_Component_Id,



                ISNULL(deo.Name,  pr.DEO)               AS DEO,



                ISNULL(ld.Name,   pr.LegislativeDistrict) AS Legislative_District,



                ISNULL(ar.Name, pr.Region)              AS RO,



                cc.Total                                AS Component_Cost,



                pt.Name                                 AS tier



                --cat.CategoryName                        AS Project_Category



                FROM dbo.tProjectRevisions      pr



                INNER JOIN dbo.tProjectComponentCost cc



                    ON  cc.ProjectRevisionFK = pr.Id



                    AND cc.IsDeleted         = 0



                INNER JOIN dbo.tProgramStages ps



                    ON ps.ProgramFK = pr.ProgramFK AND



                    ps.StageName = 'RBP'



                --INNER JOIN dbo.tOptionProjectCategory cat



                --    ON  cat.CategoryId = pr.Category



                LEFT JOIN dbo.vAdminDEO deo



                    ON  deo.ParticipantId = pr.DEO



                LEFT JOIN dbo.tOptionAdminAreaCongressionalDistrict ld



                    ON  ld.Id = pr.LegislativeDistrict



                LEFT JOIN dbo.[tOptionAdminAreaRegion] ar



                    ON  ar.ParticipantId = pr.Region



                LEFT JOIN dbo.[tOptionProjectTier] pt



              ON  pt.NameId = pr.Tier







                WHERE pr.IsDeleted = 0 AND



                    pr.Category = 19







                --SELECT DISTINCT ProgramId, Project_Id, Activity_Component_Id,



                --    DEO, Legislative_District, RO, Component_Cost



                --FROM dbo.vw_RBPBaseTable



                --WHERE Project_Category = 'Local Program'



            ) x



            GROUP BY x.ProgramId, x.Project_Id, x.DEO, x.Legislative_District, x.RO, x.tier



        ) xx



        GROUP BY xx.ProgramId, xx.DEO, xx.Legislative_District, xx.RO, xx.tier







    ) y



    GROUP BY y.DEO, y.Legislative_District, y.RO, y.tier;



    --GROUP BY y.ProgramId, y.DEO, y.Legislative_District, y.RO;
GO

CREATE OR ALTER VIEW [dbo].[MYPS_vw_rptRBPSummaryTier]







AS







    WITH RBPBase AS (







        SELECT







            pr.ProgramId                                          AS ProgramId,







            pr.ProjectId                                          AS Project_Id,







            cc.Id                                                 AS Activity_Component_Id,







            ISNULL(deo.Name,  pr.DEO)                             AS DEO,







            ISNULL(ld.Name,   pr.LegislativeDistrict)             AS Legislative_District,







            ISNULL(ar.Name,   pr.Region)                          AS RO,







            --ISNULL(deo.RegionName, '')                            AS RO,







            cc.Total                                              AS Component_Cost,







            cat.CategoryName                                      AS Project_Category,







            ISNULL(tier.Name, CAST(pr.Tier AS NVARCHAR(50)))      AS tier,







            pr.Category 										  AS CategoryId







        FROM dbo.tProjectRevisions pr







        INNER JOIN dbo.tProjectComponentCost cc







            ON  cc.ProjectRevisionFK = pr.Id







            AND cc.IsDeleted         = 0







        INNER JOIN dbo.tProgramStages ps







            ON ps.ProgramFK = pr.ProgramFK AND







            ps.StageName = 'RBP'







        INNER JOIN dbo.tOptionProjectCategory cat







            ON  cat.CategoryId = pr.Category







        LEFT JOIN dbo.tOptionProjectTier tier







            ON  tier.NameId = pr.Tier







        LEFT JOIN dbo.vAdminDEO deo







            ON  deo.ParticipantId = pr.DEO







        LEFT JOIN dbo.tOptionAdminAreaCongressionalDistrict ld







            ON  ld.Id = pr.LegislativeDistrict







        LEFT JOIN dbo.[tOptionAdminAreaRegion] ar







            ON  ar.ParticipantId = pr.Region







        WHERE pr.IsDeleted = 0







    ),















    -- -- Per-project cost aggregated by category + tier ---------------------







    ProjectCostByCategoryTier AS (







        SELECT DISTINCT







            ProgramId,







            Project_Id,







            DEO,







            Legislative_District,







            RO,







            tier,







            Project_Category,







            CategoryId,







            SUM(Component_Cost) OVER (







                PARTITION BY Project_Id, DEO, Legislative_District, RO, tier, Project_Category, CategoryId







            ) AS Component_Cost







        FROM RBPBase







    ),















    -- -- Distinct DEO + LD + RO + Tier combinations (base join set) ---------







    BaseDistinct AS (







        SELECT DISTINCT







            ProgramId,







            DEO,







            Legislative_District,







            RO,







            tier







        FROM RBPBase

        WHERE CategoryId IN (16,17,18,19,29,30)







    ),















    -- -- 16 - OO1: Ensure Safe and Reliable National Road System -----------------------------------------------------------







    OO1 AS (







        SELECT







            ProgramId,







            DEO,







            Legislative_District,







            RO,







            tier,







            COUNT(DISTINCT Project_Id) AS noProj001,







            SUM(Component_Cost)        AS Amount001







        FROM ProjectCostByCategoryTier







        WHERE CategoryId = 16







        GROUP BY ProgramId, DEO, Legislative_District, RO, tier







    ),















    -- -- 17 - OO2: Protect Lives and Properties Against Major Floods -----------------------------------------------------------







    OO2 AS (







        SELECT







            ProgramId,







            DEO,







            Legislative_District,







            RO,







            tier,







            COUNT(DISTINCT Project_Id) AS noProj002,







            SUM(Component_Cost)        AS Amount002







        FROM ProjectCostByCategoryTier







        WHERE CategoryId = 17







        GROUP BY ProgramId, DEO, Legislative_District, RO, tier







    ),















    -- -- 18 - Convergence and Special Support Program -----------------------------------------------------------







    CSSP AS (







        SELECT







  ProgramId,







            DEO,







            Legislative_District,







            RO,







            tier,







            COUNT(DISTINCT Project_Id) AS noProjCSSP,







            SUM(Component_Cost)        AS AmountCSSP







        FROM ProjectCostByCategoryTier







        WHERE CategoryId = 18







        GROUP BY ProgramId, DEO, Legislative_District, RO, tier







    ),















    -- -- 19 - Local Program                    -----------------------------------------------------------







    LP AS (







        SELECT







            ProgramId,







            DEO,







            Legislative_District,







            RO,







            tier,







            COUNT(DISTINCT Project_Id) AS noProjLP,







            SUM(Component_Cost)        AS AmountLP







        FROM ProjectCostByCategoryTier







        WHERE CategoryId = 19







        GROUP BY ProgramId, DEO, Legislative_District, RO, tier







    )















    -- -- Final � LEFT JOIN each category onto the base distinct set ---------







    SELECT DISTINCT







        --r.ProgramId,







        r.DEO,







        r.Legislative_District,







        r.RO,







        ISNULL(a.noProj001,  0) AS noProj001,







        ISNULL(a.Amount001,  0) AS Amount001,







        ISNULL(b.noProj002,  0) AS noProj002,







        ISNULL(b.Amount002,  0) AS Amount002,







        ISNULL(c.noProjCSSP, 0) AS noProjCSSP,







        ISNULL(c.AmountCSSP, 0) AS AmountCSSP,







        ISNULL(d.noProjLP,   0) AS noProjLP,







        ISNULL(d.AmountLP,   0) AS AmountLP,







        r.tier







    FROM BaseDistinct r







    LEFT JOIN OO1  a ON a.ProgramId = r.ProgramId AND a.tier = r.tier AND a.DEO = r.DEO AND a.Legislative_District = r.Legislative_District







    LEFT JOIN OO2  b ON b.ProgramId = r.ProgramId AND b.tier = r.tier AND b.DEO = r.DEO AND b.Legislative_District = r.Legislative_District







    LEFT JOIN CSSP c ON c.ProgramId = r.ProgramId AND c.tier = r.tier AND c.DEO = r.DEO AND c.Legislative_District = r.Legislative_District







    LEFT JOIN LP   d ON d.ProgramId = r.ProgramId AND d.tier = r.tier AND d.DEO = r.DEO AND d.Legislative_District = r.Legislative_District;
GO
