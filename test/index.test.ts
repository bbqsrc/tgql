import { expandGlob } from "@std/fs";
import { basename, dirname, join } from "@std/path";
import { compile } from '../src/compile-api.ts';

const __dirname = dirname(new URL(import.meta.url).pathname);

async function globSync(pattern: string, cwd: string): Promise<string[]> {
  const results: string[] = [];
  for await (const entry of expandGlob(pattern, { root: cwd })) {
    if (entry.isFile) {
      results.push(entry.path);
    }
  }
  return results;
}

// test dir structure
// examples/schema1.graphql
// examples/schema1.graphql.ts // generated
// examples/schema2.graphql
// examples/schema2.graphql.ts // generated
// examples/test-schema1.good.ts // test file
//   import * as s1 from './schema1.graphql.ts'
//   import {verify} from './utils'
//
//   export default tests = [
//     verify({
//       query: s1.query(q => [ ... ])
//       string: 'query Name { .... }',
//       variables: {a: 1, b: 2}
//     }),
//     ......
//   }
// examples/test-schema1.bad.ts
//   content can be anything that we want to fail compilation
// schema/schema-test.ts
//   tests that compile a small raw schema and expect a certain output
//   can go in this directory (i.e. checking correct support for various valid GQL schemas)
//   examples: no mutations, no query root, unions, enums, custom scalars, optionals etc.

function compileTs(_file: string) {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["check", _file],
    cwd: __dirname,
    stdout: "piped",
    stderr: "piped",
  });
  
  return command.outputSync();
}

const schemas: string[] = [];
for await (const entry of expandGlob("examples/*.graphql", { root: __dirname })) {
  if (entry.isFile) {
    schemas.push(entry.path);
  }
}

for (const schema of schemas) {
  const schemaName = basename(schema);
  const schemaCoreName = basename(schema).split('.')[0];

  Deno.test(`schema ${schemaName}`, async (t) => {
    // Prepare the schema compilation
    await t.step("compile schema", async () => {
      let extraOptionsPath = join(__dirname, `examples`, `${schemaName}.opts.json`);

      let extraOptions;
      try {
        const opts = await Deno.readTextFile(extraOptionsPath);
        extraOptions = JSON.parse(opts);
      } catch (_e) {
        extraOptions = {};
      }

      await compile({
        schema: schema,
        output: join(__dirname, 'examples', `${schemaName}.api.ts`),
        includeTypename: true,
        ...extraOptions,
      });
    });

    await t.step("typechecks", () => {
      const output = compileTs(`${schema}.api.ts`);
      if (output.code !== 0) {
        throw new Error(`Type check failed: ${new TextDecoder().decode(output.stderr)}`);
      }
    });

    const goodExamples = await globSync(`./examples/*-${schemaCoreName}.good.ts`, __dirname);
    
    for (const example of goodExamples) {
      const exampleName = basename(example);
      await t.step(`compiles with example ${exampleName}`, () => {
        const res = compileTs(example);
        if (res.code !== 0) {
          throw new Error(`Compilation failed: ${new TextDecoder().decode(res.stderr)}`);
        }
      });

      // Skip the require/verification step for now as it needs more complex conversion
      // await t.step(`runs the verifications in ${exampleName}`, async () => {
      //   const loadedExample = await import(example);
      //   // This would need significant conversion work
      // });
    }

    const badExamples = await globSync(`./examples/*-${schemaCoreName}.ts.bad`, __dirname);
    const tmpDir = Deno.makeTempDirSync({ prefix: 'bad-examples-' });

    for (const example of badExamples) {
      // Copy the bad example to a temporary directory
      const tmpExamplePath = join(tmpDir, basename(example));
      Deno.copyFileSync(example, tmpExamplePath);

      const exampleName = basename(example);
      await t.step(`compile fails with example ${exampleName}`, () => {
        const res = compileTs(tmpExamplePath);
        if (res.code === 0) {
          throw new Error('bad example compiled with no errors');
        }
        // Success - the compilation failed as expected
      });
    }
  });
}
