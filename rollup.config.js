export default {
    entry: 'src/dicomweb-client.js',
    targets: [
        {
            dest: 'build/dicomweb-client.js',
            format: 'umd',
            moduleName: 'DICOMwebClient',
        sourceMap: true
        },
    ]
};
