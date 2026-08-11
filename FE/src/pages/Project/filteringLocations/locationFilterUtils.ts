import type {
    ProjectEnums,
    ProjectDetails,
    ProjectCityEnum,
    ProjectLegislativeDistrictEnum,
    RODEOEnum,
    ProjectImplementingOfficeEnum,
    ProjectOperatingUnitEnum,
} from '../Model';

export interface RegionOption {
    ParticipantId: string;
    Name: string;
}

export interface FilteredLocationData {
    cities: ProjectCityEnum[];
    legislativeDistricts: ProjectLegislativeDistrictEnum[];
    deos: RODEOEnum[];
    ios: ProjectImplementingOfficeEnum[];
    ous: ProjectOperatingUnitEnum[];
    /** Region options for the Region dropdown. */
    regions: RegionOption[];
}

export const emptyLocationData: FilteredLocationData = {
    cities: [],
    legislativeDistricts: [],
    deos: [],
    ios: [],
    ous: [],
    regions: [],
};

type LocationDetails = Pick<
    ProjectDetails,
    'Province' | 'City' | 'LegislativeDistrict' | 'DEO' | 'ImplementingOffice'
>;

/** Deduplicate regions from a DEO list, preserving first-seen order. */
function getUniqueRegions(deos: RODEOEnum[]): RegionOption[] {
    const seen = new Set<string>();
    const result: RegionOption[] = [];
    for (const deo of deos) {
        if (!deo.RegionParticipantId || seen.has(deo.RegionParticipantId)) continue;
        seen.add(deo.RegionParticipantId);
        result.push({ ParticipantId: deo.RegionParticipantId, Name: deo.RegionName || '' });
    }
    return result;
}

/**
 * Standard filtering rules for normal projects.
 * Province → Cities, LDs, DEOs
 * City / LD / DEO → cross-filter each other via ProvinceCode
 * DEO → IOs (region-scoped R orgs + UPMO)
 * IO  → OUs
 * Region options are derived from the currently selected DEO.
 */
export function getStandardLocationFilters(
    enums: ProjectEnums,
    details: LocationDetails,
): FilteredLocationData {
    let availableCities = enums.Cities || [];
    let availableLDs = enums.LegislativeDistricts || [];
    let availableDEOs = enums.DEOs || [];
    let availableIOs = enums.ImplementingOffices || [];
    let availableOUs = enums.OperatingUnits || [];

    // ── Province-based filtering ──────────────────────────────────────────
    if (details.Province) {
        const provinceCode = details.Province;
        availableCities = enums.Cities?.filter((city) => city.ProvinceCode === provinceCode) || [];
        availableLDs = enums.LegislativeDistricts?.filter((ld) => ld.ProvinceCode === provinceCode) || [];
        availableDEOs = enums.DEOs?.filter((deo) => deo.ProvinceCode === provinceCode) || [];
    } else if (details.City) {
        const selectedCity = enums.Cities?.find((city) => city.Code === details.City);
        if (selectedCity) {
            availableLDs = enums.LegislativeDistricts?.filter((ld) => ld.ProvinceCode === selectedCity.ProvinceCode) || [];
        }
    } else if (details.LegislativeDistrict) {
        const selectedLD = enums.LegislativeDistricts?.find((ld) => ld.Code === details.LegislativeDistrict);
        if (selectedLD) {
            availableCities = enums.Cities?.filter((city) => city.ProvinceCode === selectedLD.ProvinceCode) || [];
        }
    } else if (details.DEO) {
        const selectedDEO = enums.DEOs?.find((deo) => deo.ParticipantId === details.DEO?.toString());
        if (selectedDEO) {
            availableCities = enums.Cities?.filter((city) => city.ProvinceCode === selectedDEO.ProvinceCode) || [];
        }
    }

    // ── IO filtering (DEO-scoped) ─────────────────────────────────────────
    if (details.DEO) {
        const selectedDEO = enums.DEOs?.find((deo) => deo.ParticipantId === details.DEO?.toString());
        if (selectedDEO) {
            availableIOs = enums.ImplementingOffices?.filter(
                (io) =>
                    (io.RegionParticipantId === selectedDEO.RegionParticipantId && io.OrgType === 'R') ||
                    io.OrgType === 'UPMO' ||
                    io.ParticipantId === selectedDEO.ParticipantId,
            ) || [];
        }
    } else {
        availableIOs = enums.ImplementingOffices?.filter((io) => io.OrgType === 'UPMO') || [];
    }

    // ── OU filtering (IO-scoped) ──────────────────────────────────────────
    if (details.ImplementingOffice) {
        const selectedIO = enums.ImplementingOffices?.find((io) => io.ParticipantId === details.ImplementingOffice);
        const selectedDEO = enums.DEOs?.find((deo) => deo.ParticipantId === details.DEO?.toString());
        if (selectedIO) {
            availableOUs = enums.OperatingUnits?.filter(
                (ou) =>
                    ou.OrgType === 'CO' ||
                    selectedDEO?.RegionParticipantId === ou.ParticipantId ||
                    selectedIO.ParticipantId === ou.ParticipantId ||
                    (selectedIO.OrgType === 'UPMO' ? selectedDEO?.ParticipantId === ou.ParticipantId : false),
            ) || [];
        }
    } else {
        availableOUs = enums.OperatingUnits || [];
    }

    // ── Region options (derived from selected DEO) ────────────────────────
    const regions = getUniqueRegions(
        (enums.DEOs || []).filter((deo) => deo.ParticipantId === details.DEO),
    );

    return {
        cities: availableCities,
        legislativeDistricts: availableLDs,
        deos: availableDEOs,
        ios: availableIOs,
        ous: availableOUs,
        regions,
    };
}

/**
 * Lump Sum filtering rules.
 * - Province, City, LD, DEO are not required → no geographic pre-filtering.
 * - Region is independently selectable from ALL available regions.
 * - IO shows UPMO offices (no DEO scope); OU follows IO as usual.
 */
export function getLumpsumLocationFilters(
    enums: ProjectEnums,
    details: LocationDetails,
): FilteredLocationData {
    // All location fields are unfiltered for LS
    let availableIOs = enums.ImplementingOffices?.filter((io) => io.OrgType === 'UPMO') || [];
    let availableOUs = enums.OperatingUnits || [];

    // Still apply IO → OU scoping if IO is selected
    if (details.ImplementingOffice) {
        const selectedIO = enums.ImplementingOffices?.find((io) => io.ParticipantId === details.ImplementingOffice);
        if (selectedIO) {
            availableIOs = enums.ImplementingOffices?.filter(
                (io) => io.OrgType === 'UPMO' || io.ParticipantId === selectedIO.ParticipantId,
            ) || [];
            availableOUs = enums.OperatingUnits?.filter(
                (ou) => ou.OrgType === 'CO' || selectedIO.ParticipantId === ou.ParticipantId,
            ) || [];
        }
    }

    // Region: all unique regions across all DEOs
    const regions = getUniqueRegions(enums.DEOs || []);

    return {
        cities: enums.Cities || [],
        legislativeDistricts: enums.LegislativeDistricts || [],
        deos: enums.DEOs || [],
        ios: availableIOs,
        ous: availableOUs,
        regions,
    };
}

/** Dispatch to the correct filter rule set based on project type. */
export function getLocationFilters(
    enums: ProjectEnums,
    details: LocationDetails,
    isLumpSum: boolean,
): FilteredLocationData {
    return isLumpSum
        ? getLumpsumLocationFilters(enums, details)
        : getStandardLocationFilters(enums, details);
}
