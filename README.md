# assets-aliyas

Property and rental management project for the company's buildings in Ajman.

Working local property and rental management application with authenticated workspaces, buildings, floors, flats, tenants, agreements, cheque tracking, tenant accounts, private documents and reports.

```powershell
.\scripts\preview-local.ps1 -OpenBrowser
```

Open http://127.0.0.1:3200 and select **Explore demo workspace**. Demo properties and tenants are fictional and clearly labelled. Create an empty workspace from Settings to enter a separate portfolio.

- [Application workflows and operating rules](docs/application.md)
- [Brand design and paid parking](docs/design-and-parking.md)
- [Initial requirements and open questions](docs/requirements.md)
- [Selected tools and development setup](docs/development-setup.md)

Run project commands on Windows through `scripts/pnpm.ps1` to use the pinned Node.js and pnpm versions. See the setup guide for installation, the local backend and verification commands.

Stop a preview started by the helper with `scripts/stop-preview.ps1`. Production configuration and remaining business decisions are described in the application guide.
