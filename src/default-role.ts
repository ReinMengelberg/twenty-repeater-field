import { defineApplicationRole, SystemPermissionFlag } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Front component tokens are this role intersected with the viewing member's role.
// - read/update records: load and save the repeater JSON field on any object
// - APPLICATIONS: read and write the REPEATER_DEFINITIONS app variable
// - DATA_MODEL: create the RAW_JSON field from the settings page
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} default function role`,
  description: `${APP_DISPLAY_NAME} default function role`,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  permissionFlagUniversalIdentifiers: [
    SystemPermissionFlag.APPLICATIONS,
    SystemPermissionFlag.DATA_MODEL,
  ],
});
