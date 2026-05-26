# Account Recovery

unuvault is local-first. That means the vault can work on a trusted device
without making the server a plaintext reader of passwords.

Recovery is intentionally limited. This improves trust, but it also means users
should keep their primary password and recovery information in a place they
control.

## What To Do

- Keep your primary password in a secure offline location you trust
- Keep at least one trusted device or recovery package available
- Review your signed-in devices regularly
- Revoke devices you no longer recognize or use
- Export backups only when you understand where they will be stored

## If A Device Is Lost

If one of your devices is lost:

1. Open unuvault from another trusted device or sign in to the account surface.
2. Review recent activity and the device list.
3. Mark the missing device as lost or revoke it.
4. Change your primary password if you believe the device was unlocked or the
   primary password was exposed.
5. Restore to a new device from a trusted device, recovery key, or encrypted
   backup if you have one.

Revoking a device stops future sync and account-backed access for that device.
It cannot guarantee deletion of an encrypted vault copy already stored on a
lost device that stays offline. Local encryption, system disk protection,
auto-lock, and short unlock sessions remain the first defense.

## Local-Only Use

Local-only use does not require account login, but it also means unuvault cannot
provide remote device revocation, server-backed activity review, or account
assisted recovery. If every local copy and every recovery material is lost,
unuvault cannot restore plaintext vault contents.

## What unuvault Can Help With

- Showing your current devices
- Showing recent activity
- Marking a signed-in device as lost or revoked
- Explaining which actions require the primary password
- Restoring from another trusted device, recovery key, or encrypted backup when
  that recovery material exists

## What unuvault Should Not Promise

- Reading plaintext vault contents from the server
- Fully restoring access without the primary password
- Remotely deleting encrypted data from a lost device that never comes back
  online
