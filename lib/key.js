const cmdln = require('cmdln');
const helper = require('./helper');
const util = require('util');
const Validana = require('validana-client');

const Key = module.exports = function() {
    cmdln.Cmdln.call(this, {
        name: 'validana-cli key',
        desc: 'Keypair operations.'
    });
}
util.inherits(Key, cmdln.Cmdln);

Key.prototype.do_generate = function(subcmd, opts, args, cb) {
    const key = Validana.PrivateKey.generate();
    helper.outputJSON({
        privateKey: key.toWIF(),
        publicKey: Validana.Crypto.binaryToHex(key.getPublicKey()),
        address: key.getAddress()
    });
    cb();
}
Key.prototype.do_generate.help = 'Generates a keypair and prints it as JSON.\n\n{{usage}}';
Key.prototype.do_generate.synopses = ['{{name}} {{cmd}}'];
