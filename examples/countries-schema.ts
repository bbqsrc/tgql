

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { gql } from 'graphql-tag'

const VariableName = ' $1fcbcbff-3e78-462f-b45c-668a3e09bfd8'

const ScalarBrandingField = ' $1fcbcbff-3e78-462f-b45c-668a3e09bfd9'

type CustomScalar<T> = { [ScalarBrandingField]: T }

class Variable<T, Name extends string, IsRequired extends boolean | undefined = undefined> {
  private [VariableName]: Name
  public readonly isRequired?: IsRequired
  declare private _typeMarker: T

  constructor(name: Name, isRequired?: IsRequired) {
    this[VariableName] = name
    this.isRequired = isRequired as IsRequired
  }
}

type ArrayInput<I> = [I] extends [$Atomic] ? never : ReadonlyArray<VariabledInput<I>>

type AllowedInlineScalars<S> = S extends string | number ? S : never

export type UnwrapCustomScalars<T> = T extends CustomScalar<infer S>
  ? S
  : T extends ReadonlyArray<infer I>
  ? ReadonlyArray<UnwrapCustomScalars<I>>
  : T extends Record<string, any>
  ? { [K in keyof T]: UnwrapCustomScalars<T[K]> }
  : T

type VariableWithoutScalars<T, Str extends string> = Variable<UnwrapCustomScalars<T>, Str, any>

// the array wrapper prevents distributive conditional types
// https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
type VariabledInput<T> = [T] extends [CustomScalar<infer S> | null | undefined]
  ? // scalars only support variable input
    Variable<S | null | undefined, any, any> | AllowedInlineScalars<S> | null | undefined
  : [T] extends [CustomScalar<infer S>]
  ? Variable<S, any, any> | AllowedInlineScalars<S>
  : [T] extends [$Atomic]
  ? Variable<T, any, any> | T
  : T extends ReadonlyArray<infer I>
  ? VariableWithoutScalars<T, any> | T | ArrayInput<I>
  : T extends Record<string, any> | null | undefined
  ?
      | VariableWithoutScalars<T | null | undefined, any>
      | null
      | undefined
      | { [K in keyof T]: VariabledInput<T[K]> }
      | T
  : T extends Record<string, any>
  ? VariableWithoutScalars<T, any> | { [K in keyof T]: VariabledInput<T[K]> } | T
  : never

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

/**
 * Creates a new query variable
 *
 * @param name The variable name
 */
export const $ = <Type, Name extends string>(name: Name): Variable<Type, Name, undefined> => {
  return new Variable(name, undefined)
}

/**
 * Creates a new query variable. A value will be required even if the input is optional
 *
 * @param name The variable name
 */
export const $$ = <Type, Name extends string>(name: Name): Variable<NonNullable<Type>, Name, true> => {
  return new Variable(name, true)
}

type SelectOptions = {
  argTypes?: { [key: string]: string }
  args?: { [key: string]: any }
  selection?: Selection<any>
}

class $Field<Name extends string, Type, Vars = {}> {
  public kind: 'field' = 'field'
  public type!: Type

  public vars!: Vars
  public alias: string | null = null

  constructor(public name: Name, public options: SelectOptions) {}

  as<Rename extends string>(alias: Rename): $Field<Rename, Type, Vars> {
    const f = new $Field(this.name, this.options)
    f.alias = alias
    return f as any
  }
}

class $Base<Name extends string> {
  constructor(protected $$name: Name) {}

  protected $_select<Key extends string>(
    name: Key,
    options: SelectOptions = {}
  ): $Field<Key, any, any> {
    return new $Field(name, options)
  }
}

class $Union<T, Name extends string> extends $Base<Name> {
  protected $$type!: T

  constructor(private selectorClasses: { [K in keyof T]: { new (): T[K] } }, $$name: Name) {
    super($$name)
  }

  $on<Type extends keyof T, Sel extends Selection<T[Type]>>(
    alternative: Type,
    selectorFn: (selector: T[Type]) => [...Sel]
  ): $UnionSelection<GetOutput<Sel>, GetVariables<Sel>> {
    const selection = selectorFn(new this.selectorClasses[alternative]())

    return new $UnionSelection(alternative as string, selection)
  }
}

class $Interface<T, Name extends string> extends $Base<Name> {
  protected $$type!: T

  constructor(private selectorClasses: { [K in keyof T]: { new (): T[K] } }, $$name: Name) {
    super($$name)
  }
  $on<Type extends keyof T, Sel extends Selection<T[Type]>>(
    alternative: Type,
    selectorFn: (selector: T[Type]) => [...Sel]
  ): $UnionSelection<GetOutput<Sel>, GetVariables<Sel>> {
    const selection = selectorFn(new this.selectorClasses[alternative]())

    return new $UnionSelection(alternative as string, selection)
  }
}

class $UnionSelection<T, Vars> {
  public kind: 'union' = 'union'
  protected vars!: Vars
  constructor(public alternativeName: string, public alternativeSelection: Selection<T>) {}
}

type Selection<_any> = ReadonlyArray<$Field<any, any, any> | $UnionSelection<any, any>>

type NeverNever<T> = [T] extends [never] ? {} : T

type Simplify<T> = { [K in keyof T]: T[K] } & {}

type LeafType<T> = T extends CustomScalar<infer S> ? S : T

export type GetOutput<X extends Selection<any>> = Simplify<
  UnionToIntersection<
    {
      [I in keyof X]: X[I] extends $Field<infer Name, infer Type, any>
        ? { [K in Name]: LeafType<Type> }
        : never
    }[keyof X & number]
  > &
    NeverNever<
      {
        [I in keyof X]: X[I] extends $UnionSelection<infer Type, any> ? LeafType<Type> : never
      }[keyof X & number]
    >
>

type PossiblyOptionalVar<VName extends string, VType> = null extends VType
  ? { [key in VName]?: VType }
  : { [key in VName]: VType }

type ExtractInputVariables<Inputs> = Inputs extends Variable<infer VType, infer VName, any>
  ? PossiblyOptionalVar<VName, VType>
  : // Avoid generating an index signature for possibly undefined or null inputs.
  // The compiler incorrectly infers null or undefined, and we must force access the Inputs
  // type to convince the compiler its "never", while still retaining {} as the result
  // for null and undefined cases
  // Works around issue 79
  Inputs extends null | undefined
  ? { [K in keyof Inputs]: Inputs[K] }
  : Inputs extends $Atomic
  ? {}
  : Inputs extends any[] | readonly any[]
  ? UnionToIntersection<
      { [K in keyof Inputs]: ExtractInputVariables<Inputs[K]> }[keyof Inputs & number]
    >
  : UnionToIntersection<{ [K in keyof Inputs]: ExtractInputVariables<Inputs[K]> }[keyof Inputs]>

export type GetVariables<Sel extends Selection<any>, ExtraVars = {}> = UnionToIntersection<
  {
    [I in keyof Sel]: Sel[I] extends $Field<any, any, infer Vars>
      ? Vars
      : Sel[I] extends $UnionSelection<any, infer Vars>
      ? Vars
      : never
  }[keyof Sel & number]
> &
  ExtractInputVariables<ExtraVars>

type ArgVarType = {
  type: string
  isRequired: boolean
  array: {
    isRequired: boolean
  } | null
}

const arrRegex = /\[(.*?)\]/

/**
 * Converts graphql string type to `ArgVarType`
 * @param input
 * @returns
 */
function getArgVarType(input: string): ArgVarType {
  const array = input.includes('[')
    ? {
        isRequired: input.endsWith('!'),
      }
    : null

  const type = array ? arrRegex.exec(input)![1]! : input
  const isRequired = type.endsWith('!')

  return {
    array,
    isRequired: isRequired,
    type: type.replace('!', ''),
  }
}

function fieldToQuery(prefix: string, field: $Field<any, any, any>) {
  const variables = new Map<string, { variable: Variable<any, any, any>; type: ArgVarType }>()

  function stringifyArgs(
    args: any,
    argTypes: { [key: string]: string },
    argVarType?: ArgVarType
  ): string {
    switch (typeof args) {
      case 'string': {
        const cleanType = argVarType!.type
        if ($Enums.has(cleanType!)) return args
        else return JSON.stringify(args)
      }
      case 'number':
      case 'boolean':
        return JSON.stringify(args)
      default: {
        if (args == null) return 'null'
        if (VariableName in (args as any)) {
          if (!argVarType)
            throw new globalThis.Error('Cannot use variabe as sole unnamed field argument')
          const variable = args as Variable<any, any, any>
          const argVarName = variable[VariableName]
          variables.set(argVarName, { type: argVarType, variable: variable })
          return '$' + argVarName
        }
        if (Array.isArray(args))
          return '[' + args.map(arg => stringifyArgs(arg, argTypes, argVarType)).join(',') + ']'
        const wrapped = (content: string) => (argVarType ? '{' + content + '}' : content)
        return wrapped(
          Array.from(Object.entries(args))
            .map(([key, val]) => {
              let argTypeForKey = argTypes[key]
              if (!argTypeForKey) {
                throw new globalThis.Error(`Argument type for ${key} not found`)
              }
              const cleanType = argTypeForKey.replace('[', '').replace(']', '').replace(/!/g, '')
              return (
                key +
                ':' +
                stringifyArgs(val, $InputTypes[cleanType]!, getArgVarType(argTypeForKey))
              )
            })
            .join(',')
        )
      }
    }
  }

  function extractTextAndVars(field: $Field<any, any, any> | $UnionSelection<any, any>) {
    if (field.kind === 'field') {
      let retVal = field.name
      if (field.alias) retVal = field.alias + ':' + retVal
      const args = field.options.args,
        argTypes = field.options.argTypes
      if (args && Object.keys(args).length > 0) {
        retVal += '(' + stringifyArgs(args, argTypes!) + ')'
      }
      let sel = field.options.selection
      if (sel) {
        retVal += '{'
        for (let subField of sel) {
          retVal += extractTextAndVars(subField)
        }
        retVal += '}'
      }
      return retVal + ' '
    } else if (field.kind === 'union') {
      let retVal = '... on ' + field.alternativeName + ' {'
      for (let subField of field.alternativeSelection) {
        retVal += extractTextAndVars(subField)
      }
      retVal += '}'

      return retVal + ' '
    } else {
      throw new globalThis.Error('Uknown field kind')
    }
  }

  const queryRaw = extractTextAndVars(field)!

  const queryBody = queryRaw.substring(queryRaw.indexOf('{'))

  const varList = Array.from(variables.entries())
  let ret = prefix
  if (varList.length) {
    ret +=
      '(' +
      varList
        .map(([name, { type: kind, variable }]) => {
          let type = kind.array ? '[' : ''
          type += kind.type
          if (kind.isRequired) type += '!'
          if (kind.array) type += kind.array.isRequired ? ']!' : ']'

          if (!type.endsWith('!') && variable.isRequired === true) {
            type += '!'
          }

          return '$' + name + ':' + type
        })
        .join(',') +
      ')'
  }
  ret += queryBody

  return ret
}

export type OutputTypeOf<T> = T extends $Interface<infer Subtypes, any>
  ? { [K in keyof Subtypes]: OutputTypeOf<Subtypes[K]> }[keyof Subtypes]
  : T extends $Union<infer Subtypes, any>
  ? { [K in keyof Subtypes]: OutputTypeOf<Subtypes[K]> }[keyof Subtypes]
  : T extends $Base<any>
  ? { [K in keyof T]?: OutputTypeOf<T[K]> }
  : [T] extends [$Field<any, infer FieldType, any>]
  ? FieldType
  : [T] extends [(selFn: (arg: infer Inner) => any) => any]
  ? OutputTypeOf<Inner>
  : [T] extends [(args: any, selFn: (arg: infer Inner) => any) => any]
  ? OutputTypeOf<Inner>
  : never

export type QueryOutputType<T extends TypedDocumentNode<any>> = T extends TypedDocumentNode<
  infer Out
>
  ? Out
  : never

export type QueryInputType<T extends TypedDocumentNode<any>> = T extends TypedDocumentNode<
  any,
  infer In
>
  ? In
  : never

export function fragment<T, Sel extends Selection<T>>(
  GQLType: { new (): T },
  selectFn: (selector: T) => [...Sel]
) {
  return selectFn(new GQLType())
}

type LastOf<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R
  ? R
  : never

// TS4.0+
type Push<T extends any[], V> = [...T, V]

// TS4.1+
type TuplifyUnion<T, L = LastOf<T>, N = [T] extends [never] ? true : false> = true extends N
  ? []
  : Push<TuplifyUnion<Exclude<T, L>>, L>

type AllFieldProperties<I> = {
  [K in keyof I]: I[K] extends $Field<infer Name, infer Type, any> ? $Field<Name, Type, any> : never
}

type ValueOf<T> = T[keyof T]

export type AllFields<T> = TuplifyUnion<ValueOf<AllFieldProperties<T>>>

export function all<I extends $Base<any>>(instance: I) {
  const prototype = Object.getPrototypeOf(instance)
  const allFields = Object.getOwnPropertyNames(prototype)
    .map(k => prototype[k])
    .filter(o => o?.kind === 'field')
    .map(o => o?.name) as (keyof typeof instance)[]
  return allFields.map(fieldName => instance?.[fieldName]) as any as AllFields<I>
}


type $Atomic = number | string | boolean | null | undefined

let $Enums = new Set<string>([])



export type _Any = string



export class _Entity extends $Union<{Country: Country,Continent: Continent,Language: Language}, "_Entity"> {
  constructor() {
    super({Country: Country,Continent: Continent,Language: Language}, "_Entity")
  }
}


export class _Service extends $Base<"_Service"> {
  constructor() {
    super("_Service")
  }

  
      
/**
 * The sdl representing the federated service capabilities. Includes federation
directives, removes federation types, and includes rest of full schema after
schema directives have been applied
 */
      get sdl(): $Field<"sdl", string | null>  {
       return this.$_select("sdl") as any
      }
}


export class Continent extends $Base<"Continent"> {
  constructor() {
    super("Continent")
  }

  
      
      get code(): $Field<"code", string>  {
       return this.$_select("code") as any
      }

      
      countries<Sel extends Selection<Country>>(selectorFn: (s: Country) => [...Sel]):$Field<"countries", Array<GetOutput<Sel>> , GetVariables<Sel>> {
      
      const options = {
        
        

        selection: selectorFn(new Country)
      };
      return this.$_select("countries", options as any) as any
    }
  

      
      get name(): $Field<"name", string>  {
       return this.$_select("name") as any
      }
}


export type ContinentFilterInput = {
  code?: StringQueryOperatorInput | null
}
    


export class Country extends $Base<"Country"> {
  constructor() {
    super("Country")
  }

  
      
      get capital(): $Field<"capital", string | null>  {
       return this.$_select("capital") as any
      }

      
      get code(): $Field<"code", string>  {
       return this.$_select("code") as any
      }

      
      continent<Sel extends Selection<Continent>>(selectorFn: (s: Continent) => [...Sel]):$Field<"continent", GetOutput<Sel> , GetVariables<Sel>> {
      
      const options = {
        
        

        selection: selectorFn(new Continent)
      };
      return this.$_select("continent", options as any) as any
    }
  

      
      get currency(): $Field<"currency", string | null>  {
       return this.$_select("currency") as any
      }

      
      get emoji(): $Field<"emoji", string>  {
       return this.$_select("emoji") as any
      }

      
      get emojiU(): $Field<"emojiU", string>  {
       return this.$_select("emojiU") as any
      }

      
      languages<Sel extends Selection<Language>>(selectorFn: (s: Language) => [...Sel]):$Field<"languages", Array<GetOutput<Sel>> , GetVariables<Sel>> {
      
      const options = {
        
        

        selection: selectorFn(new Language)
      };
      return this.$_select("languages", options as any) as any
    }
  

      
      get name(): $Field<"name", string>  {
       return this.$_select("name") as any
      }

      
      get native(): $Field<"native", string>  {
       return this.$_select("native") as any
      }

      
      get phone(): $Field<"phone", string>  {
       return this.$_select("phone") as any
      }

      
      states<Sel extends Selection<State>>(selectorFn: (s: State) => [...Sel]):$Field<"states", Array<GetOutput<Sel>> , GetVariables<Sel>> {
      
      const options = {
        
        

        selection: selectorFn(new State)
      };
      return this.$_select("states", options as any) as any
    }
  
}


export type CountryFilterInput = {
  code?: StringQueryOperatorInput | null,
continent?: StringQueryOperatorInput | null,
currency?: StringQueryOperatorInput | null
}
    


export class Language extends $Base<"Language"> {
  constructor() {
    super("Language")
  }

  
      
      get code(): $Field<"code", string>  {
       return this.$_select("code") as any
      }

      
      get name(): $Field<"name", string | null>  {
       return this.$_select("name") as any
      }

      
      get native(): $Field<"native", string | null>  {
       return this.$_select("native") as any
      }

      
      get rtl(): $Field<"rtl", boolean>  {
       return this.$_select("rtl") as any
      }
}


export type LanguageFilterInput = {
  code?: StringQueryOperatorInput | null
}
    


export class Query extends $Base<"Query"> {
  constructor() {
    super("Query")
  }

  
      
      _entities<Args extends VariabledInput<{
        representations: Readonly<Array<_Any>>,
      }>,Sel extends Selection<_Entity>>(args: ExactArgNames<Args, {
        representations: Readonly<Array<_Any>>,
      }>, selectorFn: (s: _Entity) => [...Sel]):$Field<"_entities", Array<GetOutput<Sel> | null> , GetVariables<Sel, Args>> {
      
      const options = {
        argTypes: {
              representations: "[_Any!]!"
            },
        args,

        selection: selectorFn(new _Entity)
      };
      return this.$_select("_entities", options as any) as any
    }
  

      
      _service<Sel extends Selection<_Service>>(selectorFn: (s: _Service) => [...Sel]):$Field<"_service", GetOutput<Sel> , GetVariables<Sel>> {
      
      const options = {
        
        

        selection: selectorFn(new _Service)
      };
      return this.$_select("_service", options as any) as any
    }
  

      
      continent<Args extends VariabledInput<{
        code: string,
      }>,Sel extends Selection<Continent>>(args: ExactArgNames<Args, {
        code: string,
      }>, selectorFn: (s: Continent) => [...Sel]):$Field<"continent", GetOutput<Sel> | null , GetVariables<Sel, Args>> {
      
      const options = {
        argTypes: {
              code: "ID!"
            },
        args,

        selection: selectorFn(new Continent)
      };
      return this.$_select("continent", options as any) as any
    }
  

      
      continents<Args extends VariabledInput<{
        filter?: ContinentFilterInput | null,
      }>,Sel extends Selection<Continent>>(args: ExactArgNames<Args, {
        filter?: ContinentFilterInput | null,
      }>, selectorFn: (s: Continent) => [...Sel]):$Field<"continents", Array<GetOutput<Sel>> , GetVariables<Sel, Args>>
continents<Sel extends Selection<Continent>>(selectorFn: (s: Continent) => [...Sel]):$Field<"continents", Array<GetOutput<Sel>> , GetVariables<Sel>>
continents(arg1: any, arg2?: any) {
      const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 };

      const options = {
        argTypes: {
              filter: "ContinentFilterInput"
            },
        args,

        selection: selectorFn(new Continent)
      };
      return this.$_select("continents", options as any) as any
    }
  

      
      countries<Args extends VariabledInput<{
        filter?: CountryFilterInput | null,
      }>,Sel extends Selection<Country>>(args: ExactArgNames<Args, {
        filter?: CountryFilterInput | null,
      }>, selectorFn: (s: Country) => [...Sel]):$Field<"countries", Array<GetOutput<Sel>> , GetVariables<Sel, Args>>
countries<Sel extends Selection<Country>>(selectorFn: (s: Country) => [...Sel]):$Field<"countries", Array<GetOutput<Sel>> , GetVariables<Sel>>
countries(arg1: any, arg2?: any) {
      const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 };

      const options = {
        argTypes: {
              filter: "CountryFilterInput"
            },
        args,

        selection: selectorFn(new Country)
      };
      return this.$_select("countries", options as any) as any
    }
  

      
      country<Args extends VariabledInput<{
        code: string,
      }>,Sel extends Selection<Country>>(args: ExactArgNames<Args, {
        code: string,
      }>, selectorFn: (s: Country) => [...Sel]):$Field<"country", GetOutput<Sel> | null , GetVariables<Sel, Args>> {
      
      const options = {
        argTypes: {
              code: "ID!"
            },
        args,

        selection: selectorFn(new Country)
      };
      return this.$_select("country", options as any) as any
    }
  

      
      language<Args extends VariabledInput<{
        code: string,
      }>,Sel extends Selection<Language>>(args: ExactArgNames<Args, {
        code: string,
      }>, selectorFn: (s: Language) => [...Sel]):$Field<"language", GetOutput<Sel> | null , GetVariables<Sel, Args>> {
      
      const options = {
        argTypes: {
              code: "ID!"
            },
        args,

        selection: selectorFn(new Language)
      };
      return this.$_select("language", options as any) as any
    }
  

      
      languages<Args extends VariabledInput<{
        filter?: LanguageFilterInput | null,
      }>,Sel extends Selection<Language>>(args: ExactArgNames<Args, {
        filter?: LanguageFilterInput | null,
      }>, selectorFn: (s: Language) => [...Sel]):$Field<"languages", Array<GetOutput<Sel>> , GetVariables<Sel, Args>>
languages<Sel extends Selection<Language>>(selectorFn: (s: Language) => [...Sel]):$Field<"languages", Array<GetOutput<Sel>> , GetVariables<Sel>>
languages(arg1: any, arg2?: any) {
      const { args, selectorFn } = !arg2 ? { args: {}, selectorFn: arg1 } : { args: arg1, selectorFn: arg2 };

      const options = {
        argTypes: {
              filter: "LanguageFilterInput"
            },
        args,

        selection: selectorFn(new Language)
      };
      return this.$_select("languages", options as any) as any
    }
  
}


export class State extends $Base<"State"> {
  constructor() {
    super("State")
  }

  
      
      get code(): $Field<"code", string | null>  {
       return this.$_select("code") as any
      }

      
      country<Sel extends Selection<Country>>(selectorFn: (s: Country) => [...Sel]):$Field<"country", GetOutput<Sel> , GetVariables<Sel>> {
      
      const options = {
        
        

        selection: selectorFn(new Country)
      };
      return this.$_select("country", options as any) as any
    }
  

      
      get name(): $Field<"name", string>  {
       return this.$_select("name") as any
      }
}


export type StringQueryOperatorInput = {
  eq?: string | null,
glob?: string | null,
in?: Readonly<Array<string | null>> | null,
ne?: string | null,
nin?: Readonly<Array<string | null>> | null,
regex?: string | null
}
    

  const $Root = {
    query: Query
  }

  namespace $RootTypes {
    export type query = Query
  }
  

export function query<Sel extends Selection<$RootTypes.query>>(
  name: string,
  selectFn: (q: $RootTypes.query) => [...Sel]
): TypedDocumentNode<GetOutput<Sel>, GetVariables<Sel>>
export function query<Sel extends Selection<$RootTypes.query>>(
  selectFn: (q: $RootTypes.query) => [...Sel]
): TypedDocumentNode<GetOutput<Sel>, Simplify<GetVariables<Sel>>>
export function query<Sel extends Selection<$RootTypes.query>>(name: any, selectFn?: any) {
  if (!selectFn) {
    selectFn = name
    name = ''
  }
  let field = new $Field<'query', GetOutput<Sel>, GetVariables<Sel>>('query', {
    selection: selectFn(new $Root.query()),
  })
  const str = fieldToQuery(`query ${name}`, field)

  return gql(str) as any
}


const $InputTypes: {[key: string]: {[key: string]: string}} = {
    ContinentFilterInput: {
    code: "StringQueryOperatorInput"
  },
  CountryFilterInput: {
    code: "StringQueryOperatorInput",
continent: "StringQueryOperatorInput",
currency: "StringQueryOperatorInput"
  },
  LanguageFilterInput: {
    code: "StringQueryOperatorInput"
  },
  StringQueryOperatorInput: {
    eq: "String",
glob: "String",
in: "[String]",
ne: "String",
nin: "[String]",
regex: "String"
  }
}

// We use a dummy conditional type that involves GenericType to defer the compiler's inference of
// any possible variables nested in this type. This addresses a problem where variables are
// inferred with type unknown
type ExactArgNames<GenericType, Constraint> = GenericType extends never
  ? never
  : GenericType extends Variable<any, any, any>
  ? GenericType
  : [Constraint] extends [$Atomic | CustomScalar<any>]
  ? GenericType
  : Constraint extends ReadonlyArray<infer InnerConstraint>
  ? GenericType extends ReadonlyArray<infer Inner>
    ? ReadonlyArray<ExactArgNames<Inner, InnerConstraint>>
    : GenericType
  : GenericType & {
      [Key in keyof GenericType]: Key extends keyof Constraint
        ? ExactArgNames<GenericType[Key], Constraint[Key]>
        : never
    }
