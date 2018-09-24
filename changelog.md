# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased
### Added
- Added support for WADO-RS [RetrieveStudy](http://dicom.nema
.org/medical/dicom/current/output/chtml/part18/sect_6.5.html#sect_6.5.1)
- Added support for WADO-RS [RetrieveSeries](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.2.html)
- Added support for WADO-RS [RetrieveInstance](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.3.html)
- Added support for WADO-RS [RetrieveBulkData](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.5.html)
- Added support for constructing [WADO-URI](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.2.html) URLs from the necessary parameters

### Fixed
- Removed duplicated tests for StoreInstances

## [0.2.0] - 2018-09-20
### Added
- Added support for STOW-RS StoreInstances

### Changed
- Switched from Mochify to Karma for running tests

### Fixed
- Fixed exit code from test.sh script to ensure Continuous Integration server properly reports failures.

