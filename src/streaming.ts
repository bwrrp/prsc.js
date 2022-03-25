import { end, ok, Parser, ParseResult } from './parser-combinators';

/**
 * Helper to collect both the yielded values and the returned value from a generator.
 *
 * @public
 *
 * @param gen - Generator to collect from
 */
export function collect<T, R>(gen: Generator<T, R>): [T[], R] {
	const values: T[] = [];
	let it = gen.next();
	while (!it.done) {
		values.push(it.value);
		it = gen.next();
	}
	return [values, it.value];
}

/**
 * A StreamingParser is similar to a Parser, but instead of returning a value when parsing is
 * complete it can parse incrementally and yield values as they are produced. The generator returns
 * a ParseResult when iteration is done which indicates whether parsing was successful.
 *
 * @public
 */
export type StreamingParser<T> = (
	input: string,
	offset: number
) => Generator<T, ParseResult<unknown>>;

/**
 * Creates a StreamingParser which applies the given Parser and yields the value produced if it
 * matches.
 *
 * @public
 *
 * @param parser - The Parser to apply
 */
export function streaming<T>(parser: Parser<T>): StreamingParser<T> {
	return function* (input: string, offset: number) {
		const res = parser(input, offset);
		if (res.success) {
			yield res.value;
		}
		return res;
	};
}

/**
 * Creates a StreamingParser which applies the given two StreamingParsers in sequence.
 *
 * Unlike `then`, this does not combine values using a function, but instead simply yields the
 * values produced by both parsers as they produce them.
 *
 * @public
 *
 * @param parser1 - First StreamingParser to apply
 * @param parser2 - StreamingParser to apply if the first one is successful
 */
export function streamingThen<T, U>(
	parser1: StreamingParser<T>,
	parser2: StreamingParser<U>
): StreamingParser<T | U> {
	return function* (input: string, offset: number) {
		const res1 = yield* parser1(input, offset);
		if (!res1.success) {
			return res1;
		}
		return yield* parser2(input, res1.offset);
	};
}

/**
 * Creates a StreamingParser which discards undefined values yielded by the given StreamingParser.
 *
 * @public
 *
 * @param parser - The StreamingParser to filter
 */
export function streamingFilterUndefined<T>(parser: StreamingParser<T | void>): StreamingParser<T> {
	return function* (input: string, offset: number) {
		const gen = parser(input, offset);
		let it = gen.next();
		while (!it.done) {
			const value = it.value;
			if (value !== undefined) {
				yield value;
			}
			it = gen.next();
		}
		return it.value;
	};
}

/**
 * Creates a StreamingParser that tries to apply the given StreamingParser zero or more times in
 * sequence. Values produced during each iteration are only yielded whenever the inner parser
 * matches successfully.
 *
 * @public
 *
 * @param parser - StreamingParser to apply repeatedly
 */
export function streamingStar<T>(parser: StreamingParser<T>): StreamingParser<T> {
	return function* (input: string, offset: number) {
		while (true) {
			const [values, result] = collect(parser(input, offset));
			if (!result.success) {
				if (result.fatal) {
					return result;
				}
				return ok(offset);
			}

			yield* values;

			if (offset === result.offset) {
				// Did not advance
				return ok(offset);
			}
			offset = result.offset;
		}
	};
}

/**
 * Creates a StreamingParser that tries to apply the given parser optionally. It only yields the
 * values produced by the inner parser if it matches successfully, and does not yield anything
 * otherwise.
 *
 * @public
 *
 * @param parser - StreamingParser to attempt to apply
 */
export function streamingOptional<T>(parser: StreamingParser<T>): StreamingParser<T> {
	return function* (input: string, offset: number) {
		const [values, result] = collect(parser(input, offset));
		if (!result.success) {
			if (result.fatal) {
				return result;
			}
			return ok(offset);
		}

		yield* values;

		return result;
	};
}

/**
 * Creates a StreamingParser that applies the given parser and directly yields values produced by
 * it, and then only succeeds if parsing concludes at the end of the input string.
 *
 * @public
 *
 * @param parser - StreamingParser to apply
 */
export function streamingComplete<T>(parser: StreamingParser<T>): StreamingParser<T> {
	return function* (input: string, offset: number) {
		const res = yield* parser(input, offset);
		if (!res.success) {
			return res;
		}
		return end(input, res.offset);
	};
}
