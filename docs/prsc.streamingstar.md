<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [prsc](./prsc.md) &gt; [streamingStar](./prsc.streamingstar.md)

## streamingStar() function

Creates a StreamingParser that tries to apply the given StreamingParser zero or more times in sequence. Values produced during each iteration are only yielded whenever the inner parser matches successfully.

<b>Signature:</b>

```typescript
export declare function streamingStar<T>(parser: StreamingParser<T>): StreamingParser<T>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  parser | [StreamingParser](./prsc.streamingparser.md)<!-- -->&lt;T&gt; | StreamingParser to apply repeatedly |

<b>Returns:</b>

[StreamingParser](./prsc.streamingparser.md)<!-- -->&lt;T&gt;

