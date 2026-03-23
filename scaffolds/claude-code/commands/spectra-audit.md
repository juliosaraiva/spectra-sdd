---
description: Audit SPECTRA generation determinism — re-generate and compare output hashes
allowed-tools: Bash, Read
---

Audit generation determinism for a feature spec.

## Steps

1. **Read the generation lock:**
   ```
   cat .spectra/generate.lock
   ```
   Find the entry for `$ARGUMENTS`. It contains: `template_hash`, `input_spec_hash`, `output_hash`, `generation_id`, `generated_at`.

2. **Read the current spec:**
   ```
   spectra spec show $ARGUMENTS
   ```

3. **Read the constitution:**
   ```
   cat .spectra/constitution.yaml
   ```

4. **Re-generate** using the same inputs (spec + constitution + template). Follow the same generation logic as `/spectra-test-design` or `/spectra-implement`.

5. **Compare hashes:**
   Compute SHA-256 of the re-generated output and compare against the locked `output_hash`.

6. **Report:**
   - **DETERMINISTIC** — hashes match. The spec fully constrains the output.
   - **HASH MISMATCH** — hashes differ. The constitution, template, or spec may have changed since generation. Show both hashes and suggest investigating what changed.
