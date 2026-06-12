# Mac Touch ID Prompt Localized Product-Name Receipt

Captured on 2026-06-13 through the product-named `UnuVault.app` prompt wrapper
with localized reason copy:

```bash
pnpm test:macos:touch-id-prompt-receipt -- --capture --output-dir docs/design/evidence/2026-06-13-mac-touch-id-prompt-localized --timeout-seconds 12
```

Receipt output:

```text
UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=running check=prompt_capture app_name=UnuVault app_path=/var/folders/3k/nmm05npd501gy97zrjc601ph0000gn/T//unuvault-touch-id-prompt-app.x0BSkg/UnuVault.app output=docs/design/evidence/2026-06-13-mac-touch-id-prompt-localized/touch-id-prompt.png timeout_seconds=12
UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=prompt_requested claim=touch_id_prompt_ux reason="解锁这台 Mac 上的本地保险库" timeout_seconds=12 biometry=touch_id can_biometrics=true
UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=completed result=denied error_domain=com.apple.LocalAuthentication error_code=-9
UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=ready claim=touch_id_prompt_screenshot screenshot=docs/design/evidence/2026-06-13-mac-touch-id-prompt-localized/touch-id-prompt.png unclaimed=notarization,physical_iphone
```

Tracked screenshot:

- `touch-id-prompt.png`

The tracked image is cropped from the temporary full-screen capture so the repo
keeps the macOS owner-authentication prompt as the reviewable receipt. The
`denied` result is the expected timeout-cancel outcome for screenshot capture;
this receipt proves the visible system prompt, not a full unlock.
