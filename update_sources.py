import os
from pathlib import Path

root_dir = Path("/Users/sanketvalunj/cryptix")
sources_path = root_dir / "garud_drishti.egg-info" / "SOURCES.txt"
sources_path.parent.mkdir(parents=True, exist_ok=True)

ignore_dirs = {
    ".git", "venv", "node_modules", "__pycache__", 
    ".pytest_cache", ".mypy_cache", ".ruff_cache"
}

files_list = []
for dirpath, dirnames, filenames in os.walk(root_dir):
    # Prune ignored directories
    dirnames[:] = [d for d in dirnames if d not in ignore_dirs and not d.startswith('.')]
    for f in filenames:
        if f.startswith('.') and f not in [".env", ".gitignore", ".dockerignore"]:
            continue
        # Skip pyc and egg-info files themselves unless requested
        if f.endswith('.pyc'):
            continue
        
        rel_path = Path(dirpath) / f
        try:
            files_list.append(str(rel_path.relative_to(root_dir)))
        except ValueError:
            pass

files_list.sort()

with open(sources_path, "w", encoding="utf-8") as f:
    f.write("\n".join(files_list) + "\n")

print(f"Updated SOURCES.txt with {len(files_list)} files.")
