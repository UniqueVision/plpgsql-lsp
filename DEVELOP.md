# Developer Guide

Below is a series of steps for developing and releasing the extension.

## Development

1. Install the recommended VSCode extensions (inside `extensions.json`).
2. Install `npm` itself.
3. Run `npm`.
4. Run `npm watch`.
5. In VSCode, hit `F5`.

When code is changed, you'll need to refresh with `> Reload Window`. Until then, any code changes are not reflected in the development window.

## Release

> :warning: Since [libpg-query](https://github.com/pyramation/libpg-query-node) is a [native node module](https://github.com/microsoft/vscode/issues/658), separate Windows/Linux and MacOS installations are required.

> :warning: The current strategy is to use a Mac when compiling a build for MacOS.

1. Update the version number in `package.json`.
2. Install with `npm install`.
3. Execute `npm run package` to produce `vscode-plpgsql-lsp-#.#.#.vsix`. (For MacOS, `npm run package:mac`.)
4. Log into [VSCode Marketplace](https://marketplace.visualstudio.com/manage/publishers/uniquevision) (Unique Vision users only at this time).
5. Under `PL/pgSQL Language Server`, select `More Actions`, then `Update` and upload the `.vsix` file.

# 開発者案内

ここは開発とリリース手順について情報を集める。

## 開発手順

1. VSCodeで推薦拡張をインストールする。（`extensions.json`の内容）
1. `npm`をインストール。
1. `npm install`
1. `npm watch`
1. VSCodeの中から`F5`。

コードが変わると`> Reload Window`が必要になる。その前はコードの変更は反映されない。

## リリース手順

> :warning: [libpg-query](https://github.com/pyramation/libpg-query-node) が [native node module](https://github.com/microsoft/vscode/issues/658) であるために、Windows/Linux と Mac は別々にインストールしなければならない。

> :warning: 現状解決策を見つけておらず、Mac 用のパッケージのアップロードは、Mac でしなければいけない。

1. `package.json`のバージョン番号を上げる。
1. `npm install` でモジュールを更新する。
1. `npm run package`で`vscode-plpgsql-lsp-#.#.#.vsix`を生成する（Macの場合は `npm run package:mac` ）。
1. [VSCode Marketplace](https://marketplace.visualstudio.com/manage/publishers/uniquevision)にログインする。
1. `PL/pgSQL Language Server`の`More Actions`の下、`Update`を選択して`.vsix`ファイルを入れる。
