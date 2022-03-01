import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import pLocate from 'p-locate';
import pathExists from 'path-exists';

const readFileAsync = promisify(fs.readFile);

async function fromVenv(projectRoot) {
    const possiblePaths = [
        ['venv', 'bin', 'pre-commit'],
        ['.venv', 'bin', 'pre-commit'],
        ['virtualenv_run', 'bin', 'pre-commit'],
        ['virtualenv', 'bin', 'pre-commit'],
    ].map((p) => path.join(projectRoot, ...p));

    const foundPath = await pLocate(possiblePaths, (file) => pathExists(file));

    if (foundPath) {
        return foundPath;
    }
}

async function fromGitHooks(projectRoot) {
    const hookPath = path.join(projectRoot, '.git', 'hooks', 'pre-commit');
    const hookFile = await readFileAsync(hookPath, { encoding: 'utf8' });

    const matches = hookFile.match(/^INSTALL_PYTHON=(.+)$/m);
    if (!matches || typeof matches[1] !== 'string') return;
    const pythonPath = matches[1];

    // This is kinda hacky, really we should just be running $python -m pre_commit
    // but i'm too lazy to refactor the rest of the code, someone pls refactor
    const preCommitPath = pythonPath.replace(/bin\/python$/, 'bin/pre-commit');

    if (await pathExists(preCommitPath)) {
        return preCommitPath;
    }
}

/**
 * This function finds grabs the best path for pre-commit by searching in order:
 * - grep ^INSTALL_PYTHON .git/hooks/pre-commit
 * - random guesses at ~/venv, ~/virtualenv etc
 * - python -m pre_commit
 */
export default async function getPreCommitPath(projectRoot) {
    // prettier-ignore
    const locations = await Promise.all([
        fromGitHooks(projectRoot),
        fromVenv(projectRoot),
    ]);

    return locations.find((l) => typeof l === 'string');
}
