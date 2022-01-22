import minimatch from "minimatch"
import path from "path"
import { ClientCapabilities, Connection, TextDocuments } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

import { PLPGSQL_LANGUAGE_SERVER_SECTION } from "./helpers"
import { makePool, PostgresPool } from "./postgres/client"
import { DEFAULT_SETTINGS, LanguageServerSettings } from "./settings"
import { DefinitionMap } from "./store/definitionMap"


export type Resource = string;

/**
 * Global Space of Language Server.
 *
 * The collection class of global variables.
 */
export class Space {
    hasConfigurationCapability: boolean
    hasWorkspaceFolderCapability: boolean
    hasDiagnosticRelatedInformationCapability: boolean

    globalSettings: LanguageServerSettings
    // Cache the settings of all open documents
    documentSettings: Map<Resource, Thenable<LanguageServerSettings>>

    // Create a simple text document manager.
    documents: TextDocuments<TextDocument>

    // Create a connection for the server, using Node's IPC as a transport.
    // Also include all preview / proposed LSP features.
    connection: Connection

    pgPool?: PostgresPool

    definitionMap: DefinitionMap

    constructor(connection: Connection, documents: TextDocuments<TextDocument>, capabilities: ClientCapabilities) {
        this.globalSettings = DEFAULT_SETTINGS
        this.documentSettings = new Map()

        this.connection = connection
        this.documents = documents

        this.definitionMap = new DefinitionMap()

        // Does the client support the `workspace/configuration` request?
        // If not, we fall back using global settings.
        this.hasConfigurationCapability = !!(
            capabilities.workspace && !!capabilities.workspace.configuration
        )
        this.hasWorkspaceFolderCapability = !!(
            capabilities.workspace && !!capabilities.workspace.workspaceFolders
        )
        this.hasDiagnosticRelatedInformationCapability = !!(
            capabilities.textDocument &&
            capabilities.textDocument.publishDiagnostics &&
            capabilities.textDocument.publishDiagnostics.relatedInformation
        )
    }

    async getPgClient(setting: LanguageServerSettings) {
        if (this.pgPool === undefined) {
            this.pgPool = makePool(setting)
        }

        if (this.pgPool === undefined) {
            return
        }

        return await this.pgPool.connect()
    }

    getDocumentSettings(resource: Resource): Thenable<LanguageServerSettings> {
        if (!this.hasConfigurationCapability) {
            return Promise.resolve(this.globalSettings)
        }
        let result = this.documentSettings.get(resource)
        if (!result) {
            result = this.connection.workspace.getConfiguration({
                scopeUri: resource,
                section: PLPGSQL_LANGUAGE_SERVER_SECTION,
            })
            this.documentSettings.set(resource, result)
        }

        return result
    }

    async getWorkSpaceFolder(resource: Resource) {
        const workspaces = await this.connection.workspace.getWorkspaceFolders()
        if (workspaces === null) {
            return undefined
        }
        const workspaceCandidates = workspaces.filter(workspace => {
            return resource.startsWith(workspace.uri)
        })

        if (workspaceCandidates.length === 0) {
            return undefined
        }

        return workspaceCandidates.sort((a, b) => b.uri.length - a.uri.length)[0]
    }

    async isDefinitionMapTarget(resource: Resource) {
        const settings = await this.getDocumentSettings(resource)
        const workSpaceUri = (await this.getWorkSpaceFolder(resource))?.uri || ""

        if (settings.definitionFiles === undefined) {
            return false
        }

        return settings.definitionFiles.some(
            filePattern => {
                return minimatch(resource, path.join(workSpaceUri, filePattern))
            },
        )
    }
}
