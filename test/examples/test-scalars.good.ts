import { $, mutation } from "./scalars.graphql.api.ts"
import { verify } from "./verify.ts"

let createScalarMutation = mutation((m) => [
  m.createObject(
    {
      input: {
        content: $("myVar"),
      },
    },
    (s) => [s.content],
  ),
])

let createEncompassingVariableMutation = mutation((m) => [
  m.createObject(
    {
      input: $("myInput"),
    },
    (s) => [s.content],
  ),
])

let createManyMutation = mutation((m) => [m.createMany({ inputs: $("myInputs") })])

export default [
  verify({
    query: createScalarMutation,
    variables: {
      myVar: { a: "str" },
    },
    schemaPath: "scalars.graphql",
    useOutputType: (oType) => {
      // val should be a string as JSONObject is {[key: string]: string}
      const typedOutput = oType as Record<string, unknown>
      const createObject = typedOutput.createObject as Record<string, unknown> | undefined
      const content = createObject?.content as Record<string, unknown> | undefined
      const key = content?.key as string | undefined
      return key?.substring(10)
    },
  }),
  verify({
    query: createEncompassingVariableMutation,
    variables: {
      myInput: {
        content: { key: "str" },
      },
    },
    schemaPath: "scalars.graphql",
  }),
  verify({
    query: createManyMutation,
    variables: {
      myInputs: [
        {
          content: { key: "s" },
        },
      ],
    },
    schemaPath: "scalars.graphql",
  }),
]
