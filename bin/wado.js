#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();

program
  .name('wado')
  .description('CLI to fetch studies via WADO RS')
  .version('0.0.1');

program.command('metadata')
  .description('Fetch a study using series metadata/bulkdata/image data retrieves')
  .argument('<string>', 'URL to extra in http:.../studies/<studyUID> format')
  .option('-d, --directory <outputDirectory>', 'Fetch data to directory')
  .action((str, options) => {
    console.log('Retrieve metadata from', str);
  });

program.parse();
