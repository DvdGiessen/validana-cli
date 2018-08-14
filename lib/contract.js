const cmdln = require('cmdln');
const helper = require('./helper');
const util = require('util');
const Validana = require('validana-client');

/**
 * Contract command
 */
const Contract = module.exports = function() {
    cmdln.Cmdln.call(this, {
        name: 'validana-cli contract',
        desc: 'Smart contract operations.',
        options: helper.clientOptions,
        helpOpts: helper.helpOpts
    });
}
util.inherits(Contract, cmdln.Cmdln);
Contract.prototype.init = helper.clientInit;
Contract.prototype.getClient = helper.getClient;

/**
 * List subcommand
 */
Contract.prototype.do_list = helper.asyncCommand(async function(subcmd, opts, args, cb) {
    const client = await this.getClient(opts)
    const contracts = await client.query('contracts');
    helper.outputJSON(contracts);
    cb();
});
Contract.prototype.do_list.synopses = ['{{name}} {{cmd}} OPTIONS'];
Contract.prototype.do_list.help = 'List all existing smart contracts.\n\n{{usage}}\n\n{{options}}';
Contract.prototype.do_list.options = helper.clientOptions;

/**
 * Execute subcommand
 */
Contract.prototype.do_execute = helper.asyncCommand(async function(subcmd, opts, args, cb) {
    // Signing key
    let signingKey;
    if (opts.signing_key) {
        signingKey = opts.signing_key;
    } else if (opts.signing_keyfile) {
            signingKey = await helper.readFile(opts.signing_keyfile);
    } else {
        throw new Error('Missing --signing-key or --signing-keyfile option.');
    }
    try {
        signingKey = JSON.parse(signingKey).privateKey;
    } catch(e) {
        // If it ain't JSON, we just use the raw string
    }
    signingKey = Validana.PrivateKey.fromWIF(signingKey);

    // Get contracts from client
    const client = await this.getClient(opts);
    const availableContracts = (await client.query('contracts')).concat([
        {
            hash: Buffer.alloc(32, 0).toString('hex'),
            version: '1.0',
            description: 'Creates a new smart contract',
            template: {
                type: { type: 'str', desc: 'Type of the smart contract', name: 'type' },
                version: { type: 'str', desc: 'Version of the smart contract', name: 'version' },
                description: { type: 'str', desc: 'Description of the smart contract', name: 'description' },
                template: { type: 'json', desc: 'Template describing smart contract input', name: 'template' },
                init: { type: 'base64', desc: 'One-time initialization code for the smart contract', name: 'init' },
                code: { type: 'base64', desc: 'Code for the smart contract', name: 'code' }
            }
        },
        {
            hash: Buffer.alloc(32, 255).toString('hex'),
            version: '1.0',
            description: 'Deletes an existing smart contract',
            template: {
                hash: { type: 'hash', desc: 'Hash of the smart contract', name: 'hash' }
            }
        }
    ]);

    // Contract hash
    let contract = null;
    if (opts.contract_hash) {
        for (const c of availableContracts) {
            if (c.hash === opts.contract_hash) {
                contract = c;
			}
        }
    } else if (opts.contract_type) {
        for (const c of availableContracts) {
            if (c.type === opts.contract_type) {
                contract = c;
			}
        }
    } else {
        throw new Error('Missing --contract-hash or --contract-type option.');
    }

    // Check contract existance
    if (!contract) {
        throw new Error('Specified contract does not exist.');
    }
    const contractHash = Validana.Crypto.hexToBinary(contract.hash);

    // Payload
    let payload;
    if (opts.payload) {
        payload = opts.payload;
    } else if (opts.payload_file) {
        payload = await helper.readFile(opts.payload_file);
    } else {
        throw new Error('Missing --payload or --payload-file option.');
    }
    payload = JSON.parse(payload);

    // Check payload
    const templateKeys = Object.keys(contract.template);
    const payloadKeys = Object.keys(payload);
    const missingKeys = templateKeys.filter(key => !payloadKeys.includes(key));
    if (missingKeys.length > 0) {
        throw new Error('Invalid payload: Missing key' + (missingKeys.length === 1 ? 's' : '') + ': ' + missingKeys.join(', '));
    }
    const extraKeys = payloadKeys.filter(key => !templateKeys.includes(key));
    if (extraKeys.length > 0) {
        throw new Error('Invalid payload: Unknown key' + (extraKeys.length === 1 ? 's' : '') + ': ' + extraKeys.join(', '));
    }

    // Execute transaction
    const transactionId = Validana.Crypto.id();
    await client.signAndSend(signingKey, transactionId, contractHash, payload, opts.valid_until);

    helper.outputJSON({
        transactionId: Validana.Crypto.binaryToHex(transactionId),
    });
    cb();
});
Contract.prototype.do_execute.synopses = ['{{name}} {{cmd}} OPTIONS'];
Contract.prototype.do_execute.help = 'Execute a smart contract.\n\n{{usage}}\n\n{{options}}';
Contract.prototype.do_execute.options = helper.clientOptions.concat([
    {names: ['contract-hash'], type: 'string', help: 'The hash of the smart contract to execute', helpArg: 'HASH'},
    {names: ['contract-type'], type: 'string', help: 'The type of the smart contract to execute', helpArg: 'TYPE'},
    {names: ['payload'], type: 'string', help: 'The payload as a JSON string', helpArg: 'JSON'},
    {names: ['payload-file'], type: 'string', help: 'The payload as a JSON file', helpArg: 'FILE', completionType: 'file'},
    {names: ['signing-key'], type: 'string', help: 'Key used for signing the transaction', helpArg: 'KEY'},
    {names: ['signing-keyfile'], type: 'string', help: 'Keyfile used for signing the transaction', helpArg: 'FILE', completionType: 'file'},
    {names: ['valid-until'], type: 'positiveInteger', default: 0, help: 'Time the transaction expires, in milliseconds since Unix epoch, or 0 to never expire'}
]);

/**
 * Create subcommand
 */
Contract.prototype.do_create = helper.asyncCommand(async function(subcmd, opts, args, cb) {
    // Transform contract options
    if (opts.contract) {
        opts.payload = opts.contract;
        delete opts.contract;
    } else if (opts.contract_file) {
        opts.payload_file = opts.contract_file;
        delete opts.contract_file;
    } else {
        throw new Error('Missing --contract or --contract-file option.');
    }

    // Hash for contract creation contract
    opts.contract_hash = Buffer.alloc(32, 0).toString('hex');

    // Re-use execute subcommand
    this.do_execute(subcmd, opts, args, cb);
});
Contract.prototype.do_create.synopses = ['{{name}} {{cmd}} OPTIONS'];
Contract.prototype.do_create.help = 'Create a new contract.\n\n{{usage}}\n\n{{options}}';
Contract.prototype.do_create.options = helper.clientOptions.concat([
    {names: ['contract'], type: 'string', help: 'The smart contract to create as a JSON string', helpArg: 'JSON'},
    {names: ['contract-file'], type: 'string', help: 'The smart contract to create as a JSON file', helpArg: 'FILE', completionType: 'file'},
    {names: ['signing-key'], type: 'string', help: 'Key used for signing the transaction', helpArg: 'KEY'},
    {names: ['signing-keyfile'], type: 'string', help: 'Keyfile used for signing the transaction', helpArg: 'FILE', completionType: 'file'},
]);

/**
 * Delete subcommand
 */
Contract.prototype.do_delete = helper.asyncCommand(async function(subcmd, opts, args, cb) {
    // Get contracts from client
    const client = await this.getClient(opts);
    const availableContracts = await client.query('contracts');

    // Contract hash
    let contract = null;
    if (opts.contract_hash) {
        for (const c of availableContracts) {
            if (c.hash === opts.contract_hash) {
                contract = c;
            }
        }
        delete opts.contract_hash;
    } else if (opts.contract_type) {
        for (const c of availableContracts) {
            if (c.type === opts.contract_type) {
                contract = c;
            }
        }
        delete opts.contract_type;
    } else {
        throw new Error('Missing --contract-hash or --contract-type option.');
    }

    // Check contract existance
    if (!contract) {
        throw new Error('Specified contract does not exist.');
    }

    // Set up opts and re-use execute subcommand
    opts.contract_hash = Buffer.alloc(32, 255).toString('hex');
    opts.payload = JSON.stringify({hash: contract.hash});
    this.do_execute(subcmd, opts, args, cb);
});
Contract.prototype.do_delete.synopses = ['{{name}} {{cmd}} OPTIONS'];
Contract.prototype.do_delete.help = 'Delete an existing smart contract.\n\n{{usage}}\n\n{{options}}';
Contract.prototype.do_delete.options = helper.clientOptions.concat([
    {names: ['contract-hash'], type: 'string', help: 'The hash of the smart contract to delete', helpArg: 'HASH'},
    {names: ['contract-type'], type: 'string', help: 'The type of the smart contract to delete', helpArg: 'TYPE'},
    {names: ['signing-key'], type: 'string', help: 'Key used for signing the transaction', helpArg: 'KEY'},
    {names: ['signing-keyfile'], type: 'string', help: 'Keyfile used for signing the transaction', helpArg: 'FILE', completionType: 'file'},
]);
