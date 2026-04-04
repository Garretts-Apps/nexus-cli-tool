# Security Posture

## Credential Storage & OS-Level Concerns

### /proc/environ Exposure (Linux)

**Concern**: On Linux systems, same-UID processes can read `/proc/[pid]/environ` to inspect the environment variables of a running process, potentially exposing credentials stored as environment variables.

**Status**: This is an **operating system-level concern**, not an application-level vulnerability. The nexus-CLI-tool does not store credentials as plaintext environment variables.

**Mitigation**:
- **Keychain Storage (macOS)**: On macOS, credentials are stored securely in the system keychain, not in process memory or environment variables.
- **Fallback Storage**: When keychain is unavailable, credentials are stored in plaintext in the filesystem with restricted permissions.
- **Recommended OS-Level Protection**: System administrators should:
  - Set restrictive `umask` values (e.g., `0077`) to limit file permissions on credential storage
  - Use OS-level access controls and SELinux policies to restrict `/proc` access
  - Deploy file integrity monitoring to detect unauthorized credential file access
  - Consider using systemd security hardening features (PrivateDevices, NoNewPrivileges, etc.)

**Application Responsibility**: The tool properly delegates credential security to OS-level mechanisms and does not introduce plaintext environment variable exposure beyond what the operating system provides.
