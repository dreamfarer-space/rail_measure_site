# 把 img/defect/*.jpg|png 等比压到宽高不超过 900px，统一重存为 JPEG（质量 82），
# 并同步改写 index.json 里的 file 字段（源图可能是 PNG）。
from json import loads, dumps
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent / "img" / "defect"
index_path = root / "index.json"
index = loads(index_path.read_text(encoding="utf-8"))

n = 0
for row in index["classes"]:
    src = root / row["file"]
    if not src.exists():
        continue
    im = Image.open(src).convert("RGB")
    im.thumbnail((900, 900), Image.Resampling.LANCZOS)
    out = root / f"{row['code']}.jpg"
    im.save(out, "JPEG", quality=82, optimize=True)
    if out != src and src.exists():
        src.unlink()
    row["file"] = out.name
    n += 1

index_path.write_text(dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"resized {n} samples, max 900px")
