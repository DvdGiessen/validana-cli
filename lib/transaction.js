const cmdln = require('cmdln');
const helper = require('./helper');
const util = require('util');

/**
 * Transaction command
 */
const Transaction = module.exports = function() {
    cmdln.Cmdln.call(this, {
        name: 'validana-cli transaction',
        desc: 'Transaction information.',
        options: helper.clientOptions,
        helpOpts: helper.helpOpts
    });
}
util.inherits(Transaction, cmdln.Cmdln);
Transaction.prototype.init = helper.clientInit;
Transaction.prototype.getClient = helper.getClient;

/**
 * Await subcommand
 */
Transaction.prototype.do_await = helper.asyncCommand(async function(subcmd, opts, args, cb) {
    // Transcation id
    let transactionId;
    if (opts.id) {
        transactionId = opts.id;
    } else if (opts.id_file) {
        transactionId = await helper.readFile(opts.id_file);
    } else {
        throw new Error('Missing --id or --id-file option.');
    }
    try {
        transactionId = JSON.parse(transactionId);
        transactionId = transactionId.transactionId || transactionId.id;
    } catch(e) {
        // If it ain't JSON, we just use the raw string
    }

    const client = await this.getClient(opts);
    const transaction = await client.getProcessedTx(transactionId);

    helper.outputJSON(transaction);
    cb();
});
Transaction.prototype.do_await.synopses = ['{{name}} {{cmd}} OPTIONS...'];
Transaction.prototype.do_await.help = 'Await processing of a transaction and returns it.\n\n{{usage}}\n\n{{options}}';
Transaction.prototype.do_await.options = helper.clientOptions.concat([
    {names: ['id'], type: 'string', help: 'The transaction ID', helpArg: 'ID'},
    {names: ['id-file'], type: 'string', help: 'File containing transaction ID', helpArg: 'FILE', completionType: 'file'}
]);

/**
 * Status subcommand
 */
Transaction.prototype.do_status = helper.asyncCommand(async function(subcmd, opts, args, cb) {
    // Transcation id
    let transactionId;
    if (opts.id) {
        transactionId = opts.id;
    } else if (opts.id_file) {
        transactionId = await helper.readFile(opts.id_file);
    } else {
        throw new Error('Missing --id or --id-file option.');
    }
    try {
        transactionId = JSON.parse(transactionId);
        transactionId = transactionId.transactionId || transactionId.id;
    } catch(e) {
        // If it ain't JSON, we just use the raw string
    }

    const client = await this.getClient(opts);
    const status = await client.query('txStatus', {txId: transactionId, push: false}, true);

    helper.outputJSON({
        transactionId: transactionId,
        status: status || null, // Old version of validana-server returned undefined instead of 'new', 'processing_accepted' or 'processing_rejected'. Setting to null makes explicit we received no result
    });
    cb();
});
Transaction.prototype.do_status.synopses = ['{{name}} {{cmd}} OPTIONS...'];
Transaction.prototype.do_status.help = 'Looks up the status of a transaction.\n\n{{usage}}\n\n{{options}}';
Transaction.prototype.do_status.options = helper.clientOptions.concat([
    {names: ['id'], type: 'string', help: 'The transaction ID', helpArg: 'ID'},
    {names: ['id-file'], type: 'string', help: 'File containing transaction ID', helpArg: 'FILE', completionType: 'file'}
]);
