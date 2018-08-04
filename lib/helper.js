
const cmdln = require('cmdln');
const fs = require('fs-extra');
const Validana = require('validana-client');

module.exports = {
    // Helper function to make commands async
    asyncCommand: command => (function(subcmd, opts, args, cb) {
        command.call(this, subcmd, opts, args, cb).catch(cb);
    }),
    clientInit: function (opts, args, callback) {
        if(opts.prefix) {
            this.prefix = opts.prefix;
        }
        this.url = opts.url;
        cmdln.Cmdln.prototype.init.call(this, opts, args, callback);
    },
    clientOptions: [
        {names: ['prefix'], env: 'VALIDANA_PREFIX', type: 'string', help: 'Signing prefix', helpArg: 'PREFIX'},
        {names: ['url'], env: 'VALIDANA_URL', type: 'string', default: 'ws://localhost:8080/api/v1/', help: 'WebSocket URL of server', helpArg: 'URL'},
    ],
    getClient: function(opts) {
        const prefix = opts.prefix || this.prefix;
        if (!prefix) {
            throw new Error('Missing --prefix option.');
        }
        const url = opts.url !== 'ws://localhost:8080/api/v1/' ? opts.url : this.url;
        return new Promise((resolve, reject) => {
            // Monkey-patch missing WebSocket error handling in the client so we get nicer errors
            if (!Validana.Client.prototype.createWebsocket.monkeyPatchedByCLI) {
                const originalCreateWebsocket = Validana.Client.prototype.createWebsocket;
                Validana.Client.prototype.createWebsocket = function() {
                    const client = this;
                    originalCreateWebsocket.call(client);
                    if (!this.webSocket.onerror) {
                        this.webSocket.onerror = function(ev) {
                            if (client.connected === Validana.Connected.NoJustStarted) {
                                client.connected = Validana.Connected.NoNotSupported;
                                reject(ev.error);
                                client.setChanged();
                                client.notifyObservers(client.connected);
                            } else {
                                throw ev.error;
                            }
                        };
                    }
                }
                Validana.Client.prototype.createWebsocket.monkeyPatchedByCLI = true;
            }

            // Get the client and wait for it to connect
            const client = Validana.Client.get();
            function resolveConnected() {
                if (client.isConnected() != Validana.Connected.NoJustStarted) {
                    if (client.isConnected() === Validana.Connected.Yes) {
                        resolve(client);
                    } else {
                        reject(client);
                    }
                    return true;
                }
                return false;
            }
            if(!resolveConnected()) {
                client.addObserver({ update: resolveConnected });
                client.init(prefix, url);
            }
        });
    },
    helpOpts: {
        includeEnv: true,
        includeDefault: true
    },
    readFile: filename => {
        if (filename === '-') {
            return new Promise((resolve, reject) => {
                const tryRead = () => {
                    fs.readFile(process.stdin.fd, 'utf8')
                        .catch(reason => {
                            if (typeof reason === 'object' && reason.code === 'EAGAIN') {
                                setTimeout(tryRead, 50);
                            } else {
                                reject(reason);
                            }
                        })
                        .then(data => {
                            if (typeof data === 'string' && data.length) {
                                resolve(data);
                            }
                        });
                }
                tryRead();
            });
        } else {
            return fs.readFile(filename, 'utf8');
        }
    },
    outputJSON: data => {
        process.stdout.write(JSON.stringify(data, null, ' '.repeat(4)) + '\n');
    }
};
