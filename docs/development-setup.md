# Development setup

The application uses the hosting server's existing MariaDB/MySQL system, private server file storage and its own authentication. Supabase services and SDKs are not required.

## Pinned toolchain

| Purpose                | Tool                        | Version        |
| ---------------------- | --------------------------- | -------------- |
| Runtime                | Node.js LTS                 | 26.13.1        |
| Package manager        | pnpm                        | 12.21.0        |
| Server and web app     | Next.js                     | 16.4.6         |
| User interface         | React / React DOM           | 19.3.1         |
| Types                  | TypeScript                  | 7.0.2          |
| Styling                | Tailwind CSS                | 4.3.5          |
| Database client        | mysql2                      | 3.24.6         |
| Database compatibility | MariaDB                     | 10.11          |
| Validation             | Zod                         | 4.6.7          |
| Forms                  | React Hook Form / resolvers | 7.92.0 / 7.0.8 |
| Tables                 | TanStack React Table        | 9.3.1          |
| Images                 | Sharp                       | 0.35.5         |
| Dates                  | date-fns                    | 4.4.0          |
| Icons                  | Phosphor React              | 2.1.10         |
| Typeface               | Geist                       | 1.9.2          |
| Lint                   | Biome                       | 2.6.8          |
| Formatting             | Prettier / Tailwind plugin  | 3.10.1 / 0.8.1 |
| Unit tests             | Vitest / Vite               | 5.1.1 / 8.3.8  |
| Browser tests          | Playwright                  | 1.65.1         |
| Component tooling      | shadcn                      | 4.23.0         |
| Malware scanner        | ClamAV                      | 1.5.5          |

Versions are exact in `package.json` and `pnpm-lock.yaml`. The MariaDB Docker image uses an immutable digest for repeatable local and CI checks. It matches the installed hosting engine's 10.11 family; the existing hosting engine is preserved. Database amounts are integer fils.

## Windows

```powershell
.\scripts\setup.ps1
.\scripts\pnpm.ps1 exec playwright install chromium
.\scripts\preview-local.ps1 -OpenBrowser
```

The setup helper downloads the pinned Node ZIP from its official source and verifies its SHA256. Node and pnpm remain in ignored `.tools`; other projects and the system PATH are preserved. Use the project launcher for every command.

Docker Desktop is needed for local MariaDB and ClamAV. No hosted account is needed. `prepare-local-env.mjs` creates random local credentials in ignored `.env.local` on a fresh checkout. Existing settings and records are preserved. It refuses to overwrite an existing unconverted backend configuration.

The preview helper starts the project services, applies the schema, prepares fictional demo data on a fresh database, builds and starts the app at http://127.0.0.1:3200. Stop only the frontend with `scripts/stop-preview.ps1`. Local services and volumes persist.

| Service       | Local endpoint                     |
| ------------- | ---------------------------------- |
| Application   | http://127.0.0.1:3200              |
| MariaDB       | 127.0.0.1:56332                    |
| ClamAV        | 127.0.0.1:56331                    |
| Private files | ignored `.private-files` directory |

Only these project's two services are managed by `compose.services.yaml`. Ports bind explicitly to localhost. Existing Docker services and volumes belonging to other projects are preserved.

## Commands

```powershell
.\scripts\pnpm.ps1 db:start
.\scripts\pnpm.ps1 db:status
.\scripts\pnpm.ps1 db:migrate
.\scripts\pnpm.ps1 db:stop
.\scripts\pnpm.ps1 format:check
.\scripts\pnpm.ps1 lint
.\scripts\pnpm.ps1 typecheck
.\scripts\pnpm.ps1 test:run
.\scripts\pnpm.ps1 build
.\scripts\pnpm.ps1 test:e2e
.\scripts\pnpm.ps1 tools:verify
```

`db:stop` stops only this project's MariaDB and scanner, preserving their volumes. Browser tests use separate verification workspaces and fictional records. The demo account is restricted to a loopback application and database, and is disabled in cPanel packages.

The shadcn generator's transitive minimatch override remains pinned to patched 11.0.9. Node/React type packages are pinned in the manifest. Biome supports the project's TypeScript 7 workflow.

See [cPanel deployment](cpanel-deployment.md) for the verified subdomain, database, SSL and the remaining hosting runtime/scanner prerequisites.
