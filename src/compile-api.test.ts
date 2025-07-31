import { assertEquals, assertMatch } from "@std/assert"
import { compileSchemas } from "./compile-api.ts"

// ------------------------------------------------------------------------------

let s1 = `
schema {
  query: Query
}

type Query {
  a(s: String): String
  test(s: String): String
}
`

let s2 = `
extend type Query {
  other(t: String): Int
  a(s: String): Int
}
`

Deno.test("works with extended schemas", () => {
  let code = compileSchemas([s1, s2])

  let res = code.split("\n").filter((l) => l.includes("this.$_select"))

  // Sorted alphabetically and contains only one occurrence of "a"
  assertMatch(res[0], /"a"/)
  assertMatch(res[1], /"other"/)
  assertMatch(res[2], /"test"/)
})

// ------------------------------------------------------------------------------

let schemaScalars = `
scalar A
scalar B

type Query {
  test(s: String): A
}
`
Deno.test("works with custom scalars", () => {
  let res = compileSchemas([schemaScalars], {
    scalars: [["(.+)", "./scalars#$1"]],
  })

  let importList = res.split("\n").filter((l) => l.startsWith("import") && l.includes("scalars"))

  assertEquals(importList, [`import type { A } from './scalars'`, `import type { B } from './scalars'`])
})

// ------------------------------------------------------------------------------

let schemaInputTypes = `
scalar A
scalar B

input MyInput {
  a: String
}
type Query {
  test(myInput: MyInput): string
}
`

Deno.test("does not add typename to input types", () => {
  let res = compileSchemas([schemaInputTypes], {
    includeTypename: true,
  })

  let lines = res.split("\n")

  let firstTypeLine = lines.findIndex((l) => l.startsWith("export type MyInput"))
  let lastTypeLine = lines.slice(firstTypeLine).findIndex((l) => l === "}")
  let typeLines = lines.slice(firstTypeLine + 1, firstTypeLine + lastTypeLine)
  let typenameLine = typeLines.find((l) => l.includes("__typename"))
  assertEquals(typenameLine, undefined, "should not contain __typename")
  // let inputType = res

  // console.log(res)
})
