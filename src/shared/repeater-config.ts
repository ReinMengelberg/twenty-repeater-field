// Shared types and pure helpers for repeater definitions and repeater values.
// No runtime imports: used by both front components and unit tests.

export const ATTRIBUTE_TYPES = [
  'TEXT',
  'NUMBER',
  'CURRENCY',
  'PERCENT',
  'BOOLEAN',
  'SELECT',
  'DATE',
] as const;

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  CURRENCY: 'Currency',
  PERCENT: 'Percent',
  BOOLEAN: 'Yes / No',
  SELECT: 'Select',
  DATE: 'Date',
};

export type AttributeDefinition = {
  key: string;
  label: string;
  type: AttributeType;
  required?: boolean;
  // SELECT only
  options?: string[];
  // CURRENCY only, ISO 4217
  currencyCode?: string;
};

// One repeater = one RAW_JSON field on one object, plus the shape of its items.
export type RepeaterDefinition = {
  id: string;
  label: string;
  objectNameSingular: string;
  fieldName: string;
  attributes: AttributeDefinition[];
};

export type RepeaterConfig = {
  version: 1;
  repeaters: RepeaterDefinition[];
};

export const EMPTY_REPEATER_CONFIG: RepeaterConfig = { version: 1, repeaters: [] };

export type RepeaterValue = string | number | boolean | null;

// In memory every item carries an id so rows keep their identity while editing; it is
// stripped before saving (see toStoredItems). Values are keyed by attribute key. Keys not
// in the current definition are preserved, so removing an attribute never destroys data.
export type RepeaterItem = { id: string } & Record<string, RepeaterValue>;

// Reserved for the in-memory row id, so it cannot be an attribute key.
const RESERVED_KEYS = new Set(['id']);

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export const isValidAttributeKey = (key: string): boolean =>
  KEY_PATTERN.test(key) && !RESERVED_KEYS.has(key);

// "Unit price" -> "unitPrice". Leading digits are dropped so the key starts with a letter.
export const toCamelCaseKey = (label: string): string =>
  label
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/^[\d\s_]+/, '')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');

const isAttributeType = (value: unknown): value is AttributeType =>
  typeof value === 'string' && (ATTRIBUTE_TYPES as readonly string[]).includes(value);

const parseJsonish = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  if (raw.trim() === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Invalid attributes are dropped instead of failing the whole repeater.
export const parseAttributes = (raw: unknown): AttributeDefinition[] => {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const attributes: AttributeDefinition[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { key, label, type, required, options, currencyCode } = entry as Record<
      string,
      unknown
    >;

    if (typeof key !== 'string' || !isValidAttributeKey(key) || seen.has(key)) continue;
    if (!isAttributeType(type)) continue;
    seen.add(key);

    attributes.push({
      key,
      label: typeof label === 'string' && label.trim() !== '' ? label : key,
      type,
      required: required === true,
      ...(type === 'SELECT'
        ? {
            options: Array.isArray(options)
              ? options.filter((option): option is string => typeof option === 'string')
              : [],
          }
        : {}),
      ...(type === 'CURRENCY'
        ? {
            currencyCode:
              typeof currencyCode === 'string' && CURRENCY_PATTERN.test(currencyCode)
                ? currencyCode
                : 'EUR',
          }
        : {}),
    });
  }

  return attributes;
};

// Parses the REPEATER_DEFINITIONS app variable (JSON string or object).
export const parseRepeaterConfig = (raw: unknown): RepeaterConfig => {
  const candidate = parseJsonish(raw);
  if (typeof candidate !== 'object' || candidate === null) return EMPTY_REPEATER_CONFIG;

  const repeatersRaw = (candidate as { repeaters?: unknown }).repeaters;
  if (!Array.isArray(repeatersRaw)) return EMPTY_REPEATER_CONFIG;

  const repeaters: RepeaterDefinition[] = [];
  for (const entry of repeatersRaw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, label, objectNameSingular, fieldName, attributes } = entry as Record<
      string,
      unknown
    >;
    if (
      typeof id !== 'string' ||
      typeof objectNameSingular !== 'string' ||
      objectNameSingular === '' ||
      typeof fieldName !== 'string' ||
      fieldName === ''
    ) {
      continue;
    }
    repeaters.push({
      id,
      label: typeof label === 'string' && label.trim() !== '' ? label : fieldName,
      objectNameSingular,
      fieldName,
      attributes: parseAttributes(attributes),
    });
  }

  return { version: 1, repeaters };
};

export const getRepeatersForObject = (
  config: RepeaterConfig,
  objectNameSingular: string,
): RepeaterDefinition[] =>
  config.repeaters.filter((repeater) => repeater.objectNameSingular === objectNameSingular);

export type ValidationError = { message: string };

export const validateAttributes = (attributes: AttributeDefinition[]): string[] => {
  const errors: string[] = [];
  const seen = new Set<string>();

  attributes.forEach((attribute, index) => {
    const row = `Attribute ${index + 1}`;
    if (!isValidAttributeKey(attribute.key)) {
      errors.push(
        RESERVED_KEYS.has(attribute.key)
          ? `${row}: key "${attribute.key}" is reserved`
          : `${row}: key "${attribute.key}" must be camelCase and start with a letter`,
      );
    } else if (seen.has(attribute.key)) {
      errors.push(`${row}: key "${attribute.key}" is used twice`);
    }
    seen.add(attribute.key);

    if (attribute.label.trim() === '') errors.push(`${row}: label is required`);
    if (attribute.type === 'SELECT' && (attribute.options ?? []).length === 0) {
      errors.push(`${row}: select needs at least one option`);
    }
    if (attribute.type === 'CURRENCY' && !CURRENCY_PATTERN.test(attribute.currencyCode ?? '')) {
      errors.push(`${row}: currency needs a 3-letter code`);
    }
  });

  return errors;
};

export const validateRepeaterConfig = (config: RepeaterConfig): string[] => {
  const errors: string[] = [];
  const bindings = new Set<string>();

  config.repeaters.forEach((repeater) => {
    const name = repeater.label.trim() || 'Untitled repeater';
    if (repeater.label.trim() === '') errors.push(`${name}: label is required`);
    if (repeater.objectNameSingular === '') errors.push(`${name}: pick an object`);
    if (repeater.fieldName === '') errors.push(`${name}: pick or create a JSON field`);

    const binding = `${repeater.objectNameSingular}.${repeater.fieldName}`;
    if (repeater.fieldName !== '' && bindings.has(binding)) {
      errors.push(`${name}: ${binding} is already used by another repeater`);
    }
    bindings.add(binding);

    if (repeater.attributes.length === 0) errors.push(`${name}: add at least one attribute`);
    for (const error of validateAttributes(repeater.attributes)) {
      errors.push(`${name}: ${error}`);
    }
  });

  return errors;
};

export const createId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const coerceValue = (value: unknown): RepeaterValue => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return null;
};

// Normalizes a stored RAW_JSON value (null, array, or JSON string) into items.
export const parseRepeaterItems = (raw: unknown): RepeaterItem[] => {
  const candidate = parseJsonish(raw);
  if (!Array.isArray(candidate)) return [];

  return candidate
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
    )
    .map((entry) => {
      const item: RepeaterItem = {
        id: typeof entry.id === 'string' && entry.id !== '' ? entry.id : createId(),
      };
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'id') continue;
        item[key] = coerceValue(value);
      }
      return item;
    });
};

// What is written to the record: the values only, without the in-memory row id.
export const toStoredItems = (items: RepeaterItem[]): Record<string, RepeaterValue>[] =>
  items.map(({ id: _id, ...values }) => values);

export const createEmptyItem = (attributes: AttributeDefinition[]): RepeaterItem => {
  const item: RepeaterItem = { id: createId() };
  for (const attribute of attributes) {
    item[attribute.key] = attribute.type === 'BOOLEAN' ? false : null;
  }
  return item;
};

// Converts raw input text into the stored value for an attribute.
export const coerceInput = (attribute: AttributeDefinition, input: string): RepeaterValue => {
  if (
    attribute.type === 'NUMBER' ||
    attribute.type === 'CURRENCY' ||
    attribute.type === 'PERCENT'
  ) {
    const normalized = input.replace(',', '.').trim();
    if (normalized === '') return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (input === '') return null;
  return input;
};

export const formatForInput = (value: RepeaterValue | undefined): string => {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return String(value);
};

export const findMissingRequired = (
  attributes: AttributeDefinition[],
  items: RepeaterItem[],
): { row: number; label: string }[] => {
  const missing: { row: number; label: string }[] = [];
  items.forEach((item, row) => {
    for (const attribute of attributes) {
      if (!attribute.required || attribute.type === 'BOOLEAN') continue;
      const value = item[attribute.key];
      if (value === null || value === undefined || value === '') {
        missing.push({ row, label: attribute.label });
      }
    }
  });
  return missing;
};
