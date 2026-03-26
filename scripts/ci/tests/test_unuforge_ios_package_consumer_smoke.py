#!/usr/bin/env python3
"""Opt-in iOS smoke for installed-package unuforge consumption from unuvault."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import venv


REPO_ROOT = Path(__file__).resolve().parents[3]
PRESET = REPO_ROOT / "presets" / "unuvault" / "release-preset.json"
HOST_PACKAGE = REPO_ROOT / "packages" / "unuvault-forge-host"


def _require_darwin_host() -> None:
    if sys.platform != "darwin":
        raise unittest.SkipTest("Darwin host required for unuvault iOS installed-package smoke.")


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
        check=False,
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


def _copy_host_package(temp_root: Path) -> Path:
    copied_host_package = temp_root / "unuvault-forge-host"
    shutil.copytree(
        HOST_PACKAGE,
        copied_host_package,
        ignore=shutil.ignore_patterns("build", "*.egg-info", "__pycache__"),
    )
    return copied_host_package


def _host_package_install_commands(python_bin: Path, host_package_path: Path) -> list[list[str]]:
    python = str(python_bin)
    return [
        [python, "-m", "pip", "install", "setuptools", "wheel"],
        [python, "-m", "pip", "install", "--no-build-isolation", str(host_package_path)],
    ]


def _ios_installed_command(python_bin: Path) -> list[str]:
    return [
        str(python_bin),
        "-m",
        "unuforge.cli",
        "profiles",
        "run",
        "ios-test-runner",
        "--preset",
        str(PRESET),
        "--host-adapter",
        "unuvault_forge_host",
    ]


class UnuforgeIosPackageConsumerSmokeTests(unittest.TestCase):
    def test_installed_package_ios_runner_uses_unuvault_forge_host(self) -> None:
        _require_darwin_host()

        with tempfile.TemporaryDirectory() as tmp_dir:
            temp_root = Path(tmp_dir)
            wheel_path = _resolve_unuforge_wheel(temp_root)
            host_package_copy = _copy_host_package(temp_root)
            venv_dir = temp_root / "venv"

            venv.EnvBuilder(with_pip=True).create(venv_dir)
            python_bin = venv_dir / "bin" / "python"

            wheel_install_completed = subprocess.run(
                [str(python_bin), "-m", "pip", "install", str(wheel_path)],
                cwd=temp_root,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                wheel_install_completed.returncode,
                0,
                wheel_install_completed.stderr,
            )

            for command in _host_package_install_commands(python_bin, host_package_copy):
                install_completed = subprocess.run(
                    command,
                    cwd=temp_root,
                    env=_controlled_env(),
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(install_completed.returncode, 0, install_completed.stderr)

            run_completed = subprocess.run(
                _ios_installed_command(python_bin),
                cwd=temp_root,
                env=_controlled_env(),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                run_completed.returncode,
                0,
                run_completed.stderr or run_completed.stdout,
            )


if __name__ == "__main__":
    unittest.main()
