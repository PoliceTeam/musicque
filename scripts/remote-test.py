"""Kiểm tra vận hành offline: Git/SSH/curl là stub tạm, không kết nối server."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


class RemoteTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='musicque-ops-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'scripts').mkdir()
        shutil.copy(ROOT / 'scripts/remote.sh', self.root / 'scripts/remote.sh')
        self.log = self.root / 'calls.jsonl'
        stub = '''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
name=Path(sys.argv[0]).name
with open(os.environ['OPS_TEST_LOG'],'a') as out:
    out.write(json.dumps([name]+sys.argv[1:])+'\\n')
if name=='git' and sys.argv[1]=='rev-parse':
    print('a'*40 if sys.argv[2]=='HEAD' or os.environ.get('MATCH_HEAD')=='yes' else 'b'*40)
'''
        for name in ['git', 'ssh', 'curl']:
            target = self.root / name
            target.write_text(stub)
            target.chmod(0o755)
        self.env = dict(os.environ, PATH=str(self.root) + ':' + os.environ['PATH'], OPS_TEST_LOG=str(self.log))

    def run_remote(self, *args):
        return subprocess.run(['bash', 'scripts/remote.sh', *args], cwd=self.root,
                              env=self.env, capture_output=True, text=True)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_unpushed_head_stops_before_ssh(self):
        result = self.run_remote('deploy')
        self.assertEqual(result.returncode, 1)
        self.assertIn('HEAD khác origin/main', result.stdout)
        self.assertFalse(any(call[0] == 'ssh' for call in self.calls()))

    def test_matching_head_dispatches_expected_sha(self):
        self.env['MATCH_HEAD'] = 'yes'
        self.assertEqual(self.run_remote('deploy').returncode, 0)
        self.assertIn("EXPECTED_DEPLOY_SHA='" + 'a'*40 + "'", self.calls()[-1][-1])

    def test_logs_default_and_explicit_service(self):
        self.assertEqual(self.run_remote('logs').returncode, 0)
        self.assertIn('music-order-api', self.calls()[-1][-1])
        self.assertEqual(self.run_remote('logs', '--', 'client').returncode, 0)
        self.assertIn('music-order-client', self.calls()[-1][-1])
        self.assertEqual(self.run_remote('logs', 'api; false').returncode, 1)

    def test_status_checks_both_urls(self):
        self.assertEqual(self.run_remote('status').returncode, 0)
        calls = self.calls()
        remote_command = next(call[-1] for call in calls if call[0] == 'ssh')
        self.assertIn('music-order-', remote_command)
        self.assertEqual(subprocess.run(['bash', '-n', '-c', remote_command]).returncode, 0)
        self.assertEqual(sum(call[0] == 'curl' for call in calls), 2)

    def test_invalid_remote_dir_blocks_ssh(self):
        self.env['REMOTE_DIR'] = "/tmp/invalid';false"
        self.assertEqual(self.run_remote('rollback').returncode, 1)
        self.assertEqual(self.calls(), [])

    def test_env_checker_only_reports_missing_names(self):
        config = {'services': {}}
        service = None
        for line in (ROOT / '.env.prod.example').read_text().splitlines():
            if line.startswith('# SERVICE: '):
                service = line.split(': ', 1)[1]
                config['services'][service] = {'environment': {}}
            if line and line[0].isupper() and '=' in line:
                config['services'][service]['environment'][line.split('=', 1)[0]] = 'do-not-print-this'
        def check():
            return subprocess.run(['python3', 'scripts/check-prod-env.py'], cwd=ROOT,
                                  input=json.dumps(config), capture_output=True, text=True)
        self.assertEqual(check().returncode, 0)
        del config['services']['api']['environment']['SSO_CLIENT_SECRET']
        config['services']['api']['environment']['JWT_SECRET'] = '   '
        result = check()
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout.splitlines(), ['JWT_SECRET', 'SSO_CLIENT_SECRET'])
        self.assertNotIn('do-not-print-this', result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
