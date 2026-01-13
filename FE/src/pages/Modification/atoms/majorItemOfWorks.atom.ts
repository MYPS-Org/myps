import { atom } from 'jotai';
import type {
    MajorItemOfWork,
    MajorItemLocations,
    ScopeOfWorkEnum
} from '../../Project/Model.d'

/**
 * Source atoms (pure state)
 */
export const ScopeOfWorkEnumAtom = atom<ScopeOfWorkEnum[]>([]);
export const MajorItemOfWorksAtom = atom<MajorItemOfWork[]>([]);
export const MajorItemLocationsAtom = atom<MajorItemLocations[]>([]);
/**
 * Derived atoms (read-only, safe)
 */

export const MajorItemOfWorksWithDropdownAtom = atom(get => {
    const items = get(MajorItemOfWorksAtom);
    const locations = get(MajorItemLocationsAtom);
    const scopeOfWorks = get(ScopeOfWorkEnumAtom);

    if (!items.length) return [];

    return items.map(item => {
        const itemLocations = locations.filter(loc => loc.ParentId === item.ReferenceId);

        return {
            ...item,
            TargetUnitId: item.TargetUnitId || 0,
            TargetUnit: item.TargetUnit || '',
            MajorItemLocations: itemLocations,
            DropdownData: scopeOfWorks?.filter(s => s.InfraType === item.InfraType) ?? []

        }
    })
});