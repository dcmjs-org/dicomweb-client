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


## For maintainers

Use `semantic` commit messages to generate releases and change log entries: [Semantic Release: How does it work?](https://semantic-release.gitbook.io/semantic-release/#how-does-it-work)

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


