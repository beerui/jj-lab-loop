import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  applyLoopEnv,
  configureRepo,
  controlRoot,
  copyTree,
  git,
  labRootFromEnv,
  materializedApp,
  originPath,
  rmRetry
} from './lib/lab-util.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, '..');

export function seedLoopGym({ root = labRootFromEnv() || defaultRoot } = {}) {
  const seedSrc = path.join(root, 'seed');
  const app = materializedApp(root);
  const origin = originPath(root);
  const ctl = controlRoot(root);
  const mat = path.join(root, '_materialized');

  rmRetry(mat);
  fs.mkdirSync(mat, { recursive: true });
  copyTree(seedSrc, app);

  git(app, ['init', '--initial-branch=master']);
  configureRepo(app);
  git(app, ['add', '-A']);
  git(app, ['-c', 'commit.gpgsign=false', 'commit', '--no-verify', '-m', 'chore: loop-gym seed']);

  fs.mkdirSync(origin, { recursive: true });
  git(origin, ['init', '--bare', '--initial-branch=master']);
  git(app, ['remote', 'add', 'origin', origin.replaceAll('\\', '/')]);
  git(app, ['push', '-u', 'origin', 'master']);
  git(app, ['checkout', '-b', 'dev']);
  git(app, ['push', '-u', 'origin', 'dev']);
  git(app, ['checkout', '-b', 'staging']);
  git(app, ['-c', 'commit.gpgsign=false', 'commit', '--no-verify', '--allow-empty', '-m', 'Merge #1 into staging']);
  git(app, ['push', '-u', 'origin', 'staging']);
  git(app, ['checkout', 'dev']);

  fs.mkdirSync(path.join(ctl, 'config'), { recursive: true });
  const naming = {
    schema_version: 'jj-flow/naming/1.0',
    dispatch: {
      control_root: ctl.replaceAll('\\', '/'),
      portfolio_root: app.replaceAll('\\', '/')
    }
  };
  fs.writeFileSync(path.join(ctl, 'config', 'naming.json'), `${JSON.stringify(naming, null, 2)}\n`);
  fs.writeFileSync(
    path.join(ctl, 'README.md'),
    'Do not cwd here for git writes.\nLoop gym isolated control_root (not a git repo).\n'
  );

  applyLoopEnv(root);
  return { root, app, origin, control: ctl };
}

const isDirect = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  seedLoopGym();
  process.stdout.write('seeded loop-gym\n');
}
