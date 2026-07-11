# Current Seed Compatibility Check

## Schema basis
- Contract: `origin/SeongWoo-new2:opsradar2/schema.sql`
- Tables generated: 13
- CSV rows generated: 242
- Deterministic UUID PK/FK values: yes
- Header, enum and FK validation: passed
- Actual DB insert executed: no

## Exclusions
- `dummy_data/05_db_seed_v2` uses an expanded candidate schema and is not directly loadable into the current database.
- `dummy_data/04_expected_outputs_for_test` is not used as seed input.
- Authentication migration columns use database defaults; no authentication credential is generated.
