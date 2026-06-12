# Mac Touch ID Prompt Receipt

Captured on 2026-06-12 through:

```bash
pnpm test:macos:touch-id-prompt-receipt -- --capture --output-dir /tmp/unuvault-touch-id-prompt-review-20260612-235232 --timeout-seconds 12
```

Receipt output:

```text
UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=prompt_requested claim=touch_id_prompt_ux reason="Unlock UnuVault local vault on this Mac." timeout_seconds=12 biometry=touch_id can_biometrics=true
UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=completed result=denied error_domain=com.apple.LocalAuthentication error_code=-9
UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=ready claim=touch_id_prompt_screenshot screenshot=/tmp/unuvault-touch-id-prompt-review-20260612-235232/touch-id-prompt.png unclaimed=notarization,physical_iphone
```

Tracked screenshot:

- `touch-id-prompt.png`

The tracked image is cropped from the temporary full-screen capture so the repo
keeps only the macOS owner-authentication prompt. The temporary full-screen
capture is not committed.
