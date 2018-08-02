export default {
  input: 'src/dicomweb-client.js',
  output: [
    {
      file: 'build/dicomweb-client.js',
      format: 'umd',
      name: 'DICOMwebClient',
      sourceMap: true
    },
  ],
};
