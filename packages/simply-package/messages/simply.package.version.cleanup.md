# summary

Cleanup package versions.

# description

Delete package versions for a given package provided one or more MAJOR.MINOR.PATCH selectors, either to select on or to exclude on. Does not delete released package versions.

If --selector is provided, only the unreleased versions matching any of the given MAJOR.MINOR.PATCH values are deleted. If --selector-exclude is provided instead, every unreleased version that does _not_ match any of the given MAJOR.MINOR.PATCH values is deleted. Exactly one of --selector or --selector-exclude must be specified; each accepts multiple values.

# flags.package.summary

Package Id

# flags.package.description

The 0Ht Package Id that you wish to cleanup versions for.

# flags.selector.summary

One or more MAJOR.MINOR.PATCH values to select on

# flags.selector.description

The MAJOR.MINOR.PATCH selector(s) that should be used to find package versions to delete. Only unreleased versions matching any of the given selectors are deleted. Mutually exclusive with --selector-exclude.

# flags.selector-exclude.summary

One or more MAJOR.MINOR.PATCH values to exclude on

# flags.selector-exclude.description

The MAJOR.MINOR.PATCH selector(s) that should be used to find package versions to keep. Every unreleased version that does not match any of the given selectors is deleted. Mutually exclusive with --selector.

# examples

- <%= config.bin %> <%= command.id %> --package 0Hoxx00000000CqCAI --selector 2.10.0 --target-dev-hub myDevHub

- <%= config.bin %> <%= command.id %> --package 0Hoxx00000000CqCAI --selector 2.10.0 --selector 2.11.0 --target-dev-hub myDevHub

- <%= config.bin %> <%= command.id %> --package 0Hoxx00000000CqCAI --selector-exclude 2.10.0 --target-dev-hub myDevHub

# errors.connectionFailed

Unable to establish connection to the org.

# errors.selectorRequired

You must specify either --selector or --selector-exclude.

# errors.selectorFormatMismatch

The selector "%s" must be in the format of MAJOR.MINOR.PATCH.

# errors.deletionJob

There was an unexpected error performing the deletion job.
