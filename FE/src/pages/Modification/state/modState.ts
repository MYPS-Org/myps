import { atom } from "jotai";

import type {
    ModificationList,
    ModificationCategory,
    ModificationReason
} from "../Model.d";

export const modListAtom = atom<ModificationList[]>([]);
export const modCategoryAtom = atom<ModificationCategory[]>([]);
export const modReasonAtom = atom<ModificationReason[]>([]);


