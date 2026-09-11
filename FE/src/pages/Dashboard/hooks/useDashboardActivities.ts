import { fetchDashboardActivities } from '../Service';
import { activitiesCacheAtom } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';
import type { ActivityLog } from '../components/DashboardActivityFeed';

function mapActivities(raw: Awaited<ReturnType<typeof fetchDashboardActivities>>): ActivityLog[] {
  return (raw.Activities ?? []).map((item) => ({
    id: item.Id,
    type: item.Type,
    title: item.Title,
    description: item.Description,
    timestamp: item.Timestamp,
    user: item.User,
  }));
}

export function useDashboardActivities(year: number, dataSourceMode: 'real' | 'benchmark', enabled: boolean) {
  return useSectionData({
    atom: activitiesCacheAtom,
    fetchFn: fetchDashboardActivities,
    map: mapActivities,
    year,
    dataSourceMode,
    enabled,
  });
}
