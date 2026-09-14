from typing import Any, Sequence
from datetime import datetime

# region Target column mapping
#
# The loader writes its provenance columns as a triple — DataImportProgramId /
# DataImportProjectId / DataImportComponentId. That is the shape of myps_db_migrated, which
# this package's own migration_sql/data_import_ids.sql adds by hand.
#
# myps_db_dev_200 is the APPLICATION's database: EF maps a single nvarchar DataImportId on
# tPrograms, tProgramRevisions, tProgramStages, tProjects, tProjectRevisions, tProjectStages
# and tProjectFundingProfile, and the full triple only on the component, per-year and work
# tables. Renaming columns there to suit the loader (what migration_sql/import_id_rename.sql
# does for myps_db_migrated) would break the EF model, so the loader adapts instead.
#
# This map lives here, not in migration.py, because it is consumed from BOTH directions:
# migration.to_target maps a frame on the way IN, and the queries below READ these columns
# back off the target — build_project_stages_sql reads tProjectRevisions' provenance column
# to stamp the stage rows. One map, so the two can never disagree.
#
# None means "this target has no such column": the value is dropped on write and unavailable
# on read. The source stage programid is already carried in DataImportId.
TARGET_COLUMN_MAP = {
    "tPrograms":               {"DataImportProgramId": "DataImportId"},
    "tProgramRevisions":       {"DataImportProgramId": "DataImportId"},
    "tProgramStages":          {"DataImportProgramId": "DataImportId"},
    "tProjects":               {"DataImportProgramId": "DataImportId"},
    "tProjectRevisions":       {"DataImportProgramId": "DataImportId", "DataImportProjectId": None},
    "tProjectStages":          {"DataImportProgramId": "DataImportId", "DataImportProjectId": None},
    "tProjectFundingProfile":  {"DataImportProgramId": "DataImportId", "DataImportProjectId": None},
    # tProjectComponentCost, tProjectComponentCostPerYear, tProjectMajorWorkItem and
    # tProjectMajorWorkLocations carry the triple on both databases — deliberately absent, so
    # the work-location queries can keep joining on all three.
}


def target_column_name(table_name: str, loader_column: str) -> str | None:
    """What `loader_column` is called on the target's `table_name`.

    Returns the loader's own name for an unmapped table, the mapped name where the target
    renames it, and None where the target has no such column."""
    mapping = TARGET_COLUMN_MAP.get(table_name)
    if not mapping or loader_column not in mapping:
        return loader_column
    return mapping[loader_column]
# endregion Target column mapping


def _quoted_id_list(ids: Sequence[str]) -> str:
    return "', '".join(ids)

# region Program Migration
def _extract_suffix_from_program_id(program_id: str) -> str:
    """Derive the target-DB Program suffix from a source MYPS ProgramId, e.g. 'P_CO-PS-220_02272025_091315' -> 'MP_02272025_091315'."""
    tokens = program_id.split("_")
    return f"_{tokens[2]}_{tokens[3]}"

# region Program Queries
def build_program_sql(source_db_name: str, program_id: str, program_pk: str, is_deleted: int, is_skipped: int) -> str:
    return f"""SELECT
'{program_pk}' AS ProgramPK,
--p.programid AS ProgramId,
p.prog_type_id AS Type,
p.yearstart AS StartYear,
ISNULL(p.is_publish, 0) AS IsPublished,
{is_deleted} AS IsDeleted,
{is_skipped} AS IsSkipped,
NULL AS SkipReason,
p.userid AS CreatedBy,
p.datecreated AS CreatedDate,
'{program_id}' AS DataImportProgramId
FROM [{source_db_name}].dbo.program p WHERE p.programid = '{program_id}'
"""


#  tProgramRevisions.Cost is decimal(18,5): anything at or above 1e13 overflows the column
#  and fails the INSERT. See build_program_revisions_sql.
PROGRAM_COST_CEILING = 10000000000000


def build_program_revisions_sql(source_db_name: str, program_pk: str, program_ids: Sequence[str]) -> str:
    """One row per stage of a program group.

    COST FALLS BACK TO THE COST STREAM WHEN THE SOURCE FIGURE OVERFLOWS (2026-09-14).

    dbo.program.cost is a stored summary, and one program in MYPS_BAK is corrupt in it:
    'GAA 2023 CSSP as Approved' says 300,585,464,920,206 against a cost stream of
    389,179,466,579 — 772x its own projects, and 1,900x its sibling stages, which sit at
    153-155 billion. tProgramRevisions.Cost is decimal(18,5), so that value cannot be
    stored: the whole 2023 CSSP group failed to load on it, and with it 34 of the 57 Lump
    Sum parents.

    Where the source figure is at or above the column's ceiling, SUM(projectcoststream.cost)
    for that program is written instead. That is derived from the program's own rows rather
    than invented, and it is the same basis dbo.pRecomputeProgramCost uses when the
    application recomputes this column — which it does, so what lands here is a transient
    summary either way. CostOverflowed comes back beside it so the caller can report the
    substitution rather than make it quietly.

    Every other program is unaffected: this is the only row in MYPS_BAK above the ceiling."""
    return f"""SELECT
'{program_pk}' AS ProgramFK,
p.programid AS ProgramId,
p.usertype AS UserGroup,
p.region_code AS DataSecurityGroup,
p.name AS Name,
p.statusid AS Status,
CASE WHEN ABS(p.cost) >= {PROGRAM_COST_CEILING}
     THEN (SELECT COALESCE(SUM(cs.cost), 0)
           FROM [{source_db_name}].dbo.projectcoststream cs
           WHERE cs.programid = p.programid)
     ELSE p.cost
END AS Cost,
CASE WHEN ABS(p.cost) >= {PROGRAM_COST_CEILING} THEN 1 ELSE 0 END AS CostOverflowed,
p.cost AS SourceCost,
p.latest_revision_id AS PCMARevisionId,
p.userid AS CreatedBy,
p.datecreated AS CreatedDate,
p.programid AS DataImportProgramId
FROM [{source_db_name}].dbo.program p WHERE p.programid IN ('{_quoted_id_list(program_ids)}')
"""


def build_program_stages_sql(source_db_name: str, target_db_name: str, program_pk: str, program_ids: Sequence[str]) -> str:
    return f"""SELECT
  '{program_pk}' AS ProgramFk,
  p.programid AS ProgramId,
  pr.Id AS RevisionId,  -- Id of the Program Revision just created
  prg_stg.NameId AS StageId,
  p.stage_id AS StageName,
  p.userid AS CreatedBy,
  p.datecreated AS CreatedDate,
  p.programid AS DataImportProgramId
FROM [{source_db_name}].dbo.program p
INNER JOIN [{target_db_name}].dbo.tProgramRevisions pr ON pr.ProgramId = p.programid
INNER JOIN [{target_db_name}].dbo.tOptionProgramStage prg_stg ON prg_stg.Name = p.stage_id
WHERE p.programid IN ('{_quoted_id_list(program_ids)}')"""

# endregion Program Queries

# region Project, Revision, Stage Queries
def build_project_sql(source_db_name: str, program_id: str, program_pk: str, is_deleted: int) -> str:
    return f"""SELECT DISTINCT
'{program_pk}' AS ProgramFK,
prj.programid AS ProgramId,
'{program_pk}_'+prj.projectid AS ProjectPK,
NULL AS ProjectGroupFK,
NULL AS ProjectType,
prj.alternate_id AS AlternateId,
NULL AS MYId,
0 AS IsPublished,
0 AS IsPublishable,
0 AS IsRevised,
0 AS PCMARevisionCount,
NULL AS LockedBy,
NULL AS LockedDate,
prj.userid AS CreatedBy,
prj.datecreated AS CreatedDate,
prj.programid AS DataImportProgramId,
{is_deleted} AS IsDeleted
FROM [{source_db_name}].dbo.project prj 
INNER JOIN [{source_db_name}].dbo.program ON program.programid=prj.programid
WHERE prj.programid = '{program_id}'"""

def build_project_revisions_sql(source_db_name: str, target_db_name: str, program_id: str, program_pk: str, is_deleted: int) -> str:
    return f"""
WITH PrjLongtermAgg AS (
    SELECT
        lp.projectid,
        lp.programid,
        MAX(lp.feasibilitystudy)  AS feasibilitystudy,
        MAX(lp.feasibilitydate)   AS feasibilitydate,
        MAX(lp.designdate)        AS designdate,
        MAX(lp.detaileddesign)    AS detaileddesign,
        MAX(lp.rowavailable)      AS rowavailable
    FROM [{source_db_name}].dbo.longtermproject lp
    WHERE lp.programid = '{program_id}'
    GROUP BY lp.projectid, lp.programid
), PrjTierAgg AS (
    SELECT
        prj_tier.projectid,
        MAX(prj_tier.tier) AS tier
    FROM [{source_db_name}].dbo.projecttier prj_tier
    GROUP BY prj_tier.projectid
), PrjDesc AS (
    SELECT
        pd.projectid AS ProjectId,
        --TODO: Better handling, because text length may exceed nvarchar(max)
        MAX(cast(pd.[description]  as NVARCHAR(max))) AS [description]
    FROM [{source_db_name}].dbo.projectdescription pd
    WHERE pd.programid = '{program_id}'
    GROUP BY pd.projectid
)
SELECT DISTINCT
-- ProjectFK mirrors tProjects.ProjectPK: ProgramPK (constant across all stages of the
-- annual program group) + source projectid. The ProgramPK keeps the key unique per
-- Project x ProgramGroup x ProgramYear while grouping the same ProjectId across stages
-- (BP -> NEP -> GAA ...) under one FK.
'{program_pk}_'+prj.projectid AS ProjectFK,
'{program_pk}' AS ProgramFK,
'{program_id}' AS ProgramId,
prj.projectid AS ProjectId,
prj.alternate_id AS AlternateId,
NULL AS MYCAApprovalDate,
-- project name or description
CASE
    WHEN prj.name_extension  = NULL         THEN TRIM(prj.name)
    WHEN prj.name_extension  = ''           THEN TRIM(prj.name)
    WHEN prj.name_extension  = ' '          THEN TRIM(prj.name)
    ELSE TRIM(prj.name + prj.name_extension)
END AS Description_1,
PrjDesc.description AS Description_2,
-- admin areas
region.IslandCode AS IslandCode,
COALESCE(prov.RegionParticipantId, '') AS Region,
citymuni.ProvinceCode AS Province,
prj_office.cm_code AS City,
prj_office.ld_code AS LegislativeDistrict,
-- org units
COALESCE(prj_office.deo_code, '') AS DEO,
COALESCE(prj_office.ou_code, '') AS OperatingUnit,
COALESCE(prj_office.io_code, '')  AS ImplementingOffice,
-- category, thrust/PAP, origin, agency
COALESCE(prj.categoryid, '')  AS Category,
COALESCE(prj_thrust.thrustid, '') AS Thrust,
COALESCE(prj.originid, '') AS Origin,
COALESCE(prj.oa, '') AS Agency,
-- modes and codes
CASE
    WHEN prj.implementmode = 'by Administration'         THEN 1
    WHEN prj.implementmode = 'by Contract'               THEN 2
    WHEN prj.implementmode = 'by MOA'                    THEN 3
    WHEN prj.implementmode = 'By Negotiated Contract'    THEN 4
    ELSE NULL
END                    AS ImplementationMode,
CASE
    WHEN prj.emergencycode = 'YES' THEN 1
    ELSE 0
END                    AS EmergencyMode,
CASE
    WHEN prj.region_wide LIKE '%ignore%'          THEN 3
    WHEN prj.region_wide IN ('YES','Y','Regionwide') THEN 1
    ELSE 2
END                    AS RegionWide,
-- dbo.longtermproject
CASE PrjLongtermAgg.feasibilitystudy
    WHEN 'Yes'          THEN 1
    WHEN 'No'           THEN 2
    WHEN 'Not applicable' THEN 3
    WHEN 'To be Decided' THEN 4
    ELSE 2
END                    AS Feasibility,
PrjLongtermAgg.feasibilitydate AS FeasibilityDate,
CASE PrjLongtermAgg.detaileddesign
    WHEN 'Yes' THEN 1
    ELSE 0
END                    AS DetailedDesign,
PrjLongtermAgg.designdate AS DetailedDesignDate,
CASE PrjLongtermAgg.rowavailable
    WHEN 'Yes' THEN 1
    ELSE 0
END                    AS RowAvailable,
-- dbo.projectier and dbo.projectrank
CASE PrjTierAgg.tier
    WHEN 'Tier II' THEN 2
    ELSE 1
END                    AS Tier,
prj_rank.rank AS Rank,
prj.userid AS CreatedBy,
prj.datecreated AS CreatedDate,
{is_deleted} AS IsDeleted,
prj.userid AS UpdatedBy,
prj.datechanged AS UpdatedDate,

'{program_id}' AS DataImportProgramId,
prj.projectid AS DataImportProjectId

-- table joins: office, thrust, rank
FROM [{source_db_name}].dbo.project prj
INNER JOIN [{source_db_name}].dbo.program ON program.programid=prj.programid
LEFT JOIN [{source_db_name}].dbo.projectoffices prj_office
    ON  prj_office.projectid = prj.projectid
    AND prj_office.programid = '{program_id}'
LEFT JOIN [{source_db_name}].dbo.projectthrust prj_thrust
    ON  prj_thrust.projectid = prj.projectid
    AND prj_thrust.programid = '{program_id}'
LEFT JOIN [{source_db_name}].dbo.projectranking prj_rank
    ON  prj_rank.projectid = prj.projectid
    AND prj_rank.programid = '{program_id}'
-- aggregate table joins: tier, longterm, description
LEFT JOIN PrjTierAgg
    ON  PrjTierAgg.projectid = prj.projectid
LEFT JOIN PrjLongtermAgg
    ON  PrjLongtermAgg.projectid = prj.projectid
    AND PrjLongtermAgg.programid = '{program_id}'
LEFT JOIN PrjDesc
    ON  PrjDesc.projectid = prj.projectid
-- table joins: admin areas
LEFT JOIN [{target_db_name}].dbo.tOptionAdminAreaCityMunicipality citymuni
    ON  citymuni.Code = prj_office.cm_code
LEFT JOIN [{target_db_name}].dbo.tOptionAdminAreaCongressionalDistrict congdist
    ON  congdist.Code = prj_office.ld_code
LEFT JOIN [{target_db_name}].dbo.tOptionAdminAreaProvince prov
    ON  prov.Id = COALESCE(citymuni.ProvinceCode, congdist.ProvinceCode)
LEFT JOIN [{target_db_name}].dbo.tOptionAdminAreaRegion region
    ON  region.ParticipantId = prov.RegionParticipantId
WHERE prj.programid = '{program_id}'
"""


def build_project_stages_sql(target_db_name: str, program_id: str, stage_num: int, stage_name: str) -> str:
    """The stage rows for one program, read back off the revisions just written.

    NOTE the provenance column is resolved through target_column_name rather than named
    literally: this SELECTs from the TARGET, and on the application's database
    tProjectRevisions has DataImportId, not DataImportProgramId. Naming it literally is what
    made the first 2023 LP run fail with "Invalid column name 'DataImportProgramId'" after
    it had already written the program, its five revisions and 294 projects."""
    revision_import_column = target_column_name("tProjectRevisions", "DataImportProgramId")
    return f"""SELECT DISTINCT
        p_rev.ProjectFK AS ProjectFK,
        p_rev.ProgramFK AS ProgramFK,
        p_rev.ProgramId AS ProgramId,
        p_rev.Id AS RevisionId,
        {stage_num} AS StageId,
        '{stage_name}' AS StageName,
        p_rev.CreatedBy AS CreatedBy,
        p_rev.CreatedDate AS CreatedDate,

        p_rev.{revision_import_column} AS DataImportProgramId,
        p_rev.ProjectId AS DataImportProjectId

    FROM [{target_db_name}].[dbo].tProjectRevisions p_rev
    LEFT JOIN [{target_db_name}].[dbo].tProjects prj ON p_rev.ProjectFK = prj.ProjectPK
    WHERE p_rev.ProgramId = '{program_id}'"""

# endregion Project Queries

# region Project Funding Profile
def build_project_funding_profile_sql(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    return f"""SELECT
        --pf.projectid AS ProjectId,
        t_prj_rev.Id AS ProjectRevisionFK,
        sr.org AS [SourceOrg],
        ag.code AS AgreementCode,
        -- (SELECT SUM(cost.cost) FROM [{source_db_name}].dbo.projectcoststream cost WHERE cost.programid = '{program_id}' AND cost.projectid = pf.projectid) AS Amount,
        (SELECT COALESCE(SUM(cost.cost), 0) FROM [{source_db_name}].dbo.projectcoststream cost WHERE cost.programid = '{program_id}' AND cost.projectid = pf.projectid) AS Amount,
        pf.[percentage] AS [Percentage],
        prj.userid AS CreatedBy,
        prj.datecreated AS CreatedDate,
        prj.userid AS UpdatedBy,
        prj.datechanged AS UpdatedDate,
        {is_deleted} AS IsDeleted,

        pf.programid AS DataImportProgramId,
        pf.projectid AS DataImportProjectId

    FROM [{source_db_name}].dbo.projectfunding pf
    INNER JOIN [{source_db_name}].dbo.fundingagreement ag 
        ON ag.fundingagreementid = pf.fundingagreementid
    INNER JOIN [{source_db_name}].dbo.fundingsource sr 
        ON sr.fundingsourceid = ag.fundingsourceid
    INNER JOIN [{source_db_name}].dbo.project prj 
        ON pf.projectid = prj.projectid AND prj.programid = pf.programid
    INNER JOIN [{target_db_name}].dbo.tProjectRevisions t_prj_rev 
        ON pf.projectid = t_prj_rev.projectid AND pf.programid = t_prj_rev.programid
    WHERE pf.programid = '{program_id}'"""
# endregion Project Funding Profile


# region Project Notes (itemization history)
def build_project_notes_sql(
        source_db_name: str, target_db_name: str,
        program_id: str, migration_user: str = "data_migration") -> str:
    """The itemization history of one program, as tProjectNotes rows.

    WHY THIS EXISTS (2026-09-14).

    The old data model records an itemization nowhere in the project tables. It is a row in
    dbo.history against the CHILD, in the GAA-R program only:

        projectid = P00746419LZ
        description = 'Itemized from Project: P00730052LS'

    dbo.vw_notes is the read-only view over it. alternate_id does NOT carry the link — of
    42,589 such notes, zero have the child's alternate_id equal to the named parent — so a
    load that ignores history loses the parent/child relationship entirely. That is what
    happened to the 2024 groups: 2,027 of their 2,028 itemized children are on
    myps_db_dev_200 with no ParentProjectId.

    Migrating the notes carries the link into the target, where the Lump Sum SQL migration
    reads it back and sets ParentProjectId. It also keeps the link on the server copy without
    that script needing a second database to consult.

    TWO PATTERNS, BOTH KEPT:
      'Itemized from Project: <parent>'     — the link itself.
      'Cost reduced due to itemization...'  — the parent's side of the same event, which is
                                              why its stored cost is the REMAINING balance.

    Idempotent: a note already present for the same revision, text and date is not written
    again, so the standalone back-fill can be re-run.
    """
    return f"""SELECT DISTINCT
    t_prj_rev.Id AS ProjectRevisionFK,
    N'' AS FileName,
    N'' AS FileExtension,
    N'' AS FilePath,
    h.[description] AS [Description],
    '{migration_user}' AS CreatedBy,
    h.[date] AS CreatedDate

    FROM [{source_db_name}].dbo.history h
    INNER JOIN [{target_db_name}].dbo.tProjectRevisions t_prj_rev
        ON  t_prj_rev.ProjectId = h.projectid
        AND t_prj_rev.ProgramId = h.programid
    WHERE h.programid = '{program_id}'
      AND (h.[description] LIKE 'Itemized from Project:%'
           OR h.[description] LIKE 'Cost reduced due to itemization%')
      AND NOT EXISTS (
            SELECT 1 FROM [{target_db_name}].dbo.tProjectNotes n
            WHERE n.ProjectRevisionFK = t_prj_rev.Id
              AND n.[Description] = h.[description]
              AND n.CreatedDate = h.[date])
    """
# endregion Project Notes (itemization history)

# region Project Component Cost, Cost per Year
def build_project_component_cost_sql(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    """One row per (project revision, component) — the grain tProjectComponentCost is on.

    WHY THIS IS A GROUP BY AND NOT A SELECT DISTINCT (2026-09-14).

    projectcoststream is per (project, component, YEAR). This query feeds a table whose
    grain is per (project, component): the years belong to tProjectComponentCostPerYear,
    which build_project_component_cost_per_year_sql loads separately.

    The previous form selected the per-year columns (cost, start_date, end_date,
    date_of_approval) alongside a correlated SUM over all years, and relied on
    SELECT DISTINCT to collapse the result. DISTINCT cannot collapse rows that differ,
    and those columns differ per year — so a component with N distinct (cost, dates)
    shapes produced N identical-Total component rows. The per-year query then joins
    ComponentId back to every one of them, multiplying the per-year rows too.

    Measured on myps_db_dev_200, loaded by the previous form: 176,316
    (ProjectRevisionFK, ComponentId) pairs carry more than one live row, up to 27
    copies, every copy with the same Total. P00201118LZ's CW1 in HGAB 2024 OO-1 has
    10 cost-stream rows with 9 distinct (cost, dates) shapes and landed as 9 rows of
    2,673,766,590 each. The itemized children of the 2024 Lump Sum parents landed with
    exactly 2 copies apiece, which doubles every parent's ItemizedTotal.

    Grouping at the real grain fixes it at the source. The per-year columns are dropped
    from this query rather than aggregated: they are not this table's data.
    """
    return f"""SELECT
    t_prj_rev.Id as ProjectRevisionFK,

    TRIM(p_cost_s.projectid) +'-'+p_cost_s.component AS CostId,
    cost_d.[description] AS Description,
    cost_d.[componenttype] AS ComponentType,
    COALESCE(p_cost_s.component, '') AS ComponentId,

    /*  The component's whole cost: every year of it. Same figure the old correlated
        subquery produced, now an aggregate of the rows actually in the group. */
    SUM(p_cost_s.cost) AS Total,

    prj.userid AS CreatedBy,
    prj.datecreated AS CreatedDate,
    prj.userid AS UpdatedBy,
    prj.datechanged AS UpdatedDate,
    {is_deleted} AS IsDeleted,

    p_cost_s.programid AS DataImportProgramId,
    p_cost_s.projectid AS DataImportProjectId,
    p_cost_s.component AS DataImportComponentId

    FROM [{source_db_name}].dbo.projectcoststream p_cost_s
    INNER JOIN [{source_db_name}].dbo.costtype cost_t ON cost_t.costtypeid = p_cost_s.costtypeid
    INNER JOIN [{source_db_name}].dbo.costdescription cost_d ON cost_d.costdescid = p_cost_s.costdescid
    INNER JOIN [{source_db_name}].dbo.project prj ON p_cost_s.projectid = prj.projectid AND prj.programid = '{program_id}'
    INNER JOIN [{target_db_name}].dbo.tProjectRevisions t_prj_rev ON p_cost_s.projectid = t_prj_rev.projectid AND p_cost_s.programid = t_prj_rev.programid
    WHERE p_cost_s.programid = '{program_id}' 
    GROUP BY
        t_prj_rev.Id,
        p_cost_s.projectid,
        p_cost_s.component,
        cost_d.[description],
        cost_d.[componenttype],
        prj.userid,
        prj.datecreated,
        prj.datechanged,
        p_cost_s.programid
    """

def build_project_component_cost_per_year_sql(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    return f"""SELECT DISTINCT
    --t_prj_rev.Id as ProjectRevisionFK,
    t_prj_cc.Id as ComponentCostFK, 
    COALESCE(p_cost_s.component, '') AS ComponentId,
    
    p_cost_s.cost AS Amount,
    TRY_CAST(SUBSTRING(TRIM(p_cost_s.projectid), PATINDEX('%[0-9]%', TRIM(p_cost_s.projectid)), 3) AS INT)+2015+p_cost_s.year AS Year,
    p_cost_s.pmsid AS UACS,
    --p_cost_s.date_of_approval AS MYCAApprovalDate,
    p_cost_s.start_date AS StartDate,
    p_cost_s.end_date AS EndDate,
    p_cost_s.date_of_approval AS DateOfApproval,
    
    prj.userid AS CreatedBy,
    prj.datecreated AS CreatedDate,
    prj.userid AS UpdatedBy,
    prj.datechanged AS UpdatedDate,
    {is_deleted} AS IsDeleted,

    p_cost_s.programid AS DataImportProgramId,
    p_cost_s.projectid AS DataImportProjectId,
    p_cost_s.component AS DataImportComponentId
    
    FROM [{source_db_name}].dbo.projectcoststream p_cost_s
    INNER JOIN [{source_db_name}].dbo.costtype cost_t 
        ON cost_t.costtypeid = p_cost_s.costtypeid
    INNER JOIN [{source_db_name}].dbo.costdescription cost_d 
        ON cost_d.costdescid = p_cost_s.costdescid
    INNER JOIN [{source_db_name}].dbo.project prj 
        ON p_cost_s.projectid = prj.projectid AND prj.programid = p_cost_s.programid
    INNER JOIN [{target_db_name}].dbo.tProjectRevisions t_prj_rev 
        ON p_cost_s.projectid = t_prj_rev.projectid AND p_cost_s.programid = t_prj_rev.programid
    INNER JOIN [{target_db_name}].[dbo].[tProjectComponentCost] t_prj_cc
        ON t_prj_cc.ProjectRevisionFK=t_prj_rev.Id
        AND t_prj_cc.ComponentId=p_cost_s.component
    WHERE p_cost_s.programid = '{program_id}' 
    -- AND p_cost_s.[year] = 1 -- DISABLED FOR MY Projects
    """

# end region Project Component Cost, Cost per Year

# region Project Major Work Item 
def build_project_major_work_item_from_activity(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    return f"""SELECT DISTINCT
    t_prj_cc.Id as ComponentCostFK, 
    COALESCE(activity.secondary_project_id, '') AS ComponentId,
    TRY_CAST(SUBSTRING(TRIM(activity.projectid), PATINDEX('%[0-9]%', TRIM(activity.projectid)), 3) AS INT)+2015+activity.activity_year AS ActivityYear,
    program.yearstart AS YearOfWork,
    scope.scope_of_work_id AS WorkTypeFK,
    activity.type AS ActivityType,
    scope.infra_type AS InfraType,
    project.userid AS CreatedBy, 
    project.datecreated AS CreatedDate, 
    project.userid AS UpdatedBy, 
    project.datechanged AS UpdatedDate, 
    {is_deleted} AS IsDeleted,

    activity.programid AS DataImportProgramId,
    activity.projectid AS DataImportProjectId,
    activity.secondary_project_id AS DataImportComponentId
    
    FROM [{source_db_name}].[dbo].[activity] AS activity 
    INNER JOIN [{source_db_name}].[dbo].[project]
    ON activity.projectid=project.projectid
    AND activity.programid=project.programid
    INNER JOIN [{source_db_name}].[dbo].[scope_of_work] AS scope
    ON activity.target_unit_id=scope.scope_of_work_id
    INNER JOIN [{source_db_name}].[dbo].[program] AS program
    ON activity.programid=program.programid
    INNER JOIN [{target_db_name}].[dbo].[tProjectRevisions] t_prj_rev
    ON activity.projectid=t_prj_rev.ProjectId
    AND activity.programid=t_prj_rev.ProgramId
    LEFT JOIN [{target_db_name}].[dbo].[tProjectComponentCost] t_prj_cc
    ON t_prj_cc.ProjectRevisionFK=t_prj_rev.Id
    AND t_prj_cc.ComponentId=activity.secondary_project_id
    WHERE activity.programid='{program_id}'
    ORDER BY ComponentCostFK"""

def build_project_major_work_item_from_activityinfra(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    return f"""SELECT DISTINCT
    t_prj_cc.Id as ComponentCostFK, 
    COALESCE(activity.secondary_project_id, '') AS ComponentId,
    TRY_CAST(SUBSTRING(TRIM(activity.projectid), PATINDEX('%[0-9]%', TRIM(activity.projectid)), 3) AS INT)+2015+activity.year AS ActivityYear,
    program.yearstart AS YearOfWork,
    scope.scope_of_work_id AS WorkTypeFK,
    activity.infrakey AS ActivityType,
    scope.infra_type AS InfraType,
    project.userid AS CreatedBy, 
    project.datecreated AS CreatedDate, 
    project.userid AS UpdatedBy, 
    project.datechanged AS UpdatedDate, 
    {is_deleted} AS IsDeleted,

    activity.programid AS DataImportProgramId,
    activity.projectid AS DataImportProjectId,
    activity.secondary_project_id AS DataImportComponentId
    
    FROM [{source_db_name}].[dbo].[activityinfra] AS activity 
    INNER JOIN [{source_db_name}].[dbo].[project]
    ON activity.projectid=project.projectid
    AND activity.programid=project.programid
    INNER JOIN [{source_db_name}].[dbo].[scope_of_work] AS scope
    ON activity.target_unit_id=scope.scope_of_work_id
    INNER JOIN [{source_db_name}].[dbo].[program] AS program
    ON activity.programid=program.programid
    INNER JOIN [{target_db_name}].[dbo].[tProjectRevisions] t_prj_rev
    ON activity.projectid=t_prj_rev.ProjectId
    AND activity.programid=t_prj_rev.ProgramId
    LEFT JOIN [{target_db_name}].[dbo].[tProjectComponentCost] t_prj_cc
    ON t_prj_cc.ProjectRevisionFK=t_prj_rev.Id
    AND t_prj_cc.ComponentId=activity.secondary_project_id
    WHERE activity.programid='{program_id}'
    ORDER BY ComponentCostFK"""
# end region Project Major Work Item 

# region Project Work Locations
def build_project_major_work_locations_from_activity_v1(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    return f"""SELECT
    activity.projectid AS ActProjectId,
    t_prj_rev.ProjectId AS RevProjectId,
    activity.programid AS ActProgramId,
    t_prj_rev.ProgramId AS RevProgramId,
    --t_prj_cc.ComponentType, 
    t_prj_cc.ComponentId, 
    --t_prj_cc.Description, 
    t_prj_rev.Id AS ProjectRevisionFK,
    t_prj_cc.Id AS ComponentCostFK, 

    t_prj_mwi.Id AS WorkItemFK,

    activity.sectionlrscode AS InfraId1,
    activity.lrsid AS InfraId2,
    scope.infra_type AS InfraType,

    activity.dsow AS DetailedScope1,
    activity.dsow_ext AS DetailedScope2,
    
    activity.target_unit_id AS TargetUnitId, 
    activity.target_unit AS TargetUnit, 
    activity.target_amount AS PhysicalTarget, 
    
    activity.start_station_limit AS StartStationLimit,  
    activity.end_station_limit AS EndStationLimit, 
    activity.start_chainage AS StartChainage, 
    activity.end_chainage AS EndChainage, 
    activity.length AS Length,
    
    project.userid AS CreatedBy, 
    project.datecreated AS CreatedDate, 
    project.userid AS UpdatedBy, 
    project.datechanged AS UpdatedDate, 
    {is_deleted} AS IsDeleted,

    activity.programid AS DataImportProgramId,
    activity.projectid AS DataImportProjectId,
    activity.secondary_project_id AS DataImportComponentId
    
    FROM [{source_db_name}].[dbo].[activity] AS activity 
    INNER JOIN [{source_db_name}].[dbo].[project]
        ON activity.projectid=project.projectid
        AND activity.programid=project.programid
    INNER JOIN [{source_db_name}].[dbo].[scope_of_work] AS scope
        ON activity.target_unit_id=scope.scope_of_work_id
    INNER JOIN [{source_db_name}].[dbo].[program] AS program
        ON activity.programid=program.programid
    INNER JOIN [{target_db_name}].[dbo].[tProjectRevisions] t_prj_rev
        ON activity.projectid=t_prj_rev.ProjectId
        AND activity.programid=t_prj_rev.ProgramId
    --INNER JOIN [{target_db_name}].[dbo].[tProjectComponentCost] t_prj_cc
    LEFT JOIN [{target_db_name}].[dbo].[tProjectComponentCost] t_prj_cc
        ON t_prj_cc.ProjectRevisionFK=t_prj_rev.Id
        AND t_prj_cc.ComponentId=activity.secondary_project_id
    LEFT JOIN [{target_db_name}].[dbo].[tProjectMajorWorkItem] t_prj_mwi
        ON t_prj_cc.Id=t_prj_mwi.ComponentCostFK
    WHERE activity.programid='{program_id}'"""

def build_project_major_work_locations_from_activityinfra_v1(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    return f"""SELECT
    activity.projectid AS ActProjectId,
    t_prj_rev.ProjectId AS RevProjectId,
    activity.programid AS ActProgramId,
    t_prj_rev.ProgramId AS RevProgramId,
    --t_prj_cc.ComponentType, 
    t_prj_cc.ComponentId, 
    --t_prj_cc.Description, 
    t_prj_rev.Id AS ProjectRevisionFK,
    t_prj_cc.Id AS ComponentCostFK, 

    t_prj_mwi.Id AS WorkItemFK,

    activity.infraid AS InfraId,
    scope.infra_type AS InfraType,

    activity.dsow AS DetailedScope1,
    activity.dsow_ext AS DetailedScope2,
    
    activity.target_unit_id AS TargetUnitId, 
    activity.target_unit AS TargetUnit, 
    activity.target_amount AS PhysicalTarget, 
    
    activity.start_x AS StartX,
    activity.start_y AS StartY,
    activity.end_x AS EndX,
    activity.end_y AS EndY,
    
    project.userid AS CreatedBy, 
    project.datecreated AS CreatedDate, 
    project.userid AS UpdatedBy, 
    project.datechanged AS UpdatedDate, 
    {is_deleted} AS IsDeleted,

    activity.programid AS DataImportProgramId,
    activity.projectid AS DataImportProjectId,
    activity.secondary_project_id AS DataImportComponentId
    
    FROM [{source_db_name}].[dbo].[activityinfra] AS activity 
    INNER JOIN [{source_db_name}].[dbo].[project]
        ON activity.projectid=project.projectid
        AND activity.programid=project.programid
    INNER JOIN [{source_db_name}].[dbo].[scope_of_work] AS scope
        ON activity.target_unit_id=scope.scope_of_work_id
    INNER JOIN [{source_db_name}].[dbo].[program] AS program
        ON activity.programid=program.programid
    --INNER JOIN [{target_db_name}].[dbo].[tProjectRevisions] t_prj_rev
    --ON activity.projectid=t_prj_rev.ProjectId
    --AND activity.programid=t_prj_rev.ProgramId
    --LEFT JOIN [{target_db_name}].[dbo].[tProjectComponentCost] t_prj_cc
    --ON t_prj_cc.ProjectRevisionFK=t_prj_rev.Id
    --AND t_prj_cc.ComponentId=activity.secondary_project_id
    INNER JOIN [{target_db_name}].[dbo].[tProjectMajorWorkItem] t_prj_mwi
        ON activity.programid=t_prj_mwi.DataImportProgramId
        AND activity.projectid=t_prj_mwi.DataImportProjectId
        AND activity.secondary_project_id=t_prj_mwi.DataImportComponentId
    WHERE activity.programid='{program_id}'"""
# V2
def build_project_major_work_locations_from_activity(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    return f"""SELECT
    activity.projectid AS ActProjectId,
    --t_prj_rev.ProjectId AS RevProjectId,
    activity.programid AS ActProgramId,
    --t_prj_rev.ProgramId AS RevProgramId,
    --t_prj_cc.ComponentType, 
    --t_prj_cc.ComponentId, 
    --t_prj_cc.Description, 
    --t_prj_rev.Id AS ProjectRevisionFK,
    --t_prj_cc.Id AS ComponentCostFK, 

    t_prj_mwi.Id AS WorkItemFK,
    COALESCE(activity.secondary_project_id, '') AS ComponentId,

    NULL AS InfraId,
    activity.sectionlrscode AS InfraId1,
    activity.lrsid AS InfraId2,
    scope.infra_type AS InfraType,

    activity.dsow AS DetailedScope1,
    activity.dsow_ext AS DetailedScope2,
    
    activity.target_unit_id AS TargetUnitId, 
    activity.target_unit AS TargetUnit, 
    activity.target_amount AS PhysicalTarget, 
    
    activity.start_station_limit AS StartStationLimit,  
    activity.end_station_limit AS EndStationLimit, 
    activity.start_chainage AS StartChainage, 
    activity.end_chainage AS EndChainage, 
    activity.length AS Length,
    
    project.userid AS CreatedBy, 
    project.datecreated AS CreatedDate, 
    project.userid AS UpdatedBy, 
    project.datechanged AS UpdatedDate, 
    {is_deleted} AS IsDeleted,

    activity.programid AS DataImportProgramId,
    activity.projectid AS DataImportProjectId,
    activity.secondary_project_id AS DataImportComponentId
    
    FROM [{source_db_name}].[dbo].[activity] AS activity 
    INNER JOIN [{source_db_name}].[dbo].[project]
        ON activity.projectid=project.projectid
        AND activity.programid=project.programid
    INNER JOIN [{source_db_name}].[dbo].[scope_of_work] AS scope
        ON activity.target_unit_id=scope.scope_of_work_id
    INNER JOIN [{source_db_name}].[dbo].[program] AS program
        ON activity.programid=program.programid
    --INNER JOIN [{target_db_name}].[dbo].[tProjectRevisions] t_prj_rev
    --ON activity.projectid=t_prj_rev.ProjectId
    --AND activity.programid=t_prj_rev.ProgramId
    --LEFT JOIN [{target_db_name}].[dbo].[tProjectComponentCost] t_prj_cc
    --ON t_prj_cc.ProjectRevisionFK=t_prj_rev.Id
    --AND t_prj_cc.ComponentId=activity.secondary_project_id
    INNER JOIN [{target_db_name}].[dbo].[tProjectMajorWorkItem] t_prj_mwi
        ON activity.programid=t_prj_mwi.DataImportProgramId
        AND activity.projectid=t_prj_mwi.DataImportProjectId
        AND activity.secondary_project_id=t_prj_mwi.DataImportComponentId
    WHERE activity.programid='{program_id}'"""

def build_project_major_work_locations_from_activityinfra(
        source_db_name: str, target_db_name: str, 
        program_id: str, is_deleted: int) -> str:
    return f"""SELECT
    activity.projectid AS ActProjectId,
    --t_prj_rev.ProjectId AS RevProjectId,
    activity.programid AS ActProgramId,
    --t_prj_rev.ProgramId AS RevProgramId,
    --t_prj_cc.ComponentType, 
    --t_prj_cc.ComponentId, 
    --t_prj_cc.Description, 
    --t_prj_rev.Id AS ProjectRevisionFK,
    --t_prj_cc.Id AS ComponentCostFK, 

    t_prj_mwi.Id AS WorkItemFK,
    COALESCE(activity.secondary_project_id, '') AS ComponentId,

    activity.infraid AS InfraId,
    scope.infra_type AS InfraType,

    activity.dsow AS DetailedScope1,
    activity.dsow_ext AS DetailedScope2,
    
    activity.target_unit_id AS TargetUnitId, 
    activity.target_unit AS TargetUnit, 
    activity.target_amount AS PhysicalTarget, 
    
    activity.start_x AS StartX,
    activity.start_y AS StartY,
    activity.end_x AS EndX,
    activity.end_y AS EndY,
    
    project.userid AS CreatedBy, 
    project.datecreated AS CreatedDate, 
    project.userid AS UpdatedBy, 
    project.datechanged AS UpdatedDate, 
    {is_deleted} AS IsDeleted,

    activity.programid AS DataImportProgramId,
    activity.projectid AS DataImportProjectId,
    activity.secondary_project_id AS DataImportComponentId
    
    FROM [{source_db_name}].[dbo].[activityinfra] AS activity 
    INNER JOIN [{source_db_name}].[dbo].[project]
        ON activity.projectid=project.projectid
        AND activity.programid=project.programid
    INNER JOIN [{source_db_name}].[dbo].[scope_of_work] AS scope
        ON activity.target_unit_id=scope.scope_of_work_id
    INNER JOIN [{source_db_name}].[dbo].[program] AS program
        ON activity.programid=program.programid
    --INNER JOIN [{target_db_name}].[dbo].[tProjectRevisions] t_prj_rev
    --ON activity.projectid=t_prj_rev.ProjectId
    --AND activity.programid=t_prj_rev.ProgramId
    --LEFT JOIN [{target_db_name}].[dbo].[tProjectComponentCost] t_prj_cc
    --ON t_prj_cc.ProjectRevisionFK=t_prj_rev.Id
    --AND t_prj_cc.ComponentId=activity.secondary_project_id
    INNER JOIN [{target_db_name}].[dbo].[tProjectMajorWorkItem] t_prj_mwi
        ON activity.programid=t_prj_mwi.DataImportProgramId
        AND activity.projectid=t_prj_mwi.DataImportProjectId
        AND activity.secondary_project_id=t_prj_mwi.DataImportComponentId
    WHERE activity.programid='{program_id}'"""


# endregion Project Work Locations
