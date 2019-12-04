const vscode = require('vscode');
const yaml = require('js-yaml');
const { promisify } = require('util');
const fs = require('fs');
const findUp = require('find-up');
const _ = require('lodash');
const execa = require('execa');

const readFileAsync = promisify(fs.readFile);

async function getPreCommitConfig () {
	const path = await findUp('.pre-commit-config.yaml', { cwd: vscode.workspace.rootPath });

	if (!path) {
		console.error(`Could not find a .pre-commit-config.yaml as a parent of ${vscode.workspace.rootPath}`);
		return new Error('Could not run pre-commit');
	}

	const file = await readFileAsync(path, { encoding: 'utf8' } );
	return yaml.safeLoad(file);
}

function activate(context) {
	console.log('Setting up pre-commit-vscode');

	context.subscriptions.push(vscode.commands.registerCommand('pre-commit-vscode.run', async () => {
		if (!vscode.window.activeTextEditor) {
			return vscode.window.showInformationMessage('You must open a file first!');
		}

		vscode.window.setStatusBarMessage("running...", 2000);

		const file = vscode.window.activeTextEditor.document.fileName;
		const config = await getPreCommitConfig();

		if (!config) {
			return vscode.window.showErrorMessage('Could not run pre-commit');
		}

		const hooks = _.flatten(config.repos.map(r => r.hooks.map(h => h.id)));
		const hook = await vscode.window.showQuickPick(['Run All Hooks', ...hooks], { canPickMany: false });

		// const task = new vscode.ProcessExecution('/Users/markl/mess/lemon-reset/venv/bin/pre-commit', [
		//     'run',
		// 	...(hook === 'Run All Hooks' ? [] : [hook]),
		//  	'--files',
		//  	file
		// ], { cwd:  vscode.workspace.rootPath });

		const terminal = vscode.window.createTerminal(`pre-commit run`, '/Users/markl/mess/lemon-reset/venv/bin/pre-commit', [
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