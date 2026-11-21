# Development Toolchain and Setup

Selected on 21 November 2026 for the property and rental management application. These tools now support the working local application. See [Application and Operating Rules](application.md) for the browser preview, workflows and production configuration.

## Selected tools

Direct package versions were checked against the npm registry's stable `latest` tag. Node.js was checked against the official release index and LTS schedule. Exact versions are pinned in `package.json` and the resolved dependency graph is committed in `pnpm-lock.yaml`.

| Purpose                                                   | Selected tool                       | Version |
| --------------------------------------------------------- | ----------------------------------- | ------- |
| Application runtime                                       | Node.js, latest LTS                 | 26.13.1 |
| Package manager                                           | pnpm                                | 12.21.0 |
| Web application and server                                | Next.js App Router with Turbopack   | 16.4.6  |
| User interface runtime                                    | React and React DOM                 | 19.3.1  |
| Type checking                                             | TypeScript native compiler          | 7.0.2   |
| Styling                                                   | Tailwind CSS and its PostCSS plugin | 4.3.5   |
| Component generator                                       | shadcn/ui CLI                       | 4.23.0  |
| Icons                                                     | Phosphor React                      | 2.1.10  |
| Database, authentication and private file storage tooling | Supabase CLI                        | 3.2.0   |
| Backend client                                            | Supabase JavaScript client          | 2.119.2 |
| Session integration                                       | Supabase SSR                        | 0.12.7  |
| Input validation                                          | Zod                                 | 4.6.7   |
| Forms                                                     | React Hook Form                     | 7.92.0  |
| Form validation adapter                                   | Hook Form resolvers                 | 7.0.8   |
| Data tables                                               | TanStack React Table                | 9.3.1   |
| Image processing                                          | Sharp                               | 0.35.5  |
| Date calculations                                         | date-fns                            | 4.4.0   |
| Linting                                                   | Biome                               | 2.6.8   |
| Formatting                                                | Prettier                            | 3.10.1  |
| Tailwind class formatting                                 | Prettier Tailwind plugin            | 0.8.1   |
| Unit test runner                                          | Vitest                              | 5.1.1   |
| Test runner build dependency                              | Vite                                | 8.3.8   |
| Browser testing                                           | Playwright Test                     | 1.65.1  |
| Self hosted typeface                                      | Geist                               | 1.9.2   |
| Server module boundary                                    | server-only                         | 0.0.1   |
| Upload malware scanning                                   | ClamAV Docker image                 | 1.5.5   |

Matching Node and React type packages are also installed. Docker Desktop 4.99.0 with Docker Engine 29.9.3 was already installed and running on this workstation and is used for the local backend.

The latest Supabase CLI selects compatible, versioned backend container images. The installed database reports PostgreSQL 17.12, using the CLI-selected image `supabase/postgres:17.12.0.000`. This is a Supabase compatibility choice, not a claim that 17 is the latest standalone PostgreSQL major. The hosted database version must be checked when a production project is selected; do not independently replace integrated backend images with arbitrary upstream versions.

Next.js currently supports TypeScript 7 through the project-local compiler CLI. Biome is used because the TypeScript ESLint parser used by the Next.js ESLint preset does not currently support TypeScript 7. ESLint and its incompatible preset were removed from the selected toolchain.

The shadcn generator includes a transitive `minimatch` dependency affected by [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). A narrowly scoped override selects patched `minimatch` 11.0.9 for `@ts-morph/common`. Generator glob matching is included in the tool verification script.

## Windows setup

Run from the repository root in PowerShell:

```powershell
.\scripts\setup.ps1
.\scripts\pnpm.ps1 exec playwright install chromium
```

The setup script downloads the pinned Windows x64 Node.js ZIP from `nodejs.org`, verifies its official SHA256 checksum, and installs Node and pnpm under the ignored `.tools` directory. It does not replace the machine's existing Node installations or persistently change system PATH. The launcher puts this project's Node first for its commands.

On the first dependency resolution, the script permits creating a lockfile. Subsequent setup runs use the committed lockfile without changing dependency versions.

On other supported operating systems, install the same Node.js and pnpm versions, then run `pnpm install --frozen-lockfile` and `pnpm exec playwright install chromium`.

## Local backend

With Docker running:

```powershell
.\scripts\pnpm.ps1 db:start
.\scripts\pnpm.ps1 db:status
.\scripts\pnpm.ps1 db:stop
```

The local project ID is `assets-aliyas`. The start command creates a dedicated Docker network with localhost port binding. A project-only Docker launcher also sets explicit loopback addresses when Supabase creates this project's published containers, because this Docker Desktop version ignores the network default. The launcher is built locally from `scripts/docker-loopback.cjs` using the pinned Node.js executable. Its PATH applies only to the backend startup process; Docker's global installation and other projects are unchanged. The script checks every published project port after startup and stops the project if any are exposed outside localhost. Ports are separate from the workstation's other applications:

| Service                                | Local address          |
| -------------------------------------- | ---------------------- |
| API, authentication and storage        | http://127.0.0.1:56321 |
| PostgreSQL                             | 127.0.0.1:56322        |
| Database and storage management studio | http://127.0.0.1:56323 |
| Development email inbox                | http://127.0.0.1:56324 |

The first backend start downloads its container images. Local development email stays in the development inbox. No paid hosted project or external email/WhatsApp service is provisioned by this setup.

Public signup and anonymous login are disabled. Automatic exposure of new public-schema tables to the Data API is disabled. The application migrations explicitly establish grants, workspace row-level security, private storage and finance permissions. Realtime, vector storage, analytics and the Edge Functions runtime are disabled until needed. The scanner runs separately on loopback port 56331 using `compose.services.yaml`.

Use `.env.example` as the list of application environment variables. Local backend keys are available through the local status command; put actual values in ignored `.env.local`. The public publishable key does not replace access policies. A secret key belongs only on the server.

An ignored `.env.local` containing this workstation's local development connection values was generated during installation. Production credentials are separate.

## Verify the installation

```powershell
.\scripts\pnpm.ps1 tools:verify
.\scripts\pnpm.ps1 lint
.\scripts\pnpm.ps1 format:check
.\scripts\pnpm.ps1 audit
.\scripts\pnpm.ps1 peers check
```

The verification script checks the Node version and every installed direct package against the manifest. It also exercises React server rendering, validation, Supabase module loading, native image conversion, component generator glob matching and an actual headless Chromium launch.

Application validation now includes `pnpm test:run`, `pnpm test:e2e`, `pnpm lint` and `pnpm build`. Use `scripts/preview-local.ps1` to start an optimized local preview before browser testing.

## Workstation verification

Verified on 21 November 2026:

- Node.js and all direct package versions match the pinned manifest.
- The complete application production build passed with TypeScript 7, React and Tailwind.
- Ten domain and local preview unit tests and twelve browser workflow tests passed against the optimized local application.
- Browser tests verified original image preservation, private WebP previews, scanned PDF uploads, document versions, access restrictions and uploads larger than 10 MB.
- The database pagination test verified complete results beyond the 1,000-row API page size.
- Encrypted database and file-storage backup creation, decryption and archive-format verification passed. A full restoration drill remains deployment work.
- React rendering, Zod, Supabase SDK loading, native Sharp conversion, generator glob matching and headless Chromium checks passed.
- Biome linting and Prettier formatting checks passed.
- The package audit reported no known vulnerabilities after the scoped dependency patch; peer dependency checks passed.
- Local authentication, REST API, storage status and Studio returned HTTP 200.
- Docker inspection confirmed that all four published project ports bind only to `127.0.0.1`.
- Local environment values and downloaded tool binaries are ignored by Git.

## Application development

```powershell
.\scripts\pnpm.ps1 dev
.\scripts\pnpm.ps1 build
.\scripts\pnpm.ps1 test:run
.\scripts\pnpm.ps1 test:e2e
```

The application commands bind to loopback. Property management, tenant profiles, accounts, cheque workflows, private documents and reports are implemented. PostgreSQL Cron creates application reminders daily at 08:00 Dubai time; the visible application refreshes data once per minute.

Hosted infrastructure, off-device backup storage, scanner hosting and external notification delivery need provider configuration before production use. The local application already implements scanning, private access and document version history. See `application.md` for the remaining deployment work.

## Sources

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [Node.js release index](https://nodejs.org/dist/index.json)
- [npm registry](https://registry.npmjs.org/)
- [pnpm installation](https://pnpm.io/installation)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js TypeScript 7 support](https://nextjs.org/docs/app/api-reference/config/typescript)
- [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [Supabase CLI and local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase local network binding](https://supabase.com/docs/guides/local-development)
- [shadcn installation](https://ui.shadcn.com/docs/installation/next)
- [Biome installation](https://biomejs.dev/installation/quick-start/)
- [ClamAV Docker installation](https://docs.clamav.net/manual/Installing/Docker.html)
