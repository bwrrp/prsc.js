<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [prsc](./prsc.md) &gt; [sequence](./prsc.sequence.md)

## sequence() function

Creates a parser that applies the given parsers in sequence, returning a tuple of the corresponding values if all of them accept.

This can be slightly less efficient than nesting `then` and its variations, but may be a lot more readable. If you don't care about any of the values produced, consider using `sequenceConsumed` instead.

<b>Signature:</b>

```typescript
export declare function sequence<Ts extends unknown[]>(...parsers: {
    [key in keyof Ts]: Parser<Ts[key]>;
}): Parser<Ts>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  parsers | { \[key in keyof Ts\]: [Parser](./prsc.parser.md)<!-- -->&lt;Ts\[key\]&gt;; } | Parsers to apply one after the other |

<b>Returns:</b>

[Parser](./prsc.parser.md)<!-- -->&lt;Ts&gt;
