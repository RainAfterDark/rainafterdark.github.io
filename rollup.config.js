import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import license from 'rollup-plugin-license';
import path from 'path';

const SRC_DEFAULT = '_javascript';
const DIST_DEFAULT = 'assets/js/dist';
const isProd = process.env.NODE_ENV === 'production';

function build(filename, includeLicense = true) {
  return {
    input: [`${SRC_DEFAULT}/${filename}.js`],
    output: {
      file: `${DIST_DEFAULT}/${filename}.min.js`,
      format: 'iife',
      name: 'Chirpy',
      sourcemap: !isProd
    },
    watch: {
      include: `${SRC_DEFAULT}/**`
    },
    plugins: [
      babel({
        babelHelpers: 'bundled',
        presets: ['@babel/env'],
        plugins: ['@babel/plugin-transform-class-properties']
      }),
      includeLicense && license({
        banner: {
          commentStyle: 'ignored',
          content: { file: path.join(__dirname, SRC_DEFAULT, '_copyright') }
        }
      }),
      isProd && terser()
    ]
  };
}

const worker = (filename) => build(`workers/${filename}`, false);

export default [
  build('commons'),
  build('home'),
  build('categories'),
  build('page'),
  build('post'),
  build('misc'),
  worker('rain-worker'),
  worker('bg-worker'),
  build('persist', false)
];
