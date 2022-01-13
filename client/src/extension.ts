/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import {
  workspace as Workspace, window as Window, ExtensionContext, languages as Languages, TextDocument, TextEdit, OutputChannel, WorkspaceFolder, Uri
} from 'vscode';


import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let defaultClient: LanguageClient;
const clients: Map<string, LanguageClient> = new Map();

let sortedWorkspaceFolders: string[] | undefined;
function getSortedWorkspaceFolders(): string[] {
  if (sortedWorkspaceFolders === undefined) {
    sortedWorkspaceFolders = Workspace.workspaceFolders ? Workspace.workspaceFolders.map(folder => {
      let result = folder.uri.toString();
      if (result.charAt(result.length - 1) !== '/') {
        result = result + '/';
      }
      return result;
    }).sort(
      (a, b) => {
        return a.length - b.length;
      }
    ) : [];
  }
  return sortedWorkspaceFolders;
}

function createLanguageClient(serverOptions: ServerOptions, clientOptions: LanguageClientOptions) {
  return new LanguageClient('plpgsqlLanguageServer', 'PL/pgSQL Language Server', serverOptions, clientOptions);
}

Workspace.onDidChangeWorkspaceFolders(() => sortedWorkspaceFolders = undefined);

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const module = context.asAbsolutePath(
    path.join('server', 'out', 'server.js')
  );
  const outputChannel: OutputChannel = Window.createOutputChannel('plpgsqlLanguageServer');

  function didOpenTextDocument(document: TextDocument): void {
    // We are only interested in language mode text
    if (document.languageId !== 'postgres' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
      return;
    }

    const uri = document.uri;
    // Untitled files go to a default client.
    if (uri.scheme === 'untitled' && !defaultClient) {
      const debugOptions = { execArgv: ["--nolazy", "--inspect=6170"] };
      const serverOptions: ServerOptions = {
        run: { module, transport: TransportKind.ipc },
        debug: {
          module,
          transport: TransportKind.ipc,
          options: debugOptions
        }
      };
      const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'untitled', language: 'postgres' }],
        synchronize: {
          // Notify the server about file changes to '.clientrc files contained in the workspace
          fileEvents: Workspace.createFileSystemWatcher('**/.clientrc')
        },
        diagnosticCollectionName: 'plpgsqlLanguageServer',
        outputChannel
      };
      defaultClient = createLanguageClient(serverOptions, clientOptions);
      defaultClient.start();
      return;
    }
    const folder = Workspace.getWorkspaceFolder(uri);
    // Files outside a folder can't be handled. This might depend on the language.
    // Single file languages like JSON might handle files outside the workspace folders.
    if (!folder) {
      return;
    }

    if (!clients.has(folder.uri.toString())) {

      const debugOptions = { execArgv: ["--nolazy", `--inspect=${6171 + clients.size}`] };
      const serverOptions = {
        run: { module, transport: TransportKind.ipc },
        debug: { module, transport: TransportKind.ipc, options: debugOptions }
      };
      const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'postgres', pattern: `${folder.uri.fsPath}/**/*` }],
        synchronize: {
          // Notify the server about file changes to '.clientrc files contained in the workspace
          fileEvents: Workspace.createFileSystemWatcher('**/.clientrc')
        },
        diagnosticCollectionName: 'plpgsqlLanguageServer',
        workspaceFolder: folder,
        outputChannel
      };
      const client = createLanguageClient(serverOptions, clientOptions);
      client.start();
      clients.set(folder.uri.toString(), client);
    }
  }

  Workspace.onDidOpenTextDocument(didOpenTextDocument);
  Workspace.textDocuments.forEach(didOpenTextDocument);
  Workspace.onDidChangeWorkspaceFolders((event) => {
    for (const folder of event.removed) {
      const client = clients.get(folder.uri.toString());
      if (client) {
        clients.delete(folder.uri.toString());
        client.stop();
      }
    }
  });
}

export function deactivate(): Thenable<void> | undefined {
  const promises: Thenable<void>[] = [];
  if (defaultClient) {
    promises.push(defaultClient.stop());
  }
  for (const client of clients.values()) {
    promises.push(client.stop());
  }
  return Promise.all(promises).then(() => undefined);
}


Languages.registerDocumentFormattingEditProvider('postgres', {
  provideDocumentFormattingEdits(document: TextDocument): TextEdit[] {
    return [];
    // const firstLine = document.lineAt(0);
    // return [TextEdit.insert(firstLine.range.start, '-- Formatting...\n')];
  }
});
