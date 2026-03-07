const STUDIO_PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');
const MOBILE_DEEP_LINK_BASE = (import.meta.env.VITE_MOBILE_DEEP_LINK_BASE || 'opla://').trim();

function buildQuery(params: Record<string, string>) {
    const query = new URLSearchParams(params);
    return query.toString();
}

function joinLink(base: string, path: string, params: Record<string, string>) {
    const trimmedBase = base.endsWith('://') ? base : base.replace(/\/+$/, '');
    const separator = trimmedBase.endsWith('://') ? '' : '/';
    const query = buildQuery(params);
    return `${trimmedBase}${separator}${path}${query ? `?${query}` : ''}`;
}

export function buildStudioInvitationAcceptLink(token: string) {
    return joinLink(STUDIO_PUBLIC_URL, 'invitations/accept', { token });
}

export function buildMobileInvitationAcceptLink(token: string) {
    return joinLink(MOBILE_DEEP_LINK_BASE, 'invitations/accept', { token });
}

export function buildMobileJoinTeamLink(pin: string) {
    return joinLink(MOBILE_DEEP_LINK_BASE, 'join-team', { pin });
}