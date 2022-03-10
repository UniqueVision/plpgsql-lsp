import { WorkspaceFolder, WorkspaceFoldersChangeEvent } from "vscode-languageserver"

export const workspaceFoldersChanged = (
  workspaceFolders: WorkspaceFolder[],
  changedFolders: WorkspaceFoldersChangeEvent,
): WorkspaceFolder[] => {
  workspaceFolders = workspaceFolders
    .filter((workspaceFolder) => {
      return !changedFolders.removed.some((changedFolder) => {
        return changedFolder.uri === workspaceFolder.uri
      })
    })

  workspaceFolders = workspaceFolders
    .filter((workspaceFolder) => {
      return !changedFolders.added.some((changedFolder) => {
        return changedFolder.uri === workspaceFolder.uri
      })
    })
    .concat(changedFolders.added)

  return workspaceFolders
}
