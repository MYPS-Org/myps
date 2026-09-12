import type { ValidationRule } from '../../../utils/FormValidation';
import type { LumpSum } from '../Model.d';

/*  The V2 required set, client side.

    IT MIRRORS LumpsumController.ValidateRequiredFieldsAsync, INCLUDING ITS ORDER.
    The server checks Category, Sub-Category, Operating Unit, Description,
    Region Wide, Agency, Origin — deliberately "in the order a person would fill
    the form" — and refuses with the first one it finds, naming the field. These
    rules are listed in that same sequence so the message a user sees before the
    request matches the one they would have seen after it. A client rule set that
    disagrees with the server's order is worse than none: the form blocks on one
    field, the user fixes it, and the server then refuses a different one.

    THIS IS A COURTESY, NOT THE RULE. The server enforces all of it regardless,
    and a save that slips past this arrives with the server's own message.

    Not here, because they are not fields on the project:
      - Allocation, Funding Source, Funding Agreement — add-mode state of their
        own, checked in LumpSumForm.handleCreate.
      - The three child arrays — edit-mode state, checked in handleUpdate.
      - CurrentStage — resolved from the program and never submitted.

    The location fields (Region, Province, City, Legislative District, DEO,
    Implementing Office) are ABSENT ON PURPOSE. V2 made them optional and the
    baseline widened the columns to match; a Lump Sum Project with no Region is
    valid and its ID takes the constant 'LS'. */
export const lumpSumFormRules: ValidationRule<Partial<LumpSum>>[] = [
  {
    field: 'ProgramId',
    message: 'Select a Program.',
    validate: (value) => !!value,
  },
  {
    field: 'CategoryId',
    /*  Category first because GenerateProjectID builds the Project ID from it,
        and a zero produced a malformed id ("BP011LS" instead of "BP01100001LS")
        that then broke id generation for every later Lump Sum Project in the
        same program. */
    message: 'Select a Category — the Lump Sum Project ID is generated from it.',
    validate: (value) => typeof value === 'number' && value > 0,
  },
  {
    field: 'SubCategoryId',
    message: 'Select a Sub-Category.',
    validate: (value) => typeof value === 'number' && value > 0,
  },
  {
    field: 'OperatingUnit',
    message:
      'Select an Operating Unit — a Lump Sum Project cannot be saved in the project form without one.',
    validate: (value) => typeof value === 'string' && value.trim().length > 0,
  },
  {
    field: 'Description',
    message: 'Enter a Description — it is how the Lump Sum Project is identified in every list.',
    validate: (value) => typeof value === 'string' && value.trim().length > 0,
  },
  /*  No Tier rule. The form stopped collecting Tier on 2026-09-06 — a rule here
      would block add-mode on a field the user cannot see. CreateLumpSum
      defaults an absent Tier to 1 and only range-checks an explicit value. */
  {
    field: 'RegionWide',
    message: 'Select Region Wide.',
    validate: (value) => typeof value === 'number' && value > 0,
  },
  {
    field: 'Agency',
    message: 'Select an Originating Agency.',
    validate: (value) => typeof value === 'number' && value > 0,
  },
  {
    field: 'Origin',
    message: 'Select an Origin.',
    validate: (value) => typeof value === 'number' && value > 0,
  },
];
