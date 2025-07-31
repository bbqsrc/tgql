import { parseArgs } from '@std/cli'
import denoConfig from '../deno.json' with { type: 'json' }
import { compile } from './compile-api.ts'
import type { Args } from './compile-options.ts'
import { UserFacingError } from './user-error.ts'

const USAGE = `Compiles a GraphQL schema to a TypeScript API

Usage: tgql [options] <schema>

Arguments:
  schema                  Path (or glob) to local schema file or URL to a server with introspection

Options:
  --output, -o <file>     The output TypeScript file (required)
  --header <header>       Additional headers to send to the server if passing a server URL (can be repeated)
  --bearer <token>        Bearer token to add as Authorization header when fetching schema from URL
  --scalar, -s <mapping>  Map scalars to TypeScript types. Format: ScalarName=TypeName or ScalarName=./path/to/file#ExportName (can be repeated)
  --include-typename      Include the __typename field in all objects
  --help, -h              Show this help message
  --version, -v           Show version number

Examples:
  tgql schema.graphql -o api.ts
  tgql https://api.example.com/graphql -o api.ts --bearer mytoken123
  tgql schema.graphql -o api.ts -s Int32=number -s Int64=bigint --include-typename
  tgql schema.graphql -o api.ts -s CustomType=./types#CustomType`

function showHelp() {
  console.log(USAGE)
}

function showVersion() {
  console.log(denoConfig.version)
}

async function main() {
  const parsed = parseArgs(Deno.args, {
    string: ['output', 'header', 'bearer', 'scalar'],
    boolean: ['include-typename', 'help', 'version'],
    collect: ['header', 'scalar'],
    default: {
      'include-typename': false,
      header: [],
      scalar: []
    },
    alias: {
      h: 'help',
      v: 'version',
      o: 'output',
      s: 'scalar'
    }
  })

  if (parsed.help) {
    showHelp()
    Deno.exit(0)
  }

  if (parsed.version) {
    showVersion()
    Deno.exit(0)
  }

  // Get schema from positional arguments
  const schema = parsed._[0]
  
  // Validate required arguments
  if (!schema) {
    console.error('Error: schema argument is required')
    console.error('Use --help for usage information')
    Deno.exit(1)
  }

  if (!parsed.output) {
    console.error('Error: --output is required')
    console.error('Use --help for usage information')
    Deno.exit(1)
  }

  // Convert parsed args to the expected Args format
  const args: Args = {
    schema: [schema as string],
    output: parsed.output as string,
    headers: Array.isArray(parsed.header) ? parsed.header : (parsed.header ? [parsed.header] : []),
    bearer: parsed.bearer as string | undefined,
    scalar: Array.isArray(parsed.scalar) ? parsed.scalar : (parsed.scalar ? [parsed.scalar] : []),
    includeTypename: parsed['include-typename'] as boolean
  }

  try {
    await compile(args)
  } catch (e) {
    if (UserFacingError.is(e)) {
      console.error(e.message)
      Deno.exit(1)
    } else {
      throw e
    }
  }
}

await main()
