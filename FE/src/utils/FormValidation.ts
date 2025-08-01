export type ValidationRule<T> = {
    field: keyof T;
    message: string;
    validate: (value: T[keyof T], fullData?: T) => boolean;
};

export type FormValidationError<T> = Partial<Record<keyof T, string>>;

/**
 * Validates a form based on the provided rules.
 * @param data - The form data to validate.
 * @param rules - The validation rules to apply.
 * @returns An object containing any validation errors found.
 */

export function formValidation<T>(
    data: T,
    rules: ValidationRule<T>[]
): FormValidationError<T> {
    const errors: FormValidationError<T> = {};

    rules.forEach(({ field, message, validate}) => {
        const value = data[field];

        const isValid = validate(value, data);
        if (!isValid) {
            errors[field] = message;
        }
    });
    return errors;
}