# `setup-pesde`

A GitHub action to install pesde, and optionally a Luau runtime (currently only Lune).

## Usage

A usage example as well as the default values for the accepted inputs is provided below.

```yml
- name: Checkout
  uses: actions/checkout@v5

- name: Setup pesde
  uses: pesde-pkg/setup-pesde@v1
  with:
    # The token used to send requests to the API, defaults to `github.token`
    # unless running a self-hosted enterprise instance.
    token: ${{ github.token }}

    # Version of pesde to install; must not include registry version build metadata.
    version: "latest"

    # The version of lune to install. If unspecified, lune is not installed. It is
    # recommended to leave undefined if using pesde managed engines.
    lune-version: ""

    # Whether the pesde's home (defaulting to `~/.pesde` unless $PESDE_HOME is specified)
    # and all the dependencies should be stored in cache and restored when required. The
    # cache key is derived from the pesde.toml manifest and the lockfile.
    cache: false

    # The directory used by pesde to store all its data (the CAS, installed binaries, etc).
    # Its value takes precedence over setting the `$PESDE_HOME` environment variable. If
    # undefined, defaults to either `$PESDE_HOME` or `~/.pesde`, where the tilde corresponds
    # to the home directory.
    home: "~/.pesde"
```

## Caching

The uniqueness of a cache and whether caching is required is obtained by a cache key of the
format `pesde-{OS}-{ARCH}-{HASH}`.

- `OS` corresponds to one of windows, macos or linux.
- `ARCH` corresponds to one of the following: arm64, x64, arm32, x86.
- `HASH` is obtained by calculating the hashes of the combined contents of `pesde.toml` and
  `pesde.lock`. If the lockfile is unavailable in the source, it is marked as missing with a
  `missing(pesde.lock)` string which is appended in place of its contents.

## License

This project is licensed under the [GPL-3.0](/LICENSE) license.
