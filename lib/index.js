#!/usr/bin/env node

// validana-client expects to be in a browser, so we make WebSockets available in the global namespace
// before validana-client is loaded anywhere
global.WebSocket = require('ws');

const cmdln = require('cmdln');
const util = require('util');

// Main function
function ValidanaCLI() {
    cmdln.Cmdln.call(this, {
        name: 'validana-cli',
        desc: 'A command-line interface client for the Validana blockchain platform.'
    });
}
util.inherits(ValidanaCLI, cmdln.Cmdln);

// Sub commands
ValidanaCLI.prototype.do_key = require('./key');
ValidanaCLI.prototype.do_contract = require('./contract');
ValidanaCLI.prototype.do_transaction = require('./transaction');

// Generate completion
ValidanaCLI.prototype.do_completion = function(subcmd, opts, args, cb) {
    // eslint-disable-next-line no-console
    process.stdout.write(this.bashCompletion());
    cb();
};
ValidanaCLI.prototype.do_completion.synopses = ['{{name}} {{cmd}}', 'source <({{name}} {{cmd}})'];
ValidanaCLI.prototype.do_completion.help = 'Generates tab-completion for all {{name}} commands.\nFor use with Bash and compatible shells.\n\n{{usage}}';

// Only run if we're being executed directly
if (require.main === module) {
    cmdln.main(new ValidanaCLI(), {
        finale: 'exit' // validana-client blocks (probably on open WebSocket connection), thus we need to force-quit after execution finished
    });
}
