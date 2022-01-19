/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentSyncKind,
  InitializeResult,
} from 'vscode-languageserver/node';
import {
  TextDocument
} from 'vscode-languageserver-textdocument';

import { LanguageServerSettings, DEFAULT_SETTINGS } from './settings';
import { getCompletionItems } from './postgres/completionItems';
import { validateTextDocument as _validateTextDocument } from './postgres/validateTextDocument';
import { Space } from './space';

let globalSpace: Space;

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);


async function validateTextDocument(textDocument: TextDocument) {
  await _validateTextDocument(
    globalSpace,
    textDocument,
  );
}

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  globalSpace = new Space(connection, documents, capabilities);

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true
      }
    }
  };
  if (globalSpace.hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (globalSpace.hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (globalSpace.hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

connection.onDidChangeConfiguration(change => {
  if (globalSpace.hasConfigurationCapability) {
    // Reset all cached document settings
    globalSpace.documentSettings.clear();
  } else {
    globalSpace.globalSettings = <LanguageServerSettings>(
      (change.settings.plpgsqlLanguageServer || DEFAULT_SETTINGS)
    );
  }

  // Revalidate all open text documents
  globalSpace.documents.all().forEach(validateTextDocument);
});

// Only keep settings for open documents
documents.onDidClose(e => {
  globalSpace.documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(async (change) => {
  await validateTextDocument(change.document);
});

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  async (textDocumentPosition) => {
    return getCompletionItems(globalSpace, textDocumentPosition.textDocument);
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
