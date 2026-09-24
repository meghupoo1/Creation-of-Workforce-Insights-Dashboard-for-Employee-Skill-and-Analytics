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

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
