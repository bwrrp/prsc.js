import {
	collect,
	consume,
	cut,
	not,
	peek,
	streaming,
	streamingComplete,
	streamingFilterUndefined,
	streamingOptional,
	streamingStar,
	streamingThen,
	token,
} from '../src';

describe('streaming combinators', () => {
	describe('streaming', () => {
		it('turns a parser into a generator', () => {
			const parser = streaming(token('a'));
			const [values, result] = collect(parser('a', 0));
			expect(values).toEqual(['a']);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(1);
		});
	});

	describe('streamingThen', () => {
		it('applies two parsers in sequence', () => {
			const parser = streamingThen(streaming(token('a')), streaming(token('b')));
			const [values, result] = collect(parser('ab', 0));
			expect(values).toEqual(['a', 'b']);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(2);
		});

		it('fails if the first parser fails', () => {
			const parser = streamingThen(streaming(token('a')), streaming(token('b')));
			const [values, result] = collect(parser('xb', 0));
			expect(values).toEqual([]);
			expect(result.success).toBe(false);
			expect(result.offset).toBe(0);
		});

		it('fails if the second parser fails', () => {
			const parser = streamingThen(streaming(token('a')), streaming(token('b')));
			const [values, result] = collect(parser('ax', 0));
			expect(values).toEqual(['a']);
			expect(result.success).toBe(false);
			expect(result.offset).toBe(1);
		});
	});

	describe('streamingFilterUndefined', () => {
		it('discards undefined values', () => {
			const parser = streamingFilterUndefined(
				streamingThen(streaming(token('a')), streaming(consume(token('b'))))
			);
			const [values, result] = collect(parser('ab', 0));
			expect(values).toEqual(['a']);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(2);
		});
	});

	describe('streamingStar', () => {
		it('repeatedly applies the parser', () => {
			const parser = streamingStar(streaming(token('a')));
			const [values, result] = collect(parser('aaaaab', 0));
			expect(values).toEqual(['a', 'a', 'a', 'a', 'a']);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(5);
		});

		it('does not yield values from partial iterations', () => {
			const parser = streamingStar(
				streamingThen(streaming(token('a')), streaming(token('b')))
			);
			const [values, result] = collect(parser('ababa', 0));
			expect(values).toEqual(['a', 'b', 'a', 'b']);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(4);
		});

		it('propagates fatal errors', () => {
			const parser = streamingStar(streaming(cut(token('a'))));
			const [values, result] = collect(parser('aab', 0));
			expect(values).toEqual(['a', 'a']);
			expect(result.success).toBe(false);
			expect(result.offset).toBe(2);
		});

		it('handles an inner parser that does not consume input', () => {
			const parser = streamingStar(streaming(peek(token('a'))));
			const [values, result] = collect(parser('a', 0));
			expect(values).toEqual(['a']);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(0);
		});
	});

	describe('streamingOptional', () => {
		it('matches the inner parser zero times', () => {
			const parser = streamingOptional(streaming(token('a')));
			const [values, result] = collect(parser('ba', 0));
			expect(values).toEqual([]);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(0);
		});

		it('matches the inner parser once', () => {
			const parser = streamingOptional(streaming(token('a')));
			const [values, result] = collect(parser('aa', 0));
			expect(values).toEqual(['a']);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(1);
		});

		it('does not yield values from partial matches', () => {
			const parser = streamingOptional(
				streamingThen(streaming(token('a')), streaming(token('b')))
			);
			const [values, result] = collect(parser('a', 0));
			expect(values).toEqual([]);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(0);
		});

		it('propagates fatal errors', () => {
			const parser = streamingOptional(streaming(cut(token('a'))));
			const [values, result] = collect(parser('ba', 0));
			expect(values).toEqual([]);
			expect(result.success).toBe(false);
			expect(result.offset).toBe(0);
		});
	});

	describe('streamingComplete', () => {
		it('accepts if the inner parser consumes the remaining input', () => {
			const parser = streamingComplete(streaming(token('a')));
			const [values, result] = collect(parser('a', 0));
			expect(values).toEqual(['a']);
			expect(result.success).toBe(true);
			expect(result.offset).toBe(1);
		});

		it('fails if the inner parser fails', () => {
			const parser = streamingComplete(streaming(token('a')));
			const [values, result] = collect(parser('b', 0));
			expect(values).toEqual([]);
			expect(result.success).toBe(false);
			expect(result.offset).toBe(0);
		});

		it('fails if not all input is consumed', () => {
			const parser = streamingComplete(streaming(token('a')));
			const [values, result] = collect(parser('aa', 0));
			expect(values).toEqual(['a']);
			expect(result.success).toBe(false);
			expect(result.offset).toBe(1);
		});
	});
});
