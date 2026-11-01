import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defineFrontComponent, PageLayoutType } from 'twenty-sdk/define';
import {
  getApplicationVariable,
  useSelectedObjectMetadata,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import { LightButton } from 'twenty-ui/components/input';
import { Callout } from 'twenty-ui/components/feedback';
import { Loader } from 'twenty-ui/primitives/feedback';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme';

import {
  REPEATER_DEFINITIONS_VARIABLE_KEY,
  REPEATER_WIDGET_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { describeError, fetchRecord } from 'src/front-components/shared/record-api';
import { RepeaterEditor } from 'src/front-components/shared/repeater-editor';
import {
  getRepeatersForObject,
  parseRepeaterConfig,
  parseRepeaterItems,
} from 'src/shared/repeater-config';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; record: Record<string, unknown> };

const RepeaterWidget = () => {
  const theme = useTheme();
  const selectedRecordIds = useSelectedRecordIds();
  const objectMetadata = useSelectedObjectMetadata();
  const recordId = selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;

  // Injected when the component loads; settings changes show up on the next load.
  const nameSingular = objectMetadata?.nameSingular ?? null;
  const namePlural = objectMetadata?.namePlural ?? null;
  const repeaters = useMemo(() => {
    if (!nameSingular) return [];
    const config = parseRepeaterConfig(getApplicationVariable(REPEATER_DEFINITIONS_VARIABLE_KEY));
    return getRepeatersForObject(config, nameSingular);
  }, [nameSingular]);

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!recordId || !namePlural || repeaters.length === 0) return;
    setLoadState({ status: 'loading' });
    try {
      const record = await fetchRecord(namePlural, recordId);
      setLoadState({ status: 'ready', record });
    } catch (error) {
      setLoadState({ status: 'error', message: describeError(error) });
    }
  }, [namePlural, recordId, repeaters.length]);

  useEffect(() => {
    void load();
  }, [load]);

  const padded = (content: ReactNode) => (
    <div style={{ padding: `${theme.spacing[2]} 0` }}>{content}</div>
  );

  if (!objectMetadata || !recordId) {
    return padded(<Text color="tertiary">Open a single record to edit its repeaters.</Text>);
  }

  if (repeaters.length === 0) {
    return padded(
      <Callout
        status="info"
        title={`No repeater configured for ${objectMetadata.nameSingular}`}
        description="Add one under Settings > Apps > Repeater Field > Repeaters."
      />,
    );
  }

  if (loadState.status === 'loading') {
    return (
      <div style={{ padding: theme.spacing[4], display: 'flex', justifyContent: 'center' }}>
        <Loader />
      </div>
    );
  }

  if (loadState.status === 'error') {
    return padded(
      <Callout
        status="error"
        title="Could not load this record"
        description={loadState.message}
        action={<LightButton onClick={() => void load()}>Retry</LightButton>}
      />,
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[6],
        // The widget card already supplies side padding; match the Fields widget edge.
        padding: `${theme.spacing[2]} 0`,
        minWidth: 0,
      }}
    >
      {repeaters.map((repeater) =>
        repeater.fieldName in loadState.record ? (
          <RepeaterEditor
            key={repeater.id}
            repeater={repeater}
            namePlural={objectMetadata.namePlural}
            recordId={recordId}
            initialItems={parseRepeaterItems(loadState.record[repeater.fieldName])}
            showTitle={repeaters.length > 1}
          />
        ) : (
          <Callout
            key={repeater.id}
            status="warning"
            title={`${repeater.label}: field "${repeater.fieldName}" not found`}
            description={`The ${objectMetadata.nameSingular} object has no field with that name, or it is inactive. Check the repeater in settings.`}
          />
        ),
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: REPEATER_WIDGET_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Repeater field',
  description: 'Edits the repeater fields configured for this object',
  component: RepeaterWidget,
  // Offered on every record page; the widget shows the repeaters configured for that object.
  widgetAvailability: { pageLayoutType: PageLayoutType.RECORD_PAGE },
});
