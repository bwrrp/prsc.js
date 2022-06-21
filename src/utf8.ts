import { error, ok, okWithValue, Parser } from './parser-combinators';

function getUtf8Length(cp: number): number {
	if (cp <= 0x7f) {
		return 1;
	}
	if (cp <= 0x7ff) {
		return 2;
	}
	if (cp <= 0xffff) {
		return 3;
	}
	return 4;
}

function getUtf8Codepoint(input: ArrayLike<number>, offset: number): number | undefined {
	let cp = input[offset] | 0;
	if ((cp & 0b1_0000000) === 0) {
		// one byte 1_aaaaaaa
		return cp;
	}
	const second = input[offset + 1];
	if (second === undefined) {
		return undefined;
	}
	if ((cp & 0b111_00000) === 0b110_00000) {
		// two bytes: 110_aaaaa 10_bbbbbb
		return ((cp & 0b11111) << 6) | (second & 0b111111);
	}
	const third = input[offset + 2];
	if (third === undefined) {
		return undefined;
	}
	if ((cp & 0b1111_0000) === 0b1110_0000) {
		// three bytes: 1110_aaaa 10_bbbbbb 10_cccccc
		return ((cp & 0b1111) << 12) | ((second & 0b111111) << 6) | (third & 0b111111);
	}
	const fourth = input[offset + 3];
	if (fourth === undefined) {
		return undefined;
	}
	if ((cp & 0b11111_000) === 0b11110_000) {
		// four bytes: 11110_aaa 10_bbbbbb 10_cccccc 10_dddddd
		return (
			((cp & 0b1111) << 18) |
			((second & 0b111111) << 12) |
			((third & 0b111111) << 6) |
			(fourth & 0b111111)
		);
	}
	throw new Error('invalid utf-8 character');
}

/**
 * Creates a Parser that matches the given string.
 *
 * @public
 *
 * @param token - The expected string
 */
export function tokenUtf8(token: string): Parser<string, ArrayLike<number>> {
	const encoded = Array.from(token, (c) => c.codePointAt(0)!);
	return (input, offset) => {
		const initialOffset = offset;
		for (let i = 0; i < encoded.length; ++i) {
			const cp = getUtf8Codepoint(input, offset);
			if (cp === undefined || cp !== encoded[i]) {
				return error(initialOffset, [token]);
			}
			offset += getUtf8Length(cp);
		}
		return okWithValue(offset, token);
	};
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
export function codepointUtf8(
	isMatch: (codepoint: number) => boolean,
	expected: string[]
): Parser<void, ArrayLike<number>> {
	return (input, offset) => {
		const cp = getUtf8Codepoint(input, offset);
		if (cp === undefined || !isMatch(cp)) {
			return error(offset, expected);
		}
		return ok(offset + getUtf8Length(cp));
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
export function codepointsUtf8(
	isMatch: (codepoint: number) => boolean,
	expected?: string[]
): Parser<void, ArrayLike<number>> {
	return (input, offset) => {
		const startOffset = offset;
		while (true) {
			const cp = getUtf8Codepoint(input, offset);
			if (cp === undefined) {
				break;
			}
			if (!isMatch(cp)) {
				break;
			}
			offset += getUtf8Length(cp);
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
export function rangeUtf8(
	firstCodePoint: number,
	lastCodePoint: number,
	expected?: string[]
): Parser<void, ArrayLike<number>> {
	return codepointUtf8(
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
export function skipCharsUtf8(nCodepoints: number): Parser<void, ArrayLike<number>> {
	return (input, offset) => {
		let i = nCodepoints;
		while (i > 0) {
			const cp = getUtf8Codepoint(input, offset);
			if (cp === undefined) {
				return error(offset, ['any character']);
			}
			offset += getUtf8Length(cp);
			i -= 1;
		}
		return ok(offset);
	};
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
export function recognizeUtf8<T>(
	parser: Parser<T, ArrayLike<number>>
): Parser<string, ArrayLike<number>> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return res;
		}
		const codepoints: number[] = [];
		while (offset < res.offset) {
			const cp = getUtf8Codepoint(input, offset)!;
			offset += getUtf8Length(cp);
			codepoints.push(cp);
		}
		return okWithValue(res.offset, String.fromCodePoint(...codepoints));
	};
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
export function dispatchUtf8<T>(
	mapping: { [codepoint: number]: Parser<T, ArrayLike<number>> },
	otherwise: Parser<T, ArrayLike<number>> | undefined,
	extraOffset: number = 0,
	expected: string[] = []
): Parser<T, ArrayLike<number>> {
	return (input, offset) => {
		const cp = getUtf8Codepoint(input, offset + extraOffset);
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
