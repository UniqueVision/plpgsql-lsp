/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    CompletionItem,
    createConnection,
    DefinitionParams,
    DidChangeConfigurationNotification,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
} from "vscode-languageserver/node"
import {
    TextDocument,
} from "vscode-languageserver-textdocument"

import { getCompletionItems } from "./postgres/completionItems"
import { validateTextDocument as _validateTextDocument } from "./postgres/validateTextDocument"
import { DEFAULT_SETTINGS, LanguageServerSettings } from "./settings"
import { Space } from "./space"
import { getDefinitionLinks, loadDefinitionInWorkspace, updateFileDefinition } from "./workspace/goToDefinition"

let globalSpace: Space

const connection = createConnection(ProposedFeatures.all)

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)


async function validateTextDocument(textDocument: TextDocument) {
    await _validateTextDocument(
        globalSpace,
        textDocument,
    )
}

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities

    globalSpace = new Space(connection, documents, capabilities)

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
            },
            // Tell the client that this server supports go to definition.
            definitionProvider: true,
        },
    }
    if (globalSpace.hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        }
    }

    return result
})

connection.onInitialized(async () => {
    if (globalSpace.hasConfigurationCapability) {
    // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined)
    }
    if (globalSpace.hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log("Workspace folder change event received.")
        })
    }
})

connection.onDidChangeConfiguration(change => {
    if (globalSpace.hasConfigurationCapability) {
    // Reset all cached document settings
        globalSpace.documentSettings.clear()
    } else {
        globalSpace.globalSettings = <LanguageServerSettings>(
            change.settings.plpgsqlLanguageServer || DEFAULT_SETTINGS
        )
    }

    // Revalidate all open text documents
    globalSpace.documents.all().forEach(validateTextDocument)
})

// Only keep settings for open documents
documents.onDidClose(e => {
    globalSpace.documentSettings.delete(e.document.uri)
})

documents.onDidOpen(async (params) => {
    connection.console.log("onDidOpen")
    if (globalSpace.definitionMap.isEmpty()) {
        await loadDefinitionInWorkspace(globalSpace, params.document.uri)
    }
})

documents.onDidChangeContent(async (change) => {
    connection.console.log("onDidChangeContent")
    await validateTextDocument(change.document)
})

documents.onDidSave(async (params) => {
    connection.console.log("onDidSave")
    await updateFileDefinition(globalSpace, params.document.uri)
})

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log("onDidChangeWatchedFiles")
})

// This handler provides the initial list of the completion items.
connection.onCompletion(
    async (textDocumentPosition) => {
        return getCompletionItems(globalSpace, textDocumentPosition.textDocument)
    },
)

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item
    },
)

connection.onDefinition((params: DefinitionParams) => {
    return getDefinitionLinks(globalSpace, params)
})

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()
