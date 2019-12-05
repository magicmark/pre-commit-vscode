const vscode = require('vscode');
const yaml = require('js-yaml');
const { promisify } = require('util');
const fs = require('fs');
const findUp = require('find-up');
const _ = require('lodash');
const execa = require('execa');
const path = require('path');
const pathExists = require('path-exists');
const pLocate = require('p-locate');

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
 * TODO: try and use what's on $PATH instead
 */
async function getPreCommitPath () {
	const possiblePaths = [
		['venv', 'pre-commit'],
		['virtualenv_run', 'pre-commit'],
	].map(p => path.join(vscode.workspace.rootPath, ...p));

	const foundPath = await pLocate(possiblePaths, file => pathExists(file));

	if (foundPath) {
		return foundPath;
	}

	console.error(`Could not find an installed version of pre-commit!`);
}

function activate(context) {
	console.log('Setting up pre-commit-vscode');

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

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
    activate,
    deactivate
}