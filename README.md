This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Project-specific deployment notes

- Do NOT commit credentials. Use `.env.local` or your hosting provider's env settings.
- Recommended env variables (see `.env.example`): `THINGSBOARD_HOST`, `THINGSBOARD_EMAIL`, `THINGSBOARD_PASSWORD`.
- The app currently reads ThingsBoard config from runtime local storage; for production, wire those values to a secure secrets store or update the code to use server-side envs.

### Deploying to Vercel

1. Create a new project on Vercel and connect your Git repository.
2. Set environment variables in the Vercel dashboard (do not commit secrets).
3. Push your branch — Vercel will build and deploy automatically.

If you want, I can initialize a local git repo here and create the initial commit; provide a remote URL (e.g. GitHub) and I can add it and push the branch for you.
