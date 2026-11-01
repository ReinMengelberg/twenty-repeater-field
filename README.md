# Repeater Field

Turn a JSON field on any Twenty object into a repeater: a list of items whose attributes you define in settings.

## Screenshots

<p align="center">
  <img src="docs/screenshots/record-widget.png" alt="Repeater widget on a Quote record page, with Items and Variables lists that have Name, Description, Price and Amount columns" width="420">
  <br><em>Repeater widget on a record page</em>
</p>

<p align="center">
  <img src="docs/screenshots/settings.png" alt="Repeaters settings page, where you set a repeater's object, JSON field and attributes with their types and required flags" width="800">
  <br><em>Defining repeaters and their attributes in settings</em>
</p>

## Features

- Repeaters on any object, each bound to a RAW_JSON field (pick one or create it from settings)
- Attribute types: text, number, currency, percent, yes/no, select, date; required flags
- Record-page widget with add, reorder, delete, discard and save
- Data stays plain JSON on the record; removed attributes keep their values

## Getting started

Deployment and configuration: [DEPLOY.md](DEPLOY.md).

## Publishing

The `Publish` workflow (`.github/workflows/publish.yml`) publishes the app to npm with provenance using [npm trusted publishing](https://docs.npmjs.com/trusted-publishers). To publish:

1. On npmjs.com register this repository as a trusted publisher of your package, pointing at the `publish.yml` workflow.
2. Bump the version in `package.json`, then push a version tag (e.g. `git tag v1.0.0 && git push --tags`) or run the workflow manually from the Actions tab.

Publishing with provenance is also how you prove ownership when claiming your app in a Twenty marketplace.

## Changelog

Notable changes are documented in [CHANGELOG.md](CHANGELOG.md).

## Learn more

- [Twenty Apps documentation](https://docs.twenty.com/developers/extend/apps/getting-started/quick-start)
- [twenty-sdk CLI reference](https://www.npmjs.com/package/twenty-sdk)
- [Discord](https://discord.gg/cx5n4Jzs57)
