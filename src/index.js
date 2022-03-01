import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import findUp from 'find-up';
import yaml from 'js-yaml';
import _ from 'lodash';
import vscode from 'vscode';

import getPreCommitPath from './location';

const { spawn } = require('child_process');

const readFileAsync = promisify(fs.readFile);

/**
 * Given an active file in the editor, find the path to the root of the project
 * (Defined by the closest parent directory where .pre-commit-config.yaml lives)
 */
async function getProjectRoot() {
    const currFile = vscode.window.activeTextEditor.document.fileName;
    const configPath = await findUp('.pre-commit-config.yaml', { cwd: currFile });

    if (configPath) {
        return path.dirname(configPath);
    }
}

async function getPreCommitConfig(projectRoot) {
    const configPath = path.join(projectRoot, '.pre-commit-config.yaml');
    const configFile = await readFileAsync(configPath, { encoding: 'utf8' });
    return yaml.safeLoad(configFile);
}

export function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('pre-commit-vscode.run', async () => {
            const currFile = vscode.window.activeTextEditor.document.fileName;

            if (!vscode.window.activeTextEditor) {
                return vscode.window.showInformationMessage('You must open a file first!');
            }

            const projectRoot = await getProjectRoot();
            if (!projectRoot) {
                return vscode.window.showErrorMessage(
                    'Could not find a .pre-commit-config.yaml file in a parent directory!',
                );
            }

            let config;
            try {
                config = await getPreCommitConfig(projectRoot);
            } catch (e) {
                console.error(e);
                return vscode.window.showErrorMessage('Could not read .pre-commit-config.yaml!');
            }

            const hooks = _.flatten(config.repos.map((r) => r.hooks.map((h) => h.id)));
            const hook = await vscode.window.showQuickPick(['Run All Hooks', ...hooks], { canPickMany: false });

            const preCommit = await getPreCommitPath(projectRoot);
            if (!preCommit) {
                return vscode.window.showErrorMessage('Could not find an installed version of pre-commit!');
            }

            // used to store stdout/stderr from the pre-commit process
            let buffer = '';

            const writeEmitter = new vscode.EventEmitter();
            const closeEmitter = new vscode.EventEmitter();

            const pty = {
                onDidWrite: writeEmitter.event,
                onDidClose: closeEmitter.event,
                open: () => writeEmitter.fire(`Running pre-commit from ${preCommit}...\n\r`),
                close: () => {},
            };

            const terminal = vscode.window.createTerminal({
                name: 'pre-commit run',
                pty,
            });

            terminal.show();

            const proc = spawn(
                preCommit,
                ['run', ...(hook === 'Run All Hooks' ? [] : [hook]), '--color', 'always', '--files', currFile],
                {
                    cwd: projectRoot,
                },
            );

            function handleData(data) {
                buffer += data.toString();
                const linesToPrint = buffer.split('\n').slice(0, -1);
                linesToPrint.forEach((line) => {
                    writeEmitter.fire(`${line}\n\r`);
                });
                buffer = buffer.split('\n').slice(-1).join('');
            }

            proc.stdout.on('data', handleData);
            proc.stderr.on('data', handleData);
            proc.on('close', (code) => {
                writeEmitter.fire(`${buffer}\n\r`);

                // If the exit code wasn't 0, leave the output open for users
                // to see and debug.
                if (code === 0) {
                    terminal.dispose();
                }
            });
        }),
    );
}

export function deactivate() {}
