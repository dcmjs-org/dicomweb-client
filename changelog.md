# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2018-09-26
### Added
- Added DICOMWebClient.version and associated NPM script to make it easier to determine which version of the library is running in an application

### Changed
- Added Babel to the Rollup configuration to produce a transpiled version of the library which can run on all browsers above Internet Explorer 11

## [0.3.1] - 2018-09-25
### Fixed
- Removed reference to 'window' so the library can be used in Node.js more easily

## [0.3.0] - 2018-09-24
### Added
- Added support for WADO-RS [RetrieveStudy](http://dicom.nema
.org/medical/dicom/current/output/chtml/part18/sect_6.5.html#sect_6.5.1)
- Added support for WADO-RS [RetrieveSeries](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.2.html)
- Added support for WADO-RS [RetrieveInstance](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.3.html)
- Added support for WADO-RS [RetrieveBulkData](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.5.html)
- Added support for constructing [WADO-URI](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.2.html) URLs from the necessary parameters

### Changed
- Switched from console.error() to throw new Error() for invalid handling input

### Fixed
- Removed duplicated tests for StoreInstances

## [0.2.0] - 2018-09-20
### Added
- Added support for STOW-RS StoreInstances

### Changed
- Switched from Mochify to Karma for running tests

### Fixed
- Fixed exit code from test.sh script to ensure Continuous Integration server properly reports failures.

