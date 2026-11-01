import { useState } from 'react';
import { Dropdown } from 'twenty-ui/components/navigation';
import { Button } from 'twenty-ui/primitives/input';
import { IconChevronDown } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';

export type PickerOption = { value: string; label: string };

type PickerFieldProps = {
  value: string | null;
  options: PickerOption[];
  onChange: (value: string) => void;
  'aria-label': string;
  placeholder?: string;
  disabled?: boolean;
  // 'plain' matches inline record fields: no border until hovered.
  variant?: 'default' | 'plain';
};

// Lists longer than this get a search box.
const SEARCH_THRESHOLD = 8;

// Single-value picker on Twenty UI Dropdown. Used instead of Select, whose body portal
// is clipped by the front component sandbox.
export const PickerField = ({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  placeholder = 'Select…',
  disabled,
  variant = 'default',
}: PickerFieldProps) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((option) => option.value === value);
  const query = search.trim().toLowerCase();
  const visible =
    query === '' ? options : options.filter((option) => option.label.toLowerCase().includes(query));

  return (
    <Dropdown.Root
      type="picker"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <Dropdown.Trigger
        disabled={disabled}
        render={
          <Button
            variant={variant === 'plain' ? 'ghost' : 'outline'}
            size="sm"
            fullWidth
            aria-label={ariaLabel}
            endIcon={<IconChevronDown size={theme.icon.size.sm} />}
            style={{ justifyContent: 'space-between', minWidth: 0 }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: selected ? undefined : theme.font.color.tertiary,
              }}
            >
              {selected?.label ?? placeholder}
            </span>
          </Button>
        }
      />
      <Dropdown.Content aria-label={ariaLabel} width={240}>
        {options.length > SEARCH_THRESHOLD && (
          <Dropdown.Search aria-label={`Search ${ariaLabel}`} value={search} onValueChange={setSearch} />
        )}
        <Dropdown.Section scrollable style={{ maxHeight: 200 }}>
          {visible.length === 0 ? (
            <Dropdown.Empty>No matches</Dropdown.Empty>
          ) : (
            <Dropdown.SelectionGroup
              aria-label={ariaLabel}
              value={value}
              onValueChange={(next) => {
                if (next !== null) onChange(next);
                setOpen(false);
              }}
            >
              {visible.map((option) => (
                <Dropdown.OptionItem key={option.value} value={option.value}>
                  {option.label}
                </Dropdown.OptionItem>
              ))}
            </Dropdown.SelectionGroup>
          )}
        </Dropdown.Section>
      </Dropdown.Content>
    </Dropdown.Root>
  );
};
