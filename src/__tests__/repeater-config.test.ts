import { describe, expect, it } from 'vitest';

import {
  coerceInput,
  createEmptyItem,
  isValidAttributeKey,
  EMPTY_REPEATER_CONFIG,
  findMissingRequired,
  getRepeatersForObject,
  parseAttributes,
  parseRepeaterConfig,
  parseRepeaterItems,
  toCamelCaseKey,
  toStoredItems,
  validateRepeaterConfig,
  type AttributeDefinition,
  type RepeaterConfig,
} from 'src/shared/repeater-config';

const LINE_ITEMS: RepeaterConfig = {
  version: 1,
  repeaters: [
    {
      id: 'r1',
      label: 'Line items',
      objectNameSingular: 'quote',
      fieldName: 'lineItems',
      attributes: [
        { key: 'name', label: 'Product', type: 'TEXT', required: true },
        { key: 'quantity', label: 'Qty', type: 'NUMBER', required: true },
      ],
    },
    {
      id: 'r2',
      label: 'Stakeholders',
      objectNameSingular: 'company',
      fieldName: 'stakeholders',
      attributes: [{ key: 'role', label: 'Role', type: 'TEXT' }],
    },
  ],
};

describe('parseRepeaterConfig', () => {
  it('round-trips the JSON string injected into front components', () => {
    const parsed = parseRepeaterConfig(JSON.stringify(LINE_ITEMS));
    expect(parsed.repeaters.map((repeater) => repeater.id)).toEqual(['r1', 'r2']);
    expect(parsed.repeaters[0].attributes[1]).toEqual({
      key: 'quantity',
      label: 'Qty',
      type: 'NUMBER',
      required: true,
    });
  });

  it('returns an empty config on garbage and drops incomplete repeaters', () => {
    expect(parseRepeaterConfig('nope')).toEqual(EMPTY_REPEATER_CONFIG);
    expect(parseRepeaterConfig(undefined)).toEqual(EMPTY_REPEATER_CONFIG);
    expect(
      parseRepeaterConfig({ repeaters: [{ id: 'x', objectNameSingular: 'quote' }] }).repeaters,
    ).toEqual([]);
  });

  it('filters repeaters by object', () => {
    expect(getRepeatersForObject(LINE_ITEMS, 'company').map((repeater) => repeater.id)).toEqual([
      'r2',
    ]);
    expect(getRepeatersForObject(LINE_ITEMS, 'person')).toEqual([]);
  });
});

describe('parseAttributes', () => {
  it('drops invalid and duplicate attributes, keeps the rest', () => {
    expect(
      parseAttributes([
        { key: 'sku', label: 'SKU', type: 'TEXT' },
        { key: 'sku', label: 'Duplicate', type: 'TEXT' },
        { key: 'Bad Key', label: 'Bad', type: 'TEXT' },
        { key: 'term', label: 'Term', type: 'SELECT', options: ['12', 3, '24'] },
        { key: 'mystery', label: 'Mystery', type: 'GEOMETRY' },
      ]),
    ).toEqual([
      { key: 'sku', label: 'SKU', type: 'TEXT', required: false },
      { key: 'term', label: 'Term', type: 'SELECT', required: false, options: ['12', '24'] },
    ]);
  });
});

describe('validateRepeaterConfig', () => {
  it('accepts a valid config', () => {
    expect(validateRepeaterConfig(LINE_ITEMS)).toEqual([]);
  });

  it('rejects two repeaters bound to the same field', () => {
    const duplicate: RepeaterConfig = {
      version: 1,
      repeaters: [LINE_ITEMS.repeaters[0], { ...LINE_ITEMS.repeaters[0], id: 'r3' }],
    };
    expect(validateRepeaterConfig(duplicate).some((error) => error.includes('quote.lineItems'))).toBe(
      true,
    );
  });

  it('requires an object, a field and attributes', () => {
    const errors = validateRepeaterConfig({
      version: 1,
      repeaters: [{ id: 'x', label: 'X', objectNameSingular: '', fieldName: '', attributes: [] }],
    });
    expect(errors).toHaveLength(3);
  });

  it('flags empty select options and bad currency codes', () => {
    const errors = validateRepeaterConfig({
      version: 1,
      repeaters: [
        {
          ...LINE_ITEMS.repeaters[0],
          attributes: [
            { key: 'term', label: 'Term', type: 'SELECT', options: [] },
            { key: 'price', label: 'Price', type: 'CURRENCY', currencyCode: 'eu' },
          ],
        },
      ],
    });
    expect(errors).toHaveLength(2);
  });
});

describe('items', () => {
  it('treats null as empty and keeps unknown keys', () => {
    expect(parseRepeaterItems(null)).toEqual([]);
    const [item] = parseRepeaterItems([{ id: 'a', name: 'Seat', legacyField: 'kept' }]);
    expect(item).toEqual({ id: 'a', name: 'Seat', legacyField: 'kept' });
  });

  it('assigns ids to items without one', () => {
    const [item] = parseRepeaterItems('[{"name":"Seat"}]');
    expect(item.id.length).toBeGreaterThan(0);
  });

  it('reports missing required values per row', () => {
    const { attributes } = LINE_ITEMS.repeaters[0];
    expect(findMissingRequired(attributes, [createEmptyItem(attributes)])).toEqual([
      { row: 0, label: 'Product' },
      { row: 0, label: 'Qty' },
    ]);
  });
});

describe('helpers', () => {
  const number: AttributeDefinition = { key: 'qty', label: 'Qty', type: 'NUMBER' };
  const text: AttributeDefinition = { key: 'name', label: 'Name', type: 'TEXT' };

  it('parses decimal commas and empties', () => {
    expect(coerceInput(number, '1,5')).toBe(1.5);
    expect(coerceInput(number, '')).toBeNull();
    expect(coerceInput(number, 'abc')).toBeNull();
    expect(coerceInput(text, '')).toBeNull();
    expect(coerceInput(text, 'Seat')).toBe('Seat');
  });

  it('derives camelCase keys from labels', () => {
    expect(toCamelCaseKey('Unit price')).toBe('unitPrice');
    expect(toCamelCaseKey('Contract term (months)')).toBe('contractTermMonths');
    expect(toCamelCaseKey('12 month discount')).toBe('monthDiscount');
  });
});

describe('toStoredItems', () => {
  it('strips the in-memory row id and keeps every value', () => {
    expect(toStoredItems([{ id: 'a', name: 'Seat', legacyField: 'kept' }])).toEqual([
      { name: 'Seat', legacyField: 'kept' },
    ]);
  });

  it('rejects id as an attribute key', () => {
    expect(isValidAttributeKey('id')).toBe(false);
    expect(parseAttributes([{ key: 'id', label: 'Id', type: 'TEXT' }])).toEqual([]);
  });
});
