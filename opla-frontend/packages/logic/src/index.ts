import { User } from "@opla/types";

export const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const getUserDisplayName = (user: User): string => {
    return user.name || user.email;
};
