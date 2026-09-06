"""Replace one image line and prove the resolved configuration changes only that image."""
import json
from pathlib import Path
import re
import subprocess
import sys

original, candidate, project_dir, project, service, old_image, new_image = sys.argv[1:]

def resolved(filename):
    result = subprocess.run(
        ['docker', 'compose', '--project-directory', project_dir, '-p', project,
         '-f', filename, 'config', '--format', 'json'],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)

try:
    before = resolved(original)
    if before['services'][service]['image'] != old_image:
        raise ValueError('Compose 镜像与运行中容器不一致，已停止。')
    text = Path(original).read_text()
    pattern = re.compile(
        r'^(\s*image:\s*)([\x22\x27]?)' + re.escape(old_image)
        + r'\2([ \t]*(?:#[^\n]*)?)$', re.MULTILINE,
    )
    updated, count = pattern.subn(lambda m: m[1] + m[2] + new_image + m[2] + m[3], text)
    if count != 1:
        raise ValueError('无法唯一定位镜像配置，已停止；未修改原文件。')
    Path(candidate).write_text(updated)
    after = resolved(candidate)
    before['services'][service]['image'] = new_image
    if before != after:
        raise ValueError('解析后的 Compose 存在镜像以外的差异，已停止；未修改原文件。')
except subprocess.CalledProcessError:
    sys.exit('Compose 配置验证失败；未输出配置内容，以避免泄露环境变量。')
except (KeyError, ValueError) as error:
    sys.exit(str(error))
