import { DefinitionLink } from "vscode-languageserver"

export type FilePath = string;
export type Definition = string;
export type DefinitionCandidate = {
  definition: string,
  definitionLink: DefinitionLink
};

export class DefinitionMap {
  candidates: Map<Definition, DefinitionLink[]>
  fileDefinitions: Map<FilePath, Definition[]>

  constructor() {
    this.candidates = new Map()
    this.fileDefinitions = new Map()
  }

  isEmpty(): boolean {
    return this.candidates.size === 0 && this.fileDefinitions.size === 0
  }

  getDefinitionLinks(definition: Definition): DefinitionLink[] | undefined {
    return this.candidates.get(definition)
  }

  updateCandidates(
    filepath: FilePath, candidates: DefinitionCandidate[] | undefined,
  ): void {
    const oldDefinitions = this.fileDefinitions.get(filepath)

    // Remove old definition of a target uri.
    if (oldDefinitions !== undefined) {
      for (const candidate of oldDefinitions) {
        const oldDefinitionLinks = this.candidates.get(candidate)
        if (oldDefinitionLinks === undefined) continue

        this.candidates.set(
          candidate,
          oldDefinitionLinks.filter((definition) => definition.targetUri !== filepath),
        )
      }
      this.fileDefinitions.delete(filepath)
    }

    if (candidates === undefined || candidates.length === 0) {
      return
    }

    // Update new definition of a target uri.
    for (const { definition, definitionLink } of candidates) {
      const definitionLinks = this.candidates.get(definition) || []
      definitionLinks.push(definitionLink)
      this.candidates.set(definition, definitionLinks)
    }

    this.fileDefinitions.set(
      filepath,
      candidates.map((candidate) => candidate.definition),
    )
  }
}
