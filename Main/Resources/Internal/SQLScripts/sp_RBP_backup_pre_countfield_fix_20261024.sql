/*
    sp_RBP -- current definition, backing the "rbp" (plain RBP) Crystal Report.

    This is the first non-"_backup_" checkpoint for this proc. Captured live via
    sp_helptext 'sp_RBP' against myps_db_dev3 on 2026-10-24, after resolving a long-standing
    local Crystal export failure on this report ("The system cannot find the path specified"
    from ReportSourceClass.Export).

    Root cause (confirmed via bisection against the GAC-deployed RBP.rpt): Target_Amount was
    sourced from tProjectMajorWorkLocations.PhysicalTarget (float, nullable). RBP.rpt's cached
    field schema expects Target_Amount as decimal(18,5) NOT NULL (matching
    tProjectComponentCostPerYear.Amount's actual type) -- a resultset column that differs in
    either SQL type or nullability from that cached OLE DB binding makes Crystal's export throw
    a generic path error instead of a type error. Confirmed by bisection: a bare CAST to
    decimal(18,5) (type-only fix, still nullable) still failed; adding ISNULL to also force
    NOT NULL is what fixed it. Kept PhysicalTarget as the actual data source throughout --
    Target_Amount is a physical target quantity, not a cost figure, and swapping to pccpy.Amount
    would reintroduce a #424-class data bug -- only its SQL type/nullability needed to change,
    not its source.

    Also removed NVARCHAR(n) length-bounding CASTs on Project_Description/componentname/dsow
    that a prior "legacy parity" change (see sp_RBP_backup_pre_legacy_parity_fix_20260909.sql)
    had added -- unbounded was the state before that change and is kept here since the
    bisection confirmed the real export blocker was the Target_Amount type, not these casts.

    Deployment note: there is no migration runner that applies scripts in this folder
    automatically -- this must be run by hand against each target database (myps_db_dev3 locally,
    then myps_db_dev / UAT) before the fix takes effect there.
*/

CREATE OR ALTER PROCEDURE [dbo].[sp_RBP]
(
    @yearstart  INT,
    @programid  VARCHAR(300) = NULL,
    @region     VARCHAR(50)  = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH LatestProgRev AS
    (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id DESC) AS rn
        FROM dbo.tProgramRevisions
    ),
    LatestProgStage AS
    (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id DESC) AS rn
        FROM dbo.tProgramStages
    ),
    x AS
    (
        SELECT
            progrev.Name                AS Program_Description,
            cat.CategoryName             AS Project_Category,
            RTRIM(p.ProjectId)           AS Project_Id,
            ar.Name                      AS RO,
            deo.Name                     AS DEO,
            p.Description                AS Project_Description,
            ou.Name                      AS Operating_Unit,
            io.Name                      AS Implementing_Office,
            ld.Name                      AS Legislative_District,
            pcc.ComponentId              AS Component_Id,
            pcc.Total                    AS Component_Cost,
            PAP.ThrustDescription        AS Thrust,
            pcc.ComponentId              AS Activity_Component_Id,
            pccpy.UACS                   AS UACS_PAP_Code,
            sow.Description              AS Type_Of_Work,
            sow.Measure                  AS Target_Unit,
            ISNULL(CAST(pmwl.PhysicalTarget AS DECIMAL(18,5)), 0) AS Target_Amount,
            ops.Description              AS stage_desc,
            rw.Name                      AS rw_flag,
            p.ProjectId                  AS projectid,
            p.ProgramId                  AS programid,
            prog.StartYear               AS yearstart,
            p.MYCAApprovalDate           AS date_of_approval,
            pcc.Description              AS componentname,
            pmwl.DetailedScope           AS dsow,
            pmwl.StartStationLimit       AS start_station_limit,
            pmwl.EndStationLimit         AS end_station_limit,
            pmwl.Length                  AS activity_length,
            pt.Name                      AS tier,
            PAP.SequenceNumber           AS Seq_no,
            p.Rank                       AS rank
        FROM dbo.[tProjectRevisions] p
        JOIN dbo.[tPrograms] prog
            ON  prog.ProgramPK  = p.ProgramFK
            AND prog.StartYear  = @yearstart
            AND p.ProgramId IN (SELECT TRIM(value) FROM STRING_SPLIT(@programid, ','))
            AND RIGHT(p.ProjectId, 2) <> 'NP'
            AND p.IsDeleted     = 0
            AND (@region IS NULL OR p.Region = @region)
        JOIN LatestProgRev progrev
            ON  progrev.ProgramFK = p.ProgramFK AND progrev.rn = 1
        JOIN dbo.[tProjectComponentCost] pcc
            ON  pcc.ProjectRevisionFK = p.Id
            AND pcc.IsDeleted         = 0
        JOIN dbo.[tProjectComponentCostPerYear] pccpy
            ON  pccpy.ComponentCostFK = pcc.Id
            AND pccpy.IsDeleted       = 0
        JOIN dbo.[tProjectMajorWorkItem] pmwi
            ON  pmwi.ComponentCostFK = pcc.Id
            AND pmwi.IsDeleted       = 0
        JOIN dbo.[tProjectMajorWorkLocations] pmwl
            ON  pmwl.WorkItemFK = pmwi.Id
            AND pmwl.IsDeleted  = 0
        JOIN dbo.[tOptionScopeOfWork] sow
            ON  sow.Enum = pmwi.WorkTypeFK
        LEFT JOIN dbo.[vAdminDEO] deo
            ON  deo.ParticipantId = p.DEO
        JOIN dbo.[tOptionProjectCategory] cat
            ON  cat.CategoryId = p.Category
        JOIN LatestProgStage progstage
            ON  progstage.ProgramFK = prog.ProgramPK AND progstage.rn = 1
        JOIN dbo.[tOptionProgramStage] ops
            ON  ops.NameId = progstage.StageId
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
    ),
    xd AS
    (
        SELECT DISTINCT
            x.Program_Description, x.Project_Category, x.Project_Id, x.RO, x.DEO,
            x.Project_Description,
            x.Operating_Unit, x.Implementing_Office, x.Legislative_District,
            x.Component_Id, x.Component_Cost, x.Thrust, x.Activity_Component_Id,
            x.UACS_PAP_Code, x.Type_Of_Work, x.Target_Unit, x.Target_Amount,
            x.stage_desc, x.rw_flag, x.projectid, x.programid, x.yearstart,
            x.date_of_approval,
            x.componentname,
            x.dsow,
            x.start_station_limit, x.end_station_limit, x.activity_length,
            x.tier, x.Seq_no, ISNULL(x.rank, 99.9) AS rank
        FROM x
        WHERE x.programid IS NOT NULL
    ),
    ranked AS
    (
        SELECT
            xd.*,
            COUNT(xd.Target_Amount) OVER (PARTITION BY xd.Project_Id, xd.Component_Id) AS CountField,
            ROW_NUMBER() OVER (PARTITION BY xd.Project_Id, xd.Component_Id ORDER BY (SELECT NULL)) AS rn
        FROM xd
    )
    SELECT
        Program_Description, Project_Category, Project_Id, RO, DEO, Project_Description,
        Operating_Unit, Implementing_Office, Legislative_District, Component_Id,
        Component_Cost, Thrust, Activity_Component_Id, UACS_PAP_Code, Type_Of_Work,
        Target_Unit, Target_Amount, stage_desc, rw_flag, projectid, programid,
        yearstart, date_of_approval, componentname, dsow, start_station_limit,
        end_station_limit, activity_length, tier, Seq_no, rank, CountField
    FROM ranked
    WHERE rn = 1
    ORDER BY Project_Id, Component_Id;
END
