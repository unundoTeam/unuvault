"""Repo-root compatibility namespace for the unuvault-forge-host package."""

from __future__ import annotations

from pathlib import Path


_SRC_PACKAGE = (
    Path(__file__).resolve().parents[1]
    / "packages"
    / "unuvault-forge-host"
    / "src"
    / "unuvault_forge_host"
)

__path__ = [str(Path(__file__).resolve().parent), str(_SRC_PACKAGE)]

from .host import HOST

__all__ = ["HOST"]
