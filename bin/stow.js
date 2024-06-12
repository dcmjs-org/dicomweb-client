#!/usr/bin/env node

console.log("wadors retrieve studies/images")
const { Command } = require('commander');
const program = new Command();

program
  .name('stow')
  .description('CLI to store part 10 data to a DICOMweb server')
  .version('0.0.1');

program.command('part10')
  .description('Fetch a study using series metadata/bulkdata/image data retrieves')
  .argument('<string>', 'URL to store to DICOMweb in http:.../studies format')
  .option('-d, --directory <outputDirectory>', 'Fetch data to directory')
  .action((str, options) => {
    console.log('Store metadata to', str);
  });

program.parse();
