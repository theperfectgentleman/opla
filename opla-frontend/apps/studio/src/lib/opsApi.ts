/**
 * Studio Ops contracts — same attendance + submission-review paths mobile already uses.
 * Keep this module free of axios / Vite so node:test can import it.
 */

export type AttendanceStatus = 'checked_in' | 'checked_out';

export type AttendanceLocation = {
    latitude: number;
    longitude: number;
    accuracy_meters?: number;
    label?: string;
};

export type AttendanceEventPayload = {
    timestamp?: string;
    location: AttendanceLocation;
    note?: string;
    image_uri?: string;
    signature?: string;
};

export type ProjectAttendanceRecord = {
    id: string;
    project_id: string;
    user_id: string;
    attendance_date: string;
    status: AttendanceStatus;
    check_in_at: string;
    check_in_location_json: AttendanceLocation;
    check_in_note?: string | null;
    check_in_image_uri?: string | null;
    check_in_signature?: string | null;
    check_out_at?: string | null;
    check_out_location_json?: AttendanceLocation | null;
    check_out_note?: string | null;
    check_out_image_uri?: string | null;
    check_out_signature?: string | null;
    created_at: string;
    updated_at: string;
};

export type SubmissionReviewStatus = 'submitted' | 'approved' | 'rejected';

export type SubmissionReviewPayload = {
    review_status: SubmissionReviewStatus;
    review_comment?: string;
};

export type ReviewQueueItem = {
    id: string;
    form_id: string;
    form_title: string;
    user_id?: string | null;
    data: Record<string, unknown>;
    review_status: SubmissionReviewStatus;
    review_comment?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    created_at: string;
};

export function projectAttendanceCollectionPath(orgId: string, projectId: string): string {
    return `/organizations/${orgId}/projects/${projectId}/attendance`;
}

export function projectAttendanceMyStatusPath(orgId: string, projectId: string): string {
    return `/organizations/${orgId}/projects/${projectId}/attendance/my-status`;
}

export function projectAttendanceCheckInPath(orgId: string, projectId: string): string {
    return `/organizations/${orgId}/projects/${projectId}/attendance/check-in`;
}

export function projectAttendanceCheckOutPath(orgId: string, projectId: string): string {
    return `/organizations/${orgId}/projects/${projectId}/attendance/check-out`;
}

export function formSubmissionsPath(formId: string): string {
    return `/forms/${formId}/submissions`;
}

export function submissionReviewPath(submissionId: string): string {
    return `/submissions/${submissionId}/review`;
}

export function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

export function localDateKey(value: Date = new Date()): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function apiErrorMessage(err: unknown, fallback: string): string {
    const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
        return detail;
    }
    if (Array.isArray(detail)) {
        const first = detail[0] as { msg?: string } | string | undefined;
        if (typeof first === 'string' && first.trim()) {
            return first;
        }
        if (first && typeof first === 'object' && typeof first.msg === 'string' && first.msg.trim()) {
            return first.msg;
        }
    }
    const message = (err as { message?: string })?.message;
    return message && message.trim() ? message : fallback;
}

export function attendanceLocationFromCoords(
    coords: { latitude: number; longitude: number; accuracy?: number | null },
    label = 'Studio',
): AttendanceLocation {
    return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        ...(coords.accuracy != null ? { accuracy_meters: coords.accuracy } : {}),
        label,
    };
}

export function attendanceEventPayload(
    location: AttendanceLocation,
    options?: { timestamp?: string; note?: string; image_uri?: string; signature?: string },
): AttendanceEventPayload {
    const payload: AttendanceEventPayload = { location };
    if (options?.timestamp) {
        payload.timestamp = options.timestamp;
    }
    const note = options?.note?.trim();
    if (note) {
        payload.note = note;
    }
    const imageUri = options?.image_uri?.trim();
    if (imageUri) {
        payload.image_uri = imageUri;
    }
    const signature = options?.signature?.trim();
    if (signature) {
        payload.signature = signature;
    }
    return payload;
}
