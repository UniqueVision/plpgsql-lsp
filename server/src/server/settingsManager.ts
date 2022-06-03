import minimatch from "minimatch"
import path from "path"
import { Connection, URI, WorkspaceFolder } from "vscode-languageserver"

import { DEFAULT_SETTINGS, Settings } from "@/settings"

type DocumentSettings = {
  documentSettingsMap: Map<URI, Thenable<Settings>>
}

type GlobalSettings = {
  globalSettings: Settings
}

export class SettingsManager {

  constructor(
    private connection: Connection,
    private settings: DocumentSettings | GlobalSettings,
  ) {
  }

  async get(uri: URI): Promise<Settings> {
    if (isDocumentSettings(this.settings)) {
      let newSettings = this.settings.documentSettingsMap.get(uri)
      if (newSettings === undefined) {
        newSettings = this.connection.workspace.getConfiguration({
          scopeUri: uri,
          section: "plpgsqlLanguageServer",
        })
        this.settings.documentSettingsMap.set(
          uri, newSettings || DEFAULT_SETTINGS,
        )
      }

      return newSettings
    }
    else {
      return this.settings.globalSettings
    }
  }

  delete(uri: URI): void {
    if (isDocumentSettings(this.settings)) {
      this.settings.documentSettingsMap.delete(uri)
    }
  }

  reset(settings?: Settings): void {
    if (isDocumentSettings(this.settings)) {
      this.settings.documentSettingsMap.clear()
    }
    else {
      this.settings.globalSettings = settings || DEFAULT_SETTINGS
    }
  }

  async getWorkspaceFolder(
    uri: URI,
  ): Promise<WorkspaceFolder | undefined> {
    const workspaces = await this.connection.workspace.getWorkspaceFolders()
    if (workspaces === null) {
      return undefined
    }

    const workspaceCandidates = workspaces.filter(
      workspace => uri.startsWith(workspace.uri),
    )

    if (workspaceCandidates.length === 0) {
      return undefined
    }

    return workspaceCandidates.sort(
      (a, b) => b.uri.length - a.uri.length,
    )[0]
  }

  async isDefinitionTarget(uri: URI): Promise<boolean> {
    const settings = await this.get(uri)
    if (settings.definitionFiles === undefined) {
      return false
    }

    const workspaceFolder = await this.getWorkspaceFolder(uri)
    if (workspaceFolder === undefined) {
      return false
    }

    return settings.definitionFiles.some(
      filePattern => {
        return minimatch(uri, path.join(workspaceFolder.uri, filePattern))
      },
    )
  }
}

function isDocumentSettings(
  settings: DocumentSettings | GlobalSettings,
): settings is DocumentSettings {
  return "documentSettingsMap" in settings
}
