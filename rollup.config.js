import builtins from 'rollup-plugin-node-builtins';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';

export default {
  entry: 'src/dicomweb-client.js',
  targets: [
    {
      dest: 'build/dicomweb-client.js',
      format: 'umd',
      name: 'DICOMwebClient',
      sourceMap: true
    },
  ],
  plugins: [
    resolve({
      jsnext: true,
      main: true,
      browser: true,
    }),
    commonjs(),
    builtins(),
    json()
  ]
};
