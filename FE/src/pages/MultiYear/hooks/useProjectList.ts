import { useAtom } from 'jotai';
import { projectMultiYearListAtom, projectMultiYearLoadingAtom } from '../state/multiYearState';
import { useCallback } from 'react';
// import { fetchProjects } from '../Service';
// import type { ProjectPagination } from '../Model.d';


export const useProjectList = () => {
    const [projectList] = useAtom(projectMultiYearListAtom);
    const [loading] = useAtom(projectMultiYearLoadingAtom);

    const fetchProjectList = useCallback(async () => {
        // Implement fetch logic here
    }, []);

    return {
        projectList,
        loading,
        fetchProjectList
    };
}