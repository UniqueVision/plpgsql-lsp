import { DomainDefinition } from "./queryDomainDefinitions"
import { FunctionDefinition } from "./queryFunctionDefinitions"
import { IndexDefinition } from "./queryIndexDefinitions"
import { MaterializedViewDefinition } from "./queryMaterializedViewDefinitions"
import { TriggerDefinition } from "./queryTriggerDefinitions"
import { TypeDefinition } from "./queryTypeDefinitions"
import { ViewDefinition } from "./queryViewDefinitions"

export type PostgresDefinition = ViewDefinition
  | MaterializedViewDefinition
  | FunctionDefinition
  | TypeDefinition
  | DomainDefinition
  | IndexDefinition
  | TriggerDefinition
