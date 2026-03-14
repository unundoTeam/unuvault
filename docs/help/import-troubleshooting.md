# Import Troubleshooting

If a browser import does not look right, use the import report and review the source export before retrying.

## Common Checks

- Confirm the export really came from Chrome, Edge, or Safari
- Confirm the file is not empty
- Expect duplicates when the same login exists more than once in browser storage
- Expect malformed rows to be skipped rather than silently imported

## Safe Retry Guidance

- Re-run the import with a fresh export if the browser data changed
- Review duplicates before deleting anything from the browser
- Keep the browser copy until unuvault autofill works on real sites you use
