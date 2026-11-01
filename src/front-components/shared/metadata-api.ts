import { getApplicationVariable } from 'twenty-sdk/front-component';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  REPEATER_DEFINITIONS_VARIABLE_KEY,
} from 'src/constants/universal-identifiers';
import { parseRepeaterConfig, type RepeaterConfig } from 'src/shared/repeater-config';

export type JsonFieldOption = { name: string; label: string };

export type ObjectOption = {
  id: string;
  nameSingular: string;
  labelSingular: string;
  jsonFields: JsonFieldOption[];
};

// Active, non-system objects with their active RAW_JSON fields.
export const listObjects = async (): Promise<ObjectOption[]> => {
  const { objects } = await new MetadataApiClient().query({
    objects: {
      __args: {
        filter: { isActive: { is: true }, isSystem: { is: false } },
        paging: { first: 500 },
      },
      edges: {
        node: {
          id: true,
          nameSingular: true,
          labelSingular: true,
          fieldsList: { name: true, label: true, type: true, isActive: true, isSystem: true },
        },
      },
    },
  });

  return (objects?.edges ?? [])
    .map(({ node }) => ({
      id: node.id,
      nameSingular: node.nameSingular,
      labelSingular: node.labelSingular,
      jsonFields: (node.fieldsList ?? [])
        .filter((field) => field.type === 'RAW_JSON' && field.isActive && !field.isSystem)
        .map((field) => ({ name: field.name, label: field.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.labelSingular.localeCompare(b.labelSingular));
};

export const createJsonField = async (
  objectMetadataId: string,
  name: string,
  label: string,
): Promise<void> => {
  await new MetadataApiClient().mutation({
    createOneField: {
      __args: {
        input: {
          field: {
            objectMetadataId,
            type: 'RAW_JSON',
            name,
            label,
            icon: 'IconListDetails',
            description: 'Repeater items (JSON array), edited with the Repeater Field app',
            isNullable: true,
          },
        },
      },
      id: true,
    },
  });
};

export const loadRepeaterConfig = async (): Promise<RepeaterConfig> => {
  try {
    const { findOneApplication } = await new MetadataApiClient().query({
      findOneApplication: {
        __args: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
        applicationVariables: { key: true, value: true },
      },
    });
    const variable = findOneApplication?.applicationVariables?.find(
      (entry) => entry.key === REPEATER_DEFINITIONS_VARIABLE_KEY,
    );
    if (variable) return parseRepeaterConfig(variable.value);
  } catch {
    // Fall back to the value injected at load time.
  }
  return parseRepeaterConfig(getApplicationVariable(REPEATER_DEFINITIONS_VARIABLE_KEY));
};

export const saveRepeaterConfig = async (config: RepeaterConfig): Promise<void> => {
  await new MetadataApiClient().mutation({
    updateOneApplicationVariable: {
      __args: { key: REPEATER_DEFINITIONS_VARIABLE_KEY, value: JSON.stringify(config) },
    },
  });
};
