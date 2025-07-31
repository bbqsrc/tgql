#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

import yargs from 'yargs'
import { compile } from './compile-api.ts'
import { UserFacingError } from './user-error.ts'

async function main() {
  let args = await yargs(Deno.args).usage('Compiles a GraphQL schema to a TypeScript API').options({
    schema: {
      type: 'array',
      string: true,
      describe: 'Path (or glob) to local schema file or URL to a server with introspection',
      required: true,
    },
    headers: {
      type: 'array',
      describe: 'Additional headers to send to the server if passing a server URL',
      default: [] as string[],
    },
    bearer: {
      type: 'string',
      describe: 'Bearer token to add as Authorization header when fetching schema from URL',
      required: false,
    },
    schemaExtensions: {
      type: 'array',
      describe: 'Additional schemas that extend the base',
      required: false,
    },
    output: {
      type: 'string',
      describe: 'The output TypeScript file',
      required: true,
    },
    scalar: {
      type: 'array',
      string: true,
      describe:
        'List of scalars in the format ScalarName=[./path/to/scalardefinition#ScalarExport]',
    },
    includeTypename: {
      type: 'boolean',
      boolean: true,
      default: false,
      describe: 'Include the __typename field in all objects',
    },
  }).argv

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

main()
