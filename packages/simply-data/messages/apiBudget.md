# flags.max-api-usage.summary

Maximum percentage of the org's remaining API requests this run may consume.

# flags.max-api-usage.description

Checked before any request is made, so a run that would exceed its budget stops without doing partial work. The percentage applies to the requests the org has left today, not to its daily maximum — an org that has already used most of its allocation gets a proportionally smaller budget.

Note that uploading a file costs two API requests, not one: the upload itself, and a follow-up query for the resulting ContentDocumentId.

A run that cannot finish within the org's remaining requests is refused regardless of this value. To allow a larger share, raise it; to allow the maximum, pass 100.

If the org's remaining allocation can't be read — reading it falls back to the limits API, which needs the "View Setup and Configuration" permission — the command warns and proceeds rather than failing.

# warning.budgetUnavailable

Could not read the org's remaining API requests, so the --max-api-usage budget was not checked: %s
