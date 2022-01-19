import { ClientCapabilities, Connection, TextDocuments } from 'vscode-languageserver';
import { DEFAULT_SETTINGS, LanguageServerSettings } from './settings';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PLPGSQL_LANGUAGE_SERVER_SECTION } from './helpers';
import { PostgresPool, makePool } from './postgres/client';

/**
 * Global Space of Language Server.
 *
 * The collection class of global variables.
 */
export class Space {
  hasConfigurationCapability: boolean;
  hasWorkspaceFolderCapability: boolean;
  hasDiagnosticRelatedInformationCapability: boolean;

  globalSettings: LanguageServerSettings;
  // Cache the settings of all open documents
  documentSettings: Map<string, Thenable<LanguageServerSettings>>;

  // Create a simple text document manager.
  documents: TextDocuments<TextDocument>;

  // Create a connection for the server, using Node's IPC as a transport.
  // Also include all preview / proposed LSP features.
  connection: Connection;

  pgPool?: PostgresPool;


  constructor(connection: Connection, documents: TextDocuments<TextDocument>, capabilities: ClientCapabilities) {
    this.globalSettings = DEFAULT_SETTINGS;
    this.documentSettings = new Map();

    this.connection = connection;
    this.documents = documents;


    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    this.hasConfigurationCapability = !!(
      capabilities.workspace && !!capabilities.workspace.configuration
    );
    this.hasWorkspaceFolderCapability = !!(
      capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    this.hasDiagnosticRelatedInformationCapability = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    );
  }

  get console() {
    return this.connection.console;
  }

  getPgPool(setting: LanguageServerSettings) {
    if (this.pgPool === undefined) {
      this.pgPool = makePool(setting);
    }
    return this.pgPool;
  }

  getDocumentSettings(resource: string): Thenable<LanguageServerSettings> {
    if (!this.hasConfigurationCapability) {
      return Promise.resolve(this.globalSettings);
    }
    let result = this.documentSettings.get(resource);
    if (!result) {
      result = this.connection.workspace.getConfiguration({
        scopeUri: resource,
        section: PLPGSQL_LANGUAGE_SERVER_SECTION
      });
      this.documentSettings.set(resource, result);
    }
    return result;
  }
}
