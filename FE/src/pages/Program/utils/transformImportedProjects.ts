import type {
  ImportedProject,
  ImportProjectDTO,
  DtoProgramDetails,
  DtoProjectDetails,
  DtoFundingProfile,
  DtoComponentCost,
  DtoComponentCostPerYear,
  DtoMajorItemOfWork,
  DtoMajorItemLocation,
} from '../../Project/Model.d';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the composite CostId used to link ComponentCost â†” ComponentCostPerYear. */
function costId(projectId: string, componentId: string): string {
  return `${projectId}-${componentId}`;
}

/** Coerce a value to a non-null string (empty string if nullish). */
function str(value: string | undefined | null): string {
  return value ?? '';
}

/** Coerce a value to a number (0 if nullish). */
function num(value: number | undefined | null): number {
  return value ?? 0;
}

// ---------------------------------------------------------------------------
// ProgramDetails  (one entry for the whole batch)
// ---------------------------------------------------------------------------
function buildProgramDetails(programId: string, stageName: string): DtoProgramDetails {
  return { programId, stageName };
}

// ---------------------------------------------------------------------------
// ProjectDetails  (one entry per project)
// ---------------------------------------------------------------------------
function buildProjectDetails(imported: ImportedProject): DtoProjectDetails {
  const d = imported.ProjectDetails;
  return {
    projectId:            str(d.ProjectId),
    alternateId:          d.AlternateId ?? null,
    externalId:           d.ExternalId  ?? null,
    myId:                 d.MYId        ?? null,
    uacs:                 d.UACS        ?? null,
    mycaApprovalDate:     d.MYCAApprovalDate ?? null,
    description:          null,                         // not in XLSM; backend sets it
    // Province is resolved to GdbId by the parser; the rest are plain names / codes
    province:             str(d.Province),
    city:                 str(d.City),
    legislativeDistrict:  str(d.LegislativeDistrict),
    operatingUnit:        str(d.OperatingUnit),
    implementingOffice:   str(d.ImplementingOffice),
    deo:                  str(d.DEO),
    region:               str(d.Region),
    // All enum/lookup fields sent as raw names â€” backend resolves to IDs
    category:             str(d.CategoryName),
    thrust:               str(d.ThrustName),
    origin:               str(d.OriginName),
    agency:               str(d.AgencyName),
    implementationMode:   str(d.ImplementationModeName),
    emergencyMode:        str(d.EmergencyModeName),
    feasibility:          str(d.FeasibilityName),
    feasibilityDate:      str(d.FeasibilityDate),
    detailedDesign:       str(d.DetailedDesignName),
    detailedDesignDate:   str(d.DetailedDesignDate),
    rowAvailable:         str(d.RowAvailableName),
    regionWide:           str(d.RegionWideName),
    tier:                 str(d.TierName),
  };
}

// ---------------------------------------------------------------------------
// FundingProfile
// ---------------------------------------------------------------------------
function buildFundingProfiles(imported: ImportedProject): DtoFundingProfile[] {
  return imported.FundingProfiles.map((row) => ({
    projectId:  row.ProjectId,
    source:     row.Source,
    agreement:  row.Agreement,
    percentage: 0,            // not in Excel; server calculates or defaults to 0
    amount:     row.Amount,
  }));
}

// ---------------------------------------------------------------------------
// ComponentCosts  +  ComponentCostPerYear
//
// Grouping rule:  same ProjectId + ComponentId â†’ one ComponentCost record
//   costId  = "{ProjectId}-{ComponentId}"
//   total   = sum of all row amounts within that group
//   Each row in the group â†’ one ComponentCostPerYear (keyed by same costId)
// ---------------------------------------------------------------------------
function buildComponentSections(imported: ImportedProject): {
  componentCosts: DtoComponentCost[];
  componentCostPerYear: DtoComponentCostPerYear[];
} {
  const costMap = new Map<string, DtoComponentCost>();
  const perYearRows: DtoComponentCostPerYear[] = [];

  for (const row of imported.ComponentCosts) {
    const id = costId(row.ProjectId, row.ComponentId);

    if (!costMap.has(id)) {
      costMap.set(id, {
        projectId:     row.ProjectId,
        costId:        id,
        componentType: row.ComponentType,
        componentId:   row.ComponentId,
        description:   str(row.Description),
        total:         0,   // accumulated below
      });
    }

    costMap.get(id)!.total += row.Total;

    perYearRows.push({
      componentCostId: id,
      amount:          row.Total,
      year:            row.ActivityYear ?? 0,
      startDate:       row.StartDate ?? null,
      endDate:         row.EndDate   ?? null,
    });
  }

  return {
    componentCosts:       Array.from(costMap.values()),
    componentCostPerYear: perYearRows,
  };
}

// ---------------------------------------------------------------------------
// MajorItemOfWorks  +  MajorItemLocations
//
// Grouping rule:
//   One MajorItemOfWork per unique (ComponentId + InfraType + WorkType + Year).
//   All MAJOR ITEMS rows in that group â†’ multiple MajorItemLocations linked via
//   parentId = referenceId.
//
// InfraType / WorkType are cross-referenced from COMPONENT DETAILS
//   (same ComponentId + Year) because MAJOR ITEMS sheet lacks those columns.
//
// referenceId is auto-generated as "{ProjectId}-{ComponentId}-{n}".
// ---------------------------------------------------------------------------
function buildMajorItemSections(imported: ImportedProject): {
  majorItemOfWorks: DtoMajorItemOfWork[];
  majorItemLocations: DtoMajorItemLocation[];
} {
  const works:     DtoMajorItemOfWork[]   = [];
  const locations: DtoMajorItemLocation[] = [];

  // Step 1: build component-info lookup  (ComponentId|Year â†’ infra/workType names)
  const compInfoMap = new Map<string, { infraTypeName: string; workTypeName: string }>();
  for (const comp of imported.ComponentCosts) {
    const key = `${comp.ComponentId}|${comp.ActivityYear ?? ''}`;
    if (!compInfoMap.has(key)) {
      compInfoMap.set(key, {
        infraTypeName: str(comp.InfraTypeName),
        workTypeName:  str(comp.WorkTypeName),
      });
    }
  }

  // Step 2: group major-item rows into works
  const workGroups = new Map<string, { work: DtoMajorItemOfWork; rows: typeof imported.MajorItemsOfWork }>();
  let groupCounter = 0;

  for (const row of imported.MajorItemsOfWork) {
    const compKey  = `${row.ComponentId}|${row.ActivityYear ?? ''}`;
    const compInfo = compInfoMap.get(compKey) ?? { infraTypeName: '', workTypeName: '' };
    const groupKey = `${row.ProjectId}|${row.ComponentId}|${compInfo.infraTypeName}|${compInfo.workTypeName}|${row.ActivityYear ?? ''}`;

    if (!workGroups.has(groupKey)) {
      groupCounter++;
      const refId = `${row.ProjectId}-${row.ComponentId}-${groupCounter}`;

      workGroups.set(groupKey, {
        work: {
          projectId:    row.ProjectId,
          referenceId:  refId,
          componentId:  row.ComponentId,
          yearOfWork:   row.ActivityYear ?? 0,
          infraType:    compInfo.infraTypeName,
          workTypeId:   compInfo.workTypeName,   // raw name â€” backend resolves to ID
          targetUnitId: str(row.TargetUnit),     // raw name â€” backend resolves to ID
          targetUnit:   str(row.TargetUnit),
        },
        rows: [],
      });
    }

    workGroups.get(groupKey)!.rows.push(row);
  }

  // Step 3: flatten into output arrays
  for (const { work, rows } of workGroups.values()) {
    works.push(work);

    for (const row of rows) {
      locations.push({
        parentId:          work.referenceId,
        infraId:           str(row.InfraId),
        detailedScope:     str(row.DetailedScope),
        targetUnitId:      str(row.TargetUnit),        // raw name â€” backend resolves
        targetUnit:        str(row.TargetUnit),
        physicalTarget:    num(row.PhysicalTarget),
        length:            num(row.Length),
        startChainage:     row.StartChainage != null ? String(row.StartChainage) : null,
        endChainage:       row.EndChainage   != null ? String(row.EndChainage)   : null,
        startX:            row.StartX        != null ? String(row.StartX)        : null,
        startY:            row.StartY        != null ? String(row.StartY)        : null,
        endX:              row.EndX          != null ? String(row.EndX)          : null,
        endY:              row.EndY          != null ? String(row.EndY)          : null,
        startStationLimit: row.StartStation  ?? null,
        endStationLimit:   row.EndStation    ?? null,
      });
    }
  }

  return { majorItemOfWorks: works, majorItemLocations: locations };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
/**
 * Transforms the raw parsed Excel data (`ImportedProject[]`) into a single
 * flat `ImportProjectDTO` ready for the backend import endpoint.
 *
 * @param imported   Output of `parseImportFile()`
 * @param programId  The program these projects are being imported into
 * @param stageName  The current stage of the program
 */
export function transformImportedProjects(
  imported: ImportedProject[],
  programId: string,
  stageName: string,
): ImportProjectDTO {
  const allProjectDetails:   DtoProjectDetails[]      = [];
  const allFunding:          DtoFundingProfile[]       = [];
  const allComponentCosts:   DtoComponentCost[]        = [];
  const allComponentPerYear: DtoComponentCostPerYear[] = [];
  const allMajorItemOfWorks: DtoMajorItemOfWork[]      = [];
  const allMajorLocations:   DtoMajorItemLocation[]    = [];

  for (const project of imported) {
    allProjectDetails.push(buildProjectDetails(project));
    allFunding.push(...buildFundingProfiles(project));

    const { componentCosts, componentCostPerYear } = buildComponentSections(project);
    allComponentCosts.push(...componentCosts);
    allComponentPerYear.push(...componentCostPerYear);

    const { majorItemOfWorks, majorItemLocations } = buildMajorItemSections(project);
    allMajorItemOfWorks.push(...majorItemOfWorks);
    allMajorLocations.push(...majorItemLocations);
  }

  return {
    programDetails:      buildProgramDetails(programId, stageName),
    projectDetails:      allProjectDetails,
    fundingProfile:      allFunding,
    componentCosts:      allComponentCosts,
    componentCostPerYear: allComponentPerYear,
    majorItemOfWorks:    allMajorItemOfWorks,
    majorItemLocations:  allMajorLocations,
  };
}


