import json
import logging
from typing import Any, Sequence

import pandas as pd

from . import queries

logger = logging.getLogger(__name__)


class MigrationException(Exception):
    pass


# region Target column mapping
# The map itself lives in queries.TARGET_COLUMN_MAP — the queries read these columns back off
# the target as well as writing them, so there is one definition, not two. See the comment
# there for why the application's database differs from myps_db_migrated.
TARGET_COLUMN_MAP = queries.TARGET_COLUMN_MAP


def to_target(df: pd.DataFrame, table_name: str) -> pd.DataFrame:
    """Rename/drop provenance columns so `df` matches `table_name` on the target database.

    A no-op for any table not in the map, and for a frame that does not carry the mapped
    columns — so this is safe against myps_db_migrated too, where the loader's own names are
    already correct."""
    mapping = TARGET_COLUMN_MAP.get(table_name)
    if not mapping:
        return df

    drop = [source for source, target in mapping.items() if target is None and source in df.columns]
    rename = {source: target for source, target in mapping.items()
              if target is not None and source in df.columns}
    if not drop and not rename:
        return df

    mapped = df.drop(columns=drop) if drop else df.copy()
    return mapped.rename(columns=rename) if rename else mapped
# endregion Target column mapping

# region Project notes (itemization history)
TABLE_PROJECT_NOTES = "tProjectNotes"


def migrate_project_notes(
    program_id: str,
    source_db_name: str, source_db_engine: Any,
    target_db_name: str, target_db_engine: Any,
    migration_user: str = "data_migration",
) -> int:
    """Copy one program's itemization history into tProjectNotes. Returns the row count.

    Runs on the SOURCE engine: the query reads dbo.history there and joins to the target's
    tProjectRevisions by (ProjectId, ProgramId), so the revisions for this program must
    already be loaded. See queries.build_project_notes_sql for why the notes matter.

    Safe to call twice — the query excludes notes already present."""
    notes_df = pd.read_sql_query(
        queries.build_project_notes_sql(source_db_name, target_db_name, program_id, migration_user),
        source_db_engine,
    )
    if notes_df.empty:
        logger.info("Stage %s: no itemization notes", program_id)
        return 0

    str_cols_df = notes_df.select_dtypes(["object", "str"])
    notes_df[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    with target_db_engine.begin() as rollback_on_error_conn:
        notes_df.to_sql(name=TABLE_PROJECT_NOTES, con=rollback_on_error_conn,
                        if_exists="append", index=False)

    logger.info("Stage %s: %d itemization note(s)", program_id, len(notes_df))
    return len(notes_df)


def migrate_notes_for_programs(
    program_ids: Sequence[str],
    source_db_name: str, source_db_engine: Any,
    target_db_name: str, target_db_engine: Any,
    migration_user: str = "data_migration",
) -> int:
    """Back-fill itemization notes for programs whose projects are ALREADY loaded.

    The 2024 groups were migrated before the notes were understood to carry the parent/child
    link, so their 2,028 itemization notes never landed. This puts them in without touching
    any other row."""
    total = 0
    for program_id in program_ids:
        total += migrate_project_notes(
            program_id, source_db_name, source_db_engine,
            target_db_name, target_db_engine, migration_user)
    return total
# endregion Project notes (itemization history)




# PROGRAM_STAGE_NUM_TO_NAME = {
#     1: "RDIP",
#     2: "PIP",
#     3: "RBP",
#     4: "BP",
#     5: "NEP",
#     6: "NEP-E",
#     7: "HGAB",
#     8: "HGAB-I",
#     9: "GAA",
#     10: "GAA-R",
# }

# PROGRAM_STAGE_NAME_TO_NUM = {name: num for num, name in PROGRAM_STAGE_NUM_TO_NAME.items()}

PROGRAM_USERTYPE_TO_ID = {
    "admin": 1,
    "dpc": 10,
    "dpd admin": 3,
    "dpd coordinators": 4,
    "faps coordinators": 14,
    "pd admin": 5,
    "pd coordinators": 6,
    "rpc": 9,
    "rpo": 8,
}

# infra_type -> valid ReferenceId prefixes for sectionlrscode
_INFRA_TYPE_LRS_PREFIXES = {
    "road": ("s", "fs"),
    "bridge": ("b", "fb"),
}

def generate_work_item_reference_id(row: pd.Series) -> pd.Series:
    row["ReferenceId"] = f"{row['ProjectId']}-{row['ComponentId']}"
    return row

def choose_infraid_from_infratype(row: pd.Series) -> str:
    infra_type = row["InfraType"].lower()
    infra_code = row["InfraId1"].lower()

    valid_prefixes = next(
        (prefixes for key, prefixes in _INFRA_TYPE_LRS_PREFIXES.items() if key in infra_type),
        None,
    )
    if valid_prefixes is None:
        return row["InfraId1"]

    if infra_code.startswith(valid_prefixes):
        return row["InfraId1"]
    return row["InfraId2"]

def choose_infraid_from_infratype_old(row):
        if "road" in str(row["InfraType"]).lower():
            if row["InfraId1"].lower().startswith("s") or row["InfraId1"].lower().startswith("fs"):
                # print(row["InfraId1"])
                return row["InfraId1"]
            else:
                # print(row["InfraId2"])
                return row["InfraId2"]

        elif "bridge" in str(row["InfraType"]).lower():
            if row["InfraId1"].lower().startswith("b") or row["InfraId1"].lower().startswith("fb"):
                # print(row["InfraId1"])
                return row["InfraId1"]
            else:
                # print(row["InfraId2"])
                return row["InfraId2"]
        else:
            # print(row["InfraId1"])
            return row["InfraId1"]
        
    

# region Program Migration
def _generate_program_pk(program_id: str) -> str:
    """Derive the target-DB Program primary key from the source MYPS ProgramId of the group's first stage,
    e.g. 'P_CO-PS-220_02272025_091315' -> 'MP_P_CO-PS-220_02272025_091315'. Constant for every stage of the group."""
    return f"MP_{program_id}"


# region ProjectPK / ProjectFK resolution
# Key contract: ProjectPK = f"{program_pk}_{<source projectid at the stage where the project FIRST appears>}".
# A project may first appear at any stage; later stages resolve back to that key through the
# tracking frame (PROJECTS_START_DF): ProjectFK, ProgramFK, ProjectId, AlternateId, StartingProgramId.
TRACKING_COLUMNS = ["ProjectFK", "ProgramFK", "ProjectId", "AlternateId", "StartingProgramId"]


def build_first_stage_tracking(project_revisions_df: pd.DataFrame, first_stage_name: str) -> pd.DataFrame:
    """Seed the tracking frame from the first stage's revisions.

    At the BP stage the source `alternate_id` holds the id the project carries in later stages, and later
    stages point back to the BP `projectid` through their `alternate_id`, so the two are swapped here."""
    tracking = project_revisions_df[["ProjectFK", "ProgramFK", "ProjectId", "AlternateId", "ProgramId"]]
    renames = {"ProgramId": "StartingProgramId"}
    if first_stage_name == "BP":
        renames.update({"AlternateId": "ProjectId", "ProjectId": "AlternateId"})
    return tracking.rename(columns=renames)[TRACKING_COLUMNS]


def _tracked_id_sets(tracking_df: pd.DataFrame):
    project_ids = set(tracking_df["ProjectId"].dropna())
    alternate_ids = set(tracking_df["AlternateId"].dropna())
    return project_ids, alternate_ids, set(tracking_df["ProjectFK"].dropna())


def split_new_projects(projects_df: pd.DataFrame, tracking_df: pd.DataFrame, program_pk: str) -> pd.DataFrame:
    """Return the rows of one stage's source projects that are not yet tracked, with their ProjectPK.

    `projects_df` needs `ProjectId` and a sanitised `AlternateId` (empty -> ProjectId). A row is an existing
    project if its ProjectId or AlternateId matches any tracked ProjectId/AlternateId, or its would-be
    ProjectPK matches a tracked ProjectFK; everything else first appears at this stage."""
    project_ids, alternate_ids, project_fks = _tracked_id_sets(tracking_df)
    tracked_ids = project_ids | alternate_ids
    project_pks = program_pk + "_" + projects_df["ProjectId"]
    is_existing = (
        projects_df["ProjectId"].isin(tracked_ids)
        | projects_df["AlternateId"].isin(tracked_ids)
        | project_pks.isin(project_fks)
    )
    new_projects = projects_df[~is_existing].copy()
    new_projects["ProjectPK"] = project_pks[~is_existing]
    return new_projects


def resolve_project_fks(revisions_df: pd.DataFrame, tracking_df: pd.DataFrame) -> pd.DataFrame:
    """Map each revision to the ProjectPK generated at its project's first appearance.

    Returns a frame aligned to `revisions_df.index` with `ProjectFK` (NaN when unresolvable) and
    `ResolvedBy` ("ProjectId" | "AlternateId" | NaN). ProjectId is tried first, then AlternateId."""
    id_to_fk = {}
    for project_id, alternate_id, project_fk in zip(
        tracking_df["ProjectId"], tracking_df["AlternateId"], tracking_df["ProjectFK"]
    ):
        if pd.notna(project_id):
            id_to_fk.setdefault(project_id, project_fk)
        if pd.notna(alternate_id):
            id_to_fk.setdefault(alternate_id, project_fk)

    by_project_id = revisions_df["ProjectId"].map(id_to_fk)
    by_alternate_id = revisions_df["AlternateId"].map(id_to_fk)
    resolved_by = pd.Series(pd.NA, index=revisions_df.index, dtype="object")
    resolved_by[by_alternate_id.notna()] = "AlternateId"
    resolved_by[by_project_id.notna()] = "ProjectId"
    return pd.DataFrame({
        "ProjectFK": by_project_id.fillna(by_alternate_id),
        "ResolvedBy": resolved_by,
    })
# endregion ProjectPK / ProjectFK resolution


def migrate_programs_and_stages(
    ord_list_program_ids: Sequence[str],  # Ordered list of Program IDs to be migrated, ordered by stage
    source_db_name: str, source_db_engine: Any,  # Source DB name and connection (MYPS_BAK and host/ip)
    target_db_name: str, target_db_engine: Any,  # Target DB name and connection (MIGRATION_TEST and host/ip)
    # KWARGS
    current_revision_number: int = 1,
    current_is_published_status: int = 0,  # NOTE: TO BE REVISITED (e.g. =1 for GAA-R)
    current_is_deleted_status: int = 0,
    current_is_skipped_status: int = 0,
    current_migration_user: str = "data_migration",
):
     # Target DB Table Names
    table_program = "tPrograms"
    table_program_revisions = "tProgramRevisions"
    table_program_stages = "tProgramStages"

    # First program in the ordered list determines the Program primary key
    current_program_id = ord_list_program_ids[0]
    program_pk = _generate_program_pk(current_program_id)

    # PROGRAM: Migrate primary program row
    program_df = pd.read_sql_query(
        queries.build_program_sql(source_db_name, current_program_id, program_pk, current_is_deleted_status, current_is_skipped_status),
        source_db_engine,
    )
    logger.debug("tPrograms Dataframe:\n%s", program_df.head())

    if program_df.shape[0] != 1:
        raise MigrationException(f"Expected exactly 1 program row for '{current_program_id}', got {program_df.shape[0]}")

    # PROGRAM REVISIONS: One row per program stage
    program_revisions_df = pd.read_sql_query(
        queries.build_program_revisions_sql(source_db_name, program_pk, ord_list_program_ids),
        source_db_engine,
    )

    # Aggregate valid UserGroups across all revisions onto the primary program entry
    program_revisions_df["UserGroupId"] = program_revisions_df["UserGroup"].apply(
        lambda user_type: PROGRAM_USERTYPE_TO_ID[user_type.lower()]
    )
    user_group_id_list = program_revisions_df["UserGroupId"].unique().tolist()
    program_df["UserGroup"] = json.dumps(user_group_id_list)

    # Derive PCMA revision count (int) from the latest_revision_id string, e.g. "REV-3" -> 3
    program_revisions_df["PCMARevisionId"] = program_revisions_df["PCMARevisionId"].fillna("0")
    program_revisions_df["PCMARevisionCount"] = program_revisions_df["PCMARevisionId"].apply(
        lambda revision_id: int(revision_id.split("-")[-1])
    )
    program_df["PCMARevisionCount"] = program_revisions_df.loc[
        program_revisions_df["PCMARevisionCount"].idxmax()
    ]["PCMARevisionCount"]

     # Aggregate DataSecurityGroup values across all revisions onto the primary program entry
    data_sec_group_list = program_revisions_df["DataSecurityGroup"].unique().tolist()
    program_df["DataSecurityGroup"] = json.dumps(data_sec_group_list)

    #  Say so when a program's stored cost overflowed tProgramRevisions.Cost and the cost
    #  stream was used instead. Never silently: it is a different number from the source.
    if "CostOverflowed" in program_revisions_df.columns:
        overflowed = program_revisions_df[program_revisions_df["CostOverflowed"] == 1]
        for _, row in overflowed.iterrows():
            logger.warning(
                "Program %s (%s): stored cost %s exceeds tProgramRevisions.Cost decimal(18,5); "
                "wrote SUM(projectcoststream.cost) = %s instead.",
                row["ProgramId"], row["Name"], row["SourceCost"], row["Cost"],
            )

    program_revisions_df_tbl = program_revisions_df[[
        "ProgramFK",
        "ProgramId",
        "Name",
        "Status",
        "Cost",
        "CreatedBy",
        "CreatedDate",
        "DataImportProgramId",
    ]]

    # Migrate Program and Program Revisions together; rollback both on error
    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(program_df, table_program).to_sql(name=table_program, con=rollback_on_error_conn, if_exists="append", index=False)
        to_target(program_revisions_df_tbl, table_program_revisions).to_sql(name=table_program_revisions, con=rollback_on_error_conn, if_exists="append", index=False)

    # PROGRAM STAGES: Requires tProgramRevisions rows to already exist in the target DB
    program_stages_df = pd.read_sql_query(
        queries.build_program_stages_sql(source_db_name, target_db_name, program_pk, ord_list_program_ids),
        source_db_engine,
    )
    logger.debug("Program Stages Dataframe:\n%s", program_stages_df.head())

    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(program_stages_df, table_program_stages).to_sql(name=table_program_stages, con=rollback_on_error_conn, if_exists="append", index=False)

    return program_pk, program_df, program_revisions_df, program_stages_df
# endregion Program Migration

# region Project Migration

def migrate_projects_and_stages_in_annual_program(
    program_pk,
    od_list_program_ids_and_stages, # Ordered list of Program IDs to be migrated, ordered by stage
    source_db_name, source_db_engine, # Source DB name and connection (MYPS_BAK and host/ip)
    target_db_name, target_db_engine, # Target DB name and connection (MIGRATION_TEST and host/ip)
    # KWARGS
    current_revision_number=1,
    current_is_published_status=0, # NOTE: TO BE REVISITED (e.g. =1 for GAA-R)
    current_is_deleted_status=0,
    current_is_wallet_draw=0,
    current_is_skipped_status=0,
    current_migration_user="data_migration",
):
    # Target DB Table Names:
    table_projects = "tProjects"
    table_project_revisions = "tProjectRevisions"
    table_project_stages = "tProjectStages"

    table_project_funding_profile = "tProjectFundingProfile"
    
    table_project_component_cost = "tProjectComponentCost"
    table_project_component_cost_per_year = "tProjectComponentCostPerYear"

    table_project_major_work_item = "tProjectMajorWorkItem"
    table_project_major_work_locations = "tProjectMajorWorkLocations" #:TODO


    

    # Overall Program ID, first in `od_list_program_ids_and_stages`
    current_program_id, current_program_stage_name, current_program_stage_num = od_list_program_ids_and_stages[0]

    # region PROJECTS: dbo.tProject rows
    projects_of_program_df_1st = pd.read_sql_query(
        queries.build_project_sql(source_db_name, current_program_id, program_pk, current_is_deleted_status),
        source_db_engine,
    )

    # NOTE: DATA SANITATION: Handle MYId
    projects_of_program_df_1st["MYId"] = projects_of_program_df_1st.apply(
        lambda row: row["AlternateId"] if ("MY" in str(row["AlternateId"])) else None
    , axis=1)

    # NOTE: DATA SANITATION: Handle ExternalId
    projects_of_program_df_1st["ExternalId"] = projects_of_program_df_1st["AlternateId"]

    values = {"ProjectType": "NULL"}
    projects_of_program_df_1st = projects_of_program_df_1st.fillna(value=values)

    # Filter out tProject columns
    projects_of_program_df_1st = projects_of_program_df_1st[[
        "ProgramFK",
        "ProgramId",
        "ProjectPK",
        "ProjectGroupFK",
        "ProjectType",
        "ExternalId",
        "MYId",
        "IsPublished",
        "IsPublishable",
        "IsRevised",
        "PCMARevisionCount",
        "CreatedBy",
        "CreatedDate",
        "LockedBy",
        "LockedDate",
        "DataImportProgramId",]]

    logger.debug(
        "Projects of Program Dataframe:\nDF shape: %s\nDF head:\n%s",
        projects_of_program_df_1st.shape,
        projects_of_program_df_1st.head(),
    )
    # end region PROJECTS: dbo.tProject rows
    
    # region PROJECT REVISIONS: dbo.tProjectRevision rows
    project_revisions_df_1st = pd.read_sql_query(
        queries.build_project_revisions_sql(source_db_name, target_db_name, current_program_id, program_pk, current_is_deleted_status),
        target_db_engine,
    )

    # Coalesce tProjectRevision.Description
    project_revisions_df_1st["Description"] = project_revisions_df_1st[["Description_1", "Description_2"]].apply(
        lambda row: row["Description_1"] if (
                    row["Description_2"]=='' 
                    or not pd.notna(row["Description_2"])
                ) else row["Description_2"]
    , axis=1)

    project_revisions_df_1st = project_revisions_df_1st[[
        "ProjectFK", # Does not change on new revision
        "ProgramFK", # Does not change on new revision
        "ProgramId", # Does not change on new revision
        
        "Category", # Does not change on new revision
        "Thrust", # Does not change on new revision
        "Origin", # Does not change on new revision
        "Agency", # Does not change on new revision
        "AlternateId", # Does not change on new revision

        "MYCAApprovalDate", # Does not change on new revision
        
        "IslandCode",
        "Region",
        "Province", # need to verify if changing
        "City", # need to verify if changing
        "LegislativeDistrict", # need to verify if changing

        # Changing per tProjectRevision
        "ProjectId", # Does not change on new revision, but changes from BP stage
        "Description",

        "DEO",
        "OperatingUnit",
        "ImplementingOffice",
        
        "ImplementationMode",
        "EmergencyMode",
        "RegionWide",
        "Feasibility",
        "FeasibilityDate",
        "DetailedDesign",
        "DetailedDesignDate",
        "RowAvailable",
        "Tier",
        "Rank",
        "CreatedBy",
        "CreatedDate",
        "IsDeleted",
        "UpdatedBy",
        "UpdatedDate",

        "DataImportProgramId",
        "DataImportProjectId",
    ]]

    # NOTE: DATA SANITATION: Strip all trailing spaces
    str_cols_df = projects_of_program_df_1st.select_dtypes(['object', 'str'])
    projects_of_program_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    str_cols_df = project_revisions_df_1st.select_dtypes(['object', 'str'])
    project_revisions_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    # region TRACKING DF for: "ProjectId", "AlternateId", "ProgramId"
    # NOTE: TRACKING DF: ProjectPK of every project seen so far, keyed by the ids it carried at its first
    # stage; later stages (and projects first appearing at any later stage) are resolved against it.
    PROJECTS_START_DF = build_first_stage_tracking(project_revisions_df_1st, current_program_stage_name)
    # endregion


    # Migrate for use in creating rows for tProjectStages
    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(projects_of_program_df_1st, table_projects).to_sql(name=table_projects, con=rollback_on_error_conn, if_exists="append", index=False)
        to_target(project_revisions_df_1st, table_project_revisions).to_sql(name=table_project_revisions, con=rollback_on_error_conn, if_exists="append", index=False)
    # endregion PROJECT REVISIONS: dbo.tProjectRevision rows
    
    # region PROJECT STAGES: dbo.tProjectStages rows
    # For first program stage, ProgramUniqueId == ProgramId
    current_program_u_id = current_program_id
    current_program_u_stage_name = current_program_stage_name
    current_program_u_stage_num = current_program_stage_num

    # For first program stage, DataImportProgramId == ProgramId
    project_stages_df_1st = pd.read_sql_query(
        queries.build_project_stages_sql(
            target_db_name, 
            current_program_u_id, 
            current_program_u_stage_num, 
            current_program_u_stage_name
        ),
        target_db_engine,
    )
    
    project_stages_df_1st = project_stages_df_1st[[
        "ProjectFK",
        "ProgramFK",
        "ProgramId",
        "RevisionId",
        "StageId",
        "StageName",
        "CreatedBy",
        "CreatedDate",

        "DataImportProgramId",
        "DataImportProjectId",
    ]]
    
    # NOTE: DATA SANITATION: Strip all trailing spaces
    str_cols_df = project_stages_df_1st.select_dtypes(['object', 'str'])
    project_stages_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    # Migrate 1st Project Stage
    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(project_stages_df_1st, table_project_stages).to_sql(name=table_project_stages, con=rollback_on_error_conn, if_exists="append", index=False)
    # end region PROJECT STAGES: dbo.tProjectStages rows

    # region 1-PRJ FUNDING PROFILE
    project_fundingprofile_df_1st = pd.read_sql_query(
        queries.build_project_funding_profile_sql(
            source_db_name, 
            target_db_name, 
            current_program_u_id, 
            current_is_deleted_status
        ), 
        source_db_engine)

    # NOTE: Additional columns not found in old data model
    project_fundingprofile_df_1st["IsWalletDraw"]=current_is_wallet_draw
    
    # NOTE: DATA SANITATION: Strip all trailing spaces
    str_cols_df = project_fundingprofile_df_1st.select_dtypes(['object', 'str'])
    project_fundingprofile_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(project_fundingprofile_df_1st, table_project_funding_profile).to_sql(name=table_project_funding_profile, con=rollback_on_error_conn, if_exists="append", index=False)

    # endregion 1-PRJ FUNDING PROFILE

    # region 1-PRJ NOTES: dbo.tProjectNotes rows (itemization history)
    migrate_project_notes(
        current_program_u_id, source_db_name, source_db_engine,
        target_db_name, target_db_engine, current_migration_user)
    # endregion 1-PRJ NOTES
    
    # region 1-PRJ COMPONENT COSTS: dbo.tProjectComponentCost rows
    project_cost_all_df_1st = pd.read_sql_query(
        queries.build_project_component_cost_sql(
            source_db_name,
            target_db_name, 
            current_program_u_id,
            current_is_deleted_status,
        ),
        target_db_engine,
    )

    project_component_cost_df_1st=project_cost_all_df_1st[[
        "ProjectRevisionFK",
        "ComponentType",
        "ComponentId",
        "Description",
        "Total",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "IsDeleted",
        "DataImportProgramId",
        "DataImportProjectId",
        "DataImportComponentId",
    ]]

    # NOTE: DATA SANITATION: Strip all trailing spaces
    str_cols_df = project_component_cost_df_1st.select_dtypes(['object', 'str'])
    project_component_cost_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    # NOTE: Special Case Handling
    project_component_cost_df_1st["ComponentId"] = project_component_cost_df_1st["ComponentId"].replace(
            {"155,000,000 CW" : "CW1"}
        )
    project_component_cost_df_1st["ComponentId"] = project_component_cost_df_1st["ComponentId"].fillna("")

    
    # Migrate 1st Project Component Cost
    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(project_component_cost_df_1st, table_project_component_cost).to_sql(name=table_project_component_cost, con=rollback_on_error_conn, if_exists="append", index=False)
    # endregion 1-PRJ COMPONENT COSTS: dbo.tProjectComponentCost rows
    
    # region 1-PRJ COMPONENT COST PER YEAR: dbo.tProjectComponentCostPerYear rows
    project_component_cost_per_year_df_1st = pd.read_sql_query(
        queries.build_project_component_cost_per_year_sql(
            source_db_name, 
            target_db_name, 
            current_program_u_id, 
            current_is_deleted_status
        ), 
        source_db_engine)
    
    # Write to SQL
    project_component_cost_per_year_df_1st[[
        "ComponentCostFK",
        "ComponentId",
        "Amount",
        "Year",
        "UACS",
        "StartDate",
        "EndDate",
        "DateOfApproval",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "IsDeleted",
        "DataImportProgramId",
        "DataImportProjectId",
        "DataImportComponentId",
    ]]

    # NOTE: DATA SANITATION: Convert object/str columns below to dates
    # project_component_cost_per_year_df_1st[["StartDate","EndDate","DateOfApproval"]] = pd.to_datetime(project_component_cost_per_year_df_1st[["StartDate","EndDate","DateOfApproval"]])
    project_component_cost_per_year_df_1st["StartDate"] = pd.to_datetime(project_component_cost_per_year_df_1st["StartDate"])
    project_component_cost_per_year_df_1st["EndDate"] = pd.to_datetime(project_component_cost_per_year_df_1st["EndDate"])
    project_component_cost_per_year_df_1st["DateOfApproval"] = pd.to_datetime(project_component_cost_per_year_df_1st["DateOfApproval"])

    # NOTE: DATA SANITATION: Strip all trailing spaces
    str_cols_df = project_component_cost_per_year_df_1st.select_dtypes(['object', 'str'])
    project_component_cost_per_year_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    # NOTE: DATA SANITATION: Strip all trailing spaces

    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(project_component_cost_per_year_df_1st, table_project_component_cost_per_year).to_sql(name=table_project_component_cost_per_year, con=rollback_on_error_conn, if_exists="append", index=False)
    # endregion 1-PRJ COMPONENT COST PER YEAR: dbo.tProjectComponentCostPerYear rows

    # region 1-PRJ MAJOR WORK ITEM: tProjectMajorWorkItem rows
    project_activity_mwi_df_1st = pd.read_sql_query(
        queries.build_project_major_work_item_from_activity(
            source_db_name, 
            target_db_name, 
            current_program_u_id, 
            current_is_deleted_status
        ), source_db_engine)

    project_activityinfra_mwi_df_1st = pd.read_sql_query(
        queries.build_project_major_work_item_from_activityinfra(
            source_db_name, 
            target_db_name, 
            current_program_u_id, 
            current_is_deleted_status
        ), source_db_engine)

    tProjectMajorWorkItem_df_1st = pd.concat([
        project_activity_mwi_df_1st[[
            "ComponentCostFK",
            "ComponentId",
            "YearOfWork", 
            "WorkTypeFK", 
            "InfraType", 
            "CreatedBy", 
            "CreatedDate", 
            "UpdatedBy", 
            "UpdatedDate", 
            "IsDeleted",
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]],
        project_activityinfra_mwi_df_1st[[
            "ComponentCostFK",
            "ComponentId",
            "YearOfWork", 
            "WorkTypeFK", 
            "InfraType", 
            "CreatedBy", 
            "CreatedDate", 
            "UpdatedBy", 
            "UpdatedDate", 
            "IsDeleted",
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]]
    ])

    # NOTE: Resolve InfraTypeFK from InfraType
    sql_statement = f"""SELECT * FROM {target_db_name}.dbo.tOptionInfraType"""
    optioninfratype_df = pd.read_sql_query(sql_statement, target_db_engine)

    # Create lower case for case-insensitive comparison
    optioninfratype_df["InfraName_low"] = optioninfratype_df["InfraName"].str.lower()
    # optioninfratype_df["InfraTypeFK"] = optioninfratype_df["InfraId"]
    optioninfratype_df["InfraTypeFK"] = optioninfratype_df["InfraCode"]
    tProjectMajorWorkItem_df_1st["InfraName_low"] = tProjectMajorWorkItem_df_1st["InfraType"].str.lower()

    # Merge to get InfraTypeFK from code table
    tProjectMajorWorkItem_df_1st_infratypefk = pd.merge(
        tProjectMajorWorkItem_df_1st, optioninfratype_df[["InfraTypeFK","InfraName_low"]], 
        # how='outer', left_on=['AlternateId'],right_on=['ProjectId'], # NOTE:Problematic for Alternate IDs containing MYIDs
        how='left', left_on=['InfraName_low'], right_on=['InfraName_low'], 
        suffixes=("_left", "_right"),
        indicator=True)
    
    # NOTE: DEBUG
    print(">>> InfraTypeFK Mapping")
    print(tProjectMajorWorkItem_df_1st_infratypefk[tProjectMajorWorkItem_df_1st_infratypefk["InfraTypeFK"].isna()])

    # Write to SQL
    tProjectMajorWorkItem_df_1st=tProjectMajorWorkItem_df_1st_infratypefk[[
        "ComponentCostFK", 
        "ComponentId",
        "YearOfWork", 
        "WorkTypeFK", 
        "InfraTypeFK", 
        "CreatedBy", 
        "CreatedDate", 
        "UpdatedBy", 
        "UpdatedDate", 
        "IsDeleted",
        "DataImportProgramId",
        "DataImportProjectId",
        "DataImportComponentId",
    ]]
    # NOTE: DATA SANITATION: Handle Work Items with no Component Cost
    tProjectMajorWorkItem_df_1st=tProjectMajorWorkItem_df_1st.fillna(value={
        "ComponentCostFK": 0
    })
    
    # NOTE: DATA SANITATION: Strip all trailing spaces
    # str_cols_df = tProjectMajorWorkItem_df_1st.select_dtypes(['object', 'str'])
    str_cols_df = tProjectMajorWorkItem_df_1st[[
        "CreatedBy", 
        "UpdatedBy", 
        "DataImportProgramId",
        "DataImportProjectId",
        "DataImportComponentId",
    ]]
    tProjectMajorWorkItem_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    # Write to DB
    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(tProjectMajorWorkItem_df_1st, table_project_major_work_item).to_sql(name=table_project_major_work_item, con=rollback_on_error_conn, if_exists="append", index=False)

    # endregion 1-PRJ MAJOR WORK ITEM: tProjectMajorWorkItem rows

    # region 1-PROJECT MAJOR WORK LOCATION: tProjectMajorWorkLocations rows
    project_activity_df_1st = pd.read_sql_query(
        queries.build_project_major_work_locations_from_activity(
            source_db_name, 
            target_db_name, 
            current_program_u_id, 
            current_is_deleted_status
        ) , source_db_engine)
    
    # NOTE: DATA SANITATION: Strip all trailing spaces
    str_cols_df = project_activity_df_1st.select_dtypes(['object', 'str'])
    project_activity_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    # NOTE: DATA SANITATION: Choose appropriate Infra Id for road or bridge, or default to what is available
    if not project_activity_df_1st.empty:
        project_activity_df_1st["InfraId"] = project_activity_df_1st.apply(
                choose_infraid_from_infratype
            , axis=1)
        
    project_activityinfra_df_1st = pd.read_sql_query(
        queries.build_project_major_work_locations_from_activityinfra(
            source_db_name, 
            target_db_name, 
            current_program_u_id, 
            current_is_deleted_status
        ), source_db_engine)
    
    # NOTE: DATA SANITATION: Strip all trailing spaces
    str_cols_df = project_activityinfra_df_1st.select_dtypes(['object', 'str'])
    project_activityinfra_df_1st[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

    tProjectMajorWorkLocations_df_1st = pd.concat([
        project_activity_df_1st[[
            "WorkItemFK",
            "ComponentId",
            "InfraId",
            "DetailedScope1",
            "DetailedScope2",
            "TargetUnitId",
            "TargetUnit",
            # "StartX",
            # "StartY",
            # "EndX",
            # "EndY",
            "PhysicalTarget",
            "StartStationLimit",
            "EndStationLimit",
            "StartChainage",
            "EndChainage",
            "Length",
            "CreatedBy",
            "CreatedDate",
            "UpdatedBy",
            "UpdatedDate",
            "IsDeleted",
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]],
        project_activityinfra_df_1st[[
            "WorkItemFK",
            "ComponentId",
            "InfraId",
            "DetailedScope1",
            "DetailedScope2",
            "TargetUnitId",
            "TargetUnit",
            "StartX",
            "StartY",
            "EndX",
            "EndY",
            # "PhysicalTarget",
            # "StartStationLimit",
            # "EndStationLimit",
            # "StartChainage",
            # "EndChainage",
            # "Length",
            "CreatedBy",
            "CreatedDate",
            "UpdatedBy",
            "UpdatedDate",
            "IsDeleted",
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]]
    ])

    tProjectMajorWorkLocations_df_1st["DetailedScope"] = tProjectMajorWorkLocations_df_1st.apply(
        lambda row: f"{row['DetailedScope1']}{row['DetailedScope2']}".strip(),
        axis=1
    )
    
    tProjectMajorWorkLocations_df_1st = tProjectMajorWorkLocations_df_1st[[
            "WorkItemFK",
            "ComponentId",
            "InfraId",
            "DetailedScope",
            "TargetUnitId",
            "TargetUnit",
            "StartX",
            "StartY",
            "EndX",
            "EndY",
            "PhysicalTarget",
            "StartStationLimit",
            "EndStationLimit",
            "StartChainage",
            "EndChainage",
            "Length",
            "CreatedBy",
            "CreatedDate",
            "UpdatedBy",
            "UpdatedDate",
            "IsDeleted",
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]]
    # Write to DB
    with target_db_engine.begin() as rollback_on_error_conn:
        to_target(tProjectMajorWorkLocations_df_1st, table_project_major_work_locations).to_sql(name=table_project_major_work_locations, con=rollback_on_error_conn, if_exists="append", index=False)

    # endregion

    # region LOOP through remaining program stages
    for idx in range(1, len(od_list_program_ids_and_stages)):
        logger.debug(f"[DEBUG] Migrating projects in <{idx}:  {od_list_program_ids_and_stages[idx]}>")
        current_program_u_id, current_program_u_stage_name, current_program_u_stage_num = od_list_program_ids_and_stages[idx]

        # region L-PROJECTFK MAP
        sql_statement=f"""SELECT DISTINCT
        '{program_pk}' AS ProgramFK,
        p.programid AS ProgramId,
        p.projectid AS ProjectId,
        p.alternate_id AS AlternateId,

        NULL AS ProjectGroupFK,
        NULL AS ProjectType,
        NULL AS MYId,
        0 AS IsPublished,
        0 AS IsPublishable,
        0 AS IsRevised,
        0 AS PCMARevisionCount,
        NULL AS LockedBy,
        NULL AS LockedDate,

        p.userid AS CreatedBy,
        p.datecreated AS CreatedDate, 
        {current_is_deleted_status} AS IsDeleted,
        p.programid AS DataImportProgramId
        FROM [{source_db_name}].dbo.project p WHERE p.programid = '{current_program_u_id}'
        """

        # region L-PROJECTS: dbo.tProject rows
        projects_of_program_df = pd.read_sql_query(
            sql_statement,
            source_db_engine,
        )

        # region L-Map PK > ProjectFK of Project
        # NOTE: DATA SANITATION: handle empty Alternate IDs, copy Project ID / Project ID
        projects_of_program_df["AlternateId"] = projects_of_program_df.apply(
            lambda row: row["ProjectId"] if (not row["AlternateId"]) else ( # Handle NoneTypes
                row["ProjectId"] if (str(row["AlternateId"]).strip()=="") else ( # Handle Empty strings
                    row["AlternateId"]))
        , axis=1)
        projects_of_program_df

        logger.debug(f"""[DEBUG] Projects of Program Dataframe:
        DF shape: {projects_of_program_df.shape}
        DF head:  
        {projects_of_program_df.head()}""")

        # NOTE: DATA MAPPING: projects already tracked (by ProjectId, AlternateId or ProjectPK) reuse the
        # ProjectPK generated at their first stage; the rest first appear at this stage and get
        # ProjectPK = f"{program_pk}_{ProjectId}" from the constant ProgramPK (NOT the stage-specific
        # current_program_u_id), matching queries.build_project_sql / build_project_revisions_sql.
        new_projects_of_program = split_new_projects(projects_of_program_df, PROJECTS_START_DF, program_pk).rename(
            columns={"AlternateId": "ExternalId"}
        )
        logger.info(
            "Stage %s: %d source projects, %d first appear at this stage",
            current_program_u_id, len(projects_of_program_df), len(new_projects_of_program),
        )

        if not new_projects_of_program.empty:
            # NOTE: DATA SANITATION: Handle MYId
            new_projects_of_program["MYId"] = new_projects_of_program.apply(
                lambda row: row["ExternalId"] if ("MY" in str(row["ExternalId"])) else None
            , axis=1)

            values = {"ProjectType": "NULL"}
            new_projects_of_program = new_projects_of_program.fillna(value=values)
            # endregion Map Primary Project ReferenceId

            # Filter out tProject columns
            new_projects_of_program_to_sql=new_projects_of_program[[
                "ProgramFK",
                "ProgramId",
                "ProjectPK",
                "ProjectGroupFK",
                "ProjectType",
                "ExternalId",
                "MYId",
                "IsPublished",
                "IsPublishable",
                "IsRevised",
                "PCMARevisionCount",
                "CreatedBy",
                "CreatedDate",
                "LockedBy",
                "LockedDate",
                "DataImportProgramId",]]
            with target_db_engine.begin() as rollback_on_error_conn:
                to_target(new_projects_of_program_to_sql, table_projects).to_sql(name=table_projects, con=rollback_on_error_conn, if_exists="append", index=False)
            #     raise Exception("!! FORCE ROLLBACK !!")

            # NOTE: Add list of new ProjectPKs to Tracking DF
            new_prj_tracking_df = new_projects_of_program[[
                "ProgramFK",
                "ProgramId",
                "ProjectPK",
                "ProjectId",
                "ExternalId",
            ]].rename(columns={
                "ProjectPK"   : "ProjectFK",
                "ExternalId"  : "AlternateId",
                "ProgramId"   : "StartingProgramId",
            })
            

            PROJECTS_START_DF = pd.concat([PROJECTS_START_DF, new_prj_tracking_df])

            logger.debug(
                "Projects of Program Dataframe:\nDF shape: %s\nDF head:\n%s",
                projects_of_program_df_1st.shape,
                projects_of_program_df_1st.head(),
            )
        # endregion PROJECTS: dbo.tProjects rows

        # region L-PROJECT REVISIONS: dbo.tProjectRevisions rows
        project_revisions_df_loop = pd.read_sql_query(
            queries.build_project_revisions_sql(source_db_name, target_db_name, current_program_u_id, program_pk, current_is_deleted_status),
            target_db_engine,
        )

        # Coalesce tProjectRevision.Description
        project_revisions_df_loop["Description"] = project_revisions_df_loop[["Description_1", "Description_2"]].apply(
            lambda row: row["Description_1"] if (
                        row["Description_2"]=='' 
                        or not pd.notna(row["Description_2"])
                    ) else row["Description_2"]
        , axis=1)

        project_revisions_df_loop = project_revisions_df_loop[[
            "ProjectFK",
            "ProgramFK",
            "ProgramId",
            "ProjectId",
            "AlternateId",
            "MYCAApprovalDate",
            "Description",
            "Region",
            "Province",
            "City",
            "LegislativeDistrict",
            "DEO",
            "OperatingUnit",
            "ImplementingOffice",
            "IslandCode",
            "Category",
            "Thrust",
            "Origin",
            "Agency",
            "ImplementationMode",
            "EmergencyMode",
            "RegionWide",
            "Feasibility",
            "FeasibilityDate",
            "DetailedDesign",
            "DetailedDesignDate",
            "RowAvailable",
            "Tier",
            "Rank",
            "CreatedBy",
            "CreatedDate",
            "IsDeleted",
            "UpdatedBy",
            "UpdatedDate",

            "DataImportProgramId",
            "DataImportProjectId",
        ]]

        # NOTE: DATA SANITATION: Strip all trailing spaces
        str_cols_df = project_revisions_df_loop.select_dtypes(['object', 'str'])
        project_revisions_df_loop[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

        # NOTE: Data Cleanup: handle empty Alternate IDs, copy Reference ID / Project ID
        project_revisions_df_loop["AlternateId"] = project_revisions_df_loop.apply(
            lambda row: row["ProjectId"] if (not row["AlternateId"]) else ( # Handle NoneTypes
                row["ProjectId"] if (str(row["AlternateId"]).strip()=="") else ( # Handle Empty strings or whitespaces
                row["AlternateId"]))
        , axis=1)

        # NOTE: Replace the SQL-generated ProjectFK (built naively from this stage's projectid) with the
        # ProjectPK from PROJECTS_START_DF: by ProjectId first, then AlternateId, so a project that started
        # earlier under a different id (e.g. its alternate_id points back to a BP projectid) reuses the key
        # generated at its first stage. Projects added to the tracking DF earlier in this iteration resolve
        # to their own freshly-generated PK.
        fk_resolution_df = resolve_project_fks(project_revisions_df_loop, PROJECTS_START_DF)
        project_revisions_df_loop["ProjectFK"] = fk_resolution_df["ProjectFK"]
        logger.info(
            "Stage %s: ProjectFK resolution %s",
            current_program_u_id,
            fk_resolution_df["ResolvedBy"].fillna("UNRESOLVED").value_counts().to_dict(),
        )

        # Drop any revision whose project could not be resolved to a tracked ProjectPK
        unresolved_revisions_df = project_revisions_df_loop[project_revisions_df_loop["ProjectFK"].isna()]
        if not unresolved_revisions_df.empty:
            logger.warning(
                "Stage %s: dropping %d revisions with no tracked ProjectPK:\n%s",
                current_program_u_id,
                len(unresolved_revisions_df),
                unresolved_revisions_df[["ProgramId", "ProjectId", "AlternateId"]].to_string(index=False),
            )
        prj_rev_df_to_sql = project_revisions_df_loop[
            ~project_revisions_df_loop["ProjectFK"].isna()
        ][[
            "ProjectFK",
            "ProgramFK",
            "ProgramId",
            "ProjectId",
            "AlternateId",
            "MYCAApprovalDate",
            "Description",
            "Region",
            "Province",
            "City",
            "LegislativeDistrict",
            "DEO",
            "OperatingUnit",
            "ImplementingOffice",
            "IslandCode",
            "Category",
            "Thrust",
            "Origin",
            "Agency",
            "ImplementationMode",
            "EmergencyMode",
            "RegionWide",
            "Feasibility",
            "FeasibilityDate",
            "DetailedDesign",
            "DetailedDesignDate",
            "RowAvailable",
            "Tier",
            "Rank",
            "CreatedBy",
            "CreatedDate",
            "IsDeleted",
            "UpdatedBy",
            "UpdatedDate",
            
            "DataImportProgramId",
            "DataImportProjectId",
        ]].reset_index(drop=True)

        with target_db_engine.begin() as rollback_on_error_conn:
            to_target(prj_rev_df_to_sql, table_project_revisions).to_sql(name=table_project_revisions, con=rollback_on_error_conn, if_exists="append", index=False)
            # raise Exception("!! FORCE ROLLBACK !!")

        # endregion PROJECT REV: dbo.tProjectRevisions rows
        
        # region L-PROJECT STAGES: dbo.tProjectStages rows
        # For first program stage, ProgramUniqueId == ProgramId
        # current_program_u_id = current_program_id
        # current_program_u_stage_name = current_program_stage_name
        # current_program_u_stage_num = current_program_stage_num

        project_stages_df_loop = pd.read_sql_query(
            queries.build_project_stages_sql(
                target_db_name, 
                current_program_u_id, 
                current_program_u_stage_num, 
                current_program_u_stage_name
            ),
            target_db_engine,
        )

        project_stages_df_loop = project_stages_df_loop[[
            "ProjectFK",
            "ProgramFK",
            "ProgramId",
            "RevisionId",
            "StageId",
            "StageName",
            "CreatedBy",
            "CreatedDate",
            
            "DataImportProgramId",
            "DataImportProjectId",
        ]]

        # NOTE: DATA SANITATION: Strip all trailing spaces
        str_cols_df = project_stages_df_loop.select_dtypes(['object', 'str'])
        project_stages_df_loop[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

        # Migrate 1st Project Stage
        with target_db_engine.begin() as rollback_on_error_conn:
            to_target(project_stages_df_loop, table_project_stages).to_sql(name=table_project_stages, con=rollback_on_error_conn, if_exists="append", index=False)
            # raise Exception("!! FORCE ROLLBACK !!")
        
        # endregion # region L-PROJECT STAGES: dbo.tProjectStages rows

        # region L-PRJ FUNDING PROFILE
        project_fundingprofile_df_loop = pd.read_sql_query(
            queries.build_project_funding_profile_sql(
                source_db_name, 
                target_db_name, 
                current_program_u_id, 
                current_is_deleted_status
            ), 
            source_db_engine)

        # NOTE: Additional columns not found in old data model
        project_fundingprofile_df_loop["IsWalletDraw"]=current_is_wallet_draw
        
        # NOTE: DATA SANITATION: Strip all trailing spaces
        str_cols_df = project_fundingprofile_df_loop.select_dtypes(['object', 'str'])
        project_fundingprofile_df_loop[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

        with target_db_engine.begin() as rollback_on_error_conn:
            to_target(project_fundingprofile_df_loop, table_project_funding_profile).to_sql(name=table_project_funding_profile, con=rollback_on_error_conn, if_exists="append", index=False)

        # endregion L-PRJ FUNDING PROFILE

        # region L-PRJ NOTES: dbo.tProjectNotes rows (itemization history)
        migrate_project_notes(
            current_program_u_id, source_db_name, source_db_engine,
            target_db_name, target_db_engine, current_migration_user)
        # endregion L-PRJ NOTES
        
        # region L-PRJ COMPONENT COSTS: dbo.tProjectComponentCost rows
        project_cost_all_df_loop = pd.read_sql_query(
            queries.build_project_component_cost_sql(
                source_db_name,
                target_db_name, 
                current_program_u_id,
                current_is_deleted_status,
            ),
            target_db_engine,
        )

        project_component_cost_df_loop=project_cost_all_df_loop[[
            "ProjectRevisionFK",
            "ComponentType",
            "ComponentId",
            "Description",
            "Total",
            "CreatedBy",
            "CreatedDate",
            "UpdatedBy",
            "UpdatedDate",
            "IsDeleted",
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]]

        # NOTE: Special Case handling for project component IDs:
        
        project_component_cost_df_loop["ComponentId"] = project_component_cost_df_loop["ComponentId"].replace(
            {"155,000,000 CW" : "CW1"}
        )
        project_component_cost_df_loop["ComponentId"] = project_component_cost_df_loop["ComponentId"].fillna("")

        # NOTE: DATA SANITATION: Strip all trailing spaces
        str_cols_df = project_component_cost_df_loop.select_dtypes(['object', 'str'])
        project_component_cost_df_loop[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())
        
        # Migrate 1st Project Component Cost
        with target_db_engine.begin() as rollback_on_error_conn:
            to_target(project_component_cost_df_loop, table_project_component_cost).to_sql(name=table_project_component_cost, con=rollback_on_error_conn, if_exists="append", index=False)
        # endregion L-PRJ COMPONENT COSTS: dbo.tProjectComponentCost rows
        
        # region L-PRJ COMPONENT COST PER YEAR: dbo.tProjectComponentCostPerYear rows
        project_component_cost_per_year_df_loop = pd.read_sql_query(
            queries.build_project_component_cost_per_year_sql(
                source_db_name, 
                target_db_name, 
                current_program_u_id, 
                current_is_deleted_status
            ), 
            source_db_engine)
        
        # Write to SQL
        project_component_cost_per_year_df_loop[[
            "ComponentCostFK",
            "ComponentId",
            "Amount",
            "Year",
            "UACS",
            "StartDate",
            "EndDate",
            "DateOfApproval",
            "CreatedBy",
            "CreatedDate",
            "UpdatedBy",
            "UpdatedDate",
            "IsDeleted",
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]]

        # NOTE: DATA SANITATION: Convert object/str columns below to dates
        # project_component_cost_per_year_df_loop[["StartDate","EndDate","DateOfApproval"]] = pd.to_datetime(project_component_cost_per_year_df_loop[["StartDate","EndDate","DateOfApproval"]])
        project_component_cost_per_year_df_loop["StartDate"] = pd.to_datetime(project_component_cost_per_year_df_loop["StartDate"])
        project_component_cost_per_year_df_loop["EndDate"] = pd.to_datetime(project_component_cost_per_year_df_loop["EndDate"])
        project_component_cost_per_year_df_loop["DateOfApproval"] = pd.to_datetime(project_component_cost_per_year_df_loop["DateOfApproval"])

        # NOTE: DATA SANITATION: Strip all trailing spaces
        str_cols_df = project_component_cost_per_year_df_loop.select_dtypes(['object', 'str'])
        project_component_cost_per_year_df_loop[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

        # NOTE: DATA SANITATION: Strip all trailing spaces

        with target_db_engine.begin() as rollback_on_error_conn:
            to_target(project_component_cost_per_year_df_loop, table_project_component_cost_per_year).to_sql(name=table_project_component_cost_per_year, con=rollback_on_error_conn, if_exists="append", index=False)
        # endregion L-PRJ COMPONENT COST PER YEAR: dbo.tProjectComponentCostPerYear rows

        # region L-PRJ MAJOR WORK ITEM: tProjectMajorWorkItem rows
        project_activity_mwi_df_loop = pd.read_sql_query(
            queries.build_project_major_work_item_from_activity(
                source_db_name, 
                target_db_name, 
                current_program_u_id, 
                current_is_deleted_status
            ), source_db_engine)

        project_activityinfra_mwi_df_loop = pd.read_sql_query(
            queries.build_project_major_work_item_from_activityinfra(
                source_db_name, 
                target_db_name, 
                current_program_u_id, 
                current_is_deleted_status
            ), source_db_engine)

        tProjectMajorWorkItem_df_loop = pd.concat([
            project_activity_mwi_df_loop[[
                "ComponentCostFK",
                "ComponentId",
                "YearOfWork", 
                "WorkTypeFK", 
                "InfraType", 
                "CreatedBy", 
                "CreatedDate", 
                "UpdatedBy", 
                "UpdatedDate", 
                "IsDeleted",
                "DataImportProgramId",
                "DataImportProjectId",
                "DataImportComponentId",
            ]],
            project_activityinfra_mwi_df_loop[[
                "ComponentCostFK",
                "ComponentId",
                "YearOfWork", 
                "WorkTypeFK", 
                "InfraType", 
                "CreatedBy", 
                "CreatedDate", 
                "UpdatedBy", 
                "UpdatedDate", 
                "IsDeleted",
                "DataImportProgramId",
                "DataImportProjectId",
                "DataImportComponentId",
            ]]
        ])

        # NOTE: Resolve InfraTypeFK from InfraType
        sql_statement = f"""SELECT * FROM {target_db_name}.dbo.tOptionInfraType"""
        optioninfratype_df = pd.read_sql_query(sql_statement, target_db_engine)

        # Create lower case for case-insensitive comparison
        optioninfratype_df["InfraName_low"] = optioninfratype_df["InfraName"].str.lower()
        # optioninfratype_df["InfraTypeFK"] = optioninfratype_df["InfraId"]
        optioninfratype_df["InfraTypeFK"] = optioninfratype_df["InfraCode"]
        tProjectMajorWorkItem_df_loop["InfraName_low"] = tProjectMajorWorkItem_df_loop["InfraType"].str.lower()

        # Merge to get InfraTypeFK from code table
        tProjectMajorWorkItem_df_loop_infratypefk = pd.merge(
            tProjectMajorWorkItem_df_loop, optioninfratype_df[["InfraTypeFK","InfraName_low"]], 
            # how='outer', left_on=['AlternateId'],right_on=['ProjectId'], # NOTE:Problematic for Alternate IDs containing MYIDs
            how='left', left_on=['InfraName_low'], right_on=['InfraName_low'], 
            suffixes=("_left", "_right"),
            indicator=True)
        
        # NOTE: DEBUG
        print(">>> InfraTypeFK Mapping")
        print(tProjectMajorWorkItem_df_loop_infratypefk[tProjectMajorWorkItem_df_loop_infratypefk["InfraTypeFK"].isna()])

        # Write to SQL
        tProjectMajorWorkItem_df_loop=tProjectMajorWorkItem_df_loop_infratypefk[[
            "ComponentCostFK", 
            "ComponentId",
            "YearOfWork", 
            "WorkTypeFK", 
            "InfraTypeFK", 
            "CreatedBy", 
            "CreatedDate", 
            "UpdatedBy", 
            "UpdatedDate", 
            "IsDeleted",
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]]
        # NOTE: DATA SANITATION: Handle Work Items with no Component Cost
        tProjectMajorWorkItem_df_loop=tProjectMajorWorkItem_df_loop.fillna(value={
            "ComponentCostFK": 0
        })
        
        # NOTE: DATA SANITATION: Strip all trailing spaces
        # str_cols_df = tProjectMajorWorkItem_df_loop.select_dtypes(['object', 'str'])
        str_cols_df = tProjectMajorWorkItem_df_loop[[
            "CreatedBy", 
            "UpdatedBy", 
            "DataImportProgramId",
            "DataImportProjectId",
            "DataImportComponentId",
        ]]
        tProjectMajorWorkItem_df_loop[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

        # Write to DB
        with target_db_engine.begin() as rollback_on_error_conn:
            to_target(tProjectMajorWorkItem_df_loop, table_project_major_work_item).to_sql(name=table_project_major_work_item, con=rollback_on_error_conn, if_exists="append", index=False)

        # endregion L-PRJ MAJOR WORK ITEM: tProjectMajorWorkItem rows

        # region L-PROJECT MAJOR WORK LOCATION: tProjectMajorWorkLocations rows
        project_activity_df_loop = pd.read_sql_query(
            queries.build_project_major_work_locations_from_activity(
                source_db_name, 
                target_db_name, 
                current_program_u_id, 
                current_is_deleted_status
            ) , source_db_engine)
        
        # NOTE: DATA SANITATION: Strip all trailing spaces
        str_cols_df = project_activity_df_loop.select_dtypes(['object', 'str'])
        project_activity_df_loop[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

        # NOTE: DATA SANITATION: Choose appropriate Infra Id for road or bridge, or default to what is available
        if not project_activity_df_loop.empty:
            project_activity_df_loop["InfraId"] = project_activity_df_loop.apply(
                    choose_infraid_from_infratype
                , axis=1)
            
        project_activityinfra_df_loop = pd.read_sql_query(
            queries.build_project_major_work_locations_from_activityinfra(
                source_db_name, 
                target_db_name, 
                current_program_u_id, 
                current_is_deleted_status
            ), source_db_engine)
        
        # NOTE: DATA SANITATION: Strip all trailing spaces
        str_cols_df = project_activityinfra_df_loop.select_dtypes(['object', 'str'])
        project_activityinfra_df_loop[str_cols_df.columns] = str_cols_df.apply(lambda x: x.str.strip())

        tProjectMajorWorkLocations_df_loop = pd.concat([
            project_activity_df_loop[[
                "WorkItemFK",
                "ComponentId",
                "InfraId",
                "DetailedScope1",
                "DetailedScope2",
                "TargetUnitId",
                "TargetUnit",
                # "StartX",
                # "StartY",
                # "EndX",
                # "EndY",
                "PhysicalTarget",
                "StartStationLimit",
                "EndStationLimit",
                "StartChainage",
                "EndChainage",
                "Length",
                "CreatedBy",
                "CreatedDate",
                "UpdatedBy",
                "UpdatedDate",
                "IsDeleted",
                "DataImportProgramId",
                "DataImportProjectId",
                "DataImportComponentId",
            ]],
            project_activityinfra_df_loop[[
                "WorkItemFK",
                "ComponentId",
                "InfraId",
                "DetailedScope1",
                "DetailedScope2",
                "TargetUnitId",
                "TargetUnit",
                "StartX",
                "StartY",
                "EndX",
                "EndY",
                # "PhysicalTarget",
                # "StartStationLimit",
                # "EndStationLimit",
                # "StartChainage",
                # "EndChainage",
                # "Length",
                "CreatedBy",
                "CreatedDate",
                "UpdatedBy",
                "UpdatedDate",
                "IsDeleted",
                "DataImportProgramId",
                "DataImportProjectId",
                "DataImportComponentId",
            ]]
        ])

        tProjectMajorWorkLocations_df_loop["DetailedScope"] = tProjectMajorWorkLocations_df_loop.apply(
            lambda row: f"{row['DetailedScope1']}{row['DetailedScope2']}".strip(),
            axis=1
        )
        
        tProjectMajorWorkLocations_df_loop = tProjectMajorWorkLocations_df_loop[[
                "WorkItemFK",
                "ComponentId",
                "InfraId",
                "DetailedScope",
                "TargetUnitId",
                "TargetUnit",
                "StartX",
                "StartY",
                "EndX",
                "EndY",
                "PhysicalTarget",
                "StartStationLimit",
                "EndStationLimit",
                "StartChainage",
                "EndChainage",
                "Length",
                "CreatedBy",
                "CreatedDate",
                "UpdatedBy",
                "UpdatedDate",
                "IsDeleted",
                "DataImportProgramId",
                "DataImportProjectId",
                "DataImportComponentId",
            ]]
        # Write to DB
        with target_db_engine.begin() as rollback_on_error_conn:
            to_target(tProjectMajorWorkLocations_df_loop, table_project_major_work_locations).to_sql(name=table_project_major_work_locations, con=rollback_on_error_conn, if_exists="append", index=False)

        # endregion L-PROJECTS
        
    # endregion LOOP through remaining program stages

    return projects_of_program_df_1st, \
    project_revisions_df_1st, \
    project_stages_df_1st, \
    project_cost_all_df_1st, \
    PROJECTS_START_DF
    

    
# endregion Project Migration
