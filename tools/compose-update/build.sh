#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ $# == 0 ]] || { printf '直接运行本脚本构建镜像；切换服务请使用它输出的 activate.sh 命令。\n' >&2; exit 1; }

die() { printf '%s\n' "$*" >&2; exit 1; }
for app in docker python3 sha256sum; do
  command -v "$app" >/dev/null || die "缺少命令：$app";
done
docker compose version >/dev/null
bundle_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source_dir=$(cd -- "$bundle_dir/../.." && pwd)
container=asspp
label() { docker inspect --format "{{index .Config.Labels \"$1\"}}" "$container"; }
project_dir=$(label com.docker.compose.project.working_dir)
config_file=$(label com.docker.compose.project.config_files)
project=$(label com.docker.compose.project)
service=$(label com.docker.compose.service)
[[ "$service" == asspp ]] || die '容器 asspp 不属于 Compose 的 asspp 服务。'
[[ -d "$project_dir" && -n "$project" && "$project" != '<no value>' ]] || die '无法从容器标签找到 Compose 项目目录。'
[[ "$config_file" != *,* && -f "$config_file" ]] || die '此脚本适用于你提供的单文件 Compose；检测到多文件配置或配置文件不存在，已停止。'
[[ ! -L "$config_file" ]] || die 'Compose 文件是符号链接，已停止以避免改错目标。'
[[ -f "$source_dir/Dockerfile" ]] || die '缺少仓库根目录的 Dockerfile。'
compose=(docker compose --project-directory "$project_dir" -p "$project" -f "$config_file")
"${compose[@]}" config --quiet
old_image=$(docker inspect --format '{{.Config.Image}}' "$container")
old_id=$(docker inspect --format '{{.Image}}' "$container")
[[ "$old_image" != *@* ]] || die '检测到使用摘要锁定的镜像，此脚本不会改写该配置。'
stamp=$(date -u +%Y%m%d%H%M%S)-$$
new_image="assppweb:local-$stamp"
backup_image="assppweb:before-update-$stamp"
backup_dir=$(mktemp -d "$project_dir/.asspp-sap-backup.XXXXXX")
candidate="$backup_dir/compose.next.yaml"
cp -p -- "$config_file" "$backup_dir/compose.before.yaml"
original_sha=$(sha256sum "$config_file" | cut -d ' ' -f 1)
printf 'Compose：%s\n备份目录：%s\n构建镜像：%s\n' "$config_file" "$backup_dir" "$new_image"

# Validate the resolved Compose configuration in memory; passwords are never printed.
python3 "$bundle_dir/replace-image.py" "$config_file" "$candidate" "$project_dir" "$project" "$service" "$old_image" "$new_image"
docker image tag "$old_id" "$backup_image"
{
  printf '#!/usr/bin/env bash\nset -euo pipefail\n'
  printf 'docker image tag %q %q\n' "$backup_image" "$old_image"
  printf 'cp -p -- %q %q\n' "$backup_dir/compose.before.yaml" "$config_file"
  printf '%q ' "${compose[@]}"
  printf 'up -d --no-deps --force-recreate --pull never %q\n' "$service"
  printf 'printf "已恢复更新前的 Compose 和镜像。\\n"\n'
} > "$backup_dir/rollback.sh"
chmod 700 "$backup_dir/rollback.sh"
printf '回滚命令：bash %q\n' "$backup_dir/rollback.sh"

# The running service stays up throughout dependency installation, tests and build.
build_commit=$(git -C "$source_dir" rev-parse --short HEAD 2>/dev/null || printf unknown)
docker build --pull \
  --build-arg "BUILD_COMMIT=$build_commit" \
  --build-arg "BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t "$new_image" "$source_dir"
[[ "$(sha256sum "$config_file" | cut -d ' ' -f 1)" == "$original_sha" ]] || die '构建期间 Compose 被其他操作修改，已停止；旧服务继续运行。'

new_id=$(docker image inspect --format '{{.Id}}' "$new_image")
{
  printf '#!/usr/bin/env bash\nset -Eeuo pipefail\numask 077\n'
  for variable in bundle_dir container project_dir config_file project service old_image old_id new_image new_id backup_image backup_dir candidate original_sha; do
    printf '%s=%q\n' "$variable" "${!variable}"
  done
  printf 'compose=('
  printf '%q ' "${compose[@]}"
  printf ')\n'
  cat "$bundle_dir/activate-template.sh"
} > "$backup_dir/activate.sh"
chmod 700 "$backup_dir/activate.sh"
printf '\n修复镜像已构建完成，现有容器及 Compose 尚未切换。\n'
printf '确认账号已导出备份，并等待现有下载结束后，执行以下命令切换：\n'
printf 'sudo bash %q\n' "$backup_dir/activate.sh"
