import invariant from 'assert';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import findUp from 'find-up';
import yaml from 'js-yaml';
import _ from 'lodash';
import vscode from 'vscode';

const readFileAsync = promisify(fs.readFile);

/**
 * Given an active file in the editor, find the path to the root of the project
 * (Defined by the closest parent directory where .pre-commit-config.yaml lives)
 */
async function getProjectRoot() {
    const currFile = vscode.window.activeTextEditor.document.fileName;
    const configPath = await findUp('.pre-commit-config.yaml', { cwd: currFile });
    invariant(configPath, `Could not find .pre-commit-config.yaml as a parent of ${currFile}`);

    return path.dirname(configPath);
}

async function getPreCommitConfig(projectRoot) {
    const configPath = path.join(projectRoot, '.pre-commit-config.yaml');
    const configFile = await readFileAsync(configPath, { encoding: 'utf8' });
    invariant(configFile, `Could not read .pre-commit-config.yaml at ${configPath}`);

    return yaml.safeLoad(configFile);
}

/**
 * Get path to python by spying on .git/hooks/pre-commit!
 * (So we can do $PYTHON -m pre-commit)
 * See: https://twitter.com/codewithanthony/status/1202499585593110528?s=20
 */
async function getPythonPath(projectRoot) {
    const gitHooksPrecommit = path.join(projectRoot, '.git', 'hooks', 'pre-commit');
    const gitHookFile = await readFileAsync(gitHooksPrecommit, { encoding: 'utf8' });
    // Sneaky! .git/bin/pre-commit will tell us where python is
    const match = gitHookFile.match(/^INSTALL_PYTHON = '(.+?)'$/m);
    invariant(match, `Could not find INSTALL_PYTHON in ${gitHooksPrecommit}`);

    return match[1];
}

export function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('pre-commit-vscode.run', async () => {
            const currFile = vscode.window.activeTextEditor.document.fileName;

            if (!vscode.window.activeTextEditor) {
                return vscode.window.showInformationMessage('You must open a file first!');
            }

            let projectRoot;
            try {
                projectRoot = await getProjectRoot();
            } catch (err) {
                console.error(err);
                return vscode.window.showErrorMessage(err.message);
            }

            let config;
            try {
                config = await getPreCommitConfig(projectRoot);
            } catch (err) {
                console.error(err);
                return vscode.window.showErrorMessage(err.message);
            }

            const hooks = _.flatten(config.repos.map(r => r.hooks.map(h => h.id)));
            const hook = await vscode.window.showQuickPick(['Run All Hooks', ...hooks], { canPickMany: false });

            let pythonPath;
            try {
                pythonPath = await getPythonPath(projectRoot);
            } catch (err) {
                console.error(err);
                return vscode.window.showErrorMessage(err.message);
            }

            const terminal = vscode.window.createTerminal(`pre-commit run`, pythonPath, [
                '-m',
                'pre_commit',
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
