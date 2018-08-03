[![Build Status](https://travis-ci.com/dcmjs-org/dicomweb-client.svg?branch=master)](https://travis-ci.com/dcmjs-org/dicomweb-client)

# DICOMweb Client

JavaScript client implementation of [DICOMweb](https://www.dicomstandard.org/dicomweb/).

For further details please refer to [PS3.18 of the DICOM standard](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/PS3.18.html).


## Goal

**This is work-in-progress and should not be used in clinical practice.**

The main motivation for this project is:
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

```js
const url = 'http://localhost:8080/dicomweb';
const client = new DICOMwebClient.api.DICOMwebClient({url});
client.searchForStudies().then(studies => {
  console.log(studies)
});
```

## Support

The developers gratefully acknowledge their reseach support:
* Open Health Imaging Foundation ([OHIF](http://ohif.org))
* Quantitative Image Informatics for Cancer Research ([QIICR](http://qiicr.org))
* [Radiomics](http://radiomics.io)
* The [Neuroimage Analysis Center](http://nac.spl.harvard.edu)
* The [National Center for Image Guided Therapy](http://ncigt.org)
* The [MGH & BWH Center for Clinical Data Science](https://www.ccds.io/)


