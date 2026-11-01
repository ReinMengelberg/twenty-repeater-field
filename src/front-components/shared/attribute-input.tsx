import { useEffect, useState } from 'react';
import { Checkbox, Input } from 'twenty-ui/primitives/input';

import { PickerField } from 'src/front-components/shared/picker-field';
import {
  coerceInput,
  formatForInput,
  type AttributeDefinition,
  type RepeaterValue,
} from 'src/shared/repeater-config';

// Picker value for "no selection"; real options are non-empty strings.
const EMPTY_OPTION = '';

type AttributeInputProps = {
  attribute: AttributeDefinition;
  value: RepeaterValue | undefined;
  onChange: (value: RepeaterValue) => void;
  disabled?: boolean;
};

// One cell editor per attribute type. Values are stored raw (numbers as numbers,
// percent as the entered number, e.g. 15 for 15%, dates as YYYY-MM-DD).
export const AttributeInput = ({ attribute, value, onChange, disabled }: AttributeInputProps) => {
  const ariaLabel = attribute.label;

  if (attribute.type === 'BOOLEAN') {
    return (
      <Checkbox
        aria-label={ariaLabel}
        checked={value === true}
        disabled={disabled}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    );
  }

  if (attribute.type === 'SELECT') {
    const options = attribute.options ?? [];
    const current = typeof value === 'string' && options.includes(value) ? value : null;

    return (
      <PickerField
        aria-label={ariaLabel}
        variant="plain"
        placeholder={attribute.label}
        value={current}
        options={[
          { value: EMPTY_OPTION, label: 'None' },
          ...options.map((option) => ({ value: option, label: option })),
        ]}
        disabled={disabled}
        onChange={(next) => onChange(next === EMPTY_OPTION ? null : next)}
      />
    );
  }

  const isNumeric =
    attribute.type === 'NUMBER' || attribute.type === 'CURRENCY' || attribute.type === 'PERCENT';

  if (isNumeric) {
    return (
      <NumericInput attribute={attribute} value={value} onChange={onChange} disabled={disabled} />
    );
  }

  return (
    <Input
      size="sm"
      variant="plain"
      aria-label={ariaLabel}
      placeholder={attribute.label}
      disabled={disabled}
      type={attribute.type === 'DATE' ? 'date' : 'text'}
      value={formatForInput(value)}
      onChange={(event) => onChange(coerceInput(attribute, event.target.value))}
    />
  );
};

// Keeps the typed text locally so intermediate input like "1," or "0.0" survives,
// while the parent always receives the parsed number (or null).
const NumericInput = ({ attribute, value, onChange, disabled }: AttributeInputProps) => {
  const [text, setText] = useState(() => formatForInput(value));

  useEffect(() => {
    // Sync when the value changes from outside (discard, reload), not while typing.
    if (coerceInput(attribute, text) !== (value ?? null)) {
      setText(formatForInput(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      size="sm"
      variant="plain"
      aria-label={attribute.label}
      disabled={disabled}
      inputMode="decimal"
      placeholder={
        attribute.type === 'CURRENCY'
          ? attribute.currencyCode
          : attribute.type === 'PERCENT'
            ? '%'
            : attribute.label
      }
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(coerceInput(attribute, event.target.value));
      }}
      style={{ textAlign: 'right' }}
    />
  );
};
