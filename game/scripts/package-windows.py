"""Bundle the verified website and portable Windows x64 runtime for the museum."""

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--runtime", required=True, type=Path, help="Directory containing node.exe and its LICENSE")
    args = parser.parse_args()
    game = Path(__file__).resolve().parents[1]
    dist = game / "dist"
    if not (dist / "index.html").is_file() or not (dist / "museum/catalog.json").is_file():
        parser.error("Build the game or unpack the verified workshop-site artifact into game/dist first.")

    files = [(game / name, name) for name in ("게임실행.cmd", "Start-Game.ps1", "server.mjs")]
    files.append((game / "전달용/실행안내.txt", "실행안내.txt"))
    files.extend((args.runtime / name, f"runtime/{name}") for name in ("node.exe", "LICENSE"))
    files.extend((path, path.relative_to(game).as_posix()) for path in sorted(dist.rglob("*")) if path.is_file())
    for path, _ in files:
        if not path.is_file():
            parser.error(f"Missing file: {path}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.output, "x", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for path, name in files:
            if name in ("게임실행.cmd", "Start-Game.ps1", "실행안내.txt"):
                # Windows PowerShell 5.1 needs the script BOM; preserve it as bytes.
                archive.writestr(name, path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
            else:
                archive.write(path, name)


if __name__ == "__main__":
    main()
