// Offline (no-VPN) fallback for local development.
//
// The dev proxy targets VITE_API_BASE_URL (https://dpwh.eptisa-dev.com), which is
// only reachable over the company VPN. Off VPN, /auth/validate never gets an answer,
// so the app bounces to /login and stays there. When VITE_OFFLINE_FALLBACK=true we
// instead start a local session and land on VITE_OFFLINE_ROUTE — expected to be a
// module that runs entirely on mocks.
//
// Gated on import.meta.env.DEV as well as the flag: a production build can never
// fabricate a session, whatever an env file says.

import { matchPath } from 'react-router-dom';
import { appRouteList } from './appRouteList';
import type { User } from '../pages/login/Service';

export const offlineFallbackEnabled =
    import.meta.env.DEV && import.meta.env.VITE_OFFLINE_FALLBACK === 'true';

/** Landing route when the backend answered normally (VPN up). */
export const onlineRoute: string = import.meta.env.VITE_DEFAULT_ROUTE || '/dashboard';

/** Landing route when the backend is unreachable (VPN down). */
export const offlineRoute: string = import.meta.env.VITE_OFFLINE_ROUTE || '/multiyear';

/**
 * True when the backend never answered — VPN down, DNS failure, or the Vite proxy
 * failing to reach its target — as opposed to the backend answering with a real
 * rejection such as 401. The proxy surfaces a dead target as a 5xx, and a raw
 * network error arrives with no status at all.
 */
export function isBackendUnreachable(error: any): boolean {
    const status: number | undefined = error?.response?.status ?? error?.Status;
    if (status === undefined) return true;
    return status >= 500;
}

/** True when `pathname` matches a path the app knows about, params included. */
export function isKnownRoute(pathname: string): boolean {
    return appRouteList.some((route) => matchPath(route.path, pathname) !== null);
}

/** Placeholder identity used only while offline. */
export const offlineUser: User = {
    FirstName: 'Offline',
    LastName: 'User',
    Name: 'Offline User',
    UserName: 'offline',
    UserId: 'offline-user',
    UserRole: 'Administrator',
    PhoneNumber: '',
    Credit: 0,
    UserGroupNames: [],
};

/** Every known route name, so no screen is permission-blocked while offline. */
export const offlineViewAccess: string[] = appRouteList.map((route) => route.RouteName);
