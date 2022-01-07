/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver/node';

import {
  TextDocument
} from 'vscode-languageserver-textdocument';

import { LanguageServerSettings, DEFAULT_SETTINGS } from './settings';
import { PostgresPool, makePool } from './postgres/client';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let globalPgPool: PostgresPool | null = null;

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
let globalSettings: LanguageServerSettings = DEFAULT_SETTINGS;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<LanguageServerSettings>> = new Map();

// 本来は resource を引数とすべきかもしれないが、簡単化のため省略
function getPostgresPool(setting: LanguageServerSettings) {
  if (globalPgPool === null) {
    globalPgPool = makePool(setting);
  }
  return globalPgPool;
}

function getDocumentSettings(resource: string): Thenable<LanguageServerSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'plpgsqlLanguageServer'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);

  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];
  const pgPool = getPostgresPool(settings);
  const pgClient = await pgPool.connect();

  try {
    await pgClient.query('BEGIN');
    await pgClient.query(text);
  }
  catch (error: unknown) {
    const diagnosic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: textDocument.positionAt(0),
        end: textDocument.positionAt(text.length - 1)
      },
      message: `${error}`,
    };
    if (hasDiagnosticRelatedInformationCapability) {
      diagnosic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnosic.range)
          },
          message: 'Syntax errors'
        }
      ];
    }
    diagnostics.push(diagnosic);
  }
  finally {
    await pgClient.query('ROLLBACK');
    pgClient.release();
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

async function getStoredProcedureCompletionItems(textDocumentUri: string) {
  const settings = await getDocumentSettings(textDocumentUri);
  const pgClient = await getPostgresPool(settings).connect();

  let procedures: CompletionItem[] = [];
  try {
    // https://dataedo.com/kb/query/postgresql/list-stored-procedures
    const results = await pgClient.query(`
      SELECT
        t_pg_proc.proname
        ,CASE
          WHEN t_pg_language.lanname = 'internal' THEN
            t_pg_proc.prosrc
          ELSE
            pg_get_functiondef(t_pg_proc.oid)
        END AS definition
      FROM
        pg_proc AS t_pg_proc
      LEFT JOIN pg_language AS t_pg_language ON (
        t_pg_proc.prolang = t_pg_language.oid
      )
    `);

    const formattedResults = results.rows.map((row, index) => {
      const proname = `${row["proname"]}`;
      const definition = `${row["definition"]}`;

      // definitionから引数リストをとります
      const func_params = definition.match(/\(.*\)/g);
      const func_param = func_params ? func_params[0] : '';
      const func_param_items = func_param.match(/\(\w*\s|,\s\w*\s/g) || [];

      // 引数リストからクエリーを生成します
      let params_customize = '(';
      func_param_items.forEach((item, index) => {
        params_customize += '\n\t';
        const param_name = item.replace('(', '').replace(/\s/g, '').replace(',', '');
        params_customize += `${index == 0 ? '' : ','}${param_name} := ${param_name}`;
      });
      params_customize += `${func_param_items.length > 0 ? '\n' : ''})`;

      // CompletionItem返します
      return {
        label: proname,
        kind: CompletionItemKind.Function,
        data: index,
        detail: definition,
        document: proname,
        insertText: proname + params_customize
      };
    });
    procedures = procedures.concat(formattedResults);
  }
  catch (error: unknown) {
    connection.console.log(`${error}`);
  }
  finally {
    pgClient.release();
  }
  return procedures;
}

async function getTableCompletionItems(textDocumentUri: string) {
  const settings = await getDocumentSettings(textDocumentUri);
  const pgClient = await getPostgresPool(settings).connect();

  let procedures: CompletionItem[] = [];
  try {
    const results = await pgClient.query(`
      SELECT
        relnamespace::regnamespace::TEXT || '.' || relname AS table_name
      FROM
        pg_class
      WHERE
        relkind = 'p'
      UNION
      SELECT
        relnamespace::regnamespace::TEXT || '.' || relname AS table_name
      FROM
        pg_class
      WHERE
        relkind = 'r' AND NOT relispartition
      ORDER BY
        table_name
    `);
    const formattedResults = results.rows.map((row, index) => {
      const table_name = `${row["table_name"]}`;
      return {
        label: table_name,
        kind: CompletionItemKind.Struct,
        data: index,
        detail: table_name,
        document: table_name
      };
    });
    procedures = procedures.concat(formattedResults);
  }
  catch (error: unknown) {
    connection.console.log(`${error}`);
  }
  finally {
    pgClient.release();
  }
  return procedures;
}

async function getCompletionItems(textDocumentUri: string) {
  const procedures = await getStoredProcedureCompletionItems(textDocumentUri);
  const tables = await getTableCompletionItems(textDocumentUri);

  return procedures.concat(tables).map((item, index) => {
    item.data = index;
    return item;
  });
}

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true
      }
    }
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <LanguageServerSettings>(
      (change.settings.plpgsqlLanguageServer || DEFAULT_SETTINGS)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  textDocumentPosition => {
    return getCompletionItems(textDocumentPosition.textDocument.uri);
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    return item;
  }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
