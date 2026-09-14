"""Load the 2023 and 2025 annual program groups from MYPS_BAK into myps_db_dev_200.

WHY A SECOND ENTRYPOINT

steps_for_migration.py drives the load from an Excel sheet and targets myps_db_migrated.
This one is for a specific, repeatable job: bringing the program groups that hold Lump Sum
projects onto the APPLICATION's database, so the Lump Sum module can see them. The group
list is inline rather than in a sheet because it is the subject of the work, not a
parameter of it — see documents/plans/legacy-ls-migration-2023-2025.md in project_myps.

WHAT IT LOADS

Four groups, every stage of each:

    2023 CSSP    BP -> NEP -> HGAB -> GAA -> GAA-R      34 Lump Sum parents
    2023 LP      BP -> NEP -> HGAB -> GAA -> GAA-R      20
    2023 OO-1    BP -> NEP -> HGAB -> GAA -> GAA-R       3
    2025 OO-1    BP -> NEP -> NEP-E -> GAA -> GAA-R      4   (the parents first appear at GAA)

A group's FIRST stage is whichever stage it actually starts at, not necessarily BP —
build_first_stage_tracking applies its BP id-swap only when the first stage IS BP, and
split_new_projects keys a project first seen at a later stage by that stage's id. The 2025
OO-1 Lump Sum parents appear for the first time at GAA and are keyed from there, which is
the intended behaviour, not a gap.

LOCALHOST ONLY

The source and target are constants here, not read from .env — .env points MYPS_DB at
192.168.50.200, and this load must never reach it. Both hosts are resolved and refused
unless they are loopback or this machine. .env supplies credentials only.

NOT IDEMPOTENT

The reference pipeline has no idempotency: a second run duplicates everything. This script
refuses to start if any of the four ProgramPKs already exists on the target. It also commits
per table per stage, so a failure mid-group leaves a partial group — undo it with
migration_sql/rollback_program_group.sql and re-run that group alone.

HOW TO RUN

    .pixi/envs/default/python.exe -m app.data_migration.steps_for_2023_2025_groups
    .pixi/envs/default/python.exe -m app.data_migration.steps_for_2023_2025_groups --group "2023 LP"
    .pixi/envs/default/python.exe -m app.data_migration.steps_for_2023_2025_groups --notes-only
"""
# region Deps
from __future__ import annotations

import argparse
import ipaddress
import logging
import socket
import sys
from typing import Sequence

import sqlalchemy as sqa
from dotenv import dotenv_values

from app.data_migration import migration

# endregion Deps

logger = logging.getLogger(__name__)

# region Config
ENV_FILE = r"C:\Users\User\Eptisa\git_wsl\02_refactored\myps-gis-backend\.env"

# Constants, deliberately. See LOCALHOST ONLY above.
SOURCE_DB_HOSTNAME = "localhost"
SOURCE_DB_NAME = "MYPS_BAK"
TARGET_DB_HOSTNAME = "localhost"
TARGET_DB_NAME = "myps_db_dev_200"

DB_DRIVER = "mssql+pymssql"
SQL_ECHO = False  # two million inserts; the reference's True is unusable here

MIGRATION_USER = "data_migration"

# [ProgramId, StageName, StageNum] per stage, ordered. StageNum is tOptionProgramStage.NameId
# on the target: BP 1, NEP 2, NEP-E 3, HGAB 4, HGAB-I 5, GAA 6, GAA-R 7.
PROGRAM_GROUPS: dict[str, list[list]] = {
    "2023 CSSP": [
        ["P_CO-PS-291_08222022_145740", "BP", 1],
        ["P_CO-PS-282_09212022_141356", "NEP", 2],
        ["P_CO-PS-282_12292022_083337", "HGAB", 4],
        ["P_CO-PS-282_01142023_105816", "GAA", 6],
        ["P_CO-PS-535_03292023_105429", "GAA-R", 7],
    ],
    "2023 LP": [
        ["P_CO-PS-535_09102022_074918", "BP", 1],
        ["P_CO-PS-535_09212022_141445", "NEP", 2],
        ["P_CO-PS-535_01052023_101752", "HGAB", 4],
        ["P_CO-PS-535_01052023_101908", "GAA", 6],
        ["P_CO-PS-535_03272023_132031", "GAA-R", 7],
    ],
    "2023 OO-1": [
        ["P_CO-PS-282_08232022_121112", "BP", 1],
        ["P_CO-PS-635_09212022_141324", "NEP", 2],
        ["P_CO-PS-553_12162022_140357", "HGAB", 4],
        ["P_CO-PS-634_01132023_075641", "GAA", 6],
        ["P_CO-PS-635_04182023_172516", "GAA-R", 7],
    ],
    "2025 OO-1": [
        ["P_CO-PS-800_07152024_143901", "BP", 1],
        ["P_CO-PS-635_08062024_153734", "NEP", 2],
        ["P_CO-PS-635_09162024_075851", "NEP-E", 3],
        ["P_CO-PS-635_01302025_100232", "GAA", 6],
        ["P_CO-PS-635_04112025_134220", "GAA-R", 7],
    ],
}

# Smallest first: 2023 LP is 294 projects and proves the pipeline in minutes.
GROUP_ORDER = ["2023 LP", "2023 OO-1", "2023 CSSP", "2025 OO-1"]

# Already on the target from the 2024 load, which predates the notes work. Their itemization
# history never landed, so their 2,027 loaded children carry no parent link.
NOTES_BACKFILL_PROGRAM_IDS = [
    "P_CO-PS-535_03252024_154915",  # GAA 2024 SSP    (GAA-R)
    "P_CO-PS-634_03252024_123925",  # GAA 2024 OO-1   (GAA-R)
    "P_CO-PS-220_03252024_155224",  # GAA 2024 LP     (GAA-R)
]
# endregion Config


# region Localhost guard
def _is_local(hostname: str) -> bool:
    """True when `hostname` resolves to loopback or to an address of this machine."""
    try:
        _, _, addresses = socket.gethostbyname_ex(hostname)
    except OSError:
        return False

    own = set()
    try:
        _, _, own_addresses = socket.gethostbyname_ex(socket.gethostname())
        own.update(own_addresses)
    except OSError:
        pass

    for address in addresses:
        if ipaddress.ip_address(address).is_loopback or address in own:
            continue
        return False
    return bool(addresses)


def assert_local(hostname: str, role: str) -> None:
    if not _is_local(hostname):
        raise SystemExit(
            f"REFUSED: {role} host {hostname!r} is not this machine. "
            "This load is localhost-only and will not touch a shared server."
        )
    logger.info("%s host %s: local", role, hostname)
# endregion Localhost guard


# region Engines
def _engine(hostname: str, database: str, username: str, password: str):
    url = sqa.engine.URL.create(
        DB_DRIVER, username=username, password=password, host=hostname, database=database
    )
    return sqa.create_engine(url, echo=SQL_ECHO)


def build_engines():
    """Both engines use the MYPS_BAK_DB_* credentials, because both point at localhost.

    .env's MYPS_DB_* pair belongs to 192.168.50.200 — a different server with a different sa
    password — and using it here fails to log in, which is the correct outcome for a
    credential that was never meant for this machine. MYPS_BAK_DB_HOSTNAME is server.local,
    which resolves to 127.0.0.1, so MYPS_BAK_DB_PASSWORD *is* the localhost credential and is
    the right one for both the source and the target."""
    env = dotenv_values(ENV_FILE)
    username = env["MYPS_BAK_DB_USERNAME"]
    password = env["MYPS_BAK_DB_PASSWORD"]
    source = _engine(SOURCE_DB_HOSTNAME, SOURCE_DB_NAME, username, password)
    target = _engine(TARGET_DB_HOSTNAME, TARGET_DB_NAME, username, password)
    return source, target
# endregion Engines


# region Pre-flight
def program_pk_for(group_name: str) -> str:
    """The ProgramPK the reference will generate for a group: MP_ + its first stage's id."""
    return f"MP_{PROGRAM_GROUPS[group_name][0][0]}"


def assert_not_already_loaded(target_engine, group_names: Sequence[str]) -> None:
    """The reference appends unconditionally — a second run duplicates a whole group."""
    wanted = {name: program_pk_for(name) for name in group_names}
    with target_engine.connect() as connection:
        rows = connection.execute(
            sqa.text("SELECT ProgramPK FROM dbo.tPrograms WHERE ProgramPK IN :pks").bindparams(
                sqa.bindparam("pks", expanding=True)
            ),
            {"pks": list(wanted.values())},
        ).fetchall()

    present = {row[0] for row in rows}
    clashes = [f"{name} ({pk})" for name, pk in wanted.items() if pk in present]
    if clashes:
        raise SystemExit(
            "REFUSED: already on the target — " + ", ".join(clashes) + ". "
            "Roll the group back with migration_sql/rollback_program_group.sql before re-running."
        )
# endregion Pre-flight


# region Run
def migrate_group(group_name: str, source_engine, target_engine) -> None:
    stages = PROGRAM_GROUPS[group_name]
    program_ids = [stage[0] for stage in stages]
    logger.info("=== %s: %d stage(s), first stage %s ===", group_name, len(stages), stages[0][1])

    program_pk, *_ = migration.migrate_programs_and_stages(
        program_ids,
        SOURCE_DB_NAME, source_engine,
        TARGET_DB_NAME, target_engine,
    )

    migration.migrate_projects_and_stages_in_annual_program(
        program_pk,
        stages,
        SOURCE_DB_NAME, source_engine,
        TARGET_DB_NAME, target_engine,
    )

    logger.info("=== %s: done (%s) ===", group_name, program_pk)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--group", action="append", choices=list(PROGRAM_GROUPS),
                        help="load only this group; repeatable. Default: all, smallest first.")
    parser.add_argument("--notes-only", action="store_true",
                        help="back-fill itemization notes for the already-loaded 2024 programs and exit.")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO, stream=sys.stdout,
        format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S",
    )

    assert_local(SOURCE_DB_HOSTNAME, "source")
    assert_local(TARGET_DB_HOSTNAME, "target")
    logger.info("source %s/%s -> target %s/%s",
                SOURCE_DB_HOSTNAME, SOURCE_DB_NAME, TARGET_DB_HOSTNAME, TARGET_DB_NAME)

    source_engine, target_engine = build_engines()

    if args.notes_only:
        written = migration.migrate_notes_for_programs(
            NOTES_BACKFILL_PROGRAM_IDS,
            SOURCE_DB_NAME, source_engine,
            TARGET_DB_NAME, target_engine,
            MIGRATION_USER,
        )
        logger.info("Back-filled %d itemization note(s).", written)
        return 0

    group_names = args.group or GROUP_ORDER
    assert_not_already_loaded(target_engine, group_names)
    logger.info("Groups to load, in order: %s", ", ".join(group_names))

    for group_name in group_names:
        migrate_group(group_name, source_engine, target_engine)

    logger.info("All groups loaded.")
    return 0
# endregion Run


if __name__ == "__main__":
    raise SystemExit(main())
