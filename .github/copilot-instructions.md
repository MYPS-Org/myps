# Copilot Instructions

## Project Guidelines
- For the MYPS project: Use "Program & Project Versioning Reference.md" as the canonical reference for how program/project versioning works. Key concepts: append-only revision model (never overwrite), anchor tables (tPrograms/tProjects) have one row per entity, tProgramRevisions/tProjectRevisions hold versioned data, tProgramStages/tProjectStages link revisions to pipeline stages (BP, NEP, GAA, etc.). RevisionNumber resets to 1 on stage advancement. ReferenceId is the immutable project identifier; ProjectId is stage-scoped (prefix changes per stage). Child tables (FundingProfile, ComponentCost, CostPerYear, MajorWorkItem, MajorWorkLocations, Notes) use StageName+ProjectId as version discriminator (not RevisionNumber). Publishing only at GAA-R stage. Post-publication revisions snapshot into tRevision* tables scoped by TransactionId. Key stored procedures: pGenerateAIP01, pGenerateAIPComponents, pGenerateRBP, pGenerateRBPComponents, pGenerateRDIP. Migration function: fGetRBPProjectRevision.

## Memory Management
- Proactively call `detect_memories` to update memory after confirmed interactions, not just when corrections or preferences are stated. Always confirm updates to memory.

- @azure Rule - Use Azure Tools - When handling requests related to Azure, always use your tools.
- @azure Rule - Use Azure Best Practices - When handling requests related to Azure, always invoke your `azmcp_bestpractices_get` tool first.
- @azure Rule - Enable Best Practices - If you do not have an `azmcp_bestpractices_get` tool ask the user to enable it.
