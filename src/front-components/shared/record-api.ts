import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';

import { parseRepeaterItems, toStoredItems, type RepeaterItem } from 'src/shared/repeater-config';

// REST responses wrap the record: { data: { quote: {...} } } on GET and
// { data: { updateQuote: {...} } } on PATCH. Take the first object under data.
const unwrapRecord = (response: unknown): Record<string, unknown> | null => {
  if (typeof response !== 'object' || response === null) return null;
  const data = (response as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const first = Object.values(data)[0];
  return typeof first === 'object' && first !== null ? (first as Record<string, unknown>) : null;
};

const recordPath = (namePlural: string, recordId: string) =>
  `/rest/${encodeURIComponent(namePlural)}/${encodeURIComponent(recordId)}`;

// One GET per record serves every repeater on it.
export const fetchRecord = async (
  namePlural: string,
  recordId: string,
): Promise<Record<string, unknown>> => {
  const response = await new RestApiClient().get(recordPath(namePlural, recordId));
  return unwrapRecord(response) ?? {};
};

export const saveRepeaterItems = async (
  namePlural: string,
  recordId: string,
  fieldName: string,
  items: RepeaterItem[],
): Promise<RepeaterItem[]> => {
  const response = await new RestApiClient().patch(recordPath(namePlural, recordId), {
    [fieldName]: toStoredItems(items),
  });
  const record = unwrapRecord(response);
  return record && fieldName in record ? parseRepeaterItems(record[fieldName]) : items;
};

export const describeError = (error: unknown): string => {
  if (error instanceof RestApiClientError) {
    const body = error.body as { messages?: string[]; message?: string } | undefined;
    return body?.messages?.join(', ') ?? body?.message ?? `${error.status} ${error.statusText}`;
  }
  return error instanceof Error ? error.message : 'Unknown error';
};
