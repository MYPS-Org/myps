import { atom } from "jotai";
import type { ProgramDetails, ProgramList, ProgramPagination, ProjectList } from "../Model.d";

// #region PROGRAMS - Multi Year Atoms

export const multiYearDetailsAtom = atom<ProgramDetails>();

export const multiYearAtom = atom<ProgramList[]>([]);

// Paginate

interface PaginatedProgramData extends PaginationResponse<ProgramList> {}

export const multiYearListAtom = atom<PaginatedProgramData>({
    lists: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
});

export const multiYearFiltersAtom = atom<ProgramPagination>({
    filter: {
        StageName: '',
        YearStart: 0,
        YearEnd: 0,
    },
    sortfield: '',
    sortDirection: 1,
    page: 1,
    limit: 20
});

// loading state
export const multiYearLoadingAtom = atom<boolean>(false);

// Write-only atom for updating Program data
export const updateMultiYearAtom = atom(
  null,
  (_get, set, newData: PaginatedProgramData) => {
    set(multiYearListAtom, newData);
    // Also update legacy atom for backwards compatibility
    set(multiYearAtom, newData.lists);
  }
);

// Selected program for navigation to project list
export const selectedProgramAtom = atom<ProgramList | null>(null);
// #endregion

//  Project - Multi Year Atoms

export const projectMultiYearAtom = atom<ProjectList[]>([]);

// Paginate

interface PaginatedProjectData extends PaginationResponse<ProjectList> {}

export const projectMultiYearListAtom = atom<PaginatedProjectData>({
    lists: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
});

// loading state
export const projectMultiYearLoadingAtom = atom<boolean>(false);

// Write-only atom for updating Project data
export const updateProjectMultiYearAtom = atom(
  null,
  (_get, set, newData: PaginatedProjectData) => {
    set(projectMultiYearListAtom, newData);
    // Also update legacy atom for backwards compatibility
    set(projectMultiYearAtom, newData.lists);
  }
);