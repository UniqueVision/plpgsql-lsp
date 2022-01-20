import { CompletionItem, CompletionItemKind, TextDocumentIdentifier } from 'vscode-languageserver';
import { LanguageServerSettings } from '../settings';
import { Space } from '../space';

async function getStoredProcedureCompletionItems(
  space: Space, settings: LanguageServerSettings
) {
  const pgClient = await space.getPgPool(settings).connect();

  let procedures: CompletionItem[] = [];
  try {
    // https://dataedo.com/kb/query/postgresql/list-stored-procedures
    const results = await pgClient.query(`
      SELECT
        t_pg_proc.proname
        ,CASE
          WHEN t_pg_language.lanname = 'internal' THEN
            t_pg_proc.prosrc
          ELSE
            pg_get_functiondef(t_pg_proc.oid)
        END AS definition
      FROM
        pg_proc AS t_pg_proc
      LEFT JOIN pg_language AS t_pg_language ON (
        t_pg_proc.prolang = t_pg_language.oid
      )
    `);

    const formattedResults = results.rows.map((row, index) => {
      const proname = `${row["proname"]}`;
      const definition = `${row["definition"]}`;

      // definitionから引数リストをとります
      const func_params = definition.match(/\(.*\)/g);
      const func_param = func_params ? func_params[0] : '';
      const func_param_items = func_param.match(/\(\w*\s|,\s\w*\s/g) || [];

      // 引数リストからクエリーを生成します
      let params_customize = '(';
      func_param_items.forEach((item, index) => {
        params_customize += '\n\t';
        const param_name = item.replace('(', '').replace(/\s/g, '').replace(',', '');
        params_customize += `${index == 0 ? '' : ','}${param_name} := ${param_name}`;
      });
      params_customize += `${func_param_items.length > 0 ? '\n' : ''})`;

      // CompletionItem返します
      return {
        label: proname,
        kind: CompletionItemKind.Function,
        data: index,
        detail: definition,
        document: proname,
        insertText: proname + params_customize
      };
    });
    procedures = procedures.concat(formattedResults);
  }
  catch (error: unknown) {
    space.console.log(`${error}`);
  }
  finally {
    pgClient.release();
  }
  return procedures;
}

async function getTableCompletionItems(
  space: Space, settings: LanguageServerSettings
) {
  const pgClient = await space.getPgPool(settings).connect();

  let procedures: CompletionItem[] = [];
  try {
    const results = await pgClient.query(`
      SELECT
        relnamespace::regnamespace::TEXT || '.' || relname AS table_name
      FROM
        pg_class
      WHERE
        relkind = 'p' OR (relkind = 'r' AND NOT relispartition)
      ORDER BY
        table_name
    `);
    const formattedResults = results.rows.map((row, index) => {
      const table_name = `${row["table_name"]}`;
      return {
        label: table_name,
        kind: CompletionItemKind.Struct,
        data: index,
        detail: table_name,
        document: table_name
      };
    });
    procedures = procedures.concat(formattedResults);
  }
  catch (error: unknown) {
    space.console.log(`${error}`);
  }
  finally {
    pgClient.release();
  }
  return procedures;
}

export async function getCompletionItems(space: Space, textDocument: TextDocumentIdentifier) {
  const settings = await space.getDocumentSettings(
    textDocument.uri
  );
  const procedures = await getStoredProcedureCompletionItems(space, settings);
  const tables = await getTableCompletionItems(space, settings);

  return procedures.concat(tables).map((item, index) => {
    item.data = index;
    return item;
  });
}
