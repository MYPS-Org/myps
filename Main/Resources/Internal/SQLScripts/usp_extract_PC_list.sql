/*
    usp_extract_PC_list -- new Crystal Report stored proc for myps_db_dev2.

    Purpose: backs a new "extract PC list" Crystal Report (Field Explorer / layout supplied by
    the operator) that needs the plain per-project-component list -- Program/Region/DEO/
    Legislative District/City/Category/Thrust/Origin/Regionwide plus one row per project
    component (Project_Component_ID/Description/Cost, UACS, start/end date) and Project_Cost as
    the per-project total. No major-work-item (infra/physical-target/chainage/etc.) fields --
    those are specific to the sibling report usp_extract_PC_MIOW_list.

    Modeled directly on dbo.usp_extract_PC_MIOW_list (same database, same parameter contract:
    @programid comma-separated list via STRING_SPLIT, @rocode/@deocode/@io_code/@categoryid as
    optional equality filters -- empty/<=0 means "no filter"). Reused as-is:
      - The LatestProgRev CTE (ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id DESC) AS rn,
        joined with rn = 1) to dedupe tProgramRevisions -- confirmed live on myps_db_dev2 that
        ProgramFK fans out up to 6 rows in tProgramRevisions, so this is required, not optional
        hardening; the currently-live usp_extract_PC_MIOW_list on this same database does NOT
        have this fix applied yet (it's an older deployment than the one committed in this
        file's sibling Reports.CrystalReportSQLFixes.sql), so this proc is built from the
        already-fixed version, not copied from what's live.
      - The pcs CTE (tProjectComponentCost + tProjectComponentCostPerYear rollup) unchanged,
        including pmsid/start_date/end_date -- which usp_extract_PC_MIOW_list computes but
        never selects. This proc selects them as UACS/Project_Start_Date/Project_End_Date,
        since the target report's Field Explorer lists those columns explicitly.
      - Project_Cost as SUM(pcs.pc_cost) OVER (PARTITION BY p.Id), same per-project-total
        pattern as the MIOW proc.

    New vs. usp_extract_PC_MIOW_list:
      - Added Regionwide: LEFT JOIN dbo.tOptionRegionWide rw ON rw.NameId = p.RegionWide
        (tProjectRevisions.RegionWide is a required int FK to this lookup's NameId).
      - Dropped the x (tProjectMajorWorkItem/tProjectMajorWorkLocations) CTE and every column
        derived from it (Infra_Type, Infra_Year, Type_of_Work, Unit_of_Measure, Physical_Target,
        Dominant, Detail_Scope_of_Work, Infra_ID, chainage/station-limit/X-Y columns) -- none of
        these appear in the target report's Field Explorer.

    Deployment: CREATE OR ALTER, no dependency on any other object in this folder. Verified live
    against myps_db_dev2 (all referenced tables/views/columns confirmed present via
    INFORMATION_SCHEMA before writing this script) and test-executed with a real @programid
    before being left in place.
*/
CREATE OR ALTER PROCEDURE [dbo].[usp_extract_PC_list]
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

    ;WITH LatestProgRev AS
    (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id DESC) AS rn
        FROM dbo.tProgramRevisions
    ),
    pcs AS
    (
        SELECT
            pcc.Id                   AS ComponentCostId,
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
    )
    SELECT DISTINCT
        p.ProgramId                               AS programid,
        prog_rev.Name                              AS Program,
        deo.RegionName                             AS Region,
        p.Region                                   AS rocode,
        deo.Name                                   AS District_Engineering_Office,
        p.DEO                                      AS deocode,
        ld.Name                                     AS Legislative_District,
        cm.Name                                     AS City_Municipality,
        cat.CategoryName                            AS Category,
        cat.CategoryId                              AS categoryid,
        PAP.ThrustDescription                       AS Thrust,
        po.Name                                     AS Project_Origin,
        rw.Name                                     AS Regionwide,
        p.ProjectId                                 AS Project_ID,
        p.Description                               AS Project_Description,
        pcs.component                               AS Project_Component_ID,
        pcs.componentname                           AS Project_Component_Description,
        pcs.pc_cost                                 AS Project_Component_Cost,
        SUM(pcs.pc_cost) OVER (PARTITION BY p.Id)   AS Project_Cost,
        pcs.pmsid                                   AS UACS,
        pcs.start_date                              AS Project_Start_Date,
        pcs.end_date                                AS Project_End_Date,
        p.AlternateId                               AS Alternate_ID,
        ou.Name                                     AS Operating_Unit,
        p.ImplementingOffice                        AS io_code,
        io.Name                                     AS Implementing_Office

    FROM dbo.[tProjectRevisions] p

    JOIN dbo.[tPrograms] prog
        ON  prog.ProgramPK = p.ProgramFK
        AND p.IsDeleted    = 0
        AND p.ProgramId IN (SELECT TRIM(value)
                            FROM STRING_SPLIT(@programid, ','))
        AND (ISNULL(@rocode, '')  = '' OR p.Region             = @rocode)
        AND (ISNULL(@deocode, '') = '' OR p.DEO                = @deocode)
        AND (ISNULL(@io_code, '') = '' OR p.ImplementingOffice = @io_code)

    JOIN LatestProgRev prog_rev
        ON  prog_rev.ProgramFK = p.ProgramFK AND prog_rev.rn = 1

    LEFT JOIN dbo.[vAdminDEO] deo
        ON  deo.ParticipantId = p.DEO

    JOIN dbo.[tOptionProjectCategory] cat
        ON  cat.CategoryId = p.Category
        AND (ISNULL(@categoryid, 0) <= 0 OR cat.CategoryId = @categoryid)

    LEFT JOIN dbo.[tOptionProjectThrustList] PAP
        ON  PAP.PAPKey = p.Thrust

    LEFT JOIN dbo.[tOptionRegionWide] rw
        ON  rw.NameId = p.RegionWide

    LEFT JOIN pcs
        ON  pcs.ProjectRevisionFK = p.Id

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

    ORDER BY deo.RegionName, deo.Name, p.ProjectId, pcs.component;
END
GO
