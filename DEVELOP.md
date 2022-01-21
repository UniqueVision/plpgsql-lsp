# 開発者案内

ここは開発とリリース手順について情報を集める。

## 開発手順

1. VSCodeで推薦拡張をインストールする。（`extensions.json`の内容）
1. `npm`をインストール。
1. `npm`
1. `npm watch`
1. vscodeの中から`F5`。

コードが変わると`> Reload Window`が必要になる。その前はコードの変更は反映されない。

## リリース手順

1. `package.json`のバージョン番号を上げる。
1. `npm install` でモジュールを更新する。
1. `npm run package`で`vscode-plpgsql-lsp-#.#.#.vsix`を生成する。
1. [VSCode Marketplace](https://marketplace.visualstudio.com/manage/publishers/uniquevision)にログインする。
1. `PL/pgSQL Language Server`の`More Actions`の下、`Update`を選択して`.vsix`ファイルを入れる。
