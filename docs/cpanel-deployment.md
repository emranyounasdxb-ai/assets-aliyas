# cPanel deployment

Application URL: **https://assets.aliyasrealestate.ae**.

## Verified hosting setup on 21 November 2026

- The subdomain exists with its own document root `/home/aliyasrealestate/assets.aliyasrealestate.ae`. The primary website remains at `/home/aliyasrealestate/public_html`.
- AutoSSL validates the assets hostname and its www alias. The certificate expires on 19 February 2027 and cPanel reports automatic renewal. Force HTTPS Redirect is enabled for the assets domain.
- The installed database tools identify MariaDB 10.11.20. The separate **`aliyasrealestate_assets`** database has its own `aliyasrealestate_assetsapp` user and application schema. Runtime permissions are limited to SELECT, INSERT, UPDATE and DELETE on that database. Migration permissions are granted only during deployment.
- The separate enabled Passenger application **Aliyas Assets** serves the assets subdomain through `/home/aliyasrealestate/apps/assets-aliyas/launcher`. Its CommonJS `app.js` loads the current release's `app.cjs` using the existing `/usr/bin/node` runtime. The live HTTPS login page returns HTTP 200. Initial owner creation requires a private terminal; the public application has no signup/bootstrap route.
- The existing enabled Passenger application `Aliyas Real Estate`, at `/aliyas-app`, belongs to the primary website. Do not edit, restart, unregister or overwrite it.
- The server's default Node executable reports 24.22.3. The official Node 26.13.1 Linux x64 archive was downloaded into `/home/aliyasrealestate/assets-aliyas-runtime` and passed its official SHA256 check. Its binary currently fails because the server lacks `libatomic.so.1`, so it is not selected for hosting. The system runtime and libraries were not changed. The package supports the existing Node 24.22.3 runtime; CI verifies the same standalone server and native image processing on both Node 26.13.1 and 24.22.3 before release.
- No primary website files, email accounts, mail routing or primary-domain MX/SPF/DKIM settings were changed. Only the separate assets release, database and subdomain configuration were activated.

## Application architecture

The app connects directly to the server's existing MariaDB/MySQL, uses revocable server sessions and scrypt password hashes, and stores scanned documents in private server folders. There is no external database, authentication or storage platform to provision.

Create a database user restricted to `aliyasrealestate_assets`. Never use the main website's database credentials or a database root account. Keep `DATABASE_URL` and the other variables in `deploy/cpanel/.env.production.example` in private hosting configuration, outside document roots and Git.

Use `/home/aliyasrealestate/assets-aliyas-private/files` for original documents and previews. This directory survives release replacement and must not be an Apache document root. Private directories use mode 0700; credentials and uploaded files use mode 0600. A reachable private ClamAV scanner is required; uploads fail closed when scanning is unavailable. ClamAV 1.5.5 was extracted from its official, SHA256-verified RPM into the assets private scanner directory, without installing system packages or changing mail scanning. Its configuration uses loopback port 3311, private definitions and the bundled certificate directory. Pass the private `CVD_CERTS_DIR` and library paths to scanner/updater subprocesses; signature verification remains enabled.

## GitHub checks and release package

`CI` runs on main pushes and pull requests. **Quality** runs locked dependency installation, formatting, lint, TypeScript, unit tests, a production build and Linux standalone package checks on both supported Node LTS runtimes. **Integration** runs a disposable MariaDB and ClamAV, migrations, fictional demo data and the complete browser suite. No hosting credentials or customer records are used.

All actions use immutable commit SHAs. Service logs, traces and private environment files are not uploaded. Main is the release branch.

After successful CI for the exact main commit, run **cPanel package**. It creates a versioned Linux `.tar.gz` and SHA256 checksum. Only the assets app origin is an input; database credentials are configured at runtime. The archive contains the Next standalone server, static/public assets, Linux dependencies and maintenance scripts. Internal relative dependency links are preserved and verified to stay inside the release. Transfer the archive intact and extract it on Linux. Never upload Windows `node_modules` or run `npm install` over the packaged dependencies.

## Isolated activation steps

1. Confirm the existing `/usr/bin/node` runtime and private ClamAV access.
2. Provision a separate assets database user. Configure `DATABASE_URL=mysql://ASSETS_USER:URL_ENCODED_PASSWORD@127.0.0.1:3306/aliyasrealestate_assets` and `PRIVATE_STORAGE_DIR=/home/aliyasrealestate/assets-aliyas-private/files`. Configure the actual scanner endpoint privately. No secret belongs in a public build variable.
3. Verify the release checksum, extract into `/home/aliyasrealestate/apps/assets-aliyas/releases/<commit>`, and keep the previous release for rollback. Never extract over `/public_html`, `/aliyas-app`, mail folders or another application's directory.
4. Run the package's `scripts/migrate.mjs` with the private environment. Its guard accepts only the dedicated assets database names. Schema creation is retryable; a checksum tracks the initial version. Future schema changes require an explicit new migration.
5. In the authenticated cPanel Terminal, run the command below. Enter the real owner's name, email and a private password of 16–200 characters. Password entry and confirmation are hidden and do not enter shell history or a credential file. The helper serializes initial setup with a database lock, refuses to run once any account exists, and seeds only the confirmed nine buildings and 68 levels. No public setup URL is created. Never run fictional demo bootstrap in production.

   ```sh
   /usr/bin/node --env-file=/home/aliyasrealestate/assets-aliyas-private/runtime.env /home/aliyasrealestate/apps/assets-aliyas/current/scripts/setup-owner.mjs
   ```

6. Copy `launcher.cjs` to `/home/aliyasrealestate/apps/assets-aliyas/launcher/app.js` and add `package.json` containing `{"type":"commonjs","private":true}` in the launcher directory. Give the launcher directory mode 0755 and those two non-secret files mode 0644; parent application directories need traversal permission. Keep private storage/configuration at 0700/0600. Register a **new** Passenger application for **assets.aliyasrealestate.ae**, base URL `/`, production mode, application path **apps/assets-aliyas/launcher**. Use the existing `/usr/bin/node` 24.22.3 default. Configure `ALIYAS_ENV_FILE` to the private runtime file. Current Passenger rejects application directives in `.htaccess`; use cPanel Application Manager and its default `app.js` startup instead. The assets `.htaccess` only needs directory-listing protection, preserving its HTTPS redirect and existing handlers. Preserve the primary website's Passenger application and configuration.
7. Schedule `scripts/reminders.mjs` through a new cPanel cron entry, preserving all existing entries. Schedule the assets-only scanner health/start helper and definition updater independently of mail services. Run `scripts/backup-local.mjs` with the private environment and working directory `/home/aliyasrealestate/assets-aliyas-private`, so encrypted backups survive release changes. Keep the backup encryption key separate from exported backups. Off-device backup destination and a restore rehearsal remain required before importing private customer documents.
8. Verify HTTPS, sign-in/sign-out, revoked sessions, workspace isolation, scanned uploads and private downloads, tenancy and parking concurrency, collections, reports and reminder generation. Check the primary website is still reachable and that its mail configuration is unchanged.

The `/api/health` route is a process liveness check, not proof that database credentials and scanning work. Complete the authenticated workflow checks before calling the deployment ready.

## References

- [cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/)
- [Passenger Node.js binding](https://www.phusionpassenger.com/library/indepth/nodejs/reverse_port_binding.html)
- [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
