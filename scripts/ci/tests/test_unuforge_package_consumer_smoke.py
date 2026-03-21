#!/usr/bin/env python3
"""Opt-in smoke for installed-package unuforge consumption from unuvault."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import venv


REPO_ROOT = Path(__file__).resolve().parents[3]
PRESET = REPO_ROOT / "presets" / "unuvault" / "release-preset.json"
HOST_PACKAGE = REPO_ROOT / "packages" / "unuvault-forge-host"


def _resolve_unuforge_wheel(temp_root: Path) -> Path:
    wheel_env = os.environ.get("UNUFORGE_WHEEL_PATH")
    if wheel_env:
        return Path(wheel_env).expanduser().resolve()

    repo_root_env = os.environ.get("UNUFORGE_REPO_ROOT")
    if not repo_root_env:
        raise unittest.SkipTest("Set UNUFORGE_WHEEL_PATH or UNUFORGE_REPO_ROOT to run this smoke.")

    repo_root = Path(repo_root_env).expanduser().resolve()
    build_script = repo_root / "scripts" / "build_distribution.py"
    dist_dir = temp_root / "unuforge-dist"
    completed = subprocess.run(
        [sys.executable, str(build_script), "--out-dir", str(dist_dir), "--json"],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise AssertionError(completed.stderr or completed.stdout)

    payload = json.loads(completed.stdout)
    return Path(payload["wheel"]).resolve()


def _controlled_env() -> dict[str, str]:
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)
    env.pop("UNUFORGE_SRC_ROOT", None)
    env.pop("UNUFORGE_REPO_ROOT", None)
    env["PYTHONNOUSERSITE"] = "1"
    return env


class UnuforgePackageConsumerSmokeTests(unittest.TestCase):
    def test_installed_package_dry_runs_use_unuvault_forge_host(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            temp_root = Path(tmp_dir)
            wheel_path = _resolve_unuforge_wheel(temp_root)
            venv_dir = temp_root / "venv"

            venv.EnvBuilder(with_pip=True).create(venv_dir)
            python_bin = venv_dir / "bin" / "python"

            install_completed = subprocess.run(
                [
                    str(python_bin),
                    "-m",
                    "pip",
                    "install",
                    str(wheel_path),
                    str(HOST_PACKAGE),
                ],
                cwd=temp_root,
                capture_output=True,
                text=True,
            )
            self.assertEqual(install_completed.returncode, 0, install_completed.stderr)

            env = _controlled_env()

            inspect_completed = subprocess.run(
                [
                    str(python_bin),
                    "-m",
                    "unuforge.cli",
                    "preset",
                    "inspect",
                    "--preset",
                    str(PRESET),
                    "--json",
                ],
                cwd=temp_root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertEqual(inspect_completed.returncode, 0, inspect_completed.stderr)
            inspect_payload = json.loads(inspect_completed.stdout)
            self.assertEqual(inspect_payload["project"]["name"], "unuvault")

            list_completed = subprocess.run(
                [
                    str(python_bin),
                    "-m",
                    "unuforge.cli",
                    "profiles",
                    "list",
                    "--preset",
                    str(PRESET),
                    "--json",
                ],
                cwd=temp_root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertEqual(list_completed.returncode, 0, list_completed.stderr)
            list_payload = json.loads(list_completed.stdout)
            profile_names = [item["name"] for item in list_payload["profiles"]]
            self.assertIn("lint-runner", profile_names)
            self.assertIn("test-runner", profile_names)

            lint_completed = subprocess.run(
                [
                    str(python_bin),
                    "-m",
                    "unuforge.cli",
                    "profiles",
                    "run",
                    "lint-runner",
                    "--preset",
                    str(PRESET),
                    "--host-adapter",
                    "unuvault_forge_host",
                    "--dry-run",
                    "--json",
                ],
                cwd=temp_root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertEqual(lint_completed.returncode, 0, lint_completed.stderr)
            lint_payload = json.loads(lint_completed.stdout)
            self.assertEqual(lint_payload["runner"], "command")
            self.assertEqual(lint_payload["cwd"], str(REPO_ROOT))
            self.assertEqual(
                lint_payload["command"],
                ["bash", str(REPO_ROOT / "scripts" / "testing" / "lint-runner.sh")],
            )

            test_completed = subprocess.run(
                [
                    str(python_bin),
                    "-m",
                    "unuforge.cli",
                    "profiles",
                    "run",
                    "test-runner",
                    "--preset",
                    str(PRESET),
                    "--host-adapter",
                    "unuvault_forge_host",
                    "--dry-run",
                    "--json",
                ],
                cwd=temp_root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertEqual(test_completed.returncode, 0, test_completed.stderr)
            test_payload = json.loads(test_completed.stdout)
            self.assertEqual(test_payload["runner"], "command")
            self.assertEqual(test_payload["cwd"], str(REPO_ROOT))
            self.assertEqual(
                test_payload["command"],
                ["bash", str(REPO_ROOT / "scripts" / "testing" / "test-runner.sh")],
            )


if __name__ == "__main__":
    unittest.main()
