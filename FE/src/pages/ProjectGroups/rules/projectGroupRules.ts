import type { AddProjectGroupModel } from "../Model";
import type { ValidationRule } from "../../../utils/FormValidation";

export const projectGroupFormRules: ValidationRule<AddProjectGroupModel>[] = [
 {
    field: "Name",
    message: "Project Group Name is required.",
    validate: (value) => !!value
 },
 {
    field: "Description",
    message: "Description is required.",
    validate: (value) => !!value
 },
 {
    field: "UserGroup",
    message: "User Group is required.",
    validate: (value) => !!value
 }
];
