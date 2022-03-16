# Developer Guide

Below is a series of steps for developing and releasing the extension.

## Development

1. Install the recommended VSCode extensions (inside `extensions.json`).
1. Install `npm` itself.
1. Run `npm`.
1. In VSCode, hit `F5`.

When code is changed, you'll need to refresh with `> Reload Window`. Until then, any code changes are not reflected in the development window.

### Try sample

1. Prepare database.

```sh
cd $THIS_REPOSITORY_ROOT

# Prepare database.
docker-compose up -d
./sample/prepare.sh
```

2. Open the sample workspace (`$THIS_REPOSITORY_ROOT/sample/sample.code-workspace`) on [Extension Development Host] window.

### Test

```sh
cd $THIS_REPOSITORY_ROOT

# Prepare database.
docker-compose up -d
./sample/prepare.sh

# Install packages.
npm install

# Run test.
npm run test
```

## Release

> :warning: Since [libpg-query](https://github.com/pyramation/libpg-query-node) is a [native node module](https://github.com/microsoft/vscode/issues/658), separate Windows/Linux and MacOS installations are required.

> :warning: The current strategy is to use a Mac when compiling a build for MacOS.

1. Update the version number in `package.json`.
1. Install with `npm install`.
1. Execute `npm run package` to produce `vscode-plpgsql-lsp-#.#.#.vsix`. (For MacOS, `npm run package:mac`.)
1. Log into [VSCode Marketplace](https://marketplace.visualstudio.com/manage/publishers/uniquevision) (Unique Vision users only at this time).
1. Under `PL/pgSQL Language Server`, select `More Actions`, then `Update` and upload the `.vsix` file.
