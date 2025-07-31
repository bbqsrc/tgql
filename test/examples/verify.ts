import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { print, parse, validate, buildSchema } from 'graphql'
import { dirname, join } from '@std/path'
import { assertEquals } from '@std/assert'

const __dirname = dirname(new URL(import.meta.url).pathname)

export function verify<Inp, Out>(opts: {
  query: TypedDocumentNode<Out, Inp>
  string?: string
  schemaPath: string
  variables: Inp
  useOutputType?: (output: Out) => void
}) {
  return async () => {
    if (opts.string) {
      let str = opts.string
      try {
        str = print(parse(opts.string))
      } catch (e) {}
      let q = opts.query.loc?.source.body
      try {
        q = print(opts.query)
      } catch (e) {}

      const schemaFile = await Deno.readTextFile(join(__dirname, opts.schemaPath))
      const schema = buildSchema(schemaFile)
      const errors = validate(schema, opts.query)
      assertEquals(errors.length, 0, `verify doc against schema. errors: ${errors[0]}`)

      assertEquals(str, q)
    }
  }
}
