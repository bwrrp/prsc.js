import {
	filter,
	map,
	optional,
	or,
	plus,
	star,
	then,
	token,
	not,
	recognize,
	delimited,
	cut,
	preceded,
	peek,
	complete,
	start
} from '../src/parser-combinators';

describe('parser combinators', () => {
	describe('token', () => {
		it('accepts the given token', () => {
			expect(token('a')('zzazz', 2).success).toBe(true);
			expect(token('a')('zzazz', 2).offset).toBe(3);
			expect(token('zaz')('zzazz', 1).success).toBe(true);
			expect(token('zaz')('zzazz', 1).offset).toBe(4);
			expect(token('zaz')('zzazz', 0).success).toBe(false);
			expect(token('zaz')('zzazz', 0).offset).toBe(0);
			expect(token('zaz')('zzazz', 7).success).toBe(false);
			expect(token('zaz')('zzazz', 7).offset).toBe(7);
		});
	});

	describe('map', () => {
		it("maps the inner parser's value", () => {
			const res = map(token('a'), () => 'b')('zzazz', 2);
			expect(res.success).toBe(true);
			expect((res as any).value).toBe('b');
			expect(res.offset).toBe(3);
		});

		it('propagates failure', () => {
			const mapped = map(token('a'), () => 'b');
			expect(mapped('zzazz', 0).success).toBe(false);
			expect(mapped('zzazz', 0).offset).toBe(0);
			expect(mapped('zzazz', 7).success).toBe(false);
			expect(mapped('zzazz', 7).offset).toBe(7);
		});
	});

	describe('filter', () => {
		it("checks against the inner parser's value", () => {
			const res1 = filter(token('a'), () => false, ['a'])('zzazz', 2);
			expect(res1.success).toBe(false);
			expect(res1.offset).toBe(2);

			const res2 = filter(token('a'), () => true, ['a'])('zzazz', 2);
			expect(res2.success).toBe(true);
			expect((res2 as any).value).toBe('a');
			expect(res2.offset).toBe(3);
		});

		it('replaces the expected value for child errors only if the child fails at the same offset', () => {
			const parser = filter(then(token('a'), token('b'), (a, b) => b + a), () => true, [
				'expected'
			]);
			const res1 = parser('bb', 0);
			expect(res1.success).toBe(false);
			expect(res1.offset).toBe(0);
			expect((res1 as any).expected).toEqual(['expected']);

			const res2 = parser('aa', 0);
			expect(res2.success).toBe(false);
			expect(res2.offset).toBe(1);
			expect((res2 as any).expected).toEqual(['b']);
		});
	});

	describe('or', () => {
		it('runs parsers until one matches', () => {
			const parser = or([token('a'), token('b')]);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('b', 0).success).toBe(true);
			expect(parser('c', 0).success).toBe(false);
		});

		it('never matches with no child parsers, which would be silly anyway', () => {
			const parser = or([]);
			expect(parser('a', 0).success).toBe(false);
			expect(parser('a', 0).offset).toBe(0);
			expect((parser('a', 0) as any).expected).toEqual([]);
		});

		it('combines expected values from its child parsers', () => {
			const parser = or([token('a'), token('b'), token('c')]);
			const res = parser('d', 0);
			expect(res.success).toBe(false);
			expect(res.offset).toBe(0);
			expect((res as any).expected).toEqual(['a', 'b', 'c']);
		});

		it('returns the error from the child parsers that got the furthest', () => {
			const ab = preceded(token('a'), token('b'));
			const abc = preceded(ab, token('c'));
			const ac = preceded(token('a'), token('c'));
			const parser = or([abc, ac]);
			const res = parser('abd', 0);
			expect(res.success).toBe(false);
			expect(res.offset).toBe(2);
			expect((res as any).expected).toEqual(['c']);
		});

		it('stops trying child parsers if one returns a fatal error', () => {
			const parser = or([cut(token('a')), token('b')]);
			const res = parser('b', 0);
			expect(res.success).toBe(false);
			expect(res.offset).toBe(0);
			expect((res as any).fatal).toBe(true);
			expect((res as any).expected).toEqual(['a']);
		});
	});

	describe('optional', () => {
		it('accepts both a value or its absence', () => {
			const parser = optional(token('a'));
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).value).toBe('a');
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).value).toBe(null);
		});
	});

	describe('star', () => {
		it('consumes input by running the parser 0 or more times', () => {
			const parser = star(token('a'));
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).value).toEqual([]);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).value).toEqual(['a']);
			expect(parser('aaa', 0).success).toBe(true);
			expect(parser('aaa', 0).offset).toBe(3);
			expect((parser('aaa', 0) as any).value).toEqual(['a', 'a', 'a']);
		});

		it('returns failure for fatal errors', () => {
			const parser = star(cut(token('a')));
			const res = parser('aaab', 0);
			expect(res.success).toBe(false);
			expect(res.offset).toBe(3);
			expect((res as any).expected).toEqual(['a']);
		});
	});

	describe('then', () => {
		it('runs two parsers in sequence and combines the values', () => {
			const parser = then(token('a'), token('b'), (a, b) => b + a);
			expect(parser('a', 0).success).toBe(false);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).expected).toEqual(['b']);
			expect(parser('aa', 0).success).toBe(false);
			expect(parser('aa', 0).offset).toBe(1);
			expect((parser('aa', 0) as any).expected).toEqual(['b']);
			expect(parser('b', 0).success).toBe(false);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).expected).toEqual(['a']);
			expect(parser('ab', 0).success).toBe(true);
			expect(parser('ab', 0).offset).toBe(2);
			expect((parser('ab', 0) as any).value).toBe('ba');
		});
	});

	describe('plus', () => {
		it('consumes input by running the parser 1 or more times', () => {
			const parser = plus(token('a'));
			expect(parser('b', 0).success).toBe(false);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).expected).toEqual(['a']);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).value).toEqual(['a']);
			expect(parser('aaa', 0).success).toBe(true);
			expect(parser('aaa', 0).offset).toBe(3);
			expect((parser('aaa', 0) as any).value).toEqual(['a', 'a', 'a']);
		});
	});

	describe('not', () => {
		it('fails if the inner parser matches', () => {
			const parser = not(token('a'), ['not a']);
			expect(parser('a', 0).success).toBe(false);
			expect(parser('a', 0).offset).toBe(0);
			expect((parser('a', 0) as any).expected).toEqual(['not a']);
		});

		it('succeeds without consuming input if the inner parser does not match', () => {
			const parser = not(token('a'), ['not a']);
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
		});
	});

	describe('delimited', () => {
		it('accepts if all three parsers match', () => {
			const parser = delimited(token('('), token('a'), token(')'));
			expect(parser('(a)', 0).success).toBe(true);
			const res = parser('(b)', 0);
			expect(res.success).toBe(false);
			expect(res.offset).toBe(1);
		});

		it('can optionally make errors after the first parser fatal', () => {
			const parser = optional(delimited(token('('), token('a'), token(')'), true));
			expect(parser('(a)', 0).success).toBe(true);
			expect(parser('(b)', 0).success).toBe(false);
		});
	});

	describe('recognize', () => {
		it('returns the part of the matched input accepted by the child parser', () => {
			const parser = recognize(delimited(token('{'), token('meep'), token('}')));
			const res1 = parser('{meep}', 0);
			expect(res1.success).toBe(true);
			expect(res1.offset).toBe(6);
			expect((res1 as any).value).toBe('{meep}');

			const res2 = parser('{maap}', 0);
			expect(res2.success).toBe(false);
			expect(res2.offset).toBe(1);
			expect((res2 as any).expected).toEqual(['meep']);
		});
	});

	describe('peek', () => {
		it('performs a look-ahead without consuming any actual input', () => {
			const parser = peek(token('a'));
			const res1 = parser('a', 0);
			expect(res1.success).toBe(true);
			expect(res1.offset).toBe(0);

			const res2 = parser('b', 0);
			expect(res2.success).toBe(false);
			expect(res2.offset).toBe(0);
		});
	});

	describe('start', () => {
		it('only matches at the start of the input', () => {
			const res1 = start('a', 0);
			expect(res1.success).toBe(true);
			expect(res1.offset).toBe(0);

			const res2 = start('a', 1);
			expect(res2.success).toBe(false);
			expect(res2.offset).toBe(1);
			expect((res2 as any).expected).toEqual(['start of input']);
		});
	});

	describe('complete', () => {
		it('only accepts if all input is consumed', () => {
			const parser = complete(token('a'));
			const res1 = parser('a', 0);
			expect(res1.success).toBe(true);
			expect(res1.offset).toBe(1);

			const res2 = parser('aa', 0);
			expect(res2.success).toBe(false);
			expect(res2.offset).toBe(1);
			expect((res2 as any).expected).toEqual(['end of input']);
		});
	});
});
