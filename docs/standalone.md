# Standalone adapter builds

The standalone adapter includes Node.js 26.8.2 and the pinned npm dependencies.
Muse is an external prerequisite: install Muse Code 1.1.1-R2514.1 separately using
Meta's installation instructions. This unofficial community adapter neither
bundles Muse nor implies redistribution permission or Meta affiliation.

## Supported target

The initial target is native `darwin-arm64` (Apple Silicon macOS). It is tested on
macOS 26.5.1 locally and has a macOS 15 CI acceptance job. Linux, Intel macOS and
Windows standalone artifacts are not advertised until their own native smoke
and host checks pass. Existing npm installation and its Node >=22 requirement
are unchanged; Linux continues through the existing npm CI path.

## Build and verify

Install dependencies with `npm ci`. Use Node.js 26.8.2 and Bun 1.3.3 as build tools:

```sh
MUSE_CODE_ACP_BUILD_NODE=/absolute/path/to/node-v26.8.2/bin/node npm run build:standalone
npm run test:standalone -- /absolute/path/printed/by/build/muse-code-acp
```

The optional `BUN_EXECUTABLE` selects the bundler executable. Versions are checked;
Bun bundles JavaScript but its runtime is not included. Node's public
[single executable application builder](https://github.com/nodejs/node/blob/v26.8.2/doc/api/single-executable-applications.md)
creates the binary, with code caching/snapshots disabled and no runtime argument
extension through `NODE_OPTIONS`. macOS builds receive an ad-hoc signature.
Notarization and signing identities are not configured by this milestone.

The output directory includes the executable, inspectable `adapter.mjs`, build
provenance, SHA-256 checksums and adapter/dependency/Node license notices. The Node
license file includes its third-party notices. Verify the directory before use:

```sh
shasum -a 256 -c SHA256SUMS
./muse-code-acp --version
MUSE_CODE_EXECUTABLE='/absolute/path with spaces/muse' ./muse-code-acp
```

Configure the editor command with that executable path and no Node command prefix.
No Node or Bun installation is needed to run it. `MUSE_CODE_EXECUTABLE` retains
precedence over PATH discovery, and `--cli` still delegates to Muse. Missing or
incompatible Muse produces an actionable diagnostic. Build outputs are excluded
from npm packages. Use a new output parent for a subsequent build; the build
script refuses to overwrite an existing artifact directory.

Source inputs come from this repository and package-lock.json; build.json records
the commit, dirty state, compiler versions and source bundle/lockfile checksums.
A dirty build is a development artifact. Rebuild a release from its exact clean
commit with the recorded tools. Platform signing and executable metadata may
prevent byte-identical binaries across machines; checksums identify each output.

## Distribution decisions

This milestone adds local build and CI acceptance plumbing only. It does not
publish binaries, alter the npm release process, enable previews or dispatch
registry updates. The npm package remains the supported published installation.

Keep Muse external unless separate redistribution terms and maintenance ownership
are established; the MIT SDK license does not license the Muse host. Node and
npm dependency notices accompany the standalone artifact. Source and rebuild
instructions remain available in this public repository.

The reference's automatic preview publishing and registry dispatch are release
policy choices, not ACP protocol requirements. Proposed follow-up: add signed
standalone release assets and registry metadata only after native target CI is
reliable and the desired channels/signing ownership are explicitly selected.
Do not copy the reference's pre-CI preview publishing behavior automatically.
