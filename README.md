[![Build Status](https://travis-ci.com/dcmjs-org/dicomweb-client.svg?branch=master)](https://travis-ci.com/dcmjs-org/dicomweb-client)

# DICOMweb Client

JavaScript client implementation of [DICOMweb](https://www.dicomstandard.org/dicomweb/).

For further details please refer to [PS3.18 of the DICOM standard](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/PS3.18.html).


## Goal

**This is work-in-progress and should not be used in clinical practice.  Use at your own risk.**

The main motivations for this project is:
* Support for storing, quering, retrieving DICOM objects over the web using RESTful services STOW-RS, QIDO-RS and WADO-RS, respectively
* Building a lightweight library to facilitate integration into web applications

## Installation

Install the [dicomweb-client](https://www.npmjs.com/package/dicomweb-client) package using the `npm` package manager:

```None
npm install dicomweb-client
```

## Building and testing

Build and test code locally:

```None
git clone https://github.com/dcmjs-org/dicomweb-client ~/dicomweb-client
cd ~/dicomweb-client
npm install
npm run build
npm test
```

## Usage

```html
<script type="text/javascript" src="https://unpkg.com/dicomweb-client"></script>
```

```js
const url = 'http://localhost:8080/dicomweb';
const client = new DICOMwebClient.api.DICOMwebClient({url});
client.searchForStudies().then(studies => {
  console.log(studies)
});
```

## Configuration Options
The API can be configured with a number of custom configuration options to control the requests.  These are:
* url to retrieve from for the base requests
* singlepart, either true or a set of parts from `bulkdata,image,video` to request as single part responses
* headers to add to the retrieve
* `XMLHttpRequest` can be passed to `storeInstances` as a property of the `options` parameter. When present, instead of creating a new `XMLHttpRequest` instance, the passed instance is used instead. One use of this would be to track the progress of a DICOM store and/or cancel it.

An example use of `XMLHttpRequest` being passed into the store is shown in the js snippet below 
as an example of where the upload's percentage progress is output to the console.

```js
const url = 'http://localhost:8080/dicomweb';
const client = new DICOMwebClient.api.DICOMwebClient({url});

// an ArrayBuffer of the DICOM object/file
const dataSet = ... ; 

// A custom HTTP request
const request = new XMLHttpRequest();

// A callback that outputs the percentage complete to the console.
const progressCallback = evt => {
  if (!evt.lengthComputable) {
    // Progress computation is not possible.
    return;
  }

  const percentComplete = Math.round((100 * evt.loaded) / evt.total);
  console.log("storeInstances  is " + percentComplete + "%");
};

// Add the progress callback as a listener to the request upload object.
request.upload.addEventListener('progress', progressCallback);

const storeInstancesOptions = {
  dataSets,
  request,
}
client.storeInstances(storeInstancesOptions).then( () => console.log("storeInstances completed successfully.") );

```

## For maintainers

Use `semantic` commit messages to generate releases and change log entries: [Semantic Release: How does it work?](https://semantic-release.gitbook.io/semantic-release/#how-does-it-work).  Github actions are used to trigger building and uploading new npm packages.

## Citation

Please cite the following article when using the client for scientific studies: [Herrmann et al. J Path Inform. 2018](http://www.jpathinformatics.org/article.asp?issn=2153-3539;year=2018;volume=9;issue=1;spage=37;epage=37;aulast=Herrmann):

```None
@article{jpathinform-2018-9-37,
    Author={
        Herrmann, M. D. and Clunie, D. A. and Fedorov A. and Doyle, S. W. and Pieper, S. and
        Klepeis, V. and Le, L. P. and Mutter, G. L. and Milstone, D. S. and Schultz, T. J. and
        Kikinis, R. and Kotecha, G. K. and Hwang, D. H. and Andriole, K, P. and Iafrate, A. J. and
        Brink, J. A. and Boland, G. W. and Dreyer, K. J. and Michalski, M. and
        Golden, J. A. and Louis, D. N. and Lennerz, J. K.
    },
    Title={Implementing the {DICOM} standard for digital pathology},
    Journal={Journal of Pathology Informatics},
    Year={2018},
    Number={1},
    Volume={9},
    Number={37}
}

```

## Support

The developers gratefully acknowledge their reseach support:
* Open Health Imaging Foundation ([OHIF](http://ohif.org))
* Quantitative Image Informatics for Cancer Research ([QIICR](http://qiicr.org))
* [Radiomics](http://radiomics.io)
* The [Neuroimage Analysis Center](http://nac.spl.harvard.edu)
* The [National Center for Image Guided Therapy](http://ncigt.org)
* The [MGH & BWH Center for Clinical Data Science](https://www.ccds.io/)


