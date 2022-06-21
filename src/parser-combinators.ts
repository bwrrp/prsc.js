/**
 * The result of parsing - either success (with an offset at which to resume parsing the next thing)
 * or failure. If a failure is fatal, parsing should not continue to try alternative options.
 *
 * A ParseResult may contain a value that represents the parsed input.
 *
 * @public
 */
export type ParseResult<T> =
	| { success: true; offset: number; value: T }
	| { success: false; offset: number; expected: string[]; fatal: boolean };

/**
 * A parser is a function that tries to match whatever it expects at the given offset in the input
 * string. Returns a ParseResult.
 *
 * @public
 */
export type Parser<T> = (input: string, offset: number) => ParseResult<T>;

/**
 * Creates a successful ParseResult containing the given value.
 *
 * @public
 *
 * @param offset - The offset in the input at which to continue parsing
 * @param value  - The value resulting from applying the parser
 */
export function okWithValue<T>(offset: number, value: T): ParseResult<T> {
	return { success: true, offset, value };
}

/**
 * Creates a successful ParseResult with an undefined value. Use this to signal success in cases
 * where no value is required.
 *
 * @public
 *
 * @param offset - The offset in the input at which to continue parsing
 */
export function ok(offset: number): ParseResult<undefined> {
	return okWithValue(offset, undefined);
}

/**
 * Creates an unsuccessful ParseResult (parse error) at the given offset.
 *
 * @public
 *
 * @param offset   - The offset in the input at which matching failed
 * @param expected - An array of strings indicating things that were expected at offset
 * @param fatal    - If true, no other branches should be tried as a result of this error
 */
export function error<T>(
	offset: number,
	expected: string[],
	fatal: boolean = false
): ParseResult<T> {
	return { success: false, offset, expected, fatal };
}

/**
 * Creates a Parser that matches the given string.
 *
 * @public
 *
 * @param token - The expected string
 */
export function token(token: string): Parser<string> {
	return (input, offset) => {
		const offsetAfter = offset + token.length;
		if (input.slice(offset, offsetAfter) === token) {
			return okWithValue(offsetAfter, token);
		}
		return error(offset, [token]);
	};
}

function lengthFromCodePoint(cp: number): number {
	return cp > 0xffff ? 2 : 1;
}

/**
 * Creates a Parser that skips the next code point if the given predicate returns true.
 *
 * This counts in unicode characters (code points), not UTF-16 code units.
 *
 * To match a sequence of code points, consider using `codepoints` instead.
 *
 * @public
 *
 * @param isMatch  - callback called with the next codepoint, should return whether that matches
 * @param expected - expected strings to return if the codepoint does not match
 */
export function codepoint(
	isMatch: (codepoint: number) => boolean,
	expected: string[]
): Parser<void> {
	return (input: string, offset: number) => {
		const cp = input.codePointAt(offset);
		if (cp === undefined || !isMatch(cp)) {
			return error(offset, expected);
		}
		return ok(offset + lengthFromCodePoint(cp));
	};
}

/**
 * Creates a Parser that skips code points while the given predicate returns true.
 *
 * This counts in unicode characters (code points), not UTF-16 code units.
 *
 * This acts like `starConsumed(codepoint(isMatch, []))` if expected is not set, or as
 * `plusConsumed(codepoint(isMatch, expected))` if it is, but is much more efficient than either of
 * those combinations.
 *
 * @public
 *
 * @param isMatch  - callback called for each codepoint, should return whether that matches
 * @param expected - expected strings to return if the first codepoint does not match
 */
export function codepoints(
	isMatch: (codepoint: number) => boolean,
	expected?: string[]
): Parser<void> {
	return (input: string, offset: number) => {
		const startOffset = offset;
		while (true) {
			const cp = input.codePointAt(offset);
			if (cp === undefined) {
				break;
			}
			if (!isMatch(cp)) {
				break;
			}
			offset += cp > 0xffff ? 2 : 1;
		}
		if (expected !== undefined && offset === startOffset) {
			return error(offset, expected);
		}
		return ok(offset);
	};
}

/**
 * Creates a Parser that matches a single character from a range of codepoints.
 *
 * Use `recognize` if you need the character that was matched.
 *
 * @public
 *
 * @param firstCodePoint - The first code point to accept
 * @param lastCodePoint  - The last code point to accept (inclusive)
 */
export function range(
	firstCodePoint: number,
	lastCodePoint: number,
	expected?: string[]
): Parser<void> {
	return codepoint(
		(cp) => firstCodePoint <= cp && cp <= lastCodePoint,
		expected || [
			`${String.fromCodePoint(firstCodePoint)}-${String.fromCodePoint(lastCodePoint)}`,
		]
	);
}

/**
 * Creates a Parser that skips the given number of characters.
 *
 * This counts in unicode characters (code points), not UTF-16 code units.
 *
 * @public
 *
 * @param nCodepoints - number of characters to skip
 */
export function skipChars(nCodepoints: number): Parser<void> {
	return (input: string, offset: number) => {
		let i = nCodepoints;
		while (i > 0) {
			const cp = input.codePointAt(offset);
			if (cp === undefined) {
				return error(offset, ['any character']);
			}
			offset += lengthFromCodePoint(cp);
			i -= 1;
		}
		return ok(offset);
	};
}

/**
 * Creates a Parser that applies the given function to each value generated by the given parser.
 *
 * @public
 *
 * @param parser - Parser to map over
 * @param map    - Function to transform values generated by parser
 */
export function map<T, U>(parser: Parser<T>, map: (v: T) => U): Parser<U> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return res;
		}
		return okWithValue(res.offset, map(res.value));
	};
}

/**
 * Creates a Parser that applies the given parser but discards the resulting value.
 *
 * @public
 *
 * @param parser - Parser to apply
 */
export function consume<T>(parser: Parser<T>): Parser<void> {
	return map(parser, () => undefined);
}

/**
 * Creates a Parser that uses the given filter predicate to check values generated by the given
 * parser. Values that pass the predicate are passed through, those that don't return a parse error
 * instead.
 *
 * @public
 *
 * @param parser   - Parser to filter
 * @param filter   - Predicate function over the inner parser's values
 * @param expected - Expected values for parse errors generated when the filter rejects a value
 * @param fatal    - Whether the error returned when the filter rejects should be fatal
 */
export function filter<T>(
	parser: Parser<T>,
	filter: (v: T) => boolean,
	expected: string[],
	fatal?: boolean
): Parser<T> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return res;
		}
		if (!filter(res.value)) {
			return error(offset, expected, fatal);
		}
		return res;
	};
}

/**
 * Creates a Parser that applies each of the given parsers in turn until one matches, then returns
 * that parser's result. If no parser matches, an error is returned reflecting the furthest offset
 * reached in the input string. If any parser returns a fatal error, no further branches are tried.
 *
 * @public
 *
 * @param parsers  - Parsers to attempt to apply
 * @param expected - Overrides the expected value used if none of the inner parsers match
 */
export function or<T>(parsers: Parser<T>[], expected?: string[]): Parser<T> {
	return (input, offset) => {
		let lastError: ParseResult<T> | null = null;
		for (const parser of parsers) {
			const res = parser(input, offset);
			if (res.success) {
				return res;
			}

			if (lastError === null || res.offset > lastError.offset) {
				lastError = res;
			} else if (res.offset === lastError.offset && expected === undefined) {
				lastError.expected = lastError.expected.concat(res.expected);
			}
			if (res.fatal) {
				return res;
			}
		}
		expected = expected || lastError?.expected || [];
		if (lastError) {
			lastError.expected = expected;
		}
		return lastError || error(offset, expected);
	};
}

/**
 * Creates a Parser that tries to apply the given parser optionally. It returns the inner parser's
 * result if succesful, and otherwise indicates success at the starting offset with a `null` value.
 *
 * If the inner parser returns a fatal failure, the error is returned as-is.
 *
 * @public
 *
 * @param parser - Parser to attempt to apply
 */
export function optional<T>(parser: Parser<T>): Parser<T | null> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success && !res.fatal) {
			return okWithValue(offset, null);
		}

		return res;
	};
}

/**
 * Creates a Parser that tries to apply the given parser zero or more times in sequence. Values for
 * successful matches are collected in an array. Once the inner parser no longer matches, success is
 * returned at the offset reached with the accumulated values.
 *
 * If the inner parser returns a fatal failure, the error is returned as-is.
 *
 * @public
 *
 * @param parser - Parser to apply repeatedly
 */
export function star<T>(parser: Parser<T>): Parser<T[]> {
	return (input, offset) => {
		let ts: T[] = [];
		let nextOffset = offset;
		while (true) {
			const res = parser(input, nextOffset);
			if (!res.success) {
				if (res.fatal) {
					return res;
				}
				break;
			}
			ts.push(res.value);
			if (res.offset === nextOffset) {
				// Did not advance
				break;
			}
			nextOffset = res.offset;
		}

		return okWithValue(nextOffset, ts);
	};
}

/**
 * Creates a Parser that tries to apply the given parser zero or more times in sequence. Values for
 * successful matches are discarded. Once the inner parser no longer matches, success is returned at
 * the offset reached.
 *
 * If the inner parser returns a fatal failure, the error is returned as-is.
 *
 * @public
 *
 * @param parser - Parser to apply repeatedly
 */
export function starConsumed<T>(parser: Parser<T>): Parser<void> {
	return (input, offset) => {
		let nextOffset = offset;
		while (true) {
			const res = parser(input, nextOffset);
			if (!res.success) {
				if (res.fatal) {
					return res;
				}
				break;
			}
			if (res.offset === nextOffset) {
				// Did not advance
				break;
			}
			nextOffset = res.offset;
		}

		return ok(nextOffset);
	};
}

/**
 * Creates a parser that discards undefined values from the array produced by the
 * given parser.
 *
 * Useful in combination with `star`, `or` and `consume`:
 *
 * ```
 * const a: Parser<string> = token('a');
 * const b: Parser<void> = consume(token('b'));
 * const abs: Parser<(string | void)[]> = star(or<string | void>([a, b]));
 * const as: Parser<string[]> = filterUndefined(abs);
 * ```
 *
 * @public
 *
 * @param parser - Parser to apply, should produce an array that may contain undefined entries.
 */
export function filterUndefined<T>(parser: Parser<(T | void)[]>): Parser<T[]> {
	return map(parser, (vs) => vs.filter((v) => v !== undefined) as T[]);
}

/**
 * Creates a Parser that applies the given two parsers in sequence, returning success only if both
 * succeed. The given join function is used to combine the values from both parsers into the single
 * value to return. If either parser fails, the failure is returned as-is.
 *
 * @public
 *
 * @param parser1 - First parser to apply
 * @param parser2 - Parser to apply after the first one is successful
 * @param join    - Function used to combine the values of both parsers
 */
export function then<T1, T2, T>(
	parser1: Parser<T1>,
	parser2: Parser<T2>,
	join: (value1: T1, value2: T2) => T
): Parser<T> {
	return (input, offset) => {
		const r1 = parser1(input, offset);
		if (!r1.success) {
			return r1;
		}
		const r2 = parser2(input, r1.offset);
		if (!r2.success) {
			return r2;
		}
		return okWithValue(r2.offset, join(r1.value, r2.value));
	};
}

/**
 * Creates a Parser that tries to apply the given parser one or more times in sequence. Values for
 * successful matches are collected in an array. Once the inner parser no longer matches, success is
 * returned at the offset reached with the accumulated values. The parser is required to match at
 * least once, so an initial failure is returned as-is.
 *
 * If the inner parser returns a fatal failure, the error is returned as-is.
 *
 * @public
 *
 * @param parser - The parser to apply repeatedly
 */
export function plus<T>(parser: Parser<T>): Parser<T[]> {
	return then(parser, star(parser), (v, vs) => [v].concat(vs));
}

/**
 * Returns the first of the given two arguments. Useful as a `join` function for `then`. See also
 * `followed`.
 *
 * @public
 *
 * @param x - Argument to return
 * @param y - Argument to ignore
 */
export function first<T1, T2>(x: T1, y: T2): T1 {
	return x;
}

/**
 * Returns the second of the given two arguments. Useful as a `join` function for `then`. See also
 * `preceded`.
 *
 * @public
 *
 * @param x - Argument to ignore
 * @param y - Argument to return
 */
export function second<T1, T2>(x: T1, y: T2): T2 {
	return y;
}

/**
 * Creates a Parser that tries to apply the given parser one or more times in sequence. Values for
 * successful matches are discarded. Once the inner parser no longer matches, success is returned at
 * the offset reached. The parser is required to match at least once, so an initial failure is
 * returned as-is.
 *
 * If the inner parser returns a fatal failure, the error is returned as-is.
 *
 * @public
 *
 * @param parser - The parser to apply repeatedly
 */
export function plusConsumed<T>(parser: Parser<T>): Parser<void> {
	return then(parser, starConsumed(parser), second);
}

/**
 * Creates a Parser that applies the given two parsers in sequence, returning the result of the
 * second if the first succeeds.
 *
 * Equivalent to `then(before, parser, second)`.
 *
 * @public
 *
 * @param before - First parser to apply, value is discarded
 * @param parser - Second parser to apply, value is kept
 */
export function preceded<TBefore, T>(before: Parser<TBefore>, parser: Parser<T>): Parser<T> {
	return then(before, parser, second);
}

/**
 * Creates a Parser that applies the given two parsers in sequence, returning the result value of
 * the first at the offset of the second if both succeed. If either parser fails the error is
 * returned as-is.
 *
 * Equivalent to `then(parser, after, first)`.
 *
 * @public
 *
 * @param parser - First parser to apply, value is kept
 * @param before - Second parser to apply, value is discarded
 */
export function followed<T, TAfter>(parser: Parser<T>, after: Parser<TAfter>): Parser<T> {
	return then(parser, after, first);
}

/**
 * Creates a Parser that applies the given parsers in sequence, returning the result value of the
 * middle parser at the offset of the third if all are successful. If any parser fails, the error is
 * returned as-is.
 *
 * Optionally makes errors by the second and third parsers fatal if `cutAfterOpen` is `true`.
 *
 * @public
 *
 * @param open         - First parser to apply, value is discarded
 * @param inner        - Second parser to apply, value is kept
 * @param close        - Third parser to apply, value is discarded
 * @param cutAfterOpen - If `true`, errors returned by the second and third parsers are considered
 *                       fatal, causing parsers using this to stop trying other branches.
 */
export function delimited<TOpen, T, TClose>(
	open: Parser<TOpen>,
	inner: Parser<T>,
	close: Parser<TClose>,
	cutAfterOpen: boolean = false
): Parser<T> {
	const rest = cutAfterOpen ? cut(followed(inner, close)) : followed(inner, close);
	return preceded(open, rest);
}

/**
 * Creates a Parser that applies the given parser. If successful, the inner parser's value is
 * discarded and the substring that was consumed from the input is returned as value instead. Errors
 * are returned as-is.
 *
 * When using this in combination with `star` or `plus`, consider using `starConsumed` or
 * `plusConsumed` instead for efficiency.
 *
 * @public
 *
 * @param parser - The parser to apply, value is discarded and replaced by the consumed input.
 */
export function recognize<T>(parser: Parser<T>): Parser<string> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return res;
		}
		return okWithValue(res.offset, input.slice(offset, res.offset));
	};
}

/**
 * Creates a Parser that applies the given parser without consuming any input. That is, if the inner
 * parser is successful, success is returned (with the resulting value) at the starting offset,
 * effectively making the parser consume no input.
 *
 * Errors returned by the inner parser are returned as-is.
 *
 * @public
 *
 * @param parser - The parser to apply, value is discarded and any progress made in input is reset.
 */
export function peek<T>(parser: Parser<T>): Parser<T> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return res;
		}
		return okWithValue(offset, res.value);
	};
}

/**
 * Creates a Parser that succeeds at the starting offset if the given parser fails and vice-versa.
 *
 * @public
 *
 * @param parser   - The parser to apply
 * @param expected - Expected values for parse errors generated when the inner parser succeeds
 */
export function not<T>(parser: Parser<T>, expected: string[]): Parser<void> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return ok(offset);
		}
		return error(offset, expected);
	};
}

/**
 * Creates a Parser that matches only if the first Parser matches input at the starting position,
 * but the second Parser does not.
 *
 * @public
 *
 * @param match    - Parser that should match
 * @param except   - Parser that should not match
 * @param expected - Expected values for parse errors generated when the except parser succeeds
 */
export function except<T, U>(match: Parser<T>, except: Parser<U>, expected: string[]): Parser<T> {
	return preceded(not(except, expected), match);
}

/**
 * Creates a parser that looks at a single codepoint to determine which parser to invoke. Can be
 * used as an alternative to large `or` parsers if looking ahead can narrow down the options.
 *
 * Can optionally look ahead further than the current codepoint, which is useful when nesting
 * several `dispatch` parsers.
 *
 * @public
 *
 * @param mapping     - Object mapping code points to parsers
 * @param otherwise   - Parser to use when the code point is not found in the mapping, or undefined
 *                      to reject in that situation.
 * @param extraOffset - How far ahead to look for the codepoint, defaults to 0
 * @param expected    - Expected values for parse errors generated when there is no codepoint or
 *                      when the codepoint is not in the mapping and there is no `otherwise` parser
 */
export function dispatch<T>(
	mapping: { [codepoint: number]: Parser<T> },
	otherwise: Parser<T> | undefined,
	extraOffset: number = 0,
	expected: string[] = []
): Parser<T> {
	return (input, offset) => {
		const cp = input.codePointAt(offset + extraOffset);
		if (cp === undefined) {
			return error(offset, expected);
		}
		const parser = mapping[cp];
		if (parser === undefined) {
			if (otherwise === undefined) {
				return error(offset, expected);
			}
			return otherwise(input, offset);
		}
		return parser(input, offset);
	};
}

/**
 * Creates a Parser that turns errors returned by the inner parser into fatal errors. Parsers such
 * as `or` and `star` will not continue to attempt additional matches if a parser returns a fatal
 * error, and will usually return the error instead.
 *
 * @public
 *
 * @param parser - The parser to wrap
 */
export function cut<T>(parser: Parser<T>): Parser<T> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return error(res.offset, res.expected, true);
		}
		return res;
	};
}

/**
 * A parser that only succeeds at the start of the input string.
 *
 * @public
 *
 * @param input  - The input to match in
 * @param offset - The offset in `input` at which to start matching
 */
export const start: Parser<void> = (_input, offset) =>
	offset === 0 ? ok(offset) : error(offset, ['start of input']);

/**
 * A parser that only succeeds if the end of the input string is reached.
 *
 * @public
 *
 * @param input  - The input to match in
 * @param offset - The offset in `input` at which to start matching
 */
export const end: Parser<void> = (input, offset) =>
	input.length === offset ? ok(offset) : error(offset, ['end of input']);

/**
 * Creates a Parser that applies the given parser and only succeeds (returning the inner parser's
 * result) if parsing concludes at the end of the input string.
 *
 * @public
 *
 * @param parser - The parser to wrap
 */
export function complete<T>(parser: Parser<T>): Parser<T> {
	return then(parser, end, first);
}
