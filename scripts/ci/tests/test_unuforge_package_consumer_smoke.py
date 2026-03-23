#!/usr/bin/env python3
"""Opt-in smoke for installed-package unuforge consumption from unuvault."""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import venv
from unittest import mock


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
        [python, "-m", "pip", "install", "--no-build-isolation", str(host_package_path)],
    ]


def _site_packages_for_module(module_name: str) -> Path | None:
    spec = importlib.util.find_spec(module_name)
    if spec is not None and spec.origin:
        return Path(spec.origin).resolve().parents[1]

    for search_root in (Path("/opt/homebrew"), Path("/usr/local")):
        if not search_root.exists():
            continue
        candidate = next(
            search_root.rglob(f"site-packages/{module_name}/__init__.py"),
            None,
        )
        if candidate is not None:
            return candidate.resolve().parents[1]

    return None


def _host_package_install_env() -> dict[str, str]:
    env = _controlled_env()
    site_packages: list[str] = []

    for module_name in ("setuptools", "wheel"):
        module_site_packages = _site_packages_for_module(module_name)
        if module_site_packages is None:
            raise AssertionError(
                f"Unable to locate local {module_name} site-packages for offline host-package install."
            )
        site_packages.append(str(module_site_packages))

    env["PYTHONPATH"] = os.pathsep.join(dict.fromkeys(site_packages))
    return env


class UnuforgePackageConsumerSmokeTests(unittest.TestCase):
    def test_controlled_env_strips_ambient_pythonpath_and_repo_overrides(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "PYTHONPATH": "/tmp/ambient-pythonpath",
                "UNUFORGE_SRC_ROOT": "/tmp/unuforge-src",
                "UNUFORGE_REPO_ROOT": "/tmp/unuforge-repo",
            },
            clear=False,
        ):
            env = _controlled_env()

        self.assertNotIn("PYTHONPATH", env)
        self.assertNotIn("UNUFORGE_SRC_ROOT", env)
        self.assertNotIn("UNUFORGE_REPO_ROOT", env)

    def test_host_package_install_commands_prepare_build_backend_without_isolation(self) -> None:
        python_bin = Path("/tmp/fake-python")
        host_package_path = Path("/tmp/fake-host-package")

        commands = _host_package_install_commands(python_bin, host_package_path)

        self.assertEqual(
            commands,
            [
                [
                    "/tmp/fake-python",
                    "-m",
                    "pip",
                    "install",
                    "--no-build-isolation",
                    "/tmp/fake-host-package",
                ],
            ],
        )

    def test_host_package_install_env_uses_local_build_backend_paths(self) -> None:
        with mock.patch(
            __name__ + "._site_packages_for_module",
            side_effect=[Path("/tmp/setuptools-site"), Path("/tmp/wheel-site")],
        ):
            env = _host_package_install_env()

        self.assertEqual(
            env["PYTHONPATH"],
            "/tmp/setuptools-site" + os.pathsep + "/tmp/wheel-site",
        )

    def test_installed_package_dry_runs_use_unuvault_forge_host(self) -> None:
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
            )
            self.assertEqual(
                wheel_install_completed.returncode,
                0,
                wheel_install_completed.stderr,
            )

            host_package_install_env = _host_package_install_env()

            for command in _host_package_install_commands(python_bin, host_package_copy):
                install_completed = subprocess.run(
                    command,
                    cwd=temp_root,
                    env=host_package_install_env,
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
            profile_names = list_payload["profiles"]
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
