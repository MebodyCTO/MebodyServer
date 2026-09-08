#!/usr/bin/env bash
# 전문가 인물 사진을 홈페이지 에셋으로 변환해 넣습니다.
#
#   ./scripts/add-expert-photo.sh ~/Downloads/사진.png
#
# png/jpg/webp 무엇이든 받아서 900x900 정사각 webp 로 만듭니다.
# 화면에서는 CSS 로 원형 크롭되므로 정사각으로만 맞추면 됩니다.
set -euo pipefail

SRC="${1:-}"
if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "사용법: $0 <이미지 경로>"
  echo "예:    $0 ~/Downloads/expert.png"
  exit 1
fi

OUT="$(cd "$(dirname "$0")/.." && pwd)/src/main/resources/static/assets/img/mb-expert.webp"

python3 - "$SRC" "$OUT" <<'PY'
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src)
if im.mode in ('RGBA', 'LA', 'P'):
    bg = Image.new('RGB', im.size, (255, 255, 243))   # --mb-cream
    im = im.convert('RGBA')
    bg.paste(im, mask=im.split()[-1])
    im = bg
else:
    im = im.convert('RGB')

# 가운데를 정사각으로 잘라 900x900
w, h = im.size
side = min(w, h)
im = im.crop(((w - side) // 2, 0, (w - side) // 2 + side, side))
im = im.resize((900, 900), Image.LANCZOS)
im.save(out, 'WEBP', quality=88, method=6)
print(f'저장: {out}')
PY

ls -la "$OUT"
echo "완료. 홈페이지를 새로고침하면 반영됩니다."
