# Contributing

## Start a watch process

```sh
pnpm i
pnpm run watch
```

## Start the dev server of the example

```sh
cd packages/blocky-example
pnpm run dev
```

## Run tests

```sh
# unit test
pnpm test:unit

# e2e test
pnpm test:e2e
```

Note that to run E2E tests locally, please make sure browser binaries are already installed via `npx playwright install` and local dev environment is started with `pnpm dev`.

## Print the bundle size

```sh
./bundle_size.sh
```

## Build the release version

```sh
pnpm i
pnpm run build
```
