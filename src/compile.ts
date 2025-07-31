import {
  type DefinitionNode,
  type EnumTypeDefinitionNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  type InputObjectTypeDefinitionNode,
  type InputValueDefinitionNode,
  type InterfaceTypeDefinitionNode,
  isTypeExtensionNode,
  Kind,
  type ObjectTypeDefinitionNode,
  OperationTypeNode,
  type ScalarTypeDefinitionNode,
  type SchemaDefinitionNode,
  type StringValueNode,
  type TypeExtensionNode,
  type TypeNode,
  type UnionTypeDefinitionNode,
} from 'graphql'
import type { Options } from './compile-options.ts'
import { postamble } from './postamble.ts'
import { ExactArgNames, Preamble } from './preamble.lib.ts'
import { getScalars } from './scalars.ts'
import { UserFacingError } from './user-error.ts'

type SupportedExtensibleNodes =
  | InterfaceTypeDefinitionNode
  | ObjectTypeDefinitionNode
  | InputObjectTypeDefinitionNode

type FieldOf<T extends SupportedExtensibleNodes> = T extends
  | ObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode
  ? FieldDefinitionNode
  : T extends InputObjectTypeDefinitionNode
  ? InputValueDefinitionNode
  : never

/**
 * Compile a list of schema definitions with the specified options into an output script string
 */
export function compileSchemaDefinitions(
  schemaDefinitions: DefinitionNode[],
  options: Options = {}
) {
  let outputScript = ''
  let usesExactArgNames = false

  function write(s: string) {
    outputScript += s + '\n'
  }

  const outputObjectTypeNames = new Set()

  const enumTypes = schemaDefinitions.flatMap(def => {
    if (def.kind === Kind.ENUM_TYPE_DEFINITION) return [def.name.value]
    return []
  })

  const scalarTypeNames = schemaDefinitions.flatMap(def => {
    if (def.kind === Kind.SCALAR_TYPE_DEFINITION) return [def.name.value]
    return []
  })

  const scalars = getScalars(scalarTypeNames, options.scalars)

  const schemaExtensionsMap = schemaDefinitions.filter(isTypeExtensionNode).reduce((acc, el) => {
    if (acc.has(el.name.value)) {
      acc.get(el.name.value)!.push(el)
    } else {
      acc.set(el.name.value, [el])
    }
    return acc
  }, new Map<string, TypeExtensionNode[]>())

  function getExtendedFields<T extends SupportedExtensibleNodes>(sd: T) {
    let fieldExtensions = (schemaExtensionsMap.get(sd.name.value) || []).flatMap(
      n => (n as any).fields || []
    ) as FieldOf<T>[]

    let fieldList = ((sd.fields || []) as FieldOf<T>[]).concat(fieldExtensions)

    fieldList.sort((f1, f2) =>
      f1.name.value < f2.name.value ? -1 : f1.name.value > f2.name.value ? 1 : 0
    )

    if (
      options.includeTypename &&
      sd.kind != Kind.INTERFACE_TYPE_DEFINITION &&
      sd.kind != Kind.INPUT_OBJECT_TYPE_DEFINITION
    ) {
      fieldList.push({
        kind: Kind.FIELD_DEFINITION,
        name: { kind: Kind.NAME, value: '__typename' },
        type: { kind: Kind.NAMED_TYPE, name: { value: 'String', kind: Kind.NAME } },
        description: { kind: Kind.STRING, value: '' },
        directives: [],
      } as any)
    }

    // Override duplicate fields
    return fieldList.filter((f, ix) => fieldList[ix + 1]?.name.value !== f.name.value)
  }

  const atomicTypes = new Map(
    enumTypes
      .map(et => [et, et])
      .concat([
        ['Int', 'number'],
        ['Float', 'number'],
        ['ID', 'string'],
        ['String', 'string'],
        ['Boolean', 'boolean'],
      ]) as [string, string][]
  )

  const scalarMap = new Map(scalars.map)

  const inheritanceMap = new Map(
    schemaDefinitions.flatMap(def => {
      if (def.kind === Kind.OBJECT_TYPE_DEFINITION) {
        return [[def.name.value, def.interfaces?.map(ifc => ifc.name.value)]]
      }
      return []
    })
  )

  // reverse map to answer "who implements this"
  const reverseInheritanceMap = new Map<string, string[]>()
  for (const [key, values] of inheritanceMap) {
    if (!values) continue
    for (const value of values) {
      reverseInheritanceMap.set(value, (reverseInheritanceMap.get(value) ?? []).concat(key))
    }
  }

  function gqlTypeHasSelector(typeName: string) {
    return !atomicTypes.get(typeName) && !scalarMap.get(typeName)
  }

  function toTSTypeName(graphqlType: string) {
    let atomic = atomicTypes.get(graphqlType)
    if (atomic) {
      return atomic
    }

    let scalar = scalarMap.get(graphqlType)
    if (scalar) {
      if (scalar === 'string' || scalar === 'number') return graphqlType
      else return `CustomScalar<${graphqlType}>`
    }

    return graphqlType
  }

  function printAtomicTypes() {
    return `type $Atomic = ${Array.from(new Set(atomicTypes.values()))
      .concat('null', 'undefined')
      .join(' | ')}
`
  }

  function printEnumList() {
    return `let $Enums = new Set<string>(${JSON.stringify(enumTypes)})
`
  }

  function printTypeWrapped(
    wrappedType: string,
    wrapperDef: TypeNode,
    notNull: boolean = false
  ): string {
    switch (wrapperDef.kind) {
      case Kind.NON_NULL_TYPE:
        return `${printTypeWrapped(wrappedType, wrapperDef.type, true)}`
      case Kind.LIST_TYPE:
        return `Array<${printTypeWrapped(wrappedType, wrapperDef.type)}>${
          !notNull ? ' | null' : ''
        }`
      case Kind.NAMED_TYPE:
        return `${toTSTypeName(wrappedType)}${!notNull ? ' | null' : ''}`
    }
  }

  function printType(def: TypeNode, notNull: boolean = false): string {
    switch (def.kind) {
      case Kind.NON_NULL_TYPE:
        return `${printType(def.type, true)}`
      case Kind.LIST_TYPE:
        return `Readonly<Array<${printType(def.type)}>>${!notNull ? ' | null' : ''}`
      case Kind.NAMED_TYPE:
        return `${toTSTypeName(def.name.value)}${!notNull ? ' | null' : ''}`
    }
  }

  function printTypeGql(def: TypeNode, notNull: boolean = false): string {
    switch (def.kind) {
      case Kind.NON_NULL_TYPE:
        return `${printTypeGql(def.type, true)}`
      case Kind.LIST_TYPE:
        return `[${printTypeGql(def.type)}]${notNull ? '!' : ''}`
      case Kind.NAMED_TYPE:
        return `${def.name.value}${notNull ? '!' : ''}`
    }
  }

  function printTypeBase(def: TypeNode): string {
    switch (def.kind) {
      case Kind.NON_NULL_TYPE:
        return `${printTypeBase(def.type)}`
      case Kind.LIST_TYPE:
        return `${printTypeBase(def.type)}`
      case Kind.NAMED_TYPE:
        return `${def.name.value}`
    }
  }

  function printInputField(def: InputValueDefinitionNode) {
    const canBeOmitted = def.type.kind !== Kind.NON_NULL_TYPE || def.defaultValue !== undefined
    return `${def.name.value}${canBeOmitted ? '?' : ''}: ${printType(def.type)}`
  }

  function printDocumentation(description?: StringValueNode) {
    return description?.value.length ?? 0 > 0
      ? `
/**
 * ${description?.value}
 */`
      : ''
  }

  function printObjectType(def: ObjectTypeDefinitionNode) {
    const className = def.name.value
    return `
${printDocumentation(def.description)}
export class ${className} extends $Base<"${className}"> {
  constructor() {
    super("${className}")
  }

  ${getExtendedFields(def)
    .map(f => printField(f, `"${className}"`))
    .join('\n')}
}`
  }

  function generateFunctionFieldDefinition(
    field: FieldDefinitionNode,
    includeArgs: boolean
  ): string {
    const methodArgs: string[] = []
    const fieldTypeName = printTypeBase(field.type)
    let hasArgs = false,
      hasSelector = false

    let argsType = ''

    if (field.arguments?.length && includeArgs) {
      hasArgs = true
      argsType = `{
        ${(field.arguments ?? []).map(arg => printInputField(arg)).join('\n')},
      }`
      methodArgs.push(`args: ExactArgNames<Args, ${argsType}>`)
      usesExactArgNames = true
    }
    if (gqlTypeHasSelector(fieldTypeName)) {
      hasSelector = true
      methodArgs.push(`selectorFn: (s: ${fieldTypeName}) => [...Sel]`)
    }
    if (methodArgs.length > 0) {
      let methodArgsSerialized = methodArgs.join(', ')

      const generics = (hasArgs ? [`Args extends VariabledInput<${argsType}>`] : []).concat(
        hasSelector ? [`Sel extends Selection<${fieldTypeName}>`] : []
      )

      return `${field.name.value}<${generics.join(',')}>(${methodArgsSerialized}):$Field<"${
        field.name.value
      }", ${hasSelector ? printTypeWrapped('GetOutput<Sel>', field.type) : printType(field.type)} ${
        hasArgs ? `, GetVariables<${hasSelector ? 'Sel' : '[]'}, Args>` : ', GetVariables<Sel>'
      }>`
    } else {
      throw new Error('Attempting to generate function field definition for non-function field')
    }
  }

  function printField(field: FieldDefinitionNode, typename: string) {
    const fieldTypeName = printTypeBase(field.type)

    let hasArgs = !!field.arguments?.length,
      hasSelector = gqlTypeHasSelector(fieldTypeName)

    if (hasArgs || hasSelector) {
      let extractArgs = ''

      let validDefinitions = generateFunctionFieldDefinition(field, true)

      const hasOnlyMaybeInputs = (field.arguments ?? []).every(
        def => def.type.kind !== Kind.NON_NULL_TYPE
      )
      if (hasOnlyMaybeInputs && hasArgs && hasSelector) {
        validDefinitions +=
          '\n' +
          generateFunctionFieldDefinition(field, false) +
          '\n' +
          `${field.name.value}(arg1: any, arg2?: any)`
        extractArgs = `const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 };\n`
      }
      return `
      ${printDocumentation(field.description)}
      ${validDefinitions} {
      ${extractArgs}
      const options = {
        ${
          hasArgs
            ? `argTypes: {
              ${field.arguments
                ?.map(arg => `${arg.name.value}: "${printTypeGql(arg.type)}"`)
                .join(',\n')}
            },`
            : ''
        }
        ${hasArgs ? `args,` : ''}

        ${hasSelector ? `selection: selectorFn(new ${fieldTypeName})` : ''}
      };
      return this.$_select("${field.name.value}", options as any) as any
    }
  `
    } else {
      let fieldType = field.name.value === '__typename' ? typename : printType(field.type)
      return `
      ${printDocumentation(field.description)}
      get ${field.name.value}(): $Field<"${field.name.value}", ${fieldType}>  {
       return this.$_select("${field.name.value}") as any
      }`
    }
  }

  function printInterface(def: InterfaceTypeDefinitionNode) {
    const className = def.name.value

    const additionalTypes = reverseInheritanceMap.get(className) ?? []
    const typenameList = additionalTypes.map(t => `"${t}"`).join(' | ')

    const InterfaceObject = `{${additionalTypes.map(t => `${t}: ${t}`)}}`
    return `
${printDocumentation(def.description)}
export class ${def.name.value} extends $Interface<${InterfaceObject}, "${def.name.value}"> {
  constructor() {
    super(${InterfaceObject}, "${def.name.value}")
  }
  ${getExtendedFields(def)
    .map(f => printField(f, typenameList))
    .join('\n')}
}`
  }

  function printInputObjectType(def: InputObjectTypeDefinitionNode) {
    return `
${printDocumentation(def.description)}
export type ${def.name.value} = {
  ${getExtendedFields(def)
    .map(field => printInputField(field))
    .join(',\n')}
}
    `
  }

  function printInputTypeMap(defs: InputObjectTypeDefinitionNode[]) {
    return `
const $InputTypes: {[key: string]: {[key: string]: string}} = {
  ${defs
    .map(
      def => `  ${def.name.value}: {
    ${getExtendedFields(def)
      .map(field => `${field.name.value}: "${printTypeGql(field.type)}"`)
      .join(',\n')}
  }`
    )
    .join(',\n')}
}
`
  }

  function printScalar(def: ScalarTypeDefinitionNode) {
    let typeName = def.name.value
    if (scalarMap.get(typeName) === typeName) return ''

    return `
${printDocumentation(def.description)}
export type ${def.name.value} = ${scalarMap.get(typeName) ?? 'unknown'}
`
  }

  function printUnion(def: UnionTypeDefinitionNode) {
    // TODO: collect all interfaces that the named type implements too
    const baseTypes = def.types?.map(t => printTypeBase(t)) ?? []
    const additionalTypes = Array.from(
      new Set(baseTypes.concat(baseTypes.flatMap(bt => inheritanceMap.get(bt) ?? [])))
    )

    const UnionObject = `{${additionalTypes.map(t => `${t}: ${t}`)}}`
    return `
${printDocumentation(def.description)}
export class ${def.name.value} extends $Union<${UnionObject}, "${def.name.value}"> {
  constructor() {
    super(${UnionObject}, "${def.name.value}")
  }
}`
  }

  function printEnumValue(def: EnumValueDefinitionNode) {
    return `${printDocumentation(def.description)}
  ${def.name.value} = "${def.name.value}"`
  }
  function printEnum(def: EnumTypeDefinitionNode) {
    return `
  ${printDocumentation(def.description)}
export enum ${def.name.value} {
  ${def.values?.map(printEnumValue).join(',\n')}
}
  `
  }

  function printSchema(def: SchemaDefinitionNode) {
    return `
  const $Root = {
    ${def.operationTypes.map(op => `${op.operation}: ${printType(op.type, true)}`).join(',\n')}
  }

  namespace $RootTypes {
    ${def.operationTypes
      .map(op => `export type ${op.operation} = ${printType(op.type, true)}`)
      .join('\n')}
  }
  `
  }

  // main

  write(scalars.imports.join('\n'))
  write(Preamble)
  write(printAtomicTypes())
  write(printEnumList())

  let rootNode: SchemaDefinitionNode | null = null

  for (let def of schemaDefinitions) {
    switch (def.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
        write(printObjectType(def))
        outputObjectTypeNames.add(def.name.value)
        break
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        write(printInputObjectType(def))
        break
      case Kind.SCALAR_TYPE_DEFINITION:
        write(printScalar(def))
        break
      case Kind.UNION_TYPE_DEFINITION:
        write(printUnion(def))
        break
      case Kind.ENUM_TYPE_DEFINITION:
        write(printEnum(def))
        break
      case Kind.INTERFACE_TYPE_DEFINITION:
        write(printInterface(def))
        break
      case Kind.SCHEMA_DEFINITION:
        rootNode = def
    }
  }

  if (!rootNode) {
    if (!outputObjectTypeNames.has('Query')) {
      throw new UserFacingError(
        'Could not find toplevel root node or an output objet type named `Query`'
      )
    }
    rootNode = {
      kind: Kind.SCHEMA_DEFINITION,
      operationTypes: [
        {
          kind: Kind.OPERATION_TYPE_DEFINITION,
          operation: OperationTypeNode.QUERY,
          type: {
            kind: Kind.NAMED_TYPE,
            name: {
              kind: Kind.NAME,
              value: 'Query',
            },
          },
        },
        ...(outputObjectTypeNames.has('Mutation')
          ? [
              {
                kind: Kind.OPERATION_TYPE_DEFINITION as const,
                operation: OperationTypeNode.MUTATION,
                type: {
                  kind: Kind.NAMED_TYPE as const,
                  name: {
                    kind: Kind.NAME as const,
                    value: 'Mutation',
                  },
                },
              },
            ]
          : []),
      ],
    }
  }
  write(printSchema(rootNode))
  write(postamble(rootNode.operationTypes.map(o => o.operation.toString())))
  write(
    printInputTypeMap(
      schemaDefinitions.filter(def => def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) as any[]
    )
  )

  if (usesExactArgNames) {
    write(ExactArgNames)
  }

  return outputScript
}
