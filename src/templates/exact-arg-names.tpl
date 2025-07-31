// We use a dummy conditional type that involves GenericType to defer the compiler's inference of
// any possible variables nested in this type. This addresses a problem where variables are
// inferred with type unknown
type ExactArgNames<GenericType, Constraint> = GenericType extends never ? never
  : GenericType extends Variable<any, any, any> ? GenericType
  : [Constraint] extends [$Atomic | CustomScalar<any>] ? GenericType
  : Constraint extends ReadonlyArray<infer InnerConstraint>
    ? GenericType extends ReadonlyArray<infer Inner> ? ReadonlyArray<ExactArgNames<Inner, InnerConstraint>>
    : GenericType
  :
    & GenericType
    & {
      [Key in keyof GenericType]: Key extends keyof Constraint ? ExactArgNames<GenericType[Key], Constraint[Key]>
        : never
    }
