# tgql

A TypeScript code generator that creates type-safe GraphQL query builders from GraphQL schemas. The generated APIs
replace `gql` query strings with pure TypeScript code, compatible with TypedDocumentNode libraries like Apollo Client,
Urql, and graphql-request.

## Installation

```bash
# Install as a global binary
deno install --allow-all --global --name tgql jsr:@necessary/tgql

# Or run directly without installation
deno run --allow-all jsr:@necessary/tgql --help
```

## Generating the API

```bash
# Using the global binary
tgql https://countries.trevorblades.com --output generated-api.ts

# Or running directly with Deno
deno run --allow-all jsr:@necessary/tgql \
  schema.graphql \
  --output generated-api.ts
```

### Examples

```bash
# Basic usage with local schema
tgql schema.graphql -o api.ts

# Fetch from GraphQL endpoint with authentication
tgql https://api.example.com/graphql -o api.ts --bearer mytoken123

# Custom scalar mappings
tgql schema.graphql -o api.ts -s Int32=number -s Int64=bigint --include-typename

# Import custom types
tgql schema.graphql -o api.ts -s CustomType=./types#CustomType
```

## Dependencies

The generated API depends on two small libraries. For Deno projects, add them with:

```bash
deno add --npm @graphql-typed-document-node/core graphql-tag
```

## Writing queries

The generated API exports `query`, `mutation`, `subscription` to access the schema roots.

The `query` function gives us access to the root `query` object of our schema:

```typescript
import { query } from "./generated-api.ts"

const continentQuery = query((q) => [
  q.continents((c) => [
    c.name,
    c.code,
  ]),
])
```

The above code will generate a query of type `TypedDocumentNode<{continents: Array<{name: string, code: string}>}, {}>`
which corresponds to the following GraphQL query string:

```graphql
query {
  continents {
    name
    code
  }
}
```

### Using Variables

We can use input variables using the `$` helper. Variable types are inferred automatically:

```typescript
import { $, query } from "./generated-api.ts"

const countryQuery = query((q) => [
  q.countries({ filter: { continent: { eq: $("continentCode") } } }, (c) => [
    c.code,
    c.capital,
    c.name,
    c.languages((l) => [l.name]),
  ]),
])
```

This will generate `TypedDocumentNode<{ countries: Array<{...}>}, { continentCode?: string | null | undefined }>`, a
typed document node that includes the input variable `continentCode`.

### Variable Types

The generated API provides two variable creation functions:

- **`$(name)`**: Creates optional variables that allow null/undefined values
- **`$$(name)`**: Creates required variables that force non-null values

```typescript
// Optional variable (allows null)
const optionalVar = $("maybeString") // Variable<string | null | undefined, 'maybeString', undefined>

// Required variable (forces non-null)
const requiredVar = $$("mustHaveString") // Variable<string, 'mustHaveString', true>
```

The GraphQL version of the country query above would be:

```graphql
query ($continentCode: String) {
  countries(filter: { continent: { eq: $continentCode } }) {
    code
    capital
    name
    languages {
      name
    }
  }
}
```

## Using queries

The queries written above can be used with any client library that supports TypedDocumentNode. For example, if using
Apollo's `useQuery`, we would write the following:

```typescript
const CountryListComponent = () => {
  const continents = useQuery(continentQuery)
  const [continent, setContinent] = useState("EU")

  const countryList = useQuery(countryQuery, {
    variables: {
      continentCode: continent,
    },
  })

  // render the country list here
}
```

## Development

This project uses Deno as its runtime and build system.

### Building

```bash
deno task build           # Build CLI binary to dist/tgql
```

### Testing

```bash
deno task test           # Run all tests
deno task test:watch     # Run tests in watch mode
```

### Installing locally

```bash
deno task install
```

It can also be built as a self-contained binary:

```bash
deno run build
```

## License

This project is licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

### Acknowledgements

This project is originally a fork of
[typed-graphql-builder](https://github.com/typed-graphql-builder/typed-graphql-builder) by Gjorgji Kjosev.
