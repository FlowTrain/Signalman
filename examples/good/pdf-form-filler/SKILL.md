---
name: pdf-form-filler
description: Use when the user needs to fill, flatten, or read field values from a fillable PDF form (AcroForm or XFA). Do NOT use for OCR or scanning image-only PDFs.
---

# PDF form filler

Fill or inspect a fillable PDF form.

## Steps

1. List the form's fields: `pdftk input.pdf dump_data_fields`.
2. Write the values to an FDF file, one entry per field name.
3. Fill and flatten: `pdftk input.pdf fill_form values.fdf output out.pdf flatten`.
4. Confirm the output has no remaining interactive fields.

## Notes

- XFA forms require a `pdftk` build with XFA support.
- Keep a copy of the original before flattening — flattening is one-way.
