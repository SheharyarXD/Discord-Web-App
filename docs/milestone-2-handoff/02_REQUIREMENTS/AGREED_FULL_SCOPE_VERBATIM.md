# Complete Project Description — Scope of Work

Development of a private, responsive web application for organizing, managing, and searching game-related information. The application will provide a structured database for ninjas, equipment, jewelry/accessories, gems, statistics, abilities, effects, and set bonuses.

## Core Functionality

- Ninja database with roles such as Support, Assaulter, Vanguard, etc.
- Ninja skills, passives, awakenings, talents, and selectable talent options.
- Clear distinction between available talents and the single talent selected/active where applicable.
- Clear indication of conditional effects, including nature requirements and other restrictions.
- Equipment database with individual statistics and 2/4/6-piece set bonuses.
- Jewelry/accessory database with individual effects and applicable set bonuses.
- Gem and statistic data structures.
- Search by ninja/item name, type, and relevant statistics.
- Multiple filters that can be applied simultaneously.
- Sorting of results based on available statistics.
- Detailed pages for ninjas, equipment, jewelry, gems, sets, and related information.
- Private access for the client and approved users.
- Admin functionality allowing the client to add, edit, remove, and manage content.
- Spanish as the default language for the initial version.
- Responsive interface for desktop, tablet, and mobile browsers.
- Initial population of the agreed current game data.
- Testing, deployment, and source code delivery.

The game Discord will be used only as the provided reference/source for the initial game information. Discord bot development, Discord integration, automatic scraping/importing, and automatic synchronization are not included.

The project will be completed through the following four milestones.

## Milestone 1 — Database Structure, Application Foundation & Initial UI

This milestone establishes the technical and visual foundation of the application.

**Deliverables**

- Set up the web application project structure and core architecture.
- Set up the initial database and required database relationships.
- Create data structures for:
  - Ninjas
  - Ninja roles
  - Skills and abilities
  - Passives
  - Awakenings
  - Talents/selectable talent options
  - Equipment
  - Equipment sets
  - Jewelry/accessories
  - Jewelry sets
  - Gems
  - Statistics
  - Effects and conditions
- Establish relationships between ninjas, items, sets, statistics, effects, and other relevant data.
- Create the initial application layout, navigation, and main UI structure.
- Establish Spanish as the default interface language.
- Establish the structure needed to clearly represent conditional effects and requirements such as nature restrictions.
- Establish the structure for talents where multiple options exist but only one can be selected/active.
- Establish the initial responsive layout for desktop and mobile.
- Prepare the technical foundation for the admin system to be completed in a later milestone.

Final search/filter functionality, completed admin functionality, full initial data population, final responsive optimization, and production deployment are handled through the subsequent milestones.

## Milestone 2 — Core Game Database & Data Management

This milestone develops the main game-data functionality on top of the foundation created in Milestone 1.

**Deliverables**

- Implement the core database functionality for ninjas, equipment, jewelry, gems, sets, statistics, abilities, and effects.
- Implement ninja information including roles, skills, passives, awakenings, and talent options.
- Implement selectable talent logic/representation where applicable.
- Implement conditional effect information, including nature requirements and restrictions.
- Implement equipment statistics and equipment-set relationships.
- Implement 2-piece, 4-piece, and 6-piece equipment bonus structures.
- Implement jewelry/accessory effects and applicable set bonuses.
- Implement gem and statistic information structures.
- Establish consistent relationships between individual items and their corresponding sets, effects, and statistics.
- Begin and continue population of the agreed initial game data from the provided Discord reference.
- Ensure the stored data can support the search, filtering, sorting, and detail functionality planned for the next milestone.

## Milestone 3 — Search, Filters, Detail Pages & Admin Functionality

This milestone focuses on making the database practical for searching, exploring, and managing game information.

**Deliverables**

- Implement search functionality for ninjas and game items.
- Implement filtering by relevant categories such as:
  - Ninja role
  - Item type
  - Equipment/jewelry set
  - Statistics
  - Other applicable game attributes
- Support multiple filters being applied together.
- Implement relevant minimum/maximum statistic filtering where applicable.
- Implement sorting of available results by statistics, including highest-to-lowest and lowest-to-highest.
- Create detailed information pages/views for:
  - Ninjas
  - Equipment
  - Jewelry/accessories
  - Gems
  - Sets
  - Related effects and statistics
- Clearly display conditional effects and requirements within the relevant details.
- Clearly present selectable talent options without implying that all available options are simultaneously active.
- Implement the admin panel for the client's content management.
- Allow the authorized client to add, edit, remove, and update game content.
- Restrict administrative functionality so regular approved users cannot manage the database.
- Continue integrating the Spanish interface and content across the implemented functionality.

## Milestone 4 — Initial Data Completion, Responsive Optimization, Testing & Deployment

This milestone completes the agreed initial version and prepares the application for production use.

**Deliverables**

- Complete the agreed initial population of current ninja, equipment, jewelry, gem, and related game data based on the provided reference information.
- Review populated data for consistency with the agreed database structure.
- Complete remaining Spanish interface/content work for the initial version.
- Complete responsive optimization for desktop, tablet, and mobile browsers.
- Test navigation, database functionality, search, filters, sorting, detail pages, and admin functionality.
- Verify appropriate access levels for the client and approved users.
- Fix issues identified during final testing that fall within the agreed project scope.
- Configure and deploy the completed application.
- Perform final production verification.
- Deliver the project source code.

The initial data population covers the agreed current dataset/reference provided for this project. Future game updates and new content after project completion are not included in the initial scope and can be handled separately.

---

**Note:** The more recent client chat clarifies parts of this original scope. In particular: formation labels, Tank/DPS, rating, release dates, per-usage effect strength, and the currently hidden Gem UI. Read `CLIENT_CONFIRMED_DECISIONS.md` to apply the newer clarifications while preserving the agreed feature boundaries.
