import { User } from "@opla/types";

export const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const getUserDisplayName = (user: User): string => {
    return user.name || user.email;
};

export {
    MOBILE_FIELD_TYPES,
    applyInputMask,
    collectFieldDefaults,
    displayInputValue,
    ensureFieldIdentity,
    formatLocalDate,
    getFieldKey,
    hasMeaningfulValue,
    isOnPlatform,
    parseFieldDefault,
    parseLocalDate,
    resolveAutoValue,
    validateFieldConstraints,
} from './formFields';
export type { FieldIdentity, FieldLike, MobileFieldType } from './formFields';
