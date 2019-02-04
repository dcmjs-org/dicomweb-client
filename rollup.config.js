import babel from 'rollup-plugin-babel';
import pkg from './package.json'

export default {
  input: 'src/dicomweb-client.js',
  output: [{
      file: pkg.main,
      format: 'umd',
      name: 'DICOMwebClient',
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
      exports: 'named'
    }
  ], 
  plugins: [
	babel({
	  runtimeHelpers: true,
	  exclude: 'node_modules/**',
  	})
  ]
};
