[[ "$(sha256sum "$config_file" | cut -d ' ' -f 1)" == "$original_sha" ]] || { printf 'Compose 已变化，请重新运行构建脚本；尚未切换服务。\n' >&2; exit 1; }
[[ "$(docker inspect --format '{{.Image}}' "$container")" == "$old_id" ]] || { printf '运行中镜像已变化，请重新运行构建脚本；尚未切换服务。\n' >&2; exit 1; }
[[ "$(docker image inspect --format '{{.Id}}' "$new_image")" == "$new_id" ]] || { printf '待切换镜像已变化，请重新运行构建脚本；尚未切换服务。\n' >&2; exit 1; }
printf '即将切换 asspp 服务。此步骤会短暂断开连接，请确保没有进行中的下载。\n'
changed=0
on_failure() {
  status=${1:-$?}
  trap - ERR INT TERM
  if [[ "$changed" == 1 ]]; then
    printf '更新或启动检查失败，正在回滚。\n' >&2
    bash "$backup_dir/rollback.sh" || printf '自动回滚失败，请执行：bash %q\n' "$backup_dir/rollback.sh" >&2
  fi
  exit "$status"
}
trap on_failure ERR
trap 'on_failure 130' INT
trap 'on_failure 143' TERM
changed=1
cp -- "$candidate" "$config_file"
"${compose[@]}" up -d --no-deps --force-recreate --pull never "$service"
ready=0
for ((attempt=0; attempt<30; attempt++)); do
  if docker exec "$container" node -e 'fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/auth/status`, {signal: AbortSignal.timeout(2000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" == 1 ]] || on_failure 1
[[ "$(docker inspect --format '{{.Image}}' "$container")" == "$(docker image inspect --format '{{.Id}}' "$new_image")" ]] || on_failure 1
changed=0
trap - ERR INT TERM

printf '新镜像已启动。正在检查并准备 SAP 公共资源（首次需要从苹果下载约 38 MB 的资源）。\n'
if ! docker exec -i "$container" node --input-type=module < "$bundle_dir/prepare-assets.mjs"; then
  printf '镜像已更新，但 SAP 资源准备失败。请保留错误输出；也可执行上述回滚命令。\n' >&2
  exit 2
fi
"${compose[@]}" ps "$service"
printf '\n更新完成。使用原浏览器打开原网址即可，已有可用账号不要重新认证、删除重加或清除网站数据。\n'
printf '仅使用备用账号测试新的登录流程。Chrome 首次签名初始化可能需要约 2 分钟。\n'
printf '构建和资源检查通过不代表真实账号已登录；请以网页登录结果为准。\n'
printf '回滚命令：bash %q\n' "$backup_dir/rollback.sh"
