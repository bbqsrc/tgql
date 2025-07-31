import { assertEquals } from "@std/assert"
import { getScalars } from "./scalars.ts"

let scalarMapPairs = [
  ["Empty", ""],
  ["MyTest", "string"],
  ["Another", "./path/to/x#TypeName"],
  ["JSON(.+)", "./jsons#JSON$1"],
  [".+", "unknown"],
] as [string, string][]

Deno.test("plain string scalar", () => {
  let scalarInfo = getScalars(["MyTest"], scalarMapPairs)
  assertEquals(scalarInfo.map, [["MyTest", "string"]])
  assertEquals(scalarInfo.imports, [])
})

Deno.test("must not match subpattern", () => {
  let scalarInfo = getScalars(["MyTest2"], scalarMapPairs)
  assertEquals(scalarInfo.map, [["MyTest2", "unknown"]])
  assertEquals(scalarInfo.imports, [])
})

Deno.test("scalar with import", () => {
  let scalarInfo = getScalars(["Another"], scalarMapPairs)
  assertEquals(scalarInfo.map, [["Another", "Another"]])
  assertEquals(scalarInfo.imports, [`import type { TypeName as Another } from './path/to/x'`])
})

Deno.test("scalar with import and pattern", () => {
  let scalarInfo = getScalars(["JSONTextDocument"], scalarMapPairs)
  assertEquals(scalarInfo.map, [["JSONTextDocument", "JSONTextDocument"]])
  assertEquals(scalarInfo.imports, [`import type { JSONTextDocument } from './jsons'`])
})

Deno.test("scalar not matching any other pattern", () => {
  let scalarInfo = getScalars(["Blaha"], scalarMapPairs)
  assertEquals(scalarInfo.map, [["Blaha", "unknown"]])
  assertEquals(scalarInfo.imports, [])
})

Deno.test("replacement and rename patterns working", () => {
  let scalarInfo = getScalars(["MyScalar"], [["(.+)", "./scalars#Rename$1"]])
  assertEquals(scalarInfo.map, [["MyScalar", "MyScalar"]])
  assertEquals(scalarInfo.imports, [`import type { RenameMyScalar as MyScalar } from './scalars'`])
})
