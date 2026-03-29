from __future__ import annotations

from unuforge.runtime.command_hosts import PresetDrivenCommandHost


class UnuvaultForgeHost(PresetDrivenCommandHost):
    def __init__(self) -> None:
        super().__init__(
            unsupported_action_message="unuvault does not expose machine actions yet",
        )


HOST = UnuvaultForgeHost()
