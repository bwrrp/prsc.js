<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [prsc](./prsc.md) &gt; [recognize](./prsc.recognize.md)

## recognize() function

Creates a parser that applies the given parser. If successful, the inner parser's value is discarded and the substring that was consumed from the input is returned as value instead. Errors are returned as-is.

<b>Signature:</b>

```typescript
export declare function recognize<T>(parser: Parser<T>): Parser<string>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  parser | [Parser](./prsc.parser.md)<!-- -->&lt;T&gt; | The parser to apply, value is discarded and replaced by the consumed input. |

<b>Returns:</b>

[Parser](./prsc.parser.md)<!-- -->&lt;string&gt;

