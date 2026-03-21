from __future__ import annotations

import json
from pathlib import Path
import subprocess
from typing import Any


def _load_preset(preset_path: str) -> tuple[Path, dict[str, Any]]:
    resolved_preset_path = Path(preset_path).resolve()
    payload = json.loads(resolved_preset_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("preset root must be an object")
    return resolved_preset_path, payload


def _repo_root_from_preset_path(preset_path: Path) -> Path:
    return preset_path.parents[2]


def _surface_index(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    raw_surfaces = payload.get("surfaces")
    if not isinstance(raw_surfaces, list):
        raise ValueError("preset `surfaces` must be an array")

    index: dict[str, dict[str, Any]] = {}
    for surface in raw_surfaces:
        if not isinstance(surface, dict):
            raise ValueError("preset surfaces must be objects")
        name = surface.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("preset surface name must be a non-empty string")
        index[name] = surface
    return index


def _entrypoint_keys(target: str) -> tuple[str, str]:
    normalized = target.strip()
    return normalized, normalized.replace("-", "_")


def _resolve_profile_script(payload: dict[str, Any], profile_name: str) -> str:
    surface = _surface_index(payload).get(profile_name)
    if not isinstance(surface, dict) or surface.get("type") != "profile":
        raise ValueError(f"unknown profile: {profile_name}")

    target = surface.get("target")
    if not isinstance(target, str) or not target.strip():
        raise ValueError(f"preset profile `{profile_name}` missing `target`")

    entrypoints = payload.get("entrypoints")
    if not isinstance(entrypoints, dict):
        raise ValueError("preset `entrypoints` must be an object for profile execution")

    for entrypoint_key in _entrypoint_keys(target):
        script_path = entrypoints.get(entrypoint_key)
        if isinstance(script_path, str) and script_path.strip():
            return script_path.strip()

    raise ValueError(f"preset profile `{profile_name}` missing entrypoint mapping")


def _build_command(
    repo_root: Path,
    script_path: str,
    passthrough_args: list[str] | None = None,
) -> dict[str, object]:
    resolved_script = (repo_root / script_path).resolve()
    if not resolved_script.exists():
        raise ValueError(f"profile script does not exist: {resolved_script}")
    return {
        "runner": "command",
        "command": ["bash", str(resolved_script), *(passthrough_args or [])],
        "cwd": str(repo_root),
    }


class UnuvaultForgeHost:
    def build_profile_execution(
        self,
        preset_path: str,
        profile_name: str,
        passthrough_args: list[str] | None = None,
    ):
        resolved_preset_path, payload = _load_preset(preset_path)
        repo_root = _repo_root_from_preset_path(resolved_preset_path)
        script_path = _resolve_profile_script(payload, profile_name)
        return _build_command(repo_root, script_path, passthrough_args)

    def run_profile(
        self,
        preset_path: str,
        profile_name: str,
        passthrough_args: list[str] | None = None,
    ) -> int:
        execution = self.build_profile_execution(preset_path, profile_name, passthrough_args)
        completed = subprocess.run(execution["command"], cwd=execution["cwd"], check=False)
        return completed.returncode

    def build_action_execution(
        self,
        preset_path: str,
        action_name: str,
        passthrough_args: list[str] | None = None,
    ):
        del preset_path, action_name, passthrough_args
        raise ValueError("unuvault does not expose machine actions yet")

    def run_action(
        self,
        preset_path: str,
        action_name: str,
        passthrough_args: list[str] | None = None,
    ) -> int:
        del preset_path, action_name, passthrough_args
        raise ValueError("unuvault does not expose machine actions yet")


HOST = UnuvaultForgeHost()
