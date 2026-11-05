# Ardziv 2 — l'app de l'équipe réserve de l'EUGA Ardziv

Application web installable (PWA) pour l'organisation de l'équipe : agenda, disponibilités, convocations, résultats.

- Frontend : Vite + React + TypeScript
- Données et comptes : Supabase (schéma dans `supabase/schema.sql`)
- Hébergement : Vercel

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner l'URL et la clé Supabase
npm run dev
```

## Variables d'environnement (Vercel)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY` (clé publishable / anon)

La feuille de route complète est dans `ROADMAP.md`.
