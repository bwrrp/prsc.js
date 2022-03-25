import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';

const { main: MAIN_DEST_FILE, module: MODULE_DEST_FILE } = require('./package.json');

export default {
	input: 'lib/index.js',
	output: [
		{
			name: 'prsc',
			file: MAIN_DEST_FILE,
			format: 'umd',
			exports: 'named',
			sourcemap: true,
		},
		{ file: MODULE_DEST_FILE, format: 'es', sourcemap: true },
	],
	plugins: [sourcemaps(), terser()],
};
