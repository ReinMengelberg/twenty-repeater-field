import { useEffect, useMemo, useRef, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';
import { IconButton, LightButton } from 'twenty-ui/components/input';
import { Heading, Text } from 'twenty-ui/primitives/typography';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';

import { AttributeInput } from 'src/front-components/shared/attribute-input';
import { describeError, saveRepeaterItems } from 'src/front-components/shared/record-api';
import {
  createEmptyItem,
  findMissingRequired,
  type RepeaterDefinition,
  type RepeaterItem,
  type RepeaterValue,
} from 'src/shared/repeater-config';

// Typing pauses this long before the record is saved, like Twenty's own fields.
const AUTOSAVE_DELAY_MS = 600;

type RepeaterEditorProps = {
  repeater: RepeaterDefinition;
  namePlural: string;
  recordId: string;
  initialItems: RepeaterItem[];
  showTitle: boolean;
};

export const RepeaterEditor = ({
  repeater,
  namePlural,
  recordId,
  initialItems,
  showTitle,
}: RepeaterEditorProps) => {
  const theme = useTheme();
  const { attributes } = repeater;

  const [items, setItems] = useState<RepeaterItem[]>(initialItems);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Last snapshot the server has, and the last one that failed, so a failure is not
  // retried in a loop; the next edit retries it.
  const savedJsonRef = useRef(JSON.stringify(initialItems));
  const failedJsonRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<RepeaterItem[] | null>(null);

  const missingRequired = useMemo(() => findMissingRequired(attributes, items), [attributes, items]);

  const persist = async (snapshot: RepeaterItem[]) => {
    const json = JSON.stringify(snapshot);
    if (json === savedJsonRef.current) return;
    if (inFlightRef.current) {
      pendingRef.current = snapshot;
      return;
    }
    inFlightRef.current = true;
    setIsSaving(true);
    try {
      await saveRepeaterItems(namePlural, recordId, repeater.fieldName, snapshot);
      savedJsonRef.current = json;
      failedJsonRef.current = null;
      setSaveError(null);
    } catch (error) {
      failedJsonRef.current = json;
      const message = describeError(error);
      setSaveError(message);
      await enqueueSnackbar({
        message: `Could not save ${repeater.label}: ${message}`,
        variant: 'error',
      });
    } finally {
      inFlightRef.current = false;
      setIsSaving(false);
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next) void persist(next);
    }
  };

  // Rows with an empty required value are kept as a local draft until filled in.
  const json = JSON.stringify(items);
  const canSave = missingRequired.length === 0;
  useEffect(() => {
    if (!canSave || json === savedJsonRef.current || json === failedJsonRef.current) return;
    const timer = setTimeout(() => void persist(items), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, canSave]);

  // Flush an edit still waiting on the debounce when the record panel closes.
  const latestRef = useRef({ items, canSave });
  latestRef.current = { items, canSave };
  useEffect(
    () => () => {
      const { items: latest, canSave: latestCanSave } = latestRef.current;
      if (latestCanSave) void persist(latest);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const updateCell = (itemId: string, key: string, value: RepeaterValue) =>
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, [key]: value } : item)),
    );

  const addRow = () => setItems((current) => [...current, createEmptyItem(attributes)]);

  const removeRow = (itemId: string) =>
    setItems((current) => current.filter((item) => item.id !== itemId));

  const moveRow = (index: number, direction: -1 | 1) =>
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const cellStyle = {
    padding: `${theme.spacing[1]} ${theme.spacing[1]} ${theme.spacing[1]} 0`,
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

  const status = isSaving
    ? 'Saving…'
    : saveError
      ? `Not saved: ${saveError}`
      : missingRequired.length > 0
        ? `Not saved yet. Fill in ${missingRequired
            .map((entry) => `${entry.label} (row ${entry.row + 1})`)
            .join(', ')}`
        : null;

  return (
    <section
      style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2], minWidth: 0 }}
    >
      {showTitle && (
        <Heading level={3} size="md">
          {repeater.label}
        </Heading>
      )}

      <div style={{ overflowX: 'auto', minWidth: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {attributes.map((attribute) => (
                <th key={attribute.key} style={headerCellStyle} scope="col">
                  {attribute.label}
                  {attribute.required ? ' *' : ''}
                </th>
              ))}
              <th style={{ ...headerCellStyle, width: 1 }} scope="col">
                <span style={{ position: 'absolute', left: -9999 }}>Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={attributes.length + 1} style={cellStyle}>
                  <Text color="tertiary">No items yet.</Text>
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  {attributes.map((attribute) => (
                    <td
                      key={attribute.key}
                      style={{
                        ...cellStyle,
                        minWidth: attribute.type === 'BOOLEAN' ? undefined : 110,
                      }}
                    >
                      <AttributeInput
                        attribute={attribute}
                        value={item[attribute.key]}
                        onChange={(value) => updateCell(item.id, attribute.key, value)}
                      />
                    </td>
                  ))}
                  <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: theme.spacing[1] }}>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label={`Move row ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => moveRow(index, -1)}
                      >
                        <IconArrowUp size={theme.icon.size.sm} />
                      </IconButton>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label={`Move row ${index + 1} down`}
                        disabled={index === items.length - 1}
                        onClick={() => moveRow(index, 1)}
                      >
                        <IconArrowDown size={theme.icon.size.sm} />
                      </IconButton>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        color="danger"
                        aria-label={`Remove row ${index + 1}`}
                        onClick={() => removeRow(item.id)}
                      >
                        <IconTrash size={theme.icon.size.sm} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.spacing[1],
          textAlign: 'center',
        }}
      >
        <LightButton startIcon={<IconPlus size={theme.icon.size.sm} />} onClick={addRow}>
          Add item
        </LightButton>
        {status && (
          <Text size="sm" color={saveError ? 'secondary' : 'tertiary'} aria-live="polite">
            {status}
          </Text>
        )}
      </div>
    </section>
  );
};
