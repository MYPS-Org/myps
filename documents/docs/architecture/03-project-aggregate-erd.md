# MYPS Base Project Aggregate ERD

## Ownership model

```mermaid
erDiagram
    tProjects ||--o{ tProjectRevisions : "stable Project to lifecycle states"
    tProjectRevisions ||--o{ tProjectFundingProfile : "ProjectRevisionFK"
    tProjectRevisions ||--o{ tProjectComponentCost : "ProjectRevisionFK"
    tProjectComponentCost ||--o{ tProjectComponentCostPerYear : "ComponentCostFK"
    tProjectComponentCost ||--o{ tProjectMajorWorkItem : "ComponentCostFK"
    tProjectMajorWorkItem ||--o{ tProjectMajorWorkLocations : "WorkItemFK"
    tProjectRevisions ||--o{ tProjectSupportingDocs : "ProjectRevisionFK"
    tProjectRevisions ||--o{ tProjectNotes : "ProjectRevisionFK"

    tProjectRevisions {
        int Id PK
        nvarchar ProjectFK FK
        nvarchar ProjectId
        nvarchar Description
        nvarchar Region
        nvarchar ImplementingOffice
        int Category
        int Tier
        bit IsDeleted
    }

    tProjectFundingProfile {
        int Id PK
        int ProjectRevisionFK FK
        nvarchar SourceOrg FK
        nvarchar AgreementCode FK
        decimal Amount
        float Percentage
        bit IsWalletDraw
        bit IsDeleted
    }

    tProjectComponentCost {
        int Id PK
        int ProjectRevisionFK FK
        nvarchar ComponentId
        nvarchar ComponentType
        decimal Total
        bit IsDeleted
    }

    tProjectComponentCostPerYear {
        int Id PK
        int ComponentCostFK FK
        int Year
        decimal Amount
        datetime StartDate
        datetime EndDate
        bit IsDeleted
    }

    tProjectMajorWorkItem {
        int Id PK
        int ComponentCostFK FK
        int YearOfWork
        int InfraTypeFK FK
        int WorkTypeFK FK
        bit IsDeleted
    }

    tProjectMajorWorkLocations {
        int Id PK
        int WorkItemFK FK
        bit IsDeleted
    }

    tProjectSupportingDocs {
        int Id PK
        int ProjectRevisionFK FK
        nvarchar DocTypeFK FK
        nvarchar FilePath
    }

    tProjectNotes {
        int Id PK
        int ProjectRevisionFK FK
        nvarchar FilePath
        nvarchar Description
    }
```

## Stage-copy remapping

```mermaid
flowchart TD
    A["Create destination tProjectRevisions row"]
    A --> B["Copy Funding, Supporting Documents, and Notes using destination ProjectRevisionFK"]
    A --> C["Create destination Component rows"]
    C --> D["Record source Component.Id → destination Component.Id map"]
    D --> E["Copy annual costs using destination ComponentCostFK"]
    D --> F["Create destination Work Items using destination ComponentCostFK"]
    F --> G["Record source WorkItem.Id → destination WorkItem.Id map"]
    G --> H["Copy Locations using destination WorkItemFK"]
    H --> I["Verify counts, ownership, cost, and readiness"]
```

## Modeling cautions

- `ComponentId` is a business/correlation value, not the relational parent key for annual costs or work items.
- Work locations inherit `YearOfWork` through their parent work item; the location table has no `YearOfWork` column.
- Supporting documents and notes do not expose the same soft-delete behavior as the other child tables.
- Component and work-item business-key uniqueness is not database-enforced.
- Destination children must never retain source-stage SQL parent IDs.

## Client-confirmed Stage-copy rules

- Copy every active Project in the Program. Completeness and publishability do not filter the advancement set.
- Copy the complete active aggregate: scalar revision, funding, components, annual costs, work items, locations, supporting documents, and notes.
- Create a new lifecycle Project revision and Project Stage even when the ProjectId prefix remains unchanged.
- Preserve immutable `ProjectPK`; recalculate only the lifecycle ProjectId Stage prefix when the destination enters another prefix group.
- After commit, the complete source aggregate is read-only Stage history.
- At GAA-R, calculate publishability per destination Project after copying. Failed Projects remain in the current GAA-R Stage for correction.
- LS/wallet and special-Project copy behavior remains pending and must be raised before implementation.
