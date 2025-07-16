import { httpClient, type ErrorResponse } from "../../services/httpClient";
import type { ProgramDetails } from "./Model";

export const initProgramDetails = async (programId: number) => {
    try {
        const response = await httpClient.post<ProgramDetails>(`/Program/Details/${programId}`, null, {
            preloaderMessage: 'Loading program details...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching program details:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const searchProgram = async (programName: string) => {
    try {
        const response = await httpClient.post<ProgramDetails>(`/Program/Search/${programName}`, null, {
            preloaderMessage: 'Searching program...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error searching program:', ErrorResponse);
        throw ErrorResponse;
    }
};