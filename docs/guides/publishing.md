# Publishing

How to release a version of Underdot to npm: the version bump, the checks that come before publishing, the publish itself, confirming it landed, and the tag and GitHub release that mark it.

## Bump the version

Every package moves to the same version together, the core and the nine plugins alike, in one release PR against `main`:

- `version` in `package.json` and in each `plugins/*/package.json`.
- Each plugin's `underdot` peer range, as `^<version>`.
- The ranges in each `test/fixtures/*/package.json`, as `^<version>`.
- The tarball names in the driving manual's run on the published packages (see: docs/guides/driving-manual.md, A site on the published packages).

Run `npm install` to carry the new versions into `package-lock.json`.

A major version that changes what a site writes also extends `q-extension/guides/migrating-from-v1.md`, or adds a guide beside it for the new major.

## Check before publishing

1. Run `npm run check`.
2. Follow the driving manual's run on the published packages, every fixture included (see: docs/guides/driving-manual.md, A site on the published packages). It is the one run that proves the packed `dist/`, each `exports` map, and each peer dependency, which is what a site installs.
3. Merge the release PR once CI is green on it.

## Publish

Publish from an up-to-date `main`, logged in to npm as `lab43`, the account that owns every package:

```sh
git checkout main && git pull
npm whoami
npm publish
npm publish --workspaces
```

- `npm whoami` prints `lab43`. When it fails or prints another account, run `npm login` first.
- Publish the core first, so no plugin is on the registry before the core it names as a peer.
- `npm publish` runs each package's `prepack`, which builds it, so no separate build step comes first.
- A version without a prerelease suffix becomes the `latest` tag.
- A package name not yet on the registry is created by its first publish, under the account publishing it.

A publish that npm does not accept the login for fails with `E404` on the `PUT`, or with `ENEEDAUTH`. Nothing was uploaded, so log in and publish again.

npm asks for a one-time password when the account requires one. Pass it as `--otp <code>`. A code that expires partway through `--workspaces` fails the packages after it. Publish those one at a time with `npm publish --workspace <name> --otp <code>`.

## Confirm the release

npm stages a new version for a few minutes before it lists it, so `npm view` shows the previous `latest` in the meantime, and its cache can show it for longer. Check each package against the registry itself:

```sh
npm view <name> dist-tags --prefer-online
```

Publishing a version again while npm stages it fails with `E409` and "Cannot publish over previously staged version". The first publish worked, so wait rather than publishing again. Move on to the tag only once every package's `latest` is the new version.

## Tag and release

Tag the merge commit the packages were published from, in the checkout that published them, and create a GitHub release from the tag:

```sh
git tag v<version> && git push origin v<version>
gh release create v<version> --title v<version> --notes-file <notes>
```

The notes say what the release changes for a site. A major release links its migration guide.
