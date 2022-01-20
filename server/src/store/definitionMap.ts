import { DefinitionLink } from "vscode-languageserver"

import { Space } from "../space"


type FilePath = string;
type Definition = string;

export class DefinitionMap {
    candidates: Map<Definition, DefinitionLink[]>
    fileDefinitions: Map<FilePath, Definition[]>

    constructor() {
        this.candidates = new Map()
        this.fileDefinitions = new Map()
    }

    isEmpty() {
        return this.candidates.size === 0 && this.fileDefinitions.size === 0
    }

    getDefinitionLinks(definition: Definition): DefinitionLink[] | undefined {
        return this.candidates.get(definition)
    }

    updateCandidates(space: Space,
        filepath: FilePath, candidates: { definition: Definition, definitionLink: DefinitionLink }[] | undefined,
    ) {
        const oldDefinitions = this.fileDefinitions.get(filepath)

        // Remove old definition of a target uri.
        if (oldDefinitions !== undefined) {
            for (const candidate in oldDefinitions) {
                const oldDefinitions = this.candidates.get(candidate)
                if (oldDefinitions === undefined) continue

                this.candidates.set(candidate, oldDefinitions.filter(definition => {
                    definition.targetUri !== filepath
                }))
            }
            this.fileDefinitions.delete(filepath)
        }

        if (candidates === undefined) {
            return
        }

        // Update new definition of a target uri.
        for (const { definition, definitionLink } of candidates) {
            const definitionLinks = this.candidates.get(definition) || []
            definitionLinks.push(definitionLink)
            this.candidates.set(definition, definitionLinks)
        }
        this.fileDefinitions.set(filepath, candidates.map(candidate => {
            return candidate.definition
        }))
    }
}
