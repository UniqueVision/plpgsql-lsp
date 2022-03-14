import { DefinitionLink, URI } from "vscode-languageserver"

export type Definition = string;
export type DefinitionCandidate = {
  definition: Definition,
  definitionLink: DefinitionLink
};

export class DefinitionsManager {
  candidates: Map<Definition, DefinitionLink[]>
  fileDefinitions: Map<URI, Definition[]>

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
    uri: URI, candidates: DefinitionCandidate[] | undefined,
  ): void {
    const oldDefinitions = this.fileDefinitions.get(uri)

    // Remove old definition of a target uri.
    if (oldDefinitions !== undefined) {
      for (const candidate of oldDefinitions) {
        const oldDefinitionLinks = this.candidates.get(candidate)
        if (oldDefinitionLinks === undefined) {
          continue
        }

        this.candidates.set(
          candidate,
          oldDefinitionLinks.filter(
            (definition) => definition.targetUri !== uri,
          ),
        )
      }
      this.fileDefinitions.delete(uri)
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
      uri,
      candidates.map((candidate) => candidate.definition),
    )
  }
}
