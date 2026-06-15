#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GIF_DIR="${ROOT_DIR}/public/sample-media/gif"
TMP_DIR="${GIF_DIR}/.reencode_tmp"
REPORT_PATH="${ROOT_DIR}/scripts/reencode-report.txt"
ORIG_DIR="/Users/wh.choi/Downloads/gif 파일 압축"

mkdir -p "${TMP_DIR}"

echo "Re-encoding GIF files in ${GIF_DIR}"
echo "Profile: balanced (max 800px, fps=22, palette dithering)"

# Restore originals from Downloads when available.
for key in q01 q02 q03 q04 q05 q06 q07 q08 q09 q10 q11 q12; do
  case "${key}" in
    q01) orig="1-1" ;;
    q02) orig="1-1" ;;
    q03) orig="1-1" ;;
    q04) orig="2-1" ;;
    q05) orig="2-2" ;;
    q06) orig="2-3" ;;
    q07) orig="3-1" ;;
    q08) orig="3-2" ;;
    q09) orig="3-3" ;;
    q10) orig="4-1" ;;
    q11) orig="4-2" ;;
    q12) orig="4-3" ;;
  esac
  src_orig="${ORIG_DIR}/${orig}.gif"
  dest="${GIF_DIR}/${key}.gif"
  if [ -f "${src_orig}" ]; then
    cp "${src_orig}" "${dest}"
  fi
done

total_before=0
total_after=0

{
  echo "file,before_bytes,after_bytes,reduction_percent"

  for src in "${GIF_DIR}"/q*.gif; do
    [ -e "${src}" ] || continue
    name="$(basename "${src}")"
    out="${TMP_DIR}/${name}"
    palette="${TMP_DIR}/${name%.gif}.png"

    before="$(stat -f%z "${src}")"
    total_before=$((total_before + before))

    ffmpeg -y -i "${src}" \
      -vf "fps=22,scale='if(gt(iw,800),800,iw)':-1:flags=lanczos,palettegen=max_colors=256:stats_mode=full" \
      "${palette}" >/dev/null 2>&1

    ffmpeg -y -i "${src}" -i "${palette}" \
      -lavfi "fps=22,scale='if(gt(iw,800),800,iw)':-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=2:diff_mode=none" \
      -gifflags -offsetting \
      "${out}" >/dev/null 2>&1

    after="$(stat -f%z "${out}")"
    total_after=$((total_after + after))

    if [ "${after}" -ge "${before}" ]; then
      cp "${src}" "${out}"
      after="${before}"
    fi

    reduction="$(python3 - <<PY
before=${before}
after=${after}
print(round((before-after)*100/before, 2))
PY
)"
    echo "${name},${before},${after},${reduction}"
  done
} > "${REPORT_PATH}"

for out in "${TMP_DIR}"/q*.gif; do
  [ -e "${out}" ] || continue
  cp "${out}" "${GIF_DIR}/$(basename "${out}")"
done

rm -rf "${TMP_DIR}"

python3 - <<PY
before=${total_before}
after=${total_after}
saved=before-after
rate=(saved*100/before) if before else 0
print(f"Before: {before} bytes ({before/1024/1024:.2f} MB)")
print(f"After:  {after} bytes ({after/1024/1024:.2f} MB)")
print(f"Saved:  {saved} bytes ({saved/1024/1024:.2f} MB, {rate:.2f}%)")
print("Detailed report:", "${REPORT_PATH}")
PY
