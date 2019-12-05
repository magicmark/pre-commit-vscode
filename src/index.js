import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import findUp from 'find-up';
import yaml from 'js-yaml';
import _ from 'lodash';
import pLocate from 'p-locate';
import pathExists from 'path-exists';
import vscode from 'vscode';

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

/**
 * TODO: A better way of getting the path to pre-commit
 * - Try and use what's on $PATH instead?
 * - Or see if using .git/hooks/pre-commit is feasible?
 * - Maybe a per-project user specified config?
 */
async function getPreCommitPath(projectRoot) {
    const possiblePaths = [
        ['venv', 'bin', 'pre-commit'],
        ['virtualenv_run', 'bin', 'pre-commit'],
        ['virtualenv', 'bin', 'pre-commit'],
    ].map(p => path.join(projectRoot, ...p));

    const foundPath = await pLocate(possiblePaths, file => pathExists(file));

    if (foundPath) {
        return foundPath;
    }
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

            const hooks = _.flatten(config.repos.map(r => r.hooks.map(h => h.id)));
            const hook = await vscode.window.showQuickPick(['Run All Hooks', ...hooks], { canPickMany: false });

            const preCommit = await getPreCommitPath(projectRoot);
            if (!preCommit) {
                return vscode.window.showErrorMessage('Could not find an installed version of pre-commit!');
            }

            const terminal = vscode.window.createTerminal(`pre-commit run`, preCommit, [
                'run',
                ...(hook === 'Run All Hooks' ? [] : [hook]),
                '--files',
                currFile,
            ]);

            terminal.show();
        }),
    );
}

export function deactivate() {}
