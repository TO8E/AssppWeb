from pathlib import Path
import os, subprocess, tempfile, json
bundle = Path(__file__).resolve().parents[1]
mock = r'''#!/usr/bin/env python3
import sys, os, json
from pathlib import Path
args=sys.argv[1:]; root=Path(os.environ['FAKE_SERVER']); cfg=root/'compose.yaml'
with (root/'calls').open('a') as log: log.write(repr((os.environ.get('CASE'),args))+'\n')
def read_image(file):
    import re
    return re.search(r'(?m)^    image: (.+)$',Path(file).read_text())[1]
if args[0]=='compose':
    if args[1]=='version': print('Docker Compose v2'); sys.exit(0)
    filename=args[args.index('-f')+1]
    if 'config' in args:
        if '--quiet' not in args:
            text=Path(filename).read_text()
            print(json.dumps({'services':{'asspp':{'image':read_image(filename),'rest':text.replace(read_image(filename),'IMAGE')}}}))
    elif 'up' in args: (root/'running').write_text(read_image(filename))
    sys.exit(0)
if args[0]=='inspect':
    fmt=args[args.index('--format')+1]
    if 'working_dir' in fmt: print(root)
    elif 'config_files' in fmt: print(cfg)
    elif 'compose.project' in fmt: print('sample')
    elif 'compose.service' in fmt: print('asspp')
    elif 'Config.Image' in fmt: print((root/'running').read_text())
    elif '.Image' in fmt: print('sha256:old' if (root/'running').read_text().startswith('ghcr.io/') else 'sha256:new')
    sys.exit(0)
if args[:2]==['image','inspect']: print('sha256:new'); sys.exit(0)
if args[:2]==['image','tag']: sys.exit(0)
if args[0]=='build':
    if os.environ.get('CASE')=='build_failure': sys.exit(33)
    if os.environ.get('CASE')=='concurrent_edit': cfg.write_text(cfg.read_text()+'# edited by user\n')
    sys.exit(0)
if args[0]=='exec':
    if os.environ.get('CASE')=='startup_failure' and not (root/'running').read_text().startswith('ghcr.io/'): sys.exit(1)
    sys.exit(0)
sys.exit(99)
'''
fixture='''services:
  asspp:
    image: ghcr.io/lakr233/assppweb:latest
    container_name: asspp
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - ./data:/data
    environment:
      ACCESS_PASSWORD: "test-fixture-only"
      PORT: "8080"
'''
for case in ('success','build_failure','startup_failure','concurrent_edit','edit_before_switch'):
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp); binpath=root/'bin'; binpath.mkdir()
        (binpath/'docker').write_text(mock); (binpath/'docker').chmod(0o755)
        (binpath/'sleep').write_text('#!/bin/sh\nexit 0\n'); (binpath/'sleep').chmod(0o755)
        cfg=root/'compose.yaml'; cfg.write_text(fixture)
        (root/'running').write_text('ghcr.io/lakr233/assppweb:latest')
        env={**os.environ,'PATH':str(binpath)+':'+os.environ['PATH'],'FAKE_SERVER':str(root),'CASE':case}
        result=subprocess.run(['bash',str(bundle/'build.sh')],env=env,capture_output=True,text=True)
        if case in ('build_failure','concurrent_edit'):
            assert result.returncode != 0, result.stdout
            expected = fixture + ('# edited by user\n' if case=='concurrent_edit' else '')
            assert cfg.read_text() == expected
            assert (root/'running').read_text() == 'ghcr.io/lakr233/assppweb:latest'
        else:
            assert result.returncode == 0, result.stdout+result.stderr
            assert cfg.read_text() == fixture, 'Build modified Compose'
            assert (root/'running').read_text() == 'ghcr.io/lakr233/assppweb:latest', 'Build switched container'
            activate = next(root.glob('.asspp-sap-backup.*/activate.sh'))
            subprocess.run(['bash','-n',str(activate)],check=True)
            if case=='edit_before_switch': cfg.write_text(fixture+'# changed after build\n')
            activation=subprocess.run(['bash',str(activate)],env=env,capture_output=True,text=True)
            text=cfg.read_text()
            if case=='success':
                assert activation.returncode==0, activation.stdout+activation.stderr
                assert 'image: assppweb:local-' in text
                assert text.replace(next(line for line in text.splitlines() if 'image:' in line),'    image: ghcr.io/lakr233/assppweb:latest') == fixture
                rollback=next(root.glob('.asspp-sap-backup.*/rollback.sh'))
                subprocess.run(['bash',str(rollback)],env=env,check=True,capture_output=True)
                assert cfg.read_text()==fixture
            else:
                assert activation.returncode != 0, activation.stdout
                expected = fixture + ('# changed after build\n' if case=='edit_before_switch' else '')
                assert text==expected, activation.stdout+activation.stderr
                assert (root/'running').read_text()=='ghcr.io/lakr233/assppweb:latest'
        print(case+': passed (mock Docker, separate build and activation)')
