import { useAtom } from "jotai";
import { modCategoryAtom, modReasonAtom } from "../../Modification/state/modState";
import { useCallback } from "react";
import { categoryData, reasonData } from "../mockData/Dropdown";

export const useDropDownData = () => {
    const [modCategories, setModCategories] = useAtom(modCategoryAtom);
    const [modReasons, setModReasons] = useAtom(modReasonAtom);

    const initializeData = useCallback(async () => {
        // setIsloading(true);
        try {
            // const response = await fetchDropDownData();
            // if (response && response.Data){
            //     setModCategories(response.Data.ModCategories);
            //     setModReasons(response.Data.ModReasons);
            // }else {
            //     setModCategories(categoryData);
            //     setModReasons(reasonData);
            // }
            setModCategories(categoryData);
            setModReasons(reasonData);
        } catch (error) {
            console.error('Error initializing dropdown data:', error);
        }
    }, [setModCategories, setModReasons]);

    return {
        initializeData,
        modCategories,
        modReasons
    }
}