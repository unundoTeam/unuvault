from __future__ import annotations

from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[4]
_PROFILE_SCRIPTS = {
    "ios-test-runner": ROOT / "scripts" / "testing" / "run-ios.sh",
    "lint-runner": ROOT / "scripts" / "testing" / "lint-runner.sh",
    "test-runner": ROOT / "scripts" / "testing" / "test-runner.sh",
}


def _passthrough_args(raw: list[str] | None = None) -> list[str]:
    return [] if raw is None else list(raw)


def _profile_script(profile_name: str) -> Path:
    script = _PROFILE_SCRIPTS.get(profile_name)
    if script is None:
        raise ValueError(f"unknown unuvault profile: {profile_name}")
    if not script.exists():
        raise ValueError(f"profile script does not exist: {script}")
    return script


class UnuvaultForgeHost:
    def build_profile_execution(
        self,
        preset_path: str,
        profile_name: str,
        passthrough_args: list[str] | None = None,
    ):
        del preset_path
        script = _profile_script(profile_name)
        return {
            "runner": "command",
            "command": ["bash", str(script), *_passthrough_args(passthrough_args)],
            "cwd": str(ROOT),
        }

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
