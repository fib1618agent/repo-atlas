# RepoAtlas GitHub Sources Enhancement Requirements

## Objective

Enhance the existing **Add GitHub Sources** popup in RepoAtlas by
introducing two analysis modes while preserving the current UI,
workflows, navigation, styling, and existing functionality.

The enhancement must be implemented as an extension of the current
feature, not a redesign.

------------------------------------------------------------------------

# 1. Non-Impact Requirements

## 1.1 Existing UI Must Remain Unchanged

The following must not be impacted:

-   Existing RepoAtlas layout
-   Navigation menu
-   Repository explorer
-   Knowledge graph visualization
-   Catalogue pages
-   Categories pages
-   Insights pages
-   Existing repository cards
-   Existing search functionality
-   Existing GitHub loading behaviour
-   Existing data structures unless required for extension

The current user experience should continue working exactly as before.

------------------------------------------------------------------------

## 1.2 Existing Functionality Must Continue Working

The current flow:

    GitHub Source URL
            |
            v
    Load Button
            |
            v
    Repository Discovery
            |
            v
    RepoAtlas Visualization

must continue working.

The enhancement only adds additional configuration before loading.

------------------------------------------------------------------------

# 2. Add GitHub Sources Popup Enhancement

The existing popup should be extended with two selectable options.

## Popup Title

    Add GitHub Sources

------------------------------------------------------------------------

# 3. Analysis Mode Selection

The popup should provide:

## Option 1

# Load All Repositories From User

Purpose:

Discover the complete repository ecosystem of a GitHub user.

Example:

    https://github.com/imdadareeph

Capabilities:

-   Fetch all public repositories
-   Display repositories found
-   Allow selection
-   Allow adding multiple GitHub users

Example:

    User Sources

    github.com/user1

    github.com/user2

    + Add another user

------------------------------------------------------------------------

## Option 2

# Analyze Specific Repository

Purpose:

Perform deep source-code intelligence analysis for selected
repositories.

Example:

    https://github.com/user/project

Capabilities:

-   Add multiple repositories
-   Analyze only selected repositories
-   Generate source-code intelligence

Example:

    Repositories

    repo-a

    repo-b

    + Add repository

------------------------------------------------------------------------

# 4. Repository Analysis Workflow

Before loading data into RepoAtlas:

The system must first analyze and create an execution plan.

Flow:

    GitHub Source
          |
          v
    Repository Analyzer
          |
          v
    Analysis Report
          |
          v
    Execution Plan
          |
          v
    Repository Processing
          |
          v
    RepoAtlas Knowledge Graph

------------------------------------------------------------------------

# 5. GitHub SpecKit Integration Requirement

RepoAtlas already contains GitHub SpecKit capability.

Before implementation, create a SpecKit planning request.

The engineering agent must first analyze:

-   Existing repository structure
-   Current components
-   Existing GitHub ingestion flow
-   Existing UI components
-   Existing backend APIs
-   Existing database models
-   Existing graph generation pipeline

Then generate:

    /specs/github-source-enhancement/

with:

    requirements.md
    design.md
    implementation-plan.md
    tasks.md

------------------------------------------------------------------------

# 6. GitHub SpecKit Prompt

Use the following prompt:

    Analyze the existing RepoAtlas repository before making any changes.

    You are implementing an enhancement to the existing GitHub Sources popup.

    Important constraints:

    1. Do not redesign existing UI.
    2. Do not remove existing functionality.
    3. Preserve all current workflows.
    4. Extend existing components only where required.

    Analyze:

    - Current frontend architecture
    - Existing popup implementation
    - Existing GitHub source loading logic
    - Backend ingestion services
    - Repository processing pipeline
    - Data models
    - Graph visualization pipeline

    Create an implementation specification for:

    Feature:

    Add two GitHub analysis modes:

    Mode 1:
    Load all repositories from GitHub users.

    Mode 2:
    Analyze specific repositories deeply.

    For Mode 2 create:

    - Source code analysis
    - Function extraction
    - Class extraction
    - Dependency mapping
    - Call graph generation
    - Source-code categories
    - AI generated notes

    Before implementation provide:

    1. Current architecture analysis
    2. Impact assessment
    3. Required files to modify
    4. Database changes if required
    5. API changes if required
    6. Frontend component changes
    7. Backend workflow changes
    8. Implementation steps
    9. Testing strategy

    Do not start coding until the plan is complete.

------------------------------------------------------------------------

# 7. Specific Repository Deep Analysis

When Option 2 is selected:

Analyze only source code.

Primary scope:

    src/

Extract:

## Functions

Capture:

-   Function name
-   Location
-   Parameters
-   Return values
-   Purpose
-   Caller functions
-   Called functions

Example:

    Function:

    generateEmbedding()

    Location:

    src/services/vector.ts

    Calls:

    EmbeddingClient

    Called By:

    KnowledgeIndexer

------------------------------------------------------------------------

## Classes

Capture:

-   Class responsibility
-   Methods
-   Interfaces
-   Dependencies
-   Relationships

------------------------------------------------------------------------

# 8. Call Graph Generation

Generate:

    Function A
         |
         v
    Function B
         |
         v
    Function C

Store:

-   Function relationships
-   Class dependencies
-   Module dependencies

Visualize inside existing RepoAtlas graph system.

Do not replace existing visualization.

------------------------------------------------------------------------

# 9. Repository Knowledge Categories

For analyzed repositories create:

## Architecture

    Entry Points
    Modules
    Services
    Layers
    Data Flow

## Code Intelligence

    Functions
    Classes
    Algorithms
    Patterns
    Utilities

## Dependencies

    Libraries
    Frameworks
    Internal Modules
    External Services

## Runtime Behaviour

    Execution Flow
    Request Flow
    Processing Flow

------------------------------------------------------------------------

# 10. Data Model Extension

Extend existing models.

New repository intelligence structure:

    Repository

     |
     +-- Metadata

     |
     +-- Source Notes

     |
     +-- Functions

     |
     +-- Classes

     |
     +-- Call Graph

     |
     +-- Dependency Graph

     |
     +-- Categories

------------------------------------------------------------------------

# 11. UI Requirements

Only modify the Add GitHub Sources popup.

Do not modify:

-   Header
-   Sidebar
-   Graph area
-   Repository cards
-   Existing pages

The popup should become:

    Add GitHub Sources


    Choose Source Type


    ( ) All repositories from users


        GitHub User URL

        [____________]

        + Add User



    ( ) Specific repositories


        Repository URL

        [____________]

        + Add Repository


    [Cancel] [Analyze]

------------------------------------------------------------------------

# 12. Acceptance Criteria

The feature is complete when:

-   Existing RepoAtlas functionality works unchanged.
-   Existing users can continue loading repositories.
-   Multiple GitHub users can be added.
-   Multiple repositories can be added.
-   Repository-specific analysis generates:
    -   Function notes
    -   Class notes
    -   Call graphs
    -   Categories
-   SpecKit analysis is completed before implementation.
-   No unrelated UI changes are introduced.
