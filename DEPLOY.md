# Repeater Field: deploy to crm.abyos.com

Turns a RAW_JSON field on any object into a repeater (a list of items) whose attributes you
define in settings.

Requires Node 24.5+, Yarn 4 (`corepack enable`) and the Twenty server on **2.51.0 or later**
(`engines.twenty` in package.json; an older server rejects the upload with
`SERVER_VERSION_INCOMPATIBLE`).

## 1. Deploy

```bash
npm install -g twenty@2.51.3
cd repeater-field
yarn install
twenty auth login --url https://crm.abyos.com --name abyos
twenty app plan --remote abyos              # preview: 2 front components, 1 settings item, 1 variable, role
twenty app publish --private --remote abyos
twenty app install --remote abyos
```

Nothing is instance-specific: no object IDs to fill in.

Updates: bump `version` in package.json, then `publish --private` again.
For iterating against the live workspace: `twenty app apply --create --remote abyos` once,
then `twenty app dev --remote abyos`.

## 2. Add a repeater (e.g. quote line items)

1. **Settings > Apps > Repeater Field > Repeaters > Add repeater.**
2. Pick the object (Quote), then pick an existing JSON field or choose **New field…**, type a
   label (e.g. "Line items") and click **Create field**. This creates a RAW_JSON field on the
   object right away.
3. Add attributes: label, key (auto-derived), type, options (Select only), required. Save. Currency attributes use EUR.
4. Open a record of that object, edit the page layout, add a widget and pick
   **Repeater field**. The widget shows every repeater configured for that object.
5. Hide the raw JSON column in the object's table views.

Repeat for any other object. One widget per record page is enough; with several repeaters on
the same object it shows each one under its own heading.

## Data shapes

The record field (RAW_JSON), e.g. `quote.lineItems`:

```json
[
  { "name": "Seat licence", "quantity": 10, "unitPrice": 49, "term": "Yearly" }
]
```

- Items have no id; values are keyed by attribute key (`id` is reserved and cannot be a key). Numbers are stored as numbers, percent as the entered
  number (15 = 15%), dates as `YYYY-MM-DD`, booleans as `true`/`false`.
- Removing an attribute hides it but keeps its values in the JSON; keys of saved attributes
  are locked in settings for that reason.
- Removing a repeater keeps the field and its data; only the binding goes.

The `REPEATER_DEFINITIONS` app variable:

```json
{ "version": 1, "repeaters": [
  { "id": "…", "label": "Line items", "objectNameSingular": "quote", "fieldName": "lineItems",
    "attributes": [
      { "key": "name", "label": "Product", "type": "TEXT", "required": true },
      { "key": "term", "label": "Term", "type": "SELECT", "options": ["Monthly", "Yearly"] },
      { "key": "unitPrice", "label": "Unit price", "type": "CURRENCY", "currencyCode": "EUR" }
    ] }
] }
```

Attribute types: TEXT, NUMBER, CURRENCY, PERCENT, BOOLEAN, SELECT, DATE.

## Permissions

The app role grants read/update on records plus two settings flags:

- `APPLICATIONS`: read and write the repeater definitions.
- `DATA_MODEL`: create the JSON field from the settings page.

Front components act as the viewing member intersected with that role, so configuring
repeaters needs a member with both permissions (an admin). Editing items on a record only
needs update access to that object.
