# UgEthnoFish dataset workspace

A private, mobile friendly workspace for Ugandan freshwater fish image records. It uses Next.js App Router, TypeScript, Postgres/Prisma and a private S3 compatible object store. There is no public sign-up; an administrator provisions contributor accounts.

## Current features

- Login only, signed HttpOnly/SameSite cookies, Argon2 password hashes, origin checked mutations, login throttling, `noindex`, restrictive robots rules, and protected pages and API routes.
- Image and species data models, typed custom column definitions with JSON values, audit entries, soft deletion and optimistic row versions.
- Species and image views, private short lived image URLs, in browser image resizing, dimension/aspect/type/size checks, pHash near duplicate blocking, and creator/licence completion checks.
- Admin account creation, column creation, deleted record listing API, and CSV/XLSX plus training ZIP export.
- Seed workbook importer that validates images and reports imports, duplicates, and failures to `import-report.json`.

The seed workbook and image directory were not present in the workspace, so no real records are included. The current grid is a browse/detail editor; bulk paste, full spreadsheet style inline editing, user disable/reset, one click audit undo, species editing, and resumable per file progress remain to be completed before using this with contributors.

## Local setup

Requirements: Node.js 22+, npm, and Docker Compose. Copy `.env.example` to `.env`, replace `SESSION_SECRET` with at least 32 random bytes, and choose a strong bootstrap admin password. Start Postgres and MinIO:

```sh
docker compose up -d
```

Create a private bucket named `ugethnofish-private` in the MinIO console at `http://localhost:9001` (default local login: `minioadmin` / `minioadmin`). Keep the bucket private. Then install and initialize:

```sh
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000` and sign in with the bootstrap admin email/password from `.env`. `db:seed` refuses the example password. Keep `.env` out of version control.

## Import existing data

Run the importer from the repo root after the app database and private bucket are initialized:

```sh
npm run import:dataset -- --xlsx ./fish_covt_dataset/entity_recognition_fish_final.xlsx --images ./fish_covt_dataset/scraped_data
```

The XLSX should contain `category, canonical_name, short_name, image_file, question, answer, source(s), origin, creator, license`, plus optionally `local_path` (e.g. `scraped_data\<species folder>\<file>.jpg`). The image is located from `local_path`, then `rel`, then `image_file`, resolved within the selected images folder. Images are normalized to JPEG (1600 px maximum side); EXIF metadata is removed. Duplicate images are reported with the existing species name and are not imported. Inspect `import-report.json` and fix failures before importing again. Import is row based, so resolve reported issues and avoid rerunning rows already imported.

## Deployment (Vercel)

Pages and API routes both run on Vercel. Two outside services are needed because Vercel has no built-in database or private file storage that this app can use directly:

| Need | Recommended | Why |
| --- | --- | --- |
| Postgres | Neon (add it from the Vercel Marketplace, *Storage → Create → Neon*) | Free tier, sets the env vars for you |
| Private image storage | Cloudflare R2 | S3 compatible, 10 GB free, no download fees. AWS S3 also works |

1. **Push the code to GitHub.** `fish_covt_dataset/` is excluded from deployments by `.vercelignore`; you can also add it to `.gitignore` if you don't want it in the repository.
2. **Create the R2 bucket.** In Cloudflare: *R2 → Create bucket* → name `ugethnofish-private` (leave public access off). Then *R2 → Manage API tokens → Create token* with **Object Read & Write** on that bucket. Note the Access Key ID, Secret Access Key and the S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`.
3. **Import the project in Vercel.** *Add New → Project* → pick the GitHub repo. Framework is detected as Next.js; leave the build command alone (Vercel runs the `vercel-build` script, which applies database migrations, then builds).
4. **Add the database.** In the project: *Storage → Create Database → Neon* → connect it to the project. This adds `DATABASE_URL` (pooled). Add `DIRECT_URL` yourself with Neon's *unpooled* connection string (`DATABASE_URL_UNPOOLED` in the Neon env vars).
5. **Add environment variables** (*Settings → Environment Variables*, for Production and Preview):
   - `SESSION_SECRET`: 64 random hex characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `S3_ENDPOINT` = `https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION` = `auto`, `S3_BUCKET` = `ugethnofish-private`
   - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` from the R2 token
   - `MAX_UPLOAD_MB` = `4`
6. **Deploy** (*Deployments → Redeploy*, or push a commit).
7. **Create the first admin account** from your computer. Put the production `DATABASE_URL`, `DIRECT_URL`, `BOOTSTRAP_ADMIN_EMAIL` and a strong `BOOTSTRAP_ADMIN_PASSWORD` in your local `.env`, then run `npm run db:seed`. Sign in on the Vercel URL and create contributor accounts from **Admin**.
8. **Import the existing dataset (optional)** with the same `.env` plus the R2 `S3_*` values: run the import command above from your computer. It uploads straight to R2 and Neon.

Vercel limits that shaped the code: request and response bodies are capped at 4.5 MB, so the upload page sends one photo per request, and the training ZIP is written to the bucket under `exports/` and downloaded through a 10-minute signed link. Add an R2 lifecycle rule deleting `exports/` objects after a day or two. Functions may run up to 300 s, which is enough to export a few thousand images.

The Dockerfile still works for other hosts: provide Postgres and a private S3 bucket, set the `.env.example` variables, run `npm run db:deploy` before each release, and expose port 3000 behind HTTPS.

## Backup and restore

- Back up Postgres with `pg_dump` and retain encrypted, access controlled copies.
- Enable object versioning or scheduled snapshots on the private bucket; back up the database and bucket together.
- Store database credentials, `SESSION_SECRET`, and object store credentials in the host's secret manager.
- Test restoring both the database and objects into a separate environment. The database contains object keys; database only backups do not contain image bytes.

## Routes and checks

Protected app pages: `/`, `/species`, `/species/:id`, `/images/:id`, `/upload`, `/download`, `/admin`. Login: `/login`. APIs under `/api` require a valid user session; admin APIs additionally check the admin role. Training export: `/api/download?format=training`; spreadsheet downloads: `format=csv` or `format=xlsx`.

Run the auth boundary acceptance checks against a running app with `node --import tsx --test tests/security.test.ts` (set `TEST_BASE_URL` to use a different local URL). Database and object storage are required for upload, import and export acceptance checks.
