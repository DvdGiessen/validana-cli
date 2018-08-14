# validana-cli
*A command-line interface client for the Validana blockchain platform*

[![npm](https://img.shields.io/npm/v/validana-cli.svg)](https://www.npmjs.com/package/validana-cli)
[![license](https://img.shields.io/npm/l/validana-cli.svg)](https://github.com/DvdGiessen/validana-cli/blob/master/LICENSE)
[![dependencies](https://img.shields.io/david/DvdGiessen/validana-cli.svg)](https://david-dm.org/DvdGiessen/validana-cli)

## Overview
This package provides a simple CLI for the Validana blockchain platform, based
on the [validana-client](https://github.com/Coinversable/validana-client)
library. For more information about the Validana blockchain platform refer to
https://validana.io.

## Installation
Install using `npm`:
```sh
sudo npm -g i validana-cli
```
You can now directly start using `validana-cli` from your command line.

By default `validana-cli` tries to connect to an instance of [validana-server](
https://github.com/Coinversable/validana-server) running on localhost. Use
the `--url` option to connect to a specific server.

### Running your own blockchain
The easiest way to run your own Validana blockchain is using Docker: Clone the
[validana-processor repository](https://github.com/Coinversable/validana-processor)
in an empty directory, generate two passwords for the database and a private
key using the `validana-cli key generate` command, configure these passwords,
the private key and a prefix of your choosing in the `docker-compose.yml` file
included in the repository, and run the blockchain with `docker-compose up -d`.
You can now use the private key you generated to create and delete smart
contracts. See the usage examples below for more things you can do.

## Usage examples
Show general usage information:
```sh
validana-cli
```

Get help on how a specifc CLI command works:
```sh
validana-cli help contract execute
```

Generate a new keypair and print it:
```sh
validana-cli key generate
```

List available smart contracts:
```sh
validana-cli contract list --prefix myblockchain
```

Create a new smart contract:
```sh
validana-cli contract create --prefix myblockchain --contract-file contracts/mycontract.json --signing-keyfile keyfile.json
```

Execute a smart contract with a given payload:
```sh
validana-cli contract execute --prefix myblockchain --contract-type mycontract --payload '{"foo": "bar"}' --signing-key L2onu5qevxBfjB6xGSkxMqzRZLT6nN9ZRWXFz5doognwbcVM2CfB
```

Wait for a transaction to be processed and get its result:
```sh
validana-cli transaction await --prefix myblockchain --id b043790915bc2f9b6bf8ae470f49c32d
```

Note that all `validana-cli` commands accept both parameters and files as input
and always output their result as JSON. As a result you can combine most
commands in various ways using simple redirection in your shell.

For example, to execute a smart contract using a newly generated key, waiting
for it to be processed and then printing the block id in which the smart
contract was created (using the [json](https://www.npmjs.com/package/json) CLI
tool):
```sh
export VALIDANA_PREFIX=myblockchain
validana-cli contract execute --contract-type mycontract --payload-file mypayload.json --signing-key "$(validana-cli key generate)" | validana-cli transaction await --id-file - | json blockId
```

You may also consider setting up tab-completion in your shell:
```sh
validana-cli completion
```

## Issues and contributing
If you have any issues with `validana-cli`, check [the issue tracker of this
project](https://github.com/DvdGiessen/validana-cli/issues) and [the upstream
issue tracker](https://github.com/Coinversable/validana-client) to see whether
it was already reported by someone else. If not, go ahead and [create a new
issue](https://github.com/DvdGiessen/validana-cli/issues/new). Try to include
as much information (CLI version, commands to reproduce) as possible.

While I personally probably won't have much time to continue developing this
project, I do very much welcome contributions! If you have fixed a bug, added a
new command or have some other contribution, feel free to open a pull request
on [GitHub](https://github.com/DvdGiessen/validana-cli).

## License
`validana-cli` is freely distributable under the terms of the
[AGPLv3 license](https://github.com/DvdGiessen/validana-cli/blob/master/LICENSE).
