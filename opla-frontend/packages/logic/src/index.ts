import { User } from "@opla/types";

export const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const getUserDisplayName = (user: User): string => {
    return user.name || user.email;
};

export {
    MOBILE_FIELD_TYPES,
    applyDecimalNormalization,
    applyInputMask,
    applyOnLoadAutoValues,
    applyOnSubmitAutoValues,
    cellInputValue,
    collectFieldDefaults,
    displayInputValue,
    effectiveInputMaxLength,
    ensureFieldIdentity,
    formatLocalDate,
    getFieldKey,
    hasMeaningfulValue,
    isNavigationalField,
    isOnPlatform,
    normalizeDecimalValue,
    parseFieldDefault,
    parseLocalDate,
    resolveAutoValue,
    resolveAutoValueForField,
    resolveFormLinkParams,
    validateFieldConstraints,
} from './formFields';
export type { FieldIdentity, FieldLike, MobileFieldType } from './formFields';
export {
    flattenUiFields,
    hydratePlayerResponses,
    optionsForField,
    parentResponse,
    runMobileFieldPass,
    visibleMobileFields,
} from './mobileFieldPass';
