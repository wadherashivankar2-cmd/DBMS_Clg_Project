# DBMS Project - Phase 1 System Reference Architecture

> **Target Model**: Gemini 3.8 Flash (Antigravity IDE)  
> **Phase**: Phase 1 — Problem Formulation, E-R Modeling, Relational Schema & Normalization  
> **Evaluation Standards**: 3NF/BCNF Compliance, Strict Foreign Key Cascading, ACID Guarantees

---

## 1. Project Scope & Domain Specification
- **System Title**: [Insert Final Project Name]
- **Target Database Engine**: PostgreSQL 16
- **Core Problem Statement**:
  - [Summarize the real-world operational bottleneck this database resolves in 2-3 sentences]
- **Key User Roles**:
  - `Admin`: Full schema DDL/DML, audit logs access.
  - `Staff / Manager`: Transactional operations, status updates, restricted deletes.
  - `End User`: Read-only queries, personal record insert/update.

---

## 2. Phase 1 Deliverables Checklist
- [ ] Comprehensive Entity-Relationship (E-R) specification.
- [ ] Identification of weak entities, multivalued attributes, and derived attributes.
- [ ] Relational schema mapping (ER to Tabular representation).
- [ ] Functional Dependency (FD) sets and formal normalization proofs (up to 3NF minimum, aim for BCNF).
- [ ] Baseline DDL script (`database/migrations/001_initial_schema.sql`) with explicit integrity constraints.
- [ ] Seed dataset (`database/seeds/001_seed_dev.sql`) with edge-case validation rows.

---

## 3. Entity & Cardinality Blueprints (Drafting Block)
### Entity List
1. **Entity 1** (`<name>`):
   - **Primary Key**: `id` (UUID or BIGSERIAL)
   - **Attributes**: `name`, `status`, `created_at`
2. **Entity 2** (`<name>`):
   - **Primary Key**: `id`
   - **Foreign Keys**: `entity1_id` references `Entity1(id)` ON DELETE RESTRICT
   - **Cardinality**: 1:N (One Entity1 can have many Entity2s)

---

## 4. Integrity Constraints & Business Logic Rules
- **Referential Integrity**:
  - All foreign keys must explicitly declare `ON DELETE CASCADE` or `ON DELETE RESTRICT`.
- **Domain Constraints**:
  - Non-negative `CHECK` constraints on amounts/counts (`CHECK (amount >= 0)`).
  - Status fields constrained via `CHECK (status IN ('ACTIVE', 'PENDING', 'ARCHIVED'))`.
  - Timestamps using `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`.

---

## 5. Normalization Requirements (Phase 1 Rigor)
- **1NF**: Atomic attributes only; no multivalued attributes.
- **2NF**: No partial functional dependencies.
- **3NF**: No transitive dependencies.
- **Functional Dependency Set ($F$)**:
  - Write down the minimal cover of functional dependencies before finalizing schema changes.

---

## 6. Antigravity Prompting Guardrails (Gemini Flash Instructions)
- Treat this file as the **Single Source of Truth**.
- Do not generate queries with `SELECT *`.
- Reject schemas where foreign keys lack indices.
