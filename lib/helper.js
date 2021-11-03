'use strict';

const cmdln = require('cmdln');
const fs = require('fs-extra');
const http = require('http');
const https = require('https');
const os = require('os');
const Validana = require('@coinversable/validana-client');

module.exports = {
    clientInit(opts, args, callback) {
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
    getClient(opts) {
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
                    if (!this.webSocket.onerror || /^\s*function\s*\(\s*\)\s*\{\s*\}\s*$/.test(this.webSocket.onerror.toString())) {
                        this.webSocket.onerror = function(ev) {
                            if (client.connected === Validana.Connected.NoJustStarted) {
                                client.connected = Validana.Connected.NoNotSupported;
                                reject(ev.error);
                                client.emit('connection', client.connected);
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
                if (client.connectionStatus() !== Validana.Connected.NoJustStarted) {
                    if (client.connectionStatus() === Validana.Connected.Yes) {
                        resolve(client);
                    } else {
                        reject(client);
                    }
                    client.off('connection', resolveConnected);
                    return true;
                }
                return false;
            }
            if(!resolveConnected()) {
                client.on('connection', resolveConnected);
                client.init(prefix, url);
            }
        });
    },
    helpOpts: {
        includeEnv: true,
        includeDefault: true
    },
    read(target, encoding) {
        // Read from stdin
        if (target === '-') {
            return this.readStream(process.stdin, encoding);
        }

        // If it is a string and doesn't look like a Windows path
        if (
            typeof target === 'string' &&
            (os.platform() !== 'win32' || !/^[A-Z]:[/\\]/i.test(target))
        ) {
            try {
                target = new URL(target);
            } catch (e) {
                // Apparently this isn't a URL
            }
        }

        // If the target is a URL
        if (typeof target === 'object' && target instanceof URL) {
            // Edge case: file URLs are only supported here, to prevent
            // web URL's from redirecting to a local file
            if (target.protocol === 'file:') {
                target = URL.fileURLToPath(target);
            } else {
                return this.readUrl(target, encoding);
            }
        }

        // Read from file
        return this.readFile(target, encoding);
    },
    readFile(filename, encoding) {
        return fs.readFile(filename, encoding);
    },
    async readStream(readableStream, encoding) {
        // Set encoding to receive decoded data from the stream
        if (encoding) {
            readableStream.setEncoding(encoding);
        }

        // Use the async iterator to retrieve chunks of data
        let data = null;
        for await (const chunk of readableStream) {
            if (!data) {
                data = chunk;
            } else if (Buffer.isBuffer(data)) {
                data = Buffer.concat([data, chunk]);
            } else {
                data += chunk;
            }
        }

        // Once the iterator finished, the stream has ended
        return data;
    },
    readUrl(url, encoding) {
        // eslint-disable-next-line no-shadow
        const readUrl = (url, encoding, previousUrls) => {
            // Parse the URL if nessecary
            if (typeof url === 'string') {
                url = new URL(url);
            }

            // Handle data URLs
            if (url.protocol === 'data:') {
                const dataUrl = url
                    .toString()
                    .match(
                        /^data:(?:[a-z]+\/[a-z0-9-+.]+(?:;[a-z0-9-.!#$%*+.{}|~`]+=[a-z0-9-.!#$%*+.{}|~`]+)*)?(?:;(base64))?,([a-z0-9!$&',()*+;=\-._~:@/?%\s]*)$/i
                    );
                if (!dataUrl) {
                    throw new Error('Invalid data URL');
                }
                let data = Buffer.from(decodeURIComponent(dataUrl[2]), dataUrl[1]);
                if (encoding) {
                    data = data.toString(encoding);
                }
                return Promise.resolve(data);
            }

            // Use HTTP-like protocol handlers
            let protocolHandler = null;
            if (url.protocol === 'http:') {
                protocolHandler = http;
            } else if (url.protocol === 'https:') {
                protocolHandler = https;
            }
            if (!protocolHandler) {
                throw new Error('Unsupported protocol');
            }
            return new Promise((resolve, reject) =>
                protocolHandler
                    .get(url, response => {
                        if (
                            response.statusCode >= 200 &&
                            response.statusCode < 300
                        ) {
                            resolve(this.readStream(response, encoding));
                        } else if (
                            response.statusCode >= 300 &&
                            response.statusCode < 400 &&
                            'location' in response.headers
                        ) {
                            const redirectUrl = new URL(
                                response.headers.location,
                                url
                            );
                            if (!previousUrls.includes(redirectUrl.toString())) {
                                resolve(
                                    readUrl(redirectUrl, encoding, [
                                        url.toString(),
                                        ...previousUrls,
                                    ])
                                );
                            } else {
                                throw new Error('Cyclical redirection');
                            }
                        } else {
                            reject(
                                new Error(
                                    `${response.statusCode} ${response.statusMessage}`
                                )
                            );
                        }
                    })
                    .on('error', reject)
            );
        };
        return readUrl(url, encoding, []);
    },
    outputJSON: data => {
        process.stdout.write(JSON.stringify(data, null, ' '.repeat(4)) + '\n');
    }
};
