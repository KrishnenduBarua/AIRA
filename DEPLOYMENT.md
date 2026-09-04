# AIRA deployment

The repository is prepared for Git-connected deployment:

- `frontend/` -> Vercel
- `backend/` -> Render web service
- `ml-model/` -> Render web service
- PostgreSQL -> Supabase
- Private uploads -> Supabase Storage

## Supabase

1. Create a Supabase project and copy its PostgreSQL connection string.
2. Run `backend/sql/schema.sql` in the Supabase SQL editor.
3. Create a private Storage bucket named `aira-private`.
4. Keep the bucket private. The backend uses the Supabase service-role key to upload and stream authorized files.

## Render

1. Connect the GitHub repository in Render.
2. Choose **Blueprint** and select `render.yaml`.
3. Set the backend environment variables marked `sync: false`.
4. Keep `ML_SERVICE_URL=http://aira-ml:10000` when using the included service name and port. If you rename the ML service, update this to its private Render hostname and port.
   Test backend-to-ML networking at `https://your-backend.onrender.com/health/dependencies`; it must return `status: "ok"` before statement uploads can work.
5. Set `CORS_ORIGINS` to the deployed Vercel origin, such as `https://aira.vercel.app`.
6. Set `DATABASE_URL` to the Supabase connection string. Use SSL if the connection string/provider requires it.

Required backend secrets include `JWT_SECRET`, `PASSWORD_SALT`, `LLM_API_KEY`, `BLOCKCHAIN_PRIVATE_KEY`, `ANCHOR_CONTRACT_ADDRESS`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Never commit these values.

## Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `frontend`.
3. Set `VITE_API_URL` to the public Render backend URL, for example `https://aira-backend.onrender.com`.
4. Deploy. Vercel redeploys when the selected GitHub branch receives a new commit.

The included `frontend/vercel.json` keeps client-side routes working on refresh.

## Git-driven updates

Configure both providers to deploy the `main` branch. A pushed commit triggers a new Vercel deployment and a new Render build/deploy. Database schema changes still need a reviewed migration or the idempotent schema to be run in Supabase.
