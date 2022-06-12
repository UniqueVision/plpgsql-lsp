# 開発者案内

## 開発方法

ここは開発とリリース手順について情報を集める。

1. VSCode で推薦拡張をインストールする（`extensions.json`の内容）。
1. `npm`をインストール。
1. `npm install`
1. VSCode の中から`F5`。

コードが変わると`> Reload Window`が必要になる。その前はコードの変更は反映されない。

### サンプルを用いた動作確認

1. データベースを準備する。

```sh
cd $THIS_REPOSITORY_ROOT

# Prepare database.
docker-compose up -d
./sample/prepare.sh
```

2. サンプルのワークスペース (`$THIS_REPOSITORY_ROOT/sample/sample.code-workspace`) を [Extension Development Host] ウィンドウで開く。

### 自動テスト

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

## リリース手順

> :warning: [libpg-query](https://github.com/pyramation/libpg-query-node) が [native node module](https://github.com/microsoft/vscode/issues/658) であるために、Linux と Mac は別々にインストールしなければならない。Windows は現状 libpg-query をビルドできていないため、一旦リリース候補から外す。パーサの剪定をしなければならない。

> :warning: 現状解決策を見つけておらず、Mac 用のパッケージのアップロードは、Mac でしなければいけない。

1. `package.json`のバージョン番号を上げる。
2. `npm install` でモジュールを更新する。
3. `npm run package`で`vscode-plpgsql-lsp-#.#.#.vsix`を生成する（Mac の場合は `npm run package:mac` ）。
4. [VSCode Marketplace](https://marketplace.visualstudio.com/manage/publishers/uniquevision)にログインする。
5. `PL/pgSQL Language Server`の`More Actions`の下、`Update`を選択して`.vsix`ファイルを入れる。
