# cPanel deployment preparation

Planned application URL: **https://assets.aliyasrealestate.ae**. The subdomain and hosting runtime have not yet been provisioned or verified. This repository prepares a Linux Node.js deployment package; it does not automatically upload or activate anything on the hosting account.

## Hosting requirements

- cPanel Application Manager or CloudLinux Setup Node.js App with a compatible Node.js 26 LTS runtime, Linux x64, and SSH/Terminal or equivalent provider access.
- The subdomain configured in cPanel, its DNS pointing at the hosting account, and a valid HTTPS certificate.
- A production Supabase project for PostgreSQL, authentication, private storage and scheduled reminders. Apply the repository's SQL migrations to that project after its backup and access setup are reviewed. The local Docker database is not copied into the web server's public directory.
- A reachable private ClamAV scanner. Keep its TCP endpoint private; document uploads fail closed if scanning is unavailable. Shared cPanel accounts may require the hosting provider or a separate private service to supply it.
- Production staff accounts and roles, private backup storage, and a tested restore procedure. The local demo login is disabled in packaged releases.

FTP transfers files; this application also requires the Node.js runtime and backend services. It cannot be deployed as an HTML-only export while retaining authentication, API routes, private documents and accounts.

## GitHub checks

The `CI` workflow runs on main pushes and pull requests:

1. **Quality**: locked dependencies, formatting, lint, TypeScript, unit tests, a production build and a Linux standalone package startup check. The package check uses synthetic settings and is not a deployable production release.
2. **Integration**: a disposable local Supabase stack and ClamAV scanner, all migrations, synthetic demo data, an optimized app and the complete browser suite. No production credentials are used.

Actions are pinned to immutable commit SHAs. Workflow permissions are read only. Test environment files and service logs remain on the disposable runner; they are not uploaded as artifacts.

## Create the production package

After CI is green for the exact main commit, manually run **cPanel package** in GitHub Actions. Supply the planned app origin, the production Supabase HTTPS origin and its public publishable key. These public values are baked into the build. Validation rejects secret/service keys, localhost and CI fixture settings before compiling.

The workflow checks that this exact main commit has successful CI, then builds on Linux and creates a versioned `.tar.gz` archive and SHA256 checksum. It packages Next's standalone server, required Linux dependencies, public assets and static chunks. Private environment files, local tools, database backups and customer uploads are excluded. No FTP credentials are requested or stored by the workflow.

## Upload and register later

1. Download the release archive and verify its checksum. Upload it through the hosting account's secure file transfer and extract it into a private application directory such as `/home/ACCOUNT/apps/assets-aliyas`, outside `public_html`. Keep the previous release for rollback.
2. Register that application in cPanel with the deployment subdomain, base URL `/`, production mode, and startup file **`app.cjs`**. This delegates to Next's generated server; Passenger controls the first HTTP server's binding.
3. Configure the variables listed in `deploy/cpanel/.env.production.example` through cPanel's application environment. `APP_ORIGIN` and the public Supabase settings must match the package. Set the actual server secret key and private scanner host/port only on the host.
4. Restart the application through cPanel. Verify `/api/health`, sign in with a staff account, check workspace isolation, upload/scanning, private downloads, agreements, parking, collections and reminders. Confirm the server logs and backup/restore procedure before importing private customer documents.

Changing the public backend or app origin requires a new package. Private runtime secrets can be rotated through the hosting environment without committing them to Git. Do not run `npm install` over the prebuilt standalone package or upload a Windows `node_modules` directory; native dependencies are verified in the Linux CI package.

The runtime package has been designed for Passenger's standard Node.js port interception. The hosting provider's installed Node.js version, Passenger configuration and native dependency compatibility must still be verified during actual deployment.

## References

- [cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/)
- [Passenger Node.js port binding](https://www.phusionpassenger.com/library/indepth/nodejs/reverse_port_binding.html)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
