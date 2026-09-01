# summary

Generate an Apex test suite from source.

# description

Scans one or more source directories for Apex classes, keeps only the ones whose first meaningful line (skipping leading blank lines and comments) is an @IsTest annotation, and writes an ApexTestSuite metadata file listing them. Every run regenerates the file from scratch based on the current state of --source-dir; an existing file with the same name is always overwritten.

# flags.source-dir.summary

Directories to scan for Apex classes

# flags.source-dir.description

One or more directories to scan, recursively, for Apex classes. Only classes whose first meaningful line is an @IsTest annotation are included in the generated suite.

# flags.name.summary

API name for the test suite

# flags.name.description

The API name for the generated test suite; also used to derive the output filename, <name>.testSuite-meta.xml.

# flags.output-dir.summary

Output directory

# flags.output-dir.description

The directory to write the generated ApexTestSuite metadata file to. Not automatically suffixed with testSuites/ — pass that directory explicitly, e.g. force-app/main/default/testSuites.

# examples

- <%= config.bin %> <%= command.id %> --source-dir force-app/main/default/classes --name My_Suite --output-dir force-app/main/default/testSuites

- <%= config.bin %> <%= command.id %> --source-dir force-app/main/default/classes --source-dir force-app/extra/classes --name All_Tests --output-dir force-app/main/default/testSuites

# error.noTestClassesFound

No @IsTest-annotated classes were found in the given source director(y/ies).

# error.scanFailed

Failed to scan the given source director(y/ies): %s

# info.scanning

Scanning for @IsTest-annotated classes...

# info.fileGenerated

Test suite successfully generated at %s
