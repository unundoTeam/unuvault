#!/usr/bin/env python3
"""Unit coverage for the unuvault iOS installed-package smoke."""

from __future__ import annotations

import os
from pathlib import Path
import unittest
from unittest import mock

import test_unuforge_ios_package_consumer_smoke as module


class UnuforgeIosPackageConsumerSmokeUnitTests(unittest.TestCase):
    def test_resolve_unuforge_wheel_prefers_explicit_wheel_path(self) -> None:
        with mock.patch.dict(
            os.environ,
            {"UNUFORGE_WHEEL_PATH": "~/tmp/unuforge-0.3.0-py3-none-any.whl"},
            clear=False,
        ):
            resolved = module._resolve_unuforge_wheel(Path("/tmp/unused-temp-root"))

        self.assertEqual(
            resolved,
            Path("~/tmp/unuforge-0.3.0-py3-none-any.whl").expanduser().resolve(),
        )

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
            env = module._controlled_env()

        self.assertNotIn("PYTHONPATH", env)
        self.assertNotIn("UNUFORGE_SRC_ROOT", env)
        self.assertNotIn("UNUFORGE_REPO_ROOT", env)
        self.assertEqual(env["PYTHONNOUSERSITE"], "1")

    def test_host_package_install_commands_bootstrap_build_backend_inside_venv(self) -> None:
        python_bin = Path("/tmp/fake-python")
        host_package_path = Path("/tmp/fake-host-package")

        commands = module._host_package_install_commands(python_bin, host_package_path)

        self.assertEqual(
            commands,
            [
                [
                    "/tmp/fake-python",
                    "-m",
                    "pip",
                    "install",
                    "setuptools",
                    "wheel",
                ],
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

    def test_require_darwin_host_skips_on_non_darwin(self) -> None:
        with mock.patch.object(module.sys, "platform", "linux"):
            with self.assertRaises(unittest.SkipTest) as raised:
                module._require_darwin_host()

        self.assertIn("Darwin", str(raised.exception))

    def test_installed_ios_command_targets_ios_test_runner(self) -> None:
        python_bin = Path("/tmp/fake-python")

        command = module._ios_installed_command(python_bin)

        self.assertEqual(
            command,
            [
                "/tmp/fake-python",
                "-m",
                "unuforge.cli",
                "profiles",
                "run",
                "ios-test-runner",
                "--preset",
                str(module.PRESET),
                "--host-adapter",
                "unuvault_forge_host",
            ],
        )


if __name__ == "__main__":
    unittest.main()
