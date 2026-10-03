# React + Vite

## AWS S3 dataset storage

The CDK analytics stack creates a versioned, encrypted S3 data-lake bucket. After deploying it, set the bucket name from the `WorkforceDataLakeBucketName` stack output:

```powershell
$env:S3_BUCKET_NAME = "your-workforce-data-lake-bucket"
$env:S3_DATA_PREFIX = "workforce-data"
```

The backend importer uploads CSV files from `public/data/` to that prefix before importing them into the operational database:

```powershell
python backend/scripts/import_data.py
```

You can also sync the CSV datasets while the API is running with `POST /api/integrations/s3/sync-datasets`.

The backend's AWS identity must have `s3:PutObject` and `s3:ListBucket` permission for the bucket. SQLite or the configured `DATABASE_URL` remains the operational database; S3 stores the source dataset copies.

## Sign-in and password setup

Employee accounts must exist in the workforce database before they can sign in. Passwords are stored as PBKDF2-SHA256 hashes. For existing accounts without a password, an administrator generates a single-use setup code from **Security & Audit Logs** and shares it with the employee through a trusted channel; the employee selects **Set up or reset password** on the sign-in page. Codes expire after 30 minutes.

To bootstrap the initial administrator, configure `ADMIN_INITIAL_PASSWORD` in the backend environment before starting the API. The account email defaults to `admin@gmail.com`; set `ADMIN_EMAIL` to another email if needed. That email must belong to an active employee whose access role is `ADMIN` or `SYSTEM_ADMIN`. On its first successful sign-in, the configured password is stored as a PBKDF2-SHA256 hash. For production, also configure a strong, persistent `JWT_SECRET_KEY`.

For local development, put persistent backend settings in `backend/.env` (this file is ignored by Git). This keeps JWT tokens valid across backend restarts. An initial admin account must also be provisioned in the employee database; after that account is active, it can issue setup codes to other employees.

Example PowerShell setup:

```powershell
$env:ADMIN_EMAIL = "admin@gmail.com"
$env:ADMIN_INITIAL_PASSWORD = "choose-a-unique-password"
$env:JWT_SECRET_KEY = "set-a-long-random-secret"
```

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
