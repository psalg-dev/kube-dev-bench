# Windows Code Signing

## Problem

On stricter/managed Windows machines, the released `.exe` is blocked by Windows
SmartScreen with **no "Run anyway"** option because the binary is **unsigned**.

The release workflow (`.github/workflows/build.yml`, "Sign Windows executable"
step) already contains signing plumbing, but it is **skipped** unless the
`CODE_SIGN_PFX` and `CODE_SIGN_PASSWORD` repo secrets are set. They are not, so
every release ships unsigned.

## First: confirm it's actually SmartScreen (not AppLocker/WDAC)

On a locked-down corporate laptop the block may be app-allowlisting policy, which
**no signature you control can fix** — only IT can allowlist the publisher/hash.

Run on the affected laptop:

```powershell
Unblock-File .\KubeDevBench-windows-amd64.exe   # removes mark-of-the-web
.\KubeDevBench-windows-amd64.exe
```

- Runs now → it was SmartScreen / mark-of-the-web. **Signing will fix it for good.**
- Still blocked with an "administrator has blocked / policy" message → it's
  **WDAC or AppLocker**. Signing won't help; ask IT to allowlist the app.

## Why the existing PFX step is a dead end for a *new* cert

Since June 2023 the CA/Browser Forum forbids exportable private keys for
publicly-trusted code-signing certs — the key must live on a hardware token or
cloud HSM. So you can no longer buy a plain `.pfx` from a public CA. A
*self-signed* pfx signs fine but does **nothing** for SmartScreen (untrusted
publisher). The `CODE_SIGN_PFX` path only works with a pre-2023 exportable cert.

## Why "just sign it" isn't enough

SmartScreen judges **reputation**, not merely "is it signed":

| Cert type | Cost | Clears SmartScreen | Notes |
|---|---|---|---|
| **Azure Trusted Signing** | ~$10/mo | Yes (good reputation) | Microsoft-run, CI action available. **Recommended.** |
| **EV** (SSL.com eSigner, DigiCert KeyLocker) | ~$300–600/yr | Yes (immediate) | Cloud-HSM, signs via provider API |
| Standard **OV** pfx (pre-2023 only) | — | No — builds over time | Fits current step but won't help soon |
| Self-signed pfx | free | **No** | Useless for SmartScreen |

## Recommended fix: Azure Trusted Signing

Cheapest path that clears SmartScreen. Requires the org to pass Microsoft
identity verification (established legal entity; orgs <3 years old need extra
proof).

### One-time Azure setup

1. Create an Azure subscription + resource group.
2. Create a **Trusted Signing account** (region e.g. `westus`).
3. Create an **Identity Validation** request; wait for approval (business docs).
4. Create a **Certificate Profile** (type: Public Trust) under the account.
5. Grant a service principal / OIDC federated credential the
   **Trusted Signing Certificate Profile Signer** role on the account.
6. Store `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_SUBSCRIPTION_ID` (and
   OIDC or `AZURE_CLIENT_SECRET`) as repo secrets.

### Workflow change (replaces the current "Sign Windows executable" step)

```yaml
      - name: Azure login
        if: matrix.platform == 'windows'
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Sign Windows executable (Trusted Signing)
        if: matrix.platform == 'windows'
        uses: azure/trusted-signing-action@v0
        with:
          endpoint: https://wus.codesigning.azure.net/      # match your account region
          trusted-signing-account-name: <your-account-name>
          certificate-profile-name: <your-profile-name>
          files-folder: build/bin
          files-folder-filter: exe
          file-digest: SHA256
          timestamp-rfc3161: http://timestamp.acs.microsoft.com
          timestamp-digest: SHA256
```

Add `permissions: id-token: write` to the `release` job for OIDC login.

## Alternative: EV cloud-HSM cert

If you already have / prefer an EV cert (SSL.com eSigner, DigiCert KeyLocker),
each provider ships its own CI signing tool/action that authenticates via API
credentials (not a PFX). Wire that in place of the current step. Immediate
SmartScreen trust, higher yearly cost.

## Immediate workaround (no signing)

Ship users the `Unblock-File` one-liner above. Works only where the block is
SmartScreen/mark-of-the-web, not policy allowlisting.
