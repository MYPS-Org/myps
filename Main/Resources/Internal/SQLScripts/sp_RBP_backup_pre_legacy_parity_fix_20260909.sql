CREATE   PROCEDURE [dbo].[sp_RBP]



(



    @yearstart  INT,



    @programid  VARCHAR(MAX) = NULL,



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









