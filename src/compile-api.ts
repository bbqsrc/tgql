import { expandGlob } from "@std/fs";
import * as gq from 'graphql';
import { request } from 'undici';

import type { Args, Options } from './compile-options.ts';
import { compileSchemaDefinitions } from './compile.ts';
import { UserFacingError } from './user-error.ts';

/**
 * Compiles the given schema file or URL and writes to the specified output file
 */
export async function compile(args: Args) {
  let schemaData = await fetchOrRead(args)

  let scalars = args.scalar?.map(s => s.split('=') as [string, string])
  let outputScript = compileSchemas(schemaData, {
    scalars,
    includeTypename: args.includeTypename,
  })

  if (args.output === '') {
    console.log(outputScript)
  } else {
    await Deno.writeTextFile(args.output, outputScript)
    
    // Format the output file with deno fmt
    try {
      const formatProcess = new Deno.Command(Deno.execPath(), {
        args: ["fmt", args.output],
        stdout: "piped",
        stderr: "piped",
      })
      
      const { success, stderr } = await formatProcess.output()
      
      if (!success) {
        const errorText = new TextDecoder().decode(stderr)
        console.warn(`Warning: Failed to format output file with deno fmt: ${errorText}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(`Warning: Failed to run deno fmt on output file: ${errorMessage}`)
    }
  }
}

const UrlRegex = /^https?:\/\//

async function fetchOrRead(args: Args) {
  let loadedSchemas: string[] = []
  let schemas = Array.isArray(args.schema) ? args.schema : [args.schema]

  for (let schemaSpec of schemas) {
    if (UrlRegex.test(schemaSpec)) {
      let headers = args.headers?.flatMap(h => h.split(':')) ?? []

      let res = await request(schemaSpec, {
        method: 'POST',
        headers: [...headers, 'content-type', 'application/json'],
        body: JSON.stringify({
          operationName: 'IntrospectionQuery',
          query: gq.getIntrospectionQuery(),
        }),
      })
      let body: any = await res.body.json()
      if (body.errors) {
        throw new UserFacingError(
          `Error introspecting schema from ${args.schema}: ${JSON.stringify(body.errors, null, 2)}`
        )
      }
      loadedSchemas.push(gq.printSchema(gq.buildClientSchema(body.data)))
    } else if (args.schema === '') {
      let res = ''
      const reader = Deno.stdin.readable.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res += decoder.decode(value);
        }
      } finally {
        reader.releaseLock();
      }
      loadedSchemas.push(res)
    } else {
      for await (let file of expandGlob(schemaSpec)) {
        if (file.isFile) {
          loadedSchemas.push(await Deno.readTextFile(file.path))
        }
      }
    }
  }
  return loadedSchemas
}

/**
 * Compiles a schema string directly to output TypeScript code
 */
export function compileSchemas(schemaStrings: string | string[], options: Options = {}): string {
  let schemaArray = Array.isArray(schemaStrings) ? schemaStrings : [schemaStrings]

  let schemas = schemaArray.map(schemaString => gq.parse(schemaString, { noLocation: false }))

  let schemaDefinitions = schemas.flatMap(s => s.definitions)

  return compileSchemaDefinitions(schemaDefinitions, options)
}
