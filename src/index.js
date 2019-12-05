import vscode from 'vscode';
import yaml from 'js-yaml');
import { promisify } from 'util';
import fs from 'fs';
import findUp from 'find-up';
import _ from 'lodash';
import path from 'path';
import pathExists from 'path-exists';
import pLocate from 'p-locate';

const readFileAsync = promisify(fs.readFile);

async function getPreCommitConfig () {
	const configPath = await findUp('.pre-commit-config.yaml', { cwd: vscode.workspace.rootPath });

	if (configPath) {
		const file = await readFileAsync(configPath, { encoding: 'utf8' } );
		return yaml.safeLoad(file);
	}

	console.error(`Could not find a .pre-commit-config.yaml as a parent of ${vscode.workspace.rootPath}`);
}

/**
 * TODO: A better way of getting the path to pre-commit
 * - Try and use what's on $PATH instead?
 * - Or see if using .git/hooks/pre-commit is feasible?
 * - Maybe a per-project user specified config?
 */
async function getPreCommitPath () {
	const possiblePaths = [
		['venv', 'bin', 'pre-commit'],
		['virtualenv_run', 'bin', 'pre-commit'],
		['virtualenv', 'bin', 'pre-commit'],
	].map(p => path.join(vscode.workspace.rootPath, ...p));

	const foundPath = await pLocate(possiblePaths, file => pathExists(file));

	if (foundPath) {
		return foundPath;
	}

	console.error(`Could not find an installed version of pre-commit!`);
}

function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('pre-commit-vscode.run', async () => {
		if (!vscode.window.activeTextEditor) {
			return vscode.window.showInformationMessage('You must open a file first!');
		}

		const file = vscode.window.activeTextEditor.document.fileName;
		const config = await getPreCommitConfig();

		if (!config) {
			return vscode.window.showErrorMessage('Could not find a .pre-commit-config.yaml file!');
		}

		const hooks = _.flatten(config.repos.map(r => r.hooks.map(h => h.id)));
		const hook = await vscode.window.showQuickPick(['Run All Hooks', ...hooks], { canPickMany: false });

		const preCommit = await getPreCommitPath();
		if (!preCommit) {
			return vscode.window.showErrorMessage('Could not find an installed version of pre-commit!');
		}

		const terminal = vscode.window.createTerminal(`pre-commit run`, preCommit, [
		    'run',
			...(hook === 'Run All Hooks' ? [] : [hook]),
		 	'--files',
		 	file
		])

		terminal.show();

	}))
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}