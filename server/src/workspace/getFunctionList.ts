import { readFileSync } from "fs"
import { parseQuery } from "libpg-query"

import { Statement } from "../postgres/statement"
import { Resource, Space } from "../space"


export async function getFunctionList(space: Space, resource: Resource) {
    const fileText = readFileSync(resource.replace(/^file:\/\//, "")).toString()
    const query = await parseQuery(fileText)

    const stmts: Statement[] | undefined = query?.["stmts"]
    if (stmts === undefined) {
        return []
    }

    return stmts.flatMap(stmt => {
        if (stmt?.stmt?.CreateFunctionStmt !== undefined) {
            return getCreateFunctionList(fileText, stmt)
        }
        else {
            return []
        }
    })
}

function getCreateFunctionList(
    fileText: string, stmt: Statement,
) {
    const createFunctionStmt = stmt?.stmt?.CreateFunctionStmt

    if (createFunctionStmt === undefined) {
        return []
    }

    return createFunctionStmt.funcname.flatMap(funcname => {
        const functionName = funcname.String.str
        if (functionName === undefined) {
            return []
        }
        const locationCandidates = createFunctionStmt.options
            .filter(option => {
                return option.DefElem.defname === "as"
            })
            .map(option => {
                return option.DefElem.location
            })

        return [{
            functionName,
            location: locationCandidates?.[0] || undefined,
        }]
    })
}
