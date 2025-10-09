import { useAtom } from "jotai";
import { multiYearListAtom, multiYearLoadingAtom } from "../state/multiYearState";
import { useCallback } from "react";
import { ProgramPaginated } from "../mockData/Programs";


export const useProgramList = () => {
    const [programData] = useAtom(multiYearListAtom);
    const [, updateProgramData ] = useAtom(multiYearListAtom);
    const [isLoading, setIsLoading] = useAtom(multiYearLoadingAtom);

    const initializeData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch data and update state'
            updateProgramData(ProgramPaginated)
        } catch (error) {
            console.error("Error initializing data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [ProgramPaginated, updateProgramData, setIsLoading]);

    const programWithFilters = useCallback(async (filters?: any) => {
        setIsLoading(true);
        try {

            // setProgramList();
        } catch (error) {
            console.error("Error applying filters:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const Paginate = useCallback((page: number) => {
        if (programData) {
            const updatedData = {
                ...programData,
                page: page
            };
            updateProgramData(updatedData);
        }
    }, [programData, updateProgramData]);

    return {
        initializeData,
        programWithFilters,
        updateProgramData,
        setIsLoading,
        isLoading,
        programData,
        Paginate
    }
}