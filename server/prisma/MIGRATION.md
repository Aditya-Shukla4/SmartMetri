# SmartMetri database migration procedure

The configured Supabase database was introspected read-only on 2026-09-13. It already contains the original SmartMetri tables, but it does not have Prisma migration history and is missing the newer checklist/notification tables. It also still has the original unique constraint on `Assignment.applicationId`.

`migrations/0001_smartmetri_initial/migration.sql` is a fresh-database baseline. Do not run `prisma migrate deploy` against the existing database until it has been baselined.

Recommended controlled procedure:

1. Back up the database.
2. Review the live-to-schema diff and confirm the existing records.
3. Create a migration against a staging clone, or apply the equivalent additive changes manually:
   - remove the unique constraint on `Assignment.applicationId`;
   - add the assignment indexes and the composite assignment uniqueness constraint (after checking for duplicate existing rows);
   - add instrument `unit`, previous-verification, and next-due fields;
   - add application type and due-date fields;
   - create `ApplicationStatusHistory`, `ChecklistTemplate`, `ChecklistItem`, `InspectionChecklistResult`, and `Notification`;
   - add their indexes and foreign keys.

`legacy-upgrade.sql` contains those additive changes for review. It is intentionally
not executed by this audit and should only be applied after a backup and staging
verification.
4. Mark the original baseline as applied with `prisma migrate resolve --applied 0001_smartmetri_initial` only after the live schema is confirmed to represent that baseline.
5. Run `prisma migrate deploy` against staging, run the seed, and then repeat against production.

Do not use `prisma migrate reset` on the configured database; it would destroy existing data.
