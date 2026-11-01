import { defineSettingsMenuItem } from 'twenty-sdk/define';

import {
  REPEATER_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  REPEATER_SETTINGS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Tab on Settings > Apps > Repeater Field. Replaces the generated Variables form.
export default defineSettingsMenuItem({
  universalIdentifier: REPEATER_SETTINGS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier: REPEATER_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  title: 'Repeaters',
  icon: 'IconListDetails',
  position: 1,
});
