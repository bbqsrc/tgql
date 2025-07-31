import { query, type QueryOutputType } from './nullability.graphql.api.ts'
import { verify } from './verify.ts'

const basicQuery = query(q => [q.posts(p => [p.id, p.author(a => [a.name])])])

type BasicQueryOutput = QueryOutputType<typeof basicQuery>

export default [
  verify({
    query: basicQuery,
    schemaPath: 'nullability.graphql',
    variables: {},
    useOutputType: output => {
      const typedOutput = output as BasicQueryOutput & Record<string, unknown>
      const posts = typedOutput.posts
      if (posts === null || posts === undefined) {
        return
      }
      const firstPost = posts[0]
      // Array access can be undefined.
      if (firstPost === undefined) {
        return
      }
      const author = firstPost.author
      if (author === null) {
        return
      }
      const name = author.name
      return name + 'test'
    },
  }),
]
