# CHC Tournament

Responsive toernooibeheer en publieke live-app voor sv CHC. De app gebruikt React/Vite als PWA en Supabase voor PostgreSQL, RLS en realtime wedstrijdwijzigingen.

## Lokaal starten

1. `npm install`
2. Kopieer `.env.example` naar `.env.local` en vul de publieke Supabase publishable/anon key in.
3. `npm run dev`

Zonder omgevingsvariabelen start de app bewust in demomodus. Er wordt geen centrale data in `localStorage` bewaard.

## Supabase

Voer `supabase/migrations/202609240001_initial_tournament.sql` uit via de Supabase SQL Editor of Supabase CLI. De migratie maakt tabellen, indexen, realtime-publicatie, demo-inhoud en Row Level Security aan.

De frontend gebruikt uitsluitend de publieke publishable/anon key. Gebruik nooit een `service_role` key in Vercel of browsercode.

Voor beheer:

1. Maak een gebruiker in Supabase Auth.
2. Voeg diens `auth.users.id` als `owner`, `admin` of `scorekeeper` toe aan `tournament_members`.
3. Voeg `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` toe aan Vercel voor Production, Preview en Development.

## Controle

- `npm test`
- `npm run build`

De PWA-manifest en service worker worden tijdens de productiebuild gegenereerd.
