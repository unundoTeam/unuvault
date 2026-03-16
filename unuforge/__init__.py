"""Repo-root compatibility namespace for the unuforge bootstrap package."""

from __future__ import annotations

from collections.abc import Mapping
import os
from pathlib import Path


def _repo_root(package_file: Path) -> Path:
    return package_file.resolve().parents[1]


def _common_repo_root(repo_root: Path) -> Path:
    git_path = repo_root / ".git"
    if git_path.is_dir():
        return repo_root
    if not git_path.is_file():
        return repo_root

    contents = git_path.read_text(encoding="utf-8").strip()
    prefix = "gitdir:"
    if not contents.startswith(prefix):
        return repo_root

    gitdir = contents[len(prefix) :].strip()
    common_git_dir = (repo_root / gitdir).resolve()
    if common_git_dir.name == ".git":
        return common_git_dir.parent
    if common_git_dir.parent.name == "worktrees" and common_git_dir.parent.parent.name == ".git":
        return common_git_dir.parents[2]
    return repo_root


def _candidate_source_roots(
    repo_root: Path,
    *,
    env: Mapping[str, str] | None = None,
) -> list[Path]:
    values = dict(os.environ if env is None else env)
    common_repo_root = _common_repo_root(repo_root)
    candidates = [
        Path(values["UNUFORGE_SRC_ROOT"]).expanduser()
        if values.get("UNUFORGE_SRC_ROOT")
        else None,
        Path(values["UNUFORGE_REPO_ROOT"]).expanduser() / "src" / "unuforge"
        if values.get("UNUFORGE_REPO_ROOT")
        else None,
        common_repo_root.parent / "unuforge" / "src" / "unuforge",
    ]

    resolved: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        if candidate is None:
            continue
        path = candidate.resolve()
        if not path.exists() or path in seen:
            continue
        seen.add(path)
        resolved.append(path)
    return resolved


_PACKAGE_DIR = Path(__file__).resolve().parent
_SOURCE_ROOTS = _candidate_source_roots(_repo_root(Path(__file__)))
if not _SOURCE_ROOTS:
    raise RuntimeError(
        "Unable to locate unuforge sources. "
        "Set UNUFORGE_SRC_ROOT or UNUFORGE_REPO_ROOT, or provide a sibling unuforge repo."
    )

__path__ = [str(_PACKAGE_DIR), *[str(path) for path in _SOURCE_ROOTS]]
