# The vendored Spanish dictionary

Purpose: record where the dictionary files in this folder come from, so the
product carries its whole dictionary in its own code (REQ-029) and needs no
download at build or run time.

- Source: the npm package `dictionary-es` version 4.0.0 (wooorm/dictionaries),
  which packages the LibreOffice Spanish dictionary of the RLA-ES project
  (general Spanish, Spain and Latin America).
- Files: `es.aff.txt` is the package's `index.aff`, `es.dic.txt` its
  `index.dic`, both copied byte for byte; `LICENSE.txt` is the package's
  `license`. The `.txt` suffix is the only change, to the names alone: the
  files are Hunspell affix and word lists, which cannot carry a comment, and
  the project's commit hook asks every new file that is not plain data for a
  `Purpose:` comment (D-026).
- Licence: GPL-3.0 OR LGPL-3.0 OR MPL-1.1, at the user's choice (see
  `LICENSE.txt`).
- SHA-256 at vendoring:
  - `es.aff.txt` 892039d59db11d747061b81c3a92a52d48ba0e055b5835af1943cbd3c2fba85b
  - `es.dic.txt` 907f786a8ceb3456722b20ad91dd4dbe99c5c16e45015ea63155e36f26b06d2c
