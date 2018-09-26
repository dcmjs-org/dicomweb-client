import babel from 'rollup-plugin-babel';

export default {
  input: 'src/dicomweb-client.js',
  output: {
      file: 'build/dicomweb-client.js',
      format: 'umd',
      name: 'DICOMwebClient',
      sourcemap: true,
  }, 
  plugins: [
	babel({
	  runtimeHelpers: true,
	  exclude: 'node_modules/**',
  	})
  ]
};
