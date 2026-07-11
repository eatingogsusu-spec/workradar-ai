# ID Mapping Rules

- Source IDs remain human-readable in the source CSV files.
- Preview IDs use UUID5 with a fixed namespace and `source_type:source_id` as the name.
- The same source ID always produces the same UUID.
- Different source types use different prefixes to prevent collisions.
- Parent IDs must be mapped before child IDs.
- Loader logs must retain both source ID and generated UUID for reconciliation.
