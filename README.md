# arena-desktop

Unofficial desktop application for [are.na](https://www.are.na).

## Description

This application is a lightweight wrapper over the existing are.na website.

## User Installation

### macOS

Download the macOS latest release [here](https://github.com/justinliang1020/arena-desktop/releases).

### Windows

Download the Windows Setup `.exe` from the same [releases page](https://github.com/justinliang1020/arena-desktop/releases).

### Linux, etc.

Not available yet. If you want this, leave a github issue or reach out to me.

## Developers Guide

1. Install Dependencies

```sh
pnpm install
```

2. Run Application

```sh
pnpm start
```

3. Package Application

```sh
pnpm package
```

## Publishing

1. Add GITHUB_TOKEN to `.env`. Scopes should have `content: write` for this repo.

```
GITHUB_TOKEN=***
```

2. Publish application

```sh
pnpm run publish
```

New releases are automatically updated using `update-electron-app`
