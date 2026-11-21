# cPanel deployment

Application URL: **https://assets.aliyasrealestate.ae**.

## Verified hosting setup on 21 November 2026

- The subdomain exists with its own document root `/home/aliyasrealestate/assets.aliyasrealestate.ae`. The primary website remains at `/home/aliyasrealestate/public_html`.
- AutoSSL validates the assets hostname and its www alias. The certificate expires on 19 February 2027 and cPanel reports automatic renewal. Force HTTPS Redirect is enabled for the assets domain.
- The installed database tools identify MariaDB 10.11.20. A separate database, **`aliyasrealestate_assets`**, has been created through cPanel. Its application user and schema have not yet been deployed.
- The existing enabled Passenger application `Aliyas Real Estate`, at `/aliyas-app`, belongs to the primary website. Do not edit, restart, unregister or overwrite it.
- The server's default Node executable reports 24.22.3. The official Node 26.13.1 Linux x64 archive was downloaded into `/home/aliyasrealestate/assets-aliyas-runtime` and passed its official SHA256 check. Its binary currently fails because the server lacks `libatomic.so.1`, so it is not selected for hosting. The system runtime and libraries were not changed. The package supports the existing Node 24.22.3 runtime; CI verifies the same standalone server and native image processing on both Node 26.13.1 and 24.22.3 before release.
- No website files, email accounts, mail routing or primary-domain MX/SPF/DKIM settings were changed. No application release has been activated.

## Application architecture

The app connects directly to the server's existing MariaDB/MySQL, uses revocable server sessions and scrypt password hashes, and stores scanned documents in private server folders. There is no external database, authentication or storage platform to provision.

Create a database user restricted to `aliyasrealestate_assets`. Never use the main website's database credentials or a database root account. Keep `DATABASE_URL` and the other variables in `deploy/cpanel/.env.production.example` in private hosting configuration, outside document roots and Git.

Use `/home/aliyasrealestate/assets-aliyas-private/files` for original documents and previews. This directory survives release replacement and must not be an Apache document root. A reachable private ClamAV scanner is required; uploads fail closed when scanning is unavailable. The server currently has no `clamdscan` or `clamscan` executable on the account's PATH; scanner service access remains to be provisioned or confirmed without changing the existing website or mail services.

## GitHub checks and release package

`CI` runs on main pushes and pull requests. **Quality** runs locked dependency installation, formatting, lint, TypeScript, unit tests, a production build and Linux standalone package checks on both supported Node LTS runtimes. **Integration** runs a disposable MariaDB and ClamAV, migrations, fictional demo data and the complete browser suite. No hosting credentials or customer records are used.

All actions use immutable commit SHAs. Service logs, traces and private environment files are not uploaded. Main is the release branch.

After successful CI for the exact main commit, run **cPanel package**. It creates a versioned Linux `.tar.gz` and SHA256 checksum. Only the assets app origin is an input; database credentials are configured at runtime. The archive contains the Next standalone server, static/public assets, Linux dependencies and maintenance scripts. Internal relative dependency links are preserved and verified to stay inside the release. Transfer the archive intact and extract it on Linux. Never upload Windows `node_modules` or run `npm install` over the packaged dependencies.

## Isolated activation steps

1. Confirm the existing `/usr/bin/node` runtime and private ClamAV access.
2. Provision a separate assets database user. Configure `DATABASE_URL=mysql://ASSETS_USER:URL_ENCODED_PASSWORD@127.0.0.1:3306/aliyasrealestate_assets` and `PRIVATE_STORAGE_DIR=/home/aliyasrealestate/assets-aliyas-private/files`. Configure the actual scanner endpoint privately. No secret belongs in a public build variable.
3. Verify the release checksum, extract into `/home/aliyasrealestate/apps/assets-aliyas/releases/<commit>`, and keep the previous release for rollback. Never extract over `/public_html`, `/aliyas-app`, mail folders or another application's directory.
4. Run the package's `scripts/migrate.mjs` with the private environment. Its guard accepts only the dedicated assets database names. Schema creation is retryable; a checksum tracks the initial version. Future schema changes require an explicit new migration.
5. Configure `ADMIN_EMAIL`, `ADMIN_NAME` and a private strong `ADMIN_PASSWORD`, then run `scripts/create-admin.mjs`. It creates a named owner and the real workspace, and refuses to overwrite an existing account's password. Run `scripts/seed-portfolio.mjs` with the owner's email to add only the confirmed nine buildings and 68 levels. It preserves an existing portfolio. Never run the fictional demo bootstrap in production.
6. Register a **new** Passenger application for **assets.aliyasrealestate.ae**, base URL `/`, production mode, startup file **app.cjs**, and the private release directory. Use the existing `/usr/bin/node` 24.22.3 executable. Stock Application Manager may not expose a startup-file field: in that case set `PassengerStartupFile app.cjs` in only the assets document root, following `assets.htaccess.example`. Preserve the HTTPS redirect. Configure `ALIYAS_ENV_FILE` to a private, mode-0600 runtime file if environment-variable entry is unavailable. Preserve the primary website's existing Passenger application and configuration.
7. Schedule `scripts/reminders.mjs` through a new cPanel cron entry, for example 04:00 UTC daily, and preserve all existing cron entries. Configure encrypted, off-device database/file backups and perform a restore rehearsal before importing private customer documents.
8. Verify HTTPS, sign-in/sign-out, revoked sessions, workspace isolation, scanned uploads and private downloads, tenancy and parking concurrency, collections, reports and reminder generation. Check the primary website is still reachable and that its mail configuration is unchanged.

The `/api/health` route is a process liveness check, not proof that database credentials and scanning work. Complete the authenticated workflow checks before calling the deployment ready.

## References

- [cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/)
- [Passenger Node.js binding](https://www.phusionpassenger.com/library/indepth/nodejs/reverse_port_binding.html)
- [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
