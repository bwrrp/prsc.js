<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [prsc](./prsc.md) &gt; [Parser](./prsc.parser.md)

## Parser type

A parser is a function that tries to match whatever it expects at the given offset in the input string. Returns a ParseResult.

<b>Signature:</b>

```typescript
export declare type Parser<T> = (input: string, offset: number) => ParseResult<T>;
```