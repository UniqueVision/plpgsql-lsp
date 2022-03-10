import minimatch from "minimatch"
import path from "path"
import { Connection, URI, WorkspaceFolder } from "vscode-languageserver"

import {
  DEFAULT_SETTINGS, PLPGSQL_LANGUAGE_SERVER_SECTION, Settings,
} from "@/settings"

type DocumentSettings = {
  hasConfigurationCapability: true,
  documentSettingsMap: Map<URI, Thenable<Settings>>
}

type GlobalSettings = {
  hasConfigurationCapability: false,
  globalSettings: Settings
}

type UninitializedSettings = {
  hasConfigurationCapability: undefined
}

export class SettingsManager {

  constructor(
    private connection: Connection,
    private settings: DocumentSettings | GlobalSettings | UninitializedSettings,
  ) {

  }

  async get(resource: URI): Promise<Settings> {
    if (this.settings.hasConfigurationCapability) {
      let newSettings = this.settings.documentSettingsMap.get(resource)
      if (newSettings === undefined) {
        newSettings = this.connection.workspace.getConfiguration({
          scopeUri: resource,
          section: PLPGSQL_LANGUAGE_SERVER_SECTION,
        })
        this.settings.documentSettingsMap.set(
          resource, newSettings || DEFAULT_SETTINGS,
        )
      }

      return newSettings
    }
    else if (this.settings.hasConfigurationCapability !== undefined) {
      return this.settings.globalSettings
    }
    else {
      return DEFAULT_SETTINGS
    }
  }

  delete(resource: URI): void {
    if (this.settings.hasConfigurationCapability) {
      this.settings.documentSettingsMap.delete(resource)
    }
  }

  reset(settings?: Settings): void {
    if (this.settings.hasConfigurationCapability) {

      this.settings.documentSettingsMap.clear()
    }
    else if (this.settings.hasConfigurationCapability !== undefined) {

      this.settings.globalSettings = settings || DEFAULT_SETTINGS
    }
  }

  async getWorkspaceFolder(
    resource: URI,
  ): Promise<WorkspaceFolder | undefined> {
    const workspaces = await this.connection.workspace.getWorkspaceFolders()
    if (workspaces === null) {
      return undefined
    }
    const workspaceCandidates = workspaces.filter(
      workspace => resource.startsWith(workspace.uri),
    )

    if (workspaceCandidates.length === 0) {
      return undefined
    }

    return workspaceCandidates.sort(
      (a, b) => b.uri.length - a.uri.length,
    )[0]
  }

  async isDefinitionTarget(resource: URI): Promise<boolean> {
    const settings = await this.get(resource)
    if (settings.definitionFiles === undefined) {
      return false
    }

    const workspaceFolder = await this.getWorkspaceFolder(resource)
    if (workspaceFolder === undefined) {
      return false
    }

    return settings.definitionFiles.some(
      filePattern => {
        return minimatch(resource, path.join(workspaceFolder.uri, filePattern))
      },
    )
  }
}
