# summary

Upload a file to a Salesforce org.

# description

Uploads a file to a Salesforce org.

Only the file's name is sent to the org — Salesforce stores it as the ContentVersion's PathOnClient and derives FileExtension and FileType from it — so the local directory the file came from is never uploaded.

# flags.file-path.summary

Path to the file to upload. May be relative or absolute; only the file's name is sent to the org.

# flags.first-publish-location-id.summary

Specify a record Id that the file should be linked to.

# flags.title.summary

Specify the title for the file being uploaded.

# examples

- <%= config.bin %> <%= command.id %> --file-path fileToUpload.txt --target-org myTargetOrg

- <%= config.bin %> <%= command.id %> --file-path fileToUpload.txt --first-publish-location-id 0019000000DmehK --target-org myTargetOrg
