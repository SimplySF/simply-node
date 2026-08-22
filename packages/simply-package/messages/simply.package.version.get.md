# summary

Get a package version from sfdx-project.json.

# description

Reads the version a package is declared at in your project's sfdx-project.json and prints it, so a script doesn't have to parse the project file itself.

Both dependencies and the project's own package are searched. A dependency declared as an alias (test-package@0.1.0+2) resolves to the version portion of the alias; a dependency declared as a package name plus a versionNumber resolves to that versionNumber; a dependency declared as a raw ID resolves through packageAliases. A package directory that builds the package resolves to that directory's versionNumber.

The version is returned exactly as it appears in the project file — no normalizing between the 0.1.0+2, 57.0.0-3, and 1.2.3.LATEST forms, since each means something to the tool that consumes it.

This command reads the project file only. It never contacts an org or a Dev Hub, so it can run in a pipeline before any authentication step.

# flags.package.summary

Package name or alias to look up.

# flags.package.description

The package name as it appears in sfdx-project.json, without a version suffix. For a dependency declared as "test-package@0.1.0+2", pass "test-package".

# flags.directory.summary

Package directory to search.

# flags.directory.description

The path of a single package directory to search, matching a "path" value in packageDirectories. Use this when the same package is declared at different versions in more than one package directory.

# examples

- Get the version of a dependency:

  <%= config.bin %> <%= command.id %> --package test-package

- Get the version of the package the project itself builds:

  <%= config.bin %> <%= command.id %> --package my-package

- Get a dependency's version from one package directory:

  <%= config.bin %> <%= command.id %> --package test-package --directory force-app

# errors.packageNotFound

No package named '%s' is declared in %s.

# errors.noVersionFound

The package '%s' is declared in '%s', but without a version. Add a version to its alias (name@version) or a versionNumber to the dependency.

# errors.ambiguousMatch

The package '%s' is declared at more than one version: %s. Use --directory to choose one package directory.
