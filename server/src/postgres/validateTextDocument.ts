import { Connection, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Space } from '../space';

export async function validateTextDocument(
  space: Space,
  textDocument: TextDocument,
): Promise<void> {
  const diagnostics: Diagnostic[] = [];

  const pgClient = await space.getPgPool(
    await space.getDocumentSettings(textDocument.uri)
  ).connect();

  const text = textDocument.getText();

  try {
    await pgClient.query('BEGIN');
    await pgClient.query(text);
  }
  catch (error: unknown) {
    const diagnosic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: textDocument.positionAt(0),
        end: textDocument.positionAt(text.length - 1)
      },
      message: `${error}`,
    };
    if (space.hasDiagnosticRelatedInformationCapability) {
      diagnosic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnosic.range)
          },
          message: 'Syntax errors'
        }
      ];
    }
    diagnostics.push(diagnosic);
  }
  finally {
    await pgClient.query('ROLLBACK');
    pgClient.release();
  }

  // Send the computed diagnostics to VSCode.
  space.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
