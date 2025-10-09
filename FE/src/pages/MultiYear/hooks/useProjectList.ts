import { useAtom } from 'jotai';
import { projectMultiYearListAtom, projectMultiYearLoadingAtom, updateProjectMultiYearAtom } from '../state/multiYearState';
import { useCallback } from 'react';
import { ProjectsPaginated } from '../mockData/Projects';
// import { fetchProjects } from '../Service';
// import type { ProjectPagination } from '../Model.d';


export const useProjectList = () => {
    const [projectData] = useAtom(projectMultiYearListAtom);
    const [, updateProjectData] = useAtom(updateProjectMultiYearAtom);
    const [isLoading, setIsLoading] = useAtom(projectMultiYearLoadingAtom);

    const initializeProjectData = useCallback(async (programId?: string) => {
        setIsLoading(true);
        console.log('initializeProjectData called with programId:', programId);
        console.log('All projects:', ProjectsPaginated.lists);
        
        try {
            let filteredProjects = ProjectsPaginated;

            // Filter projects by program ID if provided
            if (programId) {
                const filtered = ProjectsPaginated.lists.filter(project => {
                    console.log(`Comparing project.ProgramId "${project.ProgramId}" with programId "${programId}"`);
                    return project.ProgramId === programId;
                });
                console.log('Filtered projects:', filtered);
                
                filteredProjects = {
                    ...ProjectsPaginated,
                    lists: filtered,
                    total: filtered.length,
                    totalPages: Math.ceil(filtered.length / ProjectsPaginated.limit)
                };
            }
            
            console.log('Final filtered projects to update:', filteredProjects);
            updateProjectData(filteredProjects);
        } catch (error) {
            console.error("Error initializing project data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [updateProjectData, setIsLoading]);

    const projectWithFilters = useCallback(async (filters?: any) => {
        setIsLoading(true);
        try {
            // Implement filtering logic here
            console.log('Applying filters:', filters);
        } catch (error) {
            console.error("Error applying filters:", error);
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading]);

    const PaginateProjects = useCallback((page: number) => {
        if (projectData) {
            const updatedData = {
                ...projectData,
                page: page
            };
            updateProjectData(updatedData);
        }
    }, [projectData, updateProjectData]);

    return {
        projectData,
        isLoading,
        initializeProjectData,
        projectWithFilters,
        PaginateProjects,
        updateProjectData,
        setIsLoading
    };
}