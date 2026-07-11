# 2022 Loader Preview

This tool does not connect to or insert into a database. It previews deterministic UUID conversion, status normalization, column mapping, and FK candidates.

Run:
```bash
python dummy_data/2022/06_loader_preview/load_2022_source_seed_preview.py
```

Generated preview CSV files are written under `out_preview/`. Review current PostgreSQL schema constraints before building a real loader.
