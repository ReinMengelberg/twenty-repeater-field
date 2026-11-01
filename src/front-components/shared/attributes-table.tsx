import { IconButton, LightButton } from 'twenty-ui/components/input';
import { Checkbox, Input } from 'twenty-ui/primitives/input';
import { Text } from 'twenty-ui/primitives/typography';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';

import {
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPES,
  createId,
  toCamelCaseKey,
  type AttributeDefinition,
  type AttributeType,
} from 'src/shared/repeater-config';
import { PickerField } from 'src/front-components/shared/picker-field';

// Draft row: the key of an attribute that already exists in the saved definition is
// locked, since renaming it would orphan the values stored under the old key.
export type DraftAttribute = AttributeDefinition & {
  draftId: string;
  isKeyLocked: boolean;
  isKeyTouched: boolean;
  optionsText: string;
};

export const toDraftAttribute = (
  attribute: AttributeDefinition,
  isKeyLocked: boolean,
): DraftAttribute => ({
  ...attribute,
  draftId: createId(),
  isKeyLocked,
  isKeyTouched: isKeyLocked,
  optionsText: (attribute.options ?? []).join(', '),
});

export const fromDraftAttribute = (draft: DraftAttribute): AttributeDefinition => {
  const attribute: AttributeDefinition = {
    key: draft.key,
    label: draft.label.trim(),
    type: draft.type,
    required: draft.required === true,
  };
  if (draft.type === 'SELECT') {
    attribute.options = draft.optionsText
      .split(',')
      .map((option) => option.trim())
      .filter((option, index, all) => option !== '' && all.indexOf(option) === index);
  }
  if (draft.type === 'CURRENCY') {
    // Not editable in settings; keeps a code saved earlier, otherwise EUR.
    attribute.currencyCode = draft.currencyCode ?? 'EUR';
  }
  return attribute;
};

type AttributesTableProps = {
  attributes: DraftAttribute[];
  onChange: (attributes: DraftAttribute[]) => void;
  disabled?: boolean;
};

export const AttributesTable = ({ attributes, onChange, disabled }: AttributesTableProps) => {
  const theme = useTheme();

  const update = (draftId: string, patch: Partial<DraftAttribute>) =>
    onChange(
      attributes.map((draft) => {
        if (draft.draftId !== draftId) return draft;
        const next = { ...draft, ...patch };
        // New attributes derive their key from the label until the key is edited.
        if (patch.label !== undefined && !draft.isKeyTouched) {
          next.key = toCamelCaseKey(patch.label);
        }
        return next;
      }),
    );

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= attributes.length) return;
    const next = [...attributes];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const cellStyle = {
    padding: theme.spacing[1],
    borderBottom: `1px solid ${theme.border.color.light}`,
    verticalAlign: 'middle' as const,
  };
  const headerCellStyle = {
    ...cellStyle,
    textAlign: 'left' as const,
    fontWeight: theme.font.weight.medium,
    fontSize: theme.font.size.sm,
    color: theme.font.color.tertiary,
    whiteSpace: 'nowrap' as const,
  };

  const hasSelect = attributes.some((draft) => draft.type === 'SELECT');
  const columnCount = hasSelect ? 6 : 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2], minWidth: 0 }}>
      <div style={{ overflowX: 'auto', minWidth: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headerCellStyle} scope="col">Label</th>
              <th style={headerCellStyle} scope="col">Key</th>
              <th style={headerCellStyle} scope="col">Type</th>
              {hasSelect && (
                <th style={headerCellStyle} scope="col">
                  Options
                </th>
              )}
              <th style={headerCellStyle} scope="col">Required</th>
              <th style={{ ...headerCellStyle, width: 1 }} scope="col">
                <span style={{ position: 'absolute', left: -9999 }}>Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {attributes.length === 0 && (
              <tr>
                <td colSpan={columnCount} style={cellStyle}>
                  <Text color="tertiary">No attributes yet.</Text>
                </td>
              </tr>
            )}
            {attributes.map((draft, index) => (
              <tr key={draft.draftId}>
                <td style={{ ...cellStyle, minWidth: 140 }}>
                  <Input
                    size="sm"
                    aria-label={`Label for attribute ${index + 1}`}
                    value={draft.label}
                    disabled={disabled}
                    onChange={(event) => update(draft.draftId, { label: event.target.value })}
                  />
                </td>
                <td style={{ ...cellStyle, minWidth: 120 }}>
                  <Input
                    size="sm"
                    aria-label={`Key for attribute ${index + 1}`}
                    value={draft.key}
                    disabled={disabled || draft.isKeyLocked}
                    onChange={(event) =>
                      update(draft.draftId, { key: event.target.value, isKeyTouched: true })
                    }
                  />
                </td>
                <td style={{ ...cellStyle, minWidth: 120 }}>
                  <PickerField
                    aria-label={`Type for attribute ${index + 1}`}
                    value={draft.type}
                    options={ATTRIBUTE_TYPES.map((type) => ({
                      value: type,
                      label: ATTRIBUTE_TYPE_LABELS[type],
                    }))}
                    disabled={disabled}
                    onChange={(type) => update(draft.draftId, { type: type as AttributeType })}
                  />
                </td>
                {hasSelect && (
                  <td style={{ ...cellStyle, minWidth: 160 }}>
                    {draft.type === 'SELECT' && (
                      <Input
                        size="sm"
                        aria-label={`Options for attribute ${index + 1}, comma separated`}
                        placeholder="Monthly, Yearly"
                        value={draft.optionsText}
                        disabled={disabled}
                        onChange={(event) =>
                          update(draft.draftId, { optionsText: event.target.value })
                        }
                      />
                    )}
                  </td>
                )}
                <td style={cellStyle}>
                  <Checkbox
                    aria-label={`Attribute ${index + 1} is required`}
                    checked={draft.required === true}
                    disabled={disabled || draft.type === 'BOOLEAN'}
                    onCheckedChange={(checked) =>
                      update(draft.draftId, { required: checked === true })
                    }
                  />
                </td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: theme.spacing[1] }}>
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label={`Move attribute ${index + 1} up`}
                      disabled={disabled || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <IconArrowUp size={theme.icon.size.sm} />
                    </IconButton>
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label={`Move attribute ${index + 1} down`}
                      disabled={disabled || index === attributes.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <IconArrowDown size={theme.icon.size.sm} />
                    </IconButton>
                    <IconButton
                      size="xs"
                      variant="ghost"
                      color="danger"
                      aria-label={`Remove attribute ${index + 1}`}
                      disabled={disabled}
                      onClick={() =>
                        onChange(attributes.filter((entry) => entry.draftId !== draft.draftId))
                      }
                    >
                      <IconTrash size={theme.icon.size.sm} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <LightButton
          startIcon={<IconPlus size={theme.icon.size.sm} />}
          disabled={disabled}
          onClick={() =>
            onChange([
              ...attributes,
              toDraftAttribute({ key: '', label: '', type: 'TEXT', required: false }, false),
            ])
          }
        >
          Add attribute
        </LightButton>
      </div>
    </div>
  );
};
