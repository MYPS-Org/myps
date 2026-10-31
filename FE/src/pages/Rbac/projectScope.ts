/** A user group's Project visibility (tGroups.ProjectScope, Helpers/GroupProjectScope.cs). */
export const PROJECT_SCOPES = [
  {
    value: 0,
    label: 'By program Data Security',
    hint: "With Apply Filter on, the projects of programs whose Data Security Access includes the user's region; with it off, every project.",
  },
  { value: 1, label: 'All projects', hint: 'Every project in every region.' },
  {
    value: 2,
    label: 'Own region',
    hint: "The projects of every district office in the region that is the user's Plantilla Office.",
  },
  {
    value: 3,
    label: 'Own district office',
    hint: "The projects of the district engineering office that is the user's Plantilla Office.",
  },
] as const;
