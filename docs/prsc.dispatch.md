<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [prsc](./prsc.md) &gt; [dispatch](./prsc.dispatch.md)

## dispatch() function

Creates a parser that looks at a single codepoint to determine which parser to invoke. Can be used as an alternative to large `or` parsers if looking ahead can narrow down the options.

Can optionally look ahead further than the current codepoint, which is useful when nesting several `dispatch` parsers.

<b>Signature:</b>

```typescript
export declare function dispatch<T>(mapping: {
    [codepoint: number]: Parser<T>;
}, otherwise: Parser<T> | undefined, extraOffset?: number, expected?: string[]): Parser<T>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  mapping | { \[codepoint: number\]: [Parser](./prsc.parser.md)<!-- -->&lt;T&gt;; } | Object mapping code points to parsers |
|  otherwise | [Parser](./prsc.parser.md)<!-- -->&lt;T&gt; \| undefined | Parser to use when the code point is not found in the mapping, or undefined to reject in that situation. |
|  extraOffset | number | <i>(Optional)</i> How far ahead to look for the codepoint, defaults to 0 |
|  expected | string\[\] | <i>(Optional)</i> Expected values for parse errors generated when there is no codepoint or when the codepoint is not in the mapping and there is no <code>otherwise</code> parser |

<b>Returns:</b>

[Parser](./prsc.parser.md)<!-- -->&lt;T&gt;

