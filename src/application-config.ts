import { defineApplication, FieldType } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  REPEATER_DEFINITIONS_VARIABLE_KEY,
  REPEATER_DEFINITIONS_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { EMPTY_REPEATER_CONFIG } from 'src/shared/repeater-config';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    [REPEATER_DEFINITIONS_VARIABLE_KEY]: {
      universalIdentifier: REPEATER_DEFINITIONS_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Repeater definitions (object, JSON field, attributes). Edit under Settings > Apps > Repeater Field > Repeaters.',
      type: FieldType.RAW_JSON,
      value: EMPTY_REPEATER_CONFIG as unknown as Record<string, unknown>,
      isSecret: false,
    },
  },
});
