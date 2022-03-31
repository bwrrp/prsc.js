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
	start,
	range,
	skipChars,
	consume,
	except,
	filterUndefined,
	followed,
	starConsumed,
	plusConsumed,
	codepoint,
	codepoints,
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

	describe('codepoint', () => {
		it('skips a codepoint if it matches', () => {
			expect(codepoint(() => true, [])('a', 0).success).toBe(true);
			expect(codepoint(() => true, [])('a', 0).offset).toBe(1);
		});

		it('returns expected if it does not', () => {
			expect(codepoint(() => false, ['expected'])('a', 0).success).toBe(false);
			expect(codepoint(() => false, ['expected'])('a', 0).offset).toBe(0);
			expect((codepoint(() => false, ['expected'])('a', 0) as any).expected).toEqual([
				'expected',
			]);
		});
	});

	describe('codepoints', () => {
		it('skips codepoints while they match', () => {
			const parser = codepoints((cp) => cp === 'a'.codePointAt(0));
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect(parser('aaab', 0).success).toBe(true);
			expect(parser('aaab', 0).offset).toBe(3);
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
		});

		it('handles surrogate pairs', () => {
			const parser = codepoints((cp) => cp > 0x10000);
			expect(parser('\u{1f4a9}b', 0).success).toBe(true);
			expect(parser('\u{1f4a9}b', 0).offset).toBe(2);
		});

		it('needs to match at least one if expected is provided', () => {
			const parser = codepoints((cp) => cp === 'a'.codePointAt(0), ['expected']);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect(parser('b', 0).success).toBe(false);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).expected).toEqual(['expected']);
		});
	});

	describe('range', () => {
		it('accepts one from a range of unicode characters', () => {
			expect(range('a'.codePointAt(0)!, 'z'.codePointAt(0)!)('q', 0).success).toBe(true);
			expect(range('a'.codePointAt(0)!, 'z'.codePointAt(0)!)('q', 0).offset).toBe(1);
			expect(range(0x10000, 0x10ffff)('\u{1f4a9}', 0).success).toBe(true);
			expect(range(0x10000, 0x10ffff)('\u{1f4a9}', 0).offset).toBe(2);
			expect(range(0x10000, 0x10ffff)('a', 0).success).toBe(false);
			expect(range(0x10000, 0x10ffff)('a', 0).offset).toBe(0);
		});
	});

	describe('skipChars', () => {
		it('skips the given number of code points, if they exist', () => {
			expect(skipChars(1)('a', 0).success).toBe(true);
			expect(skipChars(1)('a', 0).offset).toBe(1);
			expect(skipChars(2)('a', 0).success).toBe(false);
			expect(skipChars(2)('a', 0).offset).toBe(1);
			expect(skipChars(1)('\u{1f4a9}', 0).success).toBe(true);
			expect(skipChars(1)('\u{1f4a9}', 0).offset).toBe(2);
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

	describe('consume', () => {
		it("discards the inner parser's value", () => {
			const res = consume(token('a'))('zzazz', 2);
			expect(res.success).toBe(true);
			expect((res as any).value).toBe(undefined);
			expect(res.offset).toBe(3);
		});

		it('propagates failure', () => {
			const consumed = consume(token('a'));
			expect(consumed('zzazz', 0).success).toBe(false);
			expect(consumed('zzazz', 0).offset).toBe(0);
			expect(consumed('zzazz', 7).success).toBe(false);
			expect(consumed('zzazz', 7).offset).toBe(7);
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

		it('retains the expected value for child errors if the inner parser fails', () => {
			const parser = filter(
				then(token('a'), token('b'), (a, b) => b + a),
				() => true,
				['expected']
			);
			const res1 = parser('bb', 0);
			expect(res1.success).toBe(false);
			expect(res1.offset).toBe(0);
			expect((res1 as any).expected).toEqual(['a']);

			const res2 = parser('aa', 0);
			expect(res2.success).toBe(false);
			expect(res2.offset).toBe(1);
			expect((res2 as any).expected).toEqual(['b']);
		});

		it('returns the given expected value if the filter rejects', () => {
			const parser = filter(token('a'), (a) => false, ['expected']);
			const res1 = parser('a', 0);
			expect(res1.success).toBe(false);
			expect(res1.offset).toBe(0);
			expect((res1 as any).expected).toEqual(['expected']);
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
			const parser = or([followed(token('b'), token('c')), cut(token('a')), token('b')]);
			const res = parser('b', 0);
			expect(res.success).toBe(false);
			// Fatal error takes priority over a non-fatal failed parser that made it further
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

		it('does not end up in an infinite loop if the inner parser does not consume input', () => {
			const parser = star(not(token('a'), ['not a']));
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).value).toEqual([undefined]);
		});

		it('returns failure for fatal errors', () => {
			const parser = star(cut(token('a')));
			const res = parser('aaab', 0);
			expect(res.success).toBe(false);
			expect(res.offset).toBe(3);
			expect((res as any).expected).toEqual(['a']);
		});
	});

	describe('starConsumed', () => {
		it('consumes input by running the parser 0 or more times', () => {
			const parser = starConsumed(token('a'));
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).value).toBe(undefined);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).value).toBe(undefined);
			expect(parser('aaa', 0).success).toBe(true);
			expect(parser('aaa', 0).offset).toBe(3);
			expect((parser('aaa', 0) as any).value).toBe(undefined);
		});

		it('does not end up in an infinite loop if the inner parser does not consume input', () => {
			const parser = starConsumed(not(token('a'), ['not a']));
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).value).toBe(undefined);
		});

		it('returns failure for fatal errors', () => {
			const parser = starConsumed(cut(token('a')));
			const res = parser('aaab', 0);
			expect(res.success).toBe(false);
			expect(res.offset).toBe(3);
			expect((res as any).expected).toEqual(['a']);
		});
	});

	describe('filterUndefined', () => {
		it('discards undefined values from the array produced by the inner parser', () => {
			const a = token('a');
			const b = consume(token('b'));
			const abs = star(or<string | void>([a, b]));
			const as = filterUndefined(abs);
			expect(as('ababab', 0).success).toBe(true);
			expect(as('ababab', 0).offset).toBe(6);
			expect((as('ababab', 0) as any).value).toEqual(['a', 'a', 'a']);
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

	describe('plusConsumed', () => {
		it('consumes input by running the parser 1 or more times', () => {
			const parser = plusConsumed(token('a'));
			expect(parser('b', 0).success).toBe(false);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).expected).toEqual(['a']);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).value).toBe(undefined);
			expect(parser('aaa', 0).success).toBe(true);
			expect(parser('aaa', 0).offset).toBe(3);
			expect((parser('aaa', 0) as any).value).toBe(undefined);
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

	describe('except', () => {
		it('fails if the first parser fails', () => {
			const parser = except(token('b'), token('c'), ['b not c']);
			expect(parser('a', 0).success).toBe(false);
			expect(parser('a', 0).offset).toBe(0);
			expect((parser('a', 0) as any).expected).toEqual(['b']);
		});

		it('fails if the second parser matches', () => {
			const parser = except(token('a'), token('a'), ['a not a']);
			expect(parser('a', 0).success).toBe(false);
			expect(parser('a', 0).offset).toBe(0);
			expect((parser('a', 0) as any).expected).toEqual(['a not a']);
		});

		it('succeeds if the first matches and the second does not', () => {
			const parser = except(token('b'), token('a'), ['b not a']);
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(1);
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
