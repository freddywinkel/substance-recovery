# Replit Deployment Checklist

Use this checklist to deploy the GitHub repository as a new Replit project.

## 1. Import From GitHub

1. In Replit, import/connect the GitHub repository.
2. Name the new Replit project exactly: `Substance Recovery`.
3. Do not overwrite or reuse the old Replit project named `Anchor (Recovery Path)`.
4. Keep the pnpm workspace/monorepo structure intact.

## 2. Install And Validate

Run these commands from the repository root:

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

Optional targeted checks:

```bash
pnpm --filter @workspace/anchor run typecheck
pnpm --filter @workspace/anchor run build
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build
```

## 3. Secrets

The app must load without secrets in offline mode. Add these Replit Secrets only if cloud sync/auth is needed:

```text
DATABASE_URL
VITE_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
```

Without those secrets:

- The frontend still runs.
- IndexedDB/offline-first local data still works.
- Clerk sign-in UI is disabled.
- `/api/sync` returns `401 Unauthorized`.
- `/api/health` still returns `{ "status": "ok" }` if the backend is deployed.

## 4. Run In Replit

Use the Replit Run button or run:

```bash
pnpm --filter @workspace/anchor run dev
```

Confirm the app opens and works without auth/secrets in offline mode.

## 5. Deploy With Replit Autoscale

1. Open Replit Deployments.
2. Choose Autoscale.
3. Confirm the deployment target uses the repository `.replit` config:
   - Build: `pnpm install && pnpm run build`
   - Run: `pnpm --filter @workspace/api-server run start`
   - Router: `application`
4. Deploy.

The production API server serves:

- Built frontend from `artifacts/anchor/dist/public`
- SPA fallback routes such as `/settings`, `/journal`, and `/craving`
- Backend routes under `/api`

## 6. Verify The Deployed URL

After deployment, verify:

```text
/
/help
/tools
/journal
/settings
/registraties
/craving
/trek
/anxiety
/boredom
/relapse
```

Also verify:

- PWA manifest loads at `/manifest.webmanifest`.
- Service worker file loads at `/sw.js`.
- Mobile viewport and safe-area layout look correct.
- Bottom navigation and floating SOS button do not block primary actions.
- If the backend is deployed, `/api/health` returns `{ "status": "ok" }`.
- If auth secrets are not configured, `/api/sync` remains protected and returns `401`.

## 7. Notes

- Use pnpm only. Do not use npm or yarn.
- Do not delete `pnpm-lock.yaml`.
- Do not flatten the monorepo.
- Do not make Clerk mandatory.
- Do not make `DATABASE_URL` mandatory for frontend/offline use.
- Preserve IndexedDB local data and tombstone/sync behavior.
