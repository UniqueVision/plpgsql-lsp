import { DefinitionLink, DefinitionParams, LocationLink, Position, Range } from 'vscode-languageserver';
import { getWordRangeAtPosition, PLPGSQL_LANGUAGE_SERVER_SECTION } from '../helpers';
import { LanguageServerSettings } from '../settings';
import { Resource, Space } from '../space';
import { parseQuery } from 'libpg-query';
import { readFileSync } from 'fs';
import { sync as glob } from "glob";
type Candidate = { definition: string, definitionLink: DefinitionLink };

export async function loadDefinitionInWorkspace(space: Space, resource: Resource) {
  const settings: LanguageServerSettings = await space.getDocumentSettings(resource);
  const workspace = await space.getWorkSpaceFolder(resource);
  if (workspace === undefined) {
    return;
  }

  if (settings.definitionFiles) {
    for (const filePattern of settings.definitionFiles) {
      const files = glob(filePattern);
      try {
        await Promise.all(files.map(async (file) => {
          resource = `${workspace.uri}/${file}`;
          space.console.log(`resource: ${resource}`);
          await updateFileDefinition(space, resource);
        }));
      }
      catch (error: unknown) {
        space.console.error(`${error}`);
        continue;
      }
    }
  }
}

export async function updateFileDefinition(space: Space, resource: Resource) {
  const query = await parseQuery(readFileSync(resource.replace(/^file:\/\//, "")).toString());

  const stmts = query?.["stmts"];
  if (stmts === undefined) {
    return;
  }
  const createStmts: Candidate[] = getCreateStmts(stmts, resource)
    .concat(getCompositeTypeStmts(stmts, resource))
    .concat(getCreateFunctionStmts(stmts, resource));

  space.console.log(`createStmts: ${JSON.stringify(createStmts)}`);
  space.definitionMap.updateCandidates(space, resource, createStmts);
}

function getCreateStmts(stmts: any, resource: Resource): Candidate[] {
  return stmts
    .filter((stmt: any) => {
      return (
        stmt?.["stmt"]?.["CreateStmt"]?.["relation"]?.["schemaname"] !== undefined
        && stmt?.["stmt"]?.["CreateStmt"]?.["relation"]?.["relname"] !== undefined
      );
    })
    .map((stmt: any) => {
      const definition = [
        stmt?.["stmt"]?.["CreateStmt"]?.["relation"]?.["schemaname"],
        stmt?.["stmt"]?.["CreateStmt"]?.["relation"]?.["relname"]
      ].join(".");

      const definitionLink = LocationLink.create(
        resource,
        Range.create(Position.create(0, 0), Position.create(0, 0)),
        Range.create(Position.create(0, 0), Position.create(0, 0))
      );

      return {
        definition,
        definitionLink
      };
    });
}

function getCompositeTypeStmts(stmts: any, resource: Resource): Candidate[] {
  return stmts
    .filter((stmt: any) => {
      return (
        stmt?.["stmt"]?.["CompositeTypeStmt"]?.["typevar"]?.["relname"] !== undefined
      );
    })
    .map((stmt: any) => {
      const definition = stmt?.["stmt"]?.["CompositeTypeStmt"]?.["typevar"]?.["relname"];

      const definitionLink = LocationLink.create(
        resource,
        Range.create(Position.create(0, 0), Position.create(0, 0)),
        Range.create(Position.create(0, 0), Position.create(0, 0))
      );

      return {
        definition,
        definitionLink
      };
    });
}

function getCreateFunctionStmts(stmts: any, resource: Resource): Candidate[] {
  return stmts
    .filter((stmt: any) => {
      const funcname = stmt?.["stmt"]?.["CreateFunctionStmt"]?.["funcname"];
      return funcname !== undefined && funcname.length !== 0;
    })
    .map((stmt: any) => {
      return stmt["stmt"]["CreateFunctionStmt"]["funcname"]
        .filter((funcname: any) => {
          return funcname?.["String"]?.["str"] !== undefined;
        })
        .map((enableFuncname: any) => {
          const definitionLink = LocationLink.create(
            resource,
            Range.create(Position.create(0, 0), Position.create(0, 0)),
            Range.create(Position.create(0, 0), Position.create(0, 0))
          );

          return {
            definition: enableFuncname["String"]["str"],
            definitionLink
          };
        });
    }).flat();
}

export function getDefinitionLinks(
  space: Space,
  params: DefinitionParams
): DefinitionLink[] | undefined {
  const uri = params.textDocument.uri;
  const document = space.documents.get(uri);
  if (document === undefined) {
    return undefined;
  }

  const word_range = getWordRangeAtPosition(document, params.position);
  if (word_range === undefined) {
    return undefined;
  }

  const word = document.getText(word_range);
  space.console.log(`definition uri: ${uri}`);
  space.console.log(`definition word: "${word}"`);
  space.console.log(`definition links: "${JSON.stringify(space.definitionMap.getDefinitionLinks(word))}"`);

  return space.definitionMap.getDefinitionLinks(word);
}
