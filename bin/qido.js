#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();

program
  .name('qido')
  .description('CLI to query a study')
  .version('0.0.1');

  
program.command('patient')
.description('Queries for studies of a given study')
.argument('<string>', 'URL to query against in http:.../studies format')
.action((str, options) => {
  console.log('Query patients', str);
});

program.command('studies')
  .description('Queries for studies of a given study')
  .argument('<string>', 'URL to query against in http:.../studies format')
  .action((str, options) => {
    console.log('Query studies', str);
  });

program.command('series')
  .description('Queries for series of a given study')
  .argument('<string>', 'URL to query against in http:.../studies format')
  .action((str, options) => {
    console.log('query series', str);
  });

program.parse();
