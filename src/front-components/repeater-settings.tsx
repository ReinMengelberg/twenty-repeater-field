import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar, openCommandConfirmationModal } from 'twenty-sdk/front-component';
import { LightButton, LightIconButton, MainButton } from 'twenty-ui/components/input';
import { Callout } from 'twenty-ui/components/feedback';
import { Dropdown } from 'twenty-ui/components/navigation';
import { Input } from 'twenty-ui/primitives/input';
import { Loader } from 'twenty-ui/primitives/feedback';
import { Heading, Text } from 'twenty-ui/primitives/typography';
import {
  IconDeviceFloppy,
  IconDotsVertical,
  IconPlus,
  IconRestore,
  IconTrash,
} from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';

import { REPEATER_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  AttributesTable,
  fromDraftAttribute,
  toDraftAttribute,
  type DraftAttribute,
} from 'src/front-components/shared/attributes-table';
import {
  createJsonField,
  listObjects,
  loadRepeaterConfig,
  saveRepeaterConfig,
  type ObjectOption,
} from 'src/front-components/shared/metadata-api';
import { PickerField } from 'src/front-components/shared/picker-field';
import { describeError } from 'src/front-components/shared/record-api';
import {
  createId,
  EMPTY_REPEATER_CONFIG,
  toCamelCaseKey,
  validateRepeaterConfig,
  type RepeaterConfig,
  type RepeaterDefinition,
} from 'src/shared/repeater-config';

type DraftRepeater = Omit<RepeaterDefinition, 'attributes'> & {
  attributes: DraftAttribute[];
  newFieldLabel: string;
};

const NEW_FIELD = '__new__';

const toDraftRepeater = (repeater: RepeaterDefinition): DraftRepeater => ({
  ...repeater,
  attributes: repeater.attributes.map((attribute) => toDraftAttribute(attribute, true)),
  newFieldLabel: '',
});

const fromDrafts = (drafts: DraftRepeater[]): RepeaterConfig => ({
  version: 1,
  repeaters: drafts.map(({ id, label, objectNameSingular, fieldName, attributes }) => ({
    id,
    label: label.trim(),
    objectNameSingular,
    fieldName,
    attributes: attributes.map(fromDraftAttribute),
  })),
});

const RepeaterSettings = () => {
  const theme = useTheme();
  const [objects, setObjects] = useState<ObjectOption[] | null>(null);
  const [saved, setSaved] = useState<RepeaterConfig>(EMPTY_REPEATER_CONFIG);
  const [drafts, setDrafts] = useState<DraftRepeater[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [creatingFieldFor, setCreatingFieldFor] = useState<string | null>(null);

  const reset = useCallback((config: RepeaterConfig) => {
    setSaved(config);
    setDrafts(config.repeaters.map(toDraftRepeater));
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [config, objectOptions] = await Promise.all([loadRepeaterConfig(), listObjects()]);
      setObjects(objectOptions);
      reset(config);
    } catch (error) {
      setLoadError(describeError(error));
    }
  }, [reset]);

  useEffect(() => {
    void load();
  }, [load]);

  const candidate = useMemo(() => fromDrafts(drafts), [drafts]);
  const errors = useMemo(() => validateRepeaterConfig(candidate), [candidate]);
  const isDirty = JSON.stringify(candidate) !== JSON.stringify(saved);

  const updateRepeater = (id: string, patch: Partial<DraftRepeater>) =>
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );

  const addRepeater = () =>
    setDrafts((current) => [
      ...current,
      {
        id: createId(),
        label: '',
        objectNameSingular: '',
        fieldName: '',
        attributes: [],
        newFieldLabel: '',
      },
    ]);

  const removeRepeater = async (draft: DraftRepeater) => {
    const isSaved = saved.repeaters.some((repeater) => repeater.id === draft.id);
    if (isSaved) {
      const choice = await openCommandConfirmationModal({
        title: `Remove "${draft.label || 'repeater'}"?`,
        subtitle: `The widget stops showing it after you save. Data in ${draft.objectNameSingular}.${draft.fieldName} is kept.`,
        confirmButtonText: 'Remove',
        confirmButtonAccent: 'danger',
      });
      if (choice !== 'confirm') return;
    }
    setDrafts((current) => current.filter((entry) => entry.id !== draft.id));
  };

  const createField = async (draft: DraftRepeater) => {
    const object = objects?.find((entry) => entry.nameSingular === draft.objectNameSingular);
    const label = draft.newFieldLabel.trim();
    const name = toCamelCaseKey(label);
    if (!object || name === '') return;

    setCreatingFieldFor(draft.id);
    try {
      await createJsonField(object.id, name, label);
      setObjects(await listObjects());
      updateRepeater(draft.id, {
        fieldName: name,
        newFieldLabel: '',
        label: draft.label.trim() === '' ? label : draft.label,
      });
      await enqueueSnackbar({
        message: `Created field ${object.labelSingular} › ${label}`,
        variant: 'success',
      });
    } catch (error) {
      await enqueueSnackbar({
        message: `Could not create field: ${describeError(error)}`,
        variant: 'error',
      });
    } finally {
      setCreatingFieldFor(null);
    }
  };

  const save = async () => {
    if (errors.length > 0) return;
    setIsSaving(true);
    try {
      await saveRepeaterConfig(candidate);
      reset(candidate);
      await enqueueSnackbar({
        message: 'Repeaters saved. Open records pick up changes on reload.',
        variant: 'success',
      });
    } catch (error) {
      await enqueueSnackbar({
        message: `Could not save repeaters: ${describeError(error)}`,
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <Callout
        status="error"
        fullWidth
        title="Could not load repeaters"
        description={loadError}
        action={<LightButton onClick={() => void load()}>Retry</LightButton>}
      />
    );
  }

  if (!objects) {
    return (
      <div style={{ padding: theme.spacing[6], display: 'flex', justifyContent: 'center' }}>
        <Loader />
      </div>
    );
  }

  const busy = isSaving || creatingFieldFor !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4], minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
        <Heading level={2} size="lg">
          Repeaters
        </Heading>
        <Text color="tertiary">
          A repeater turns a JSON field on any object into a list of items with the attributes
          you define here. Add the Repeater field widget to that object's record page to edit it.
        </Text>
      </div>

      {drafts.length === 0 && (
        <Callout
          status="info"
          fullWidth
          title="No repeaters yet"
          description="Add one, pick an object and a JSON field (or create one), then define its attributes."
        />
      )}

      {drafts.map((draft) => {
        const object = objects.find((entry) => entry.nameSingular === draft.objectNameSingular);
        const jsonFields = object?.jsonFields ?? [];
        const fieldMissing =
          draft.fieldName !== '' && !jsonFields.some((field) => field.name === draft.fieldName);
        const fieldSelectValue = draft.fieldName === '' ? NEW_FIELD : draft.fieldName;

        return (
          <section
            key={draft.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing[3],
              padding: theme.spacing[4],
              border: `1px solid ${theme.border.color.medium}`,
              borderRadius: theme.border.radius.md,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: theme.spacing[2],
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Heading level={3} size="md">
                  {draft.label.trim() || 'Untitled repeater'}
                </Heading>
                <Text size="sm" color="tertiary">
                  {object
                    ? `${object.labelSingular} › ${
                        jsonFields.find((field) => field.name === draft.fieldName)?.label ??
                        (draft.fieldName || 'no field yet')
                      }`
                    : 'No object yet'}
                </Text>
              </div>
              <Dropdown.Root type="menu">
                <Dropdown.Trigger
                  disabled={busy}
                  render={
                    <LightIconButton
                      size="sm"
                      aria-label={`Actions for ${draft.label.trim() || 'untitled repeater'}`}
                    >
                      <IconDotsVertical size={theme.icon.size.md} />
                    </LightIconButton>
                  }
                />
                <Dropdown.Content aria-label="Repeater actions" width={200} align="end">
                  <Dropdown.ActionItem
                    color="danger"
                    startIcon={<IconTrash size={theme.icon.size.sm} />}
                    onClick={() => void removeRepeater(draft)}
                  >
                    Remove repeater
                  </Dropdown.ActionItem>
                </Dropdown.Content>
              </Dropdown.Root>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: theme.spacing[3],
                alignItems: 'end',
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
                <Text size="sm" color="secondary">
                  Label
                </Text>
                <Input
                  size="sm"
                  placeholder="Line items"
                  value={draft.label}
                  disabled={busy}
                  onChange={(event) => updateRepeater(draft.id, { label: event.target.value })}
                />
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
                <Text size="sm" color="secondary">
                  Object
                </Text>
                <PickerField
                  aria-label="Object"
                  placeholder="Pick an object"
                  value={draft.objectNameSingular === '' ? null : draft.objectNameSingular}
                  options={objects.map((entry) => ({
                    value: entry.nameSingular,
                    label: entry.labelSingular,
                  }))}
                  disabled={busy}
                  onChange={(nameSingular) => {
                    if (nameSingular !== draft.objectNameSingular) {
                      updateRepeater(draft.id, { objectNameSingular: nameSingular, fieldName: '' });
                    }
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
                <Text size="sm" color="secondary">
                  JSON field
                </Text>
                <PickerField
                  aria-label="JSON field"
                  placeholder="Pick an object first"
                  value={draft.objectNameSingular === '' ? null : fieldSelectValue}
                  options={[
                    ...jsonFields.map((field) => ({
                      value: field.name,
                      label: `${field.label} (${field.name})`,
                    })),
                    ...(fieldMissing
                      ? [{ value: draft.fieldName, label: `${draft.fieldName} (missing)` }]
                      : []),
                    { value: NEW_FIELD, label: 'New field…' },
                  ]}
                  disabled={busy || draft.objectNameSingular === ''}
                  onChange={(value) =>
                    updateRepeater(draft.id, { fieldName: value === NEW_FIELD ? '' : value })
                  }
                />
              </div>
            </div>

            {draft.objectNameSingular !== '' && draft.fieldName === '' && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: theme.spacing[2],
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: '1 1 220px' }}>
                  <Input
                    size="sm"
                    aria-label="New field label"
                    placeholder={`New JSON field on ${object?.labelSingular ?? 'object'}, e.g. Line items`}
                    value={draft.newFieldLabel}
                    disabled={busy}
                    onChange={(event) =>
                      updateRepeater(draft.id, { newFieldLabel: event.target.value })
                    }
                  />
                </div>
                <Text size="sm" color="tertiary">
                  API name: {toCamelCaseKey(draft.newFieldLabel) || '—'}
                </Text>
                <LightButton
                  startIcon={<IconPlus size={theme.icon.size.sm} />}
                  disabled={busy || toCamelCaseKey(draft.newFieldLabel) === ''}
                  loading={creatingFieldFor === draft.id}
                  onClick={() => void createField(draft)}
                >
                  Create field
                </LightButton>
              </div>
            )}

            {fieldMissing && (
              <Callout
                status="warning"
                fullWidth
                title={`Field "${draft.fieldName}" no longer exists on ${object?.labelSingular ?? draft.objectNameSingular}`}
                description="Pick another JSON field or create a new one."
              />
            )}

            <AttributesTable
              attributes={draft.attributes}
              disabled={busy}
              onChange={(attributes) => updateRepeater(draft.id, { attributes })}
            />
          </section>
        );
      })}

      {errors.length > 0 && drafts.length > 0 && (
        <Callout
          status="warning"
          fullWidth
          title="Fix these before saving"
          description={errors.join(' · ')}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing[2],
          justifyContent: 'space-between',
        }}
      >
        <LightButton
          startIcon={<IconPlus size={theme.icon.size.sm} />}
          disabled={busy}
          onClick={addRepeater}
        >
          Add repeater
        </LightButton>
        <div style={{ display: 'flex', gap: theme.spacing[2] }}>
          <LightButton
            startIcon={<IconRestore size={theme.icon.size.sm} />}
            disabled={!isDirty || busy}
            onClick={() => reset(saved)}
          >
            Discard
          </LightButton>
          <MainButton
            startIcon={<IconDeviceFloppy size={theme.icon.size.sm} />}
            disabled={!isDirty || errors.length > 0 || creatingFieldFor !== null}
            loading={isSaving}
            onClick={() => void save()}
          >
            Save
          </MainButton>
        </div>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: REPEATER_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Repeaters',
  description: 'Settings page for defining repeaters on any object',
  component: RepeaterSettings,
});
