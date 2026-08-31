/*
 * Copyright (c) 2026, Clay Chipps.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-await-in-loop */
/* eslint-disable complexity */
import fs from 'node:fs/promises';
import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve';
import type { JsonMap } from '@salesforce/ts-types';
import {
  buildTechnicalDesignDocumentHtml,
  type ApexClassItem,
  type ApexTriggerItem,
  type ApprovalProcessItem,
  type AuraComponentItem,
  type CustomApplicationItem,
  type CustomLabelItem,
  type CustomMetadataItem,
  type DashboardItem,
  type DigitalExperienceBundleItem,
  type EmailTemplateItem,
  type ExperienceBundleItem,
  type FieldSetItem,
  type FlexipageItem,
  type FlowItem,
  type GroupItem,
  type LayoutItem,
  type LightningComponentItem,
  type ObjectItem,
  type PermissionSetGroupItem,
  type PermissionSetItem,
  type QueueItem,
  type RecordTypeItem,
  type ReportItem,
  type SharingRuleItem,
  type StaticResourceItem,
  type ValidationRuleItem,
  type VisualforcePageItem,
} from '@simplysf/simply-document-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-document', 'simply.document.generate');

/** A `CustomField` component's parsed fields, before `massageCustomField` derives its display type/description. */
type RawCustomFieldXml = {
  fullName: string;
  label?: string;
  type?: string;
  required?: string;
  externalId?: string;
  unique?: string;
  description?: string;
  length?: string;
  precision?: string;
  scale?: string;
  referenceTo?: string;
  formula?: string;
};

/** A `CustomObject` component's own parsed fields, plus any field-level children found on it directly. */
type RawCustomObjectXml = {
  name: string;
  label?: string;
  description?: string;
  miniDescription?: string;
  sharingModel?: string;
  externalSharingModel?: string;
  customSettingsType?: string;
  eventType?: string;
  publishBehavior?: string;
  layouts?: LayoutItem[];
  fieldSets?: FieldSetItem[];
  customFields?: RawCustomFieldXml[];
  recordTypes?: RecordTypeItem[];
  validationRules?: ValidationRuleItem[];
};

/**
 * Accumulates everything found for a given object/custom-metadata-type API name, from two
 * possible sources: standalone top-level components (`CustomField`, `Layout`, `FieldSet`,
 * `RecordType`, `ValidationRule`), and the object's own `CustomObject` component (whose children
 * are scanned separately). Both sources are merged once scanning completes.
 */
type ObjectAccumulator = {
  customFields?: RawCustomFieldXml[];
  layouts?: LayoutItem[];
  recordTypes?: RecordTypeItem[];
  fieldSets?: FieldSetItem[];
  validationRules?: ValidationRuleItem[];
  customObject?: RawCustomObjectXml;
};

/**
 * Parse a component's metadata XML and return it flattened with the component's name, matching
 * the shape the technical design document template expects.
 *
 * @param component - The component to parse.
 * @param metadataType - The XML root element name to read (usually the component's metadata type).
 * @returns The component's name, plus whatever fields were found under `metadataType`.
 */
async function getMetadataFromComponent(
  component: SourceComponent,
  metadataType: string,
): Promise<Record<string, unknown> & { name: string }> {
  const parsed = await component.parseXml<Record<string, JsonMap | undefined>>();
  return { name: component.name, ...(parsed[metadataType] ?? {}) };
}

/**
 * Extract the free-form "description" portion of a field description that follows this org's
 * `description: ... usage notes: ...` convention, falling back to the raw description otherwise.
 *
 * @param description - The field's raw description, if any.
 * @returns The extracted mini-description, or `undefined` if there was no description.
 */
function extractDescription(description?: string): string | undefined {
  if (!description) {
    return undefined;
  }
  const regex = /description:\s*(?<description>.*?)\s*usage notes:/is;
  const match = regex.exec(description);
  return match?.groups?.description ?? description;
}

/**
 * Derive a field's display type (e.g. `Lookup(Account)`, `Text(80)`) and mini-description.
 *
 * @param customField - The field's raw parsed XML.
 * @returns The field, ready for rendering in the technical design document.
 */
function massageCustomField(customField: RawCustomFieldXml): RawCustomFieldXml & { miniDescription?: string } {
  const massaged: RawCustomFieldXml & { miniDescription?: string } = {
    ...customField,
    miniDescription: extractDescription(customField.description),
  };

  if (massaged.formula) {
    massaged.type = `Formula(${massaged.type ?? ''})`;
    return massaged;
  }

  switch (massaged.type ?? '') {
    case 'LongTextArea':
      massaged.type = `LongTextArea(${massaged.length ?? ''})`;
      break;
    case 'Lookup':
      massaged.type = `Lookup(${massaged.referenceTo ?? ''})`;
      break;
    case 'MasterDetail':
      massaged.type = `MasterDetail(${massaged.referenceTo ?? ''})`;
      massaged.required = 'true';
      break;
    case 'Number':
      massaged.type = `Number(${massaged.precision ?? ''},${massaged.scale ?? ''})`;
      break;
    case 'Text':
      massaged.type = `Text(${massaged.length ?? ''})`;
      break;
    default:
      break;
  }

  return massaged;
}

/** Where the generated document was written, and how many top-level metadata items it covers. */
export type DocumentGenerateResult = {
  outputFile: string;
  componentCount: number;
};

/**
 * Scans a Salesforce project directory for metadata and generates a Confluence-storage-format
 * technical design document covering the data model, security model, groups/queues/permissions,
 * solution inventory, and custom code inventory.
 */
export default class DocumentGenerate extends SfCommand<DocumentGenerateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    directory: Flags.directory({
      summary: messages.getMessage('flags.directory.summary'),
      char: 'd',
      exists: true,
      required: true,
    }),
    'output-file': Flags.string({
      summary: messages.getMessage('flags.output-file.summary'),
      required: true,
    }),
    'template-file': Flags.file({
      summary: messages.getMessage('flags.template-file.summary'),
      description: messages.getMessage('flags.template-file.description'),
      exists: true,
    }),
    'output-format': Flags.custom<'html'>({ options: ['html'] })({
      summary: messages.getMessage('flags.output-format.summary'),
      description: messages.getMessage('flags.output-format.description'),
      default: 'html',
    }),
  };

  /** @returns Where the generated document was written, and how many top-level metadata items it covers. */
  public async run(): Promise<DocumentGenerateResult> {
    const { flags } = await this.parse(DocumentGenerate);

    const customTemplateSource = flags['template-file']
      ? await fs.readFile(flags['template-file'], 'utf-8')
      : undefined;

    this.spinner.start(messages.getMessage('info.scanningProject'));

    let components: ComponentSet;
    try {
      components = ComponentSet.fromSource(flags.directory);
    } catch (error) {
      this.spinner.stop();
      throw messages.createError('error.scanFailed', [(error as Error).message]);
    }

    const apexClasses: ApexClassItem[] = [];
    const apexTriggers: ApexTriggerItem[] = [];
    const approvalProcesses: ApprovalProcessItem[] = [];
    const auraComponents: AuraComponentItem[] = [];
    const customApplications: CustomApplicationItem[] = [];
    const customLabels: CustomLabelItem[] = [];
    const customMetadata: CustomMetadataItem[] = [];
    const customMetadataTypes: ObjectItem[] = [];
    const customObjects: ObjectItem[] = [];
    const customSettings: ObjectItem[] = [];
    const dashboards: DashboardItem[] = [];
    const digitalExperienceBundles: DigitalExperienceBundleItem[] = [];
    const emailTemplates: EmailTemplateItem[] = [];
    const experienceBundles: ExperienceBundleItem[] = [];
    const flexipages: FlexipageItem[] = [];
    const flows: FlowItem[] = [];
    const groups: GroupItem[] = [];
    const lightningComponents: LightningComponentItem[] = [];
    const objectMap = new Map<string, ObjectAccumulator>();
    const permissionSets: PermissionSetItem[] = [];
    const permissionSetGroups: PermissionSetGroupItem[] = [];
    const platformEvents: ObjectItem[] = [];
    const queues: QueueItem[] = [];
    const reports: ReportItem[] = [];
    const sharingRules: SharingRuleItem[] = [];
    const standardObjects: ObjectItem[] = [];
    const staticResources: StaticResourceItem[] = [];
    const visualforcePages: VisualforcePageItem[] = [];

    for (const rawComponent of components) {
      const component = rawComponent as SourceComponent;

      this.spinner.status = component.name;

      if (component.type.name === 'ApexClass') {
        apexClasses.push(await getMetadataFromComponent(component, 'ApexClass'));
      } else if (component.type.name === 'ApexPage') {
        visualforcePages.push(await getMetadataFromComponent(component, 'ApexPage'));
      } else if (component.type.name === 'ApexTrigger') {
        apexTriggers.push(await getMetadataFromComponent(component, 'ApexTrigger'));
      } else if (component.type.name === 'ApprovalProcess') {
        approvalProcesses.push(await getMetadataFromComponent(component, 'ApprovalProcess'));
      } else if (component.type.name === 'AuraDefinitionBundle') {
        auraComponents.push(await getMetadataFromComponent(component, 'AuraDefinitionBundle'));
      } else if (component.type.name === 'CustomApplication') {
        customApplications.push(await getMetadataFromComponent(component, 'CustomApplication'));
      } else if (component.type.name === 'CustomField') {
        const customField = (await getMetadataFromComponent(component, 'CustomField')) as unknown as RawCustomFieldXml;
        const objectName = component.parent?.name ?? '';
        const objectFromMap = objectMap.get(objectName) ?? {};
        objectFromMap.customFields = [...(objectFromMap.customFields ?? []), customField];
        objectMap.set(objectName, objectFromMap);
      } else if (component.type.name === 'Layout') {
        const pageLayout = await getMetadataFromComponent(component, 'Layout');
        const nameParts = component.name.split('-');
        const objectName = nameParts.at(0) ?? '';
        const nameOnly = nameParts.at(1);
        const objectFromMap = objectMap.get(objectName) ?? {};
        objectFromMap.layouts = [...(objectFromMap.layouts ?? []), { ...pageLayout, nameOnly }];
        objectMap.set(objectName, objectFromMap);
      } else if (component.type.name === 'CustomMetadata') {
        customMetadata.push(await getMetadataFromComponent(component, 'CustomMetadata'));
      } else if (component.type.name === 'CustomObject') {
        const customObjectXml = (await getMetadataFromComponent(
          component,
          'CustomObject',
        )) as unknown as RawCustomObjectXml;
        const customObject: RawCustomObjectXml = {
          ...customObjectXml,
          name: component.name,
          miniDescription: extractDescription(customObjectXml.description),
        };

        const customFields: RawCustomFieldXml[] = [];
        const fieldSets: FieldSetItem[] = [];
        const recordTypes: RecordTypeItem[] = [];
        const validationRules: ValidationRuleItem[] = [];

        for (const child of component.getChildren()) {
          if (child.type.name === 'FieldSet') {
            fieldSets.push((await getMetadataFromComponent(child, 'FieldSet')) as unknown as FieldSetItem);
            continue;
          }

          if (child.type.name === 'CustomField') {
            customFields.push((await getMetadataFromComponent(child, 'CustomField')) as unknown as RawCustomFieldXml);
            continue;
          }

          if (child.type.name === 'RecordType') {
            recordTypes.push((await getMetadataFromComponent(child, 'RecordType')) as unknown as RecordTypeItem);
            continue;
          }

          if (child.type.name === 'ValidationRule') {
            validationRules.push(
              (await getMetadataFromComponent(child, 'ValidationRule')) as unknown as ValidationRuleItem,
            );
            continue;
          }
        }

        customObject.fieldSets = fieldSets;
        customObject.customFields = customFields;
        customObject.recordTypes = recordTypes;
        customObject.validationRules = validationRules;

        const objectFromMap = objectMap.get(component.name) ?? {};
        objectFromMap.customObject = customObject;
        objectMap.set(component.name, objectFromMap);
      } else if (component.type.name === 'CustomLabels') {
        customLabels.push((await getMetadataFromComponent(component, 'CustomLabels')) as unknown as CustomLabelItem);
      } else if (component.type.name === 'Dashboard') {
        const dashboard = (await getMetadataFromComponent(component, 'Dashboard')) as unknown as DashboardItem & {
          title?: string;
        };
        dashboard.folderName = dashboard.folderName ?? component.name.split('/').at(0);
        dashboard.name = dashboard.title ?? component.name.split('/').at(1) ?? dashboard.name;
        dashboards.push(dashboard);
      } else if (component.type.name === 'DigitalExperienceBundle') {
        digitalExperienceBundles.push(await getMetadataFromComponent(component, 'DigitalExperienceBundle'));
      } else if (component.type.name === 'EmailTemplate') {
        const emailTemplateXml = await component.parseXml<{
          EmailTemplate?: { name?: string; type?: string; description?: string };
        }>();
        emailTemplates.push({
          apiName: component.name,
          label: emailTemplateXml.EmailTemplate?.name,
          ...emailTemplateXml.EmailTemplate,
        });
      } else if (component.type.name === 'ExperienceBundle') {
        experienceBundles.push(await getMetadataFromComponent(component, 'ExperienceBundle'));
      } else if (component.type.name === 'FieldSet') {
        const fieldSets = objectMap.get(component.parent?.name ?? '')?.fieldSets ?? [];
        fieldSets.push((await getMetadataFromComponent(component, 'FieldSet')) as unknown as FieldSetItem);
        const objectFromMap = objectMap.get(component.parent?.name ?? '') ?? {};
        objectFromMap.fieldSets = fieldSets;
        objectMap.set(component.parent?.name ?? '', objectFromMap);
      } else if (component.type.name === 'Flexipage') {
        flexipages.push(await getMetadataFromComponent(component, 'FlexiPage'));
      } else if (component.type.name === 'Flow') {
        flows.push(await getMetadataFromComponent(component, 'Flow'));
      } else if (component.type.name === 'Group') {
        const groupXml = await component.parseXml<{ Group?: { name?: string; doesIncludeBosses?: string } }>();
        groups.push({ apiName: component.name, label: groupXml.Group?.name, ...groupXml.Group });
      } else if (component.type.name === 'LightningComponentBundle') {
        lightningComponents.push(await getMetadataFromComponent(component, 'LightningComponentBundle'));
      } else if (component.type.name === 'PermissionSet') {
        permissionSets.push(await getMetadataFromComponent(component, 'PermissionSet'));
      } else if (component.type.name === 'PermissionSetGroup') {
        permissionSetGroups.push(await getMetadataFromComponent(component, 'PermissionSetGroup'));
      } else if (component.type.name === 'Queue') {
        const queueXml = await component.parseXml<{
          Queue?: {
            name?: string;
            doesSendEmailToMembers?: string;
            queueSobject?: { sobjectType?: string } | Array<{ sobjectType?: string }>;
          };
        }>();

        const queueObjects: string[] = [];
        const queueSobject = queueXml.Queue?.queueSobject;
        if (Array.isArray(queueSobject)) {
          for (const sobject of queueSobject) {
            if (sobject.sobjectType) {
              queueObjects.push(sobject.sobjectType);
            }
          }
        } else if (queueSobject?.sobjectType) {
          queueObjects.push(queueSobject.sobjectType);
        }

        queues.push({
          doesSendEmailToMembers: queueXml.Queue?.doesSendEmailToMembers,
          label: queueXml.Queue?.name,
          name: component.name,
          queueObjects,
        });
      } else if (component.type.name === 'RecordType') {
        const recordTypes = objectMap.get(component.parent?.name ?? '')?.recordTypes ?? [];
        recordTypes.push((await getMetadataFromComponent(component, 'RecordType')) as unknown as RecordTypeItem);
        const objectFromMap = objectMap.get(component.parent?.name ?? '') ?? {};
        objectFromMap.recordTypes = recordTypes;
        objectMap.set(component.parent?.name ?? '', objectFromMap);
      } else if (component.type.name === 'Report') {
        const report = (await getMetadataFromComponent(component, 'Report')) as unknown as ReportItem;
        report.folderName = report.folderName ?? component.name.split('/').at(0);
        report.name = component.name.split('/').at(1) ?? report.name;
        reports.push(report);
      } else if (component.type.name === 'SharingRules') {
        for (const child of component.getChildren()) {
          const sharingRule = (await getMetadataFromComponent(child, child.type.name)) as unknown as SharingRuleItem;
          sharingRule.object = child.parent?.name;
          sharingRule.type = child.type.name;
          sharingRules.push(sharingRule);
        }
      } else if (component.type.name === 'StaticResource') {
        staticResources.push(await getMetadataFromComponent(component, 'StaticResource'));
      } else if (component.type.name === 'ValidationRule') {
        const validationRules = objectMap.get(component.parent?.name ?? '')?.validationRules ?? [];
        validationRules.push(
          (await getMetadataFromComponent(component, 'ValidationRule')) as unknown as ValidationRuleItem,
        );
        const objectFromMap = objectMap.get(component.parent?.name ?? '') ?? {};
        objectFromMap.validationRules = validationRules;
        objectMap.set(component.parent?.name ?? '', objectFromMap);
      }
    }

    this.spinner.stop();
    this.spinner.start(messages.getMessage('info.mappingObjects'));

    for (const [key, value] of objectMap) {
      const customObject: RawCustomObjectXml = value.customObject ?? { name: key, label: key };

      if (value.customFields ?? customObject.customFields) {
        customObject.customFields = [...(value.customFields ?? []), ...(customObject.customFields ?? [])]
          .toSorted((a, b) => a.fullName.localeCompare(b.fullName))
          .map(massageCustomField);
      }
      if (value.layouts ?? customObject.layouts) {
        customObject.layouts = [...(value.layouts ?? []), ...(customObject.layouts ?? [])].toSorted((a, b) =>
          (a.nameOnly ?? '').localeCompare(b.nameOnly ?? ''),
        );
      }

      // Platform Events
      if (key.endsWith('__e')) {
        platformEvents.push(customObject);
        continue;
      }

      // Custom Metadata Types
      if (key.includes('__mdt')) {
        customMetadataTypes.push(customObject);
        continue;
      }

      // Custom Settings
      if (customObject.customSettingsType) {
        customSettings.push(customObject);
        continue;
      }

      if (value.recordTypes ?? customObject.recordTypes) {
        customObject.recordTypes = [...(value.recordTypes ?? []), ...(customObject.recordTypes ?? [])].toSorted(
          (a, b) => a.fullName.localeCompare(b.fullName),
        );
      }
      if (value.fieldSets ?? customObject.fieldSets) {
        customObject.fieldSets = [...(value.fieldSets ?? []), ...(customObject.fieldSets ?? [])].toSorted((a, b) =>
          (a.label ?? '').localeCompare(b.label ?? ''),
        );
      }
      if (value.validationRules ?? customObject.validationRules) {
        customObject.validationRules = [
          ...(value.validationRules ?? []),
          ...(customObject.validationRules ?? []),
        ].toSorted((a, b) => a.fullName.localeCompare(b.fullName));
      }

      if (customObject.name.endsWith('__c')) {
        customObjects.push(customObject);
      } else {
        standardObjects.push(customObject);
      }
    }

    platformEvents.sort((a, b) => a.name.localeCompare(b.name));
    customMetadataTypes.sort((a, b) => a.name.localeCompare(b.name));
    customSettings.sort((a, b) => a.name.localeCompare(b.name));
    customObjects.sort((a, b) => a.name.localeCompare(b.name));

    this.spinner.stop();

    this.spinner.start(messages.getMessage('info.renderingDocument'));

    let html: string;
    if (flags['output-format'] === 'html') {
      html = buildTechnicalDesignDocumentHtml(
        {
          apexClasses,
          apexTriggers,
          approvalProcesses,
          auraComponents,
          customApplications,
          customLabels,
          customMetadata,
          customMetadataTypes,
          customObjects,
          customSettings,
          dashboards,
          digitalExperienceBundles,
          emailTemplates,
          experienceBundles,
          flexipages,
          flows,
          groups,
          lightningComponents,
          permissionSets,
          permissionSetGroups,
          platformEvents,
          queues,
          reports,
          sharingRules,
          standardObjects,
          staticResources,
          visualforcePages,
        },
        customTemplateSource,
      );
    } else {
      throw messages.createError('error.unsupportedOutputFormat', [flags['output-format']]);
    }

    await fs.writeFile(flags['output-file'], html, 'utf-8');
    this.spinner.stop();

    this.info(messages.getMessage('info.complete', [flags['output-file']]));

    const componentCount =
      apexClasses.length +
      apexTriggers.length +
      approvalProcesses.length +
      auraComponents.length +
      customApplications.length +
      customLabels.length +
      customMetadata.length +
      customMetadataTypes.length +
      customObjects.length +
      customSettings.length +
      dashboards.length +
      digitalExperienceBundles.length +
      emailTemplates.length +
      experienceBundles.length +
      flexipages.length +
      flows.length +
      groups.length +
      lightningComponents.length +
      permissionSets.length +
      permissionSetGroups.length +
      platformEvents.length +
      queues.length +
      reports.length +
      sharingRules.length +
      standardObjects.length +
      staticResources.length +
      visualforcePages.length;

    return {
      outputFile: flags['output-file'],
      componentCount,
    };
  }
}
