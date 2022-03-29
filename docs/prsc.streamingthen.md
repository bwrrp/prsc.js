<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [prsc](./prsc.md) &gt; [streamingThen](./prsc.streamingthen.md)

## streamingThen() function

Creates a StreamingParser which applies the given two StreamingParsers in sequence.

Unlike `then`<!-- -->, this does not combine values using a function, but instead simply yields the values produced by both parsers as they produce them.

<b>Signature:</b>

```typescript
export declare function streamingThen<T, U>(parser1: StreamingParser<T>, parser2: StreamingParser<U>): StreamingParser<T | U>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  parser1 | [StreamingParser](./prsc.streamingparser.md)<!-- -->&lt;T&gt; | First StreamingParser to apply |
|  parser2 | [StreamingParser](./prsc.streamingparser.md)<!-- -->&lt;U&gt; | StreamingParser to apply if the first one is successful |

<b>Returns:</b>

[StreamingParser](./prsc.streamingparser.md)<!-- -->&lt;T \| U&gt;
