# region Deps
from pprint import pprint

import pandas as pd
import sqlalchemy as sqa
from dotenv import dotenv_values

from app.data_migration import migration

# endregion Deps

# region Config
# Machine-specific settings. Edit these before running.

# FOR: powershell-server.local
ENV_FILE = r"C:\Path\To\myps-gis\app\.env"
# FOR: WSL
# ENV_FILE = "/mnt/c/Users/User/Eptisa/git_wsl/myps-gis-backend/app/.env"

PROGRAMS_XLSX = r"C:\Path\To\myps_gis\documents\migrated_programs_myps_db.xlsx"
PROGRAMS_SHEET = "programs_2024_except_nogroup"
# PROGRAMS_SHEET = "programs_2024_nogroup"
# PROGRAMS_SHEET = "programs_2025_all"

# Program groups whose programs are migrated one-by-one instead of as a group
STANDALONE_GROUP_MARKERS = ("RBP", "RDIP")

# endregion Config

# region Load .env
env_config = dotenv_values(ENV_FILE)

pprint(env_config)

# endregion Load.env

# region SOURCE_DB & TARGET_DB Init
# SOURCE = MYPS_BAK_DB_* in .env, TARGET = MYPS_DB_* in .env
SOURCE_DB_NAME = env_config["MYPS_BAK_DB_DATABASE"]
SOURCE_DB_HOSTNAME = env_config["MYPS_BAK_DB_HOSTNAME"]
SOURCE_DB_USERNAME = env_config["MYPS_BAK_DB_USERNAME"]
SOURCE_DB_PASSWORD = env_config["MYPS_BAK_DB_PASSWORD"]

# TARGET_DB_NAME = env_config["MYPS_DB_DATABASE"]
TARGET_DB_NAME = "myps_db_migrated"
TARGET_DB_HOSTNAME = env_config["MYPS_DB_HOSTNAME"]
TARGET_DB_USERNAME = env_config["MYPS_DB_USERNAME"]
TARGET_DB_PASSWORD = env_config["MYPS_DB_PASSWORD"]

DB_DRIVER = "mssql+pymssql"  # swapped to pymssql
SQL_ECHO = True

SOURCE_DB_URL = sqa.engine.URL.create(
    DB_DRIVER,
    username=SOURCE_DB_USERNAME,
    password=SOURCE_***REMOVED***
    host=SOURCE_DB_HOSTNAME,
    database=SOURCE_DB_NAME,
)
SOURCE_DB_ENGINE = sqa.create_engine(SOURCE_DB_URL, echo=SQL_ECHO)

TARGET_DB_URL = sqa.engine.URL.create(
    DB_DRIVER,
    username=TARGET_DB_USERNAME,
    password=TARGET_***REMOVED***
    host=TARGET_DB_HOSTNAME,
    database=TARGET_DB_NAME,
)
TARGET_DB_ENGINE = sqa.create_engine(TARGET_DB_URL, echo=SQL_ECHO)

# DB Tables
table_program = "tPrograms"
table_program_revisions = "tProgramRevisions"
table_program_stages = "tProgramStages"
table_projects = "tProjects"
table_project_revisions = "tProjectRevisions"
table_project_stages = "tProjectStages"
table_project_major_work_items = "tProjectMajorWorkItem"
table_project_major_work_locations = "tProjectMajorWorkLocations"

# endregion

# region read input Excel Sheets
PROGRAM_COLUMNS = ["ProgramId", "StageId", "StageNum"]

programs_from_sheet_df = pd.read_excel(PROGRAMS_XLSX, sheet_name=PROGRAMS_SHEET)

programs_from_sheet_df["StageNum"] = pd.to_numeric(
    programs_from_sheet_df["StageNum"], errors="coerce"
).astype("Int64")
programs_grouped_df = programs_from_sheet_df.groupby("ProgramGroup")

# Create list of `programs_to_migrate`: one entry per migration unit, each a list
# of [ProgramId, StageId, StageNum] rows ordered by stage.
programs_to_migrate = []
for program_group, program_group_df in programs_grouped_df:
    # print(f"{program_group}: {program_group_df.shape}")
    group_rows = program_group_df[PROGRAM_COLUMNS].values.tolist()

    if any(marker in program_group for marker in STANDALONE_GROUP_MARKERS):
        # Each program in the group migrates on its own
        for program in group_rows:
            programs_to_migrate.append([program])
    else:
        programs_to_migrate.append(group_rows)

# endregion read input Excel Sheets

# region pre-checks before running actual Migration
pprint(programs_to_migrate)
print(f"SRC DB: {SOURCE_DB_ENGINE}")
print(f"TARG DB: {TARGET_DB_ENGINE}")
# raise Exception("!! STOP FOR TESTS !!")
# endregion pre-checks before running actual Migration


# region Run Actual Data Migration
for od_list_program_ids_and_stages in programs_to_migrate:
    # Migrate entries for Program Tables
    od_list_program_ids = [program[0] for program in od_list_program_ids_and_stages]
    pprint(od_list_program_ids)

    program_pk, program_df, program_revisions_df, program_stages_df = migration.migrate_programs_and_stages(
        od_list_program_ids,  # Ordered list of Program IDs to be migrated, ordered by stage
        SOURCE_DB_NAME, SOURCE_DB_ENGINE,  # Source DB name and connection (MYPS_BAK and host/ip)
        TARGET_DB_NAME, TARGET_DB_ENGINE,)

    # Migrate entries for Project Tables of this Top Level Program
    projects_df, project_revisions_df, project_stages_df, project_cost_all_df, PROJECTS_START_DF = migration.migrate_projects_and_stages_in_annual_program(
        program_pk,
        od_list_program_ids_and_stages,  # Ordered list of Program IDs to be migrated, ordered by stage
        SOURCE_DB_NAME, SOURCE_DB_ENGINE,  # Source DB name and connection (MYPS_BAK and host/ip)
        TARGET_DB_NAME, TARGET_DB_ENGINE,)

    # NOTE: DEBUG break
    # break

# endregion Run Actual Data Migration
