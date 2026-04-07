# AI Event Organiser

A full-stack event creation and discovery platform that puts AI in the driver's seat for the boring parts of running an event. Describe your idea in a sentence, and the app drafts the title, description, category, tags, capacity, ticket type, and even an estimated duration — leaving you free to focus on the parts that actually matter.

Built with **Next.js 16**, **Convex**, **Clerk**, **Shadcn UI**, **Tailwind CSS v4**, and **Google Gemini**.

---

## Highlights

- **AI-drafted events** — Gemini generates a complete event scaffold from a one-line idea, including smart tag suggestions and duration estimates.
- **Quick-start prompt templates** — Tap a chip ("Tech Meetup", "Workshop", "Networking Mixer", "Community Event") to pre-fill the AI prompt with a vetted starting point.
- **Smart end-time inference** — When the AI suggests a duration and you've already picked a start time, the end time is filled in automatically.
- **"You might also like" recommendations** — A `getSimilarEvents` Convex query surfaces upcoming events in the same category, ranked by city, country, and how soon they're happening.
- **Location-aware discovery** — Country → State → City filtering powered by `country-state-city`, with clean shareable URLs (`/explore/gurugram-haryana`).
- **QR-code check-in** — Organisers scan attendees in at the venue using the in-browser scanner; tickets are confirmed instantly.
- **Free vs Pro tiers** — Free users get 1 event and the default theme color; Pro unlocks unlimited events and the full color palette. Limits are enforced on the server, not just the client.

---

## How the AI generation works

The Gemini integration lives in **`lib/ai/event-generator.js`** and is called from a thin Next.js route handler at `app/api/generate-event/route.js`. Splitting it this way keeps prompt engineering, JSON sanitisation, and validation in one place, and makes it trivial to call the same function from a Convex action or a CLI down the line.

The generator:

1. Builds a strict prompt that lists the valid category IDs straight from `lib/data.js` — no drift between the UI and the model.
2. Asks Gemini for a fixed JSON shape (title, description, category, tags, capacity, ticket type, duration).
3. Strips any markdown code fences the model insists on adding anyway.
4. Validates and normalises every field, falling back to safe defaults for anything malformed.
5. Retries once on JSON parse errors (the most common transient failure), but doesn't retry on auth or quota errors — those won't fix themselves.

The result is a predictable response shape the client can wire straight into the form.

---

## Project Structure

```
ai-event-organiser/
├── app/
│   ├── (auth)/              # Sign-in / sign-up routes (Clerk)
│   ├── (main)/              # Authenticated app: create, my events, my tickets
│   ├── (public)/            # Public explore + event detail pages
│   └── api/generate-event/  # Thin AI route handler
├── components/              # Shared UI (cards, modals, headers, shadcn primitives)
├── convex/                  # Schema, queries, mutations
│   ├── events.js            # createEvent, getMyEvents, getSimilarEvents, deleteEvent
│   ├── registrations.js     # Ticketing + check-in
│   ├── users.js             # Clerk → Convex sync
│   └── schema.js            # Tables and indexes
├── hooks/                   # use-convex-query, use-store-user, use-onboarding
├── lib/
│   ├── ai/event-generator.js  # Gemini prompt + parsing logic
│   ├── data.js              # CATEGORIES (single source of truth)
│   ├── slug.js              # Shared slugify + buildEventSlug
│   ├── location-utils.js    # Slug ↔ location parsing
│   └── utils.js             # cn() helper
└── public/                  # Static assets
```

---

## Tech Stack

| Layer        | Tools                                                           |
|--------------|-----------------------------------------------------------------|
| Frontend     | Next.js 16, React 19, Tailwind CSS v4, Shadcn UI, Lucide Icons  |
| State / data | Convex (DB + functions), React Hook Form, Zod                   |
| Auth         | Clerk (with social login)                                       |
| AI           | Google Gemini (`gemini-2.0-flash`)                              |
| Media        | Unsplash API for cover images                                   |
| Misc         | `country-state-city`, `html5-qrcode`, `react-qr-code`, `sonner` |

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/tanmaymaity6/ai-event-organiser
cd ai-event-organiser
npm install
```

### 2. Create `.env.local`

```bash
# Convex (created by `npx convex dev`)
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_JWT_ISSUER_DOMAIN=

# Unsplash
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=

# Gemini
GEMINI_API_KEY=
```

### 3. Run Convex and Next.js

```bash
npx convex dev      # in one terminal
npm run dev         # in another
```

Open [http://localhost:3000](http://localhost:3000).

---

## Pages

| Route                       | Purpose                                              |
|-----------------------------|------------------------------------------------------|
| `/`                         | Landing page with hero and search                    |
| `/explore`                  | Browse and filter events                             |
| `/explore/[slug]`           | Events filtered by city                              |
| `/events/[slug]`            | Public event detail page with registration          |
| `/create-event`             | Authenticated event builder with AI assist          |
| `/my-events`                | Organiser dashboard                                  |
| `/my-events/[eventId]`      | Event management + QR check-in                      |
| `/my-tickets`               | Tickets the user has registered for                 |

---

## Free vs Pro

| Feature                 | Free | Pro       |
|-------------------------|------|-----------|
| Events you can create   | 1    | Unlimited |
| Custom theme colors     | ❌   | ✅        |
| AI event generation     | ✅   | ✅        |
| QR check-in             | ✅   | ✅        |

Both limits are enforced on the Convex server inside `createEvent`, so a tampered client can't bypass them.

---

## Contributing

PRs welcome. If you're adding to the AI generator, keep the JSON contract in `lib/ai/event-generator.js` and the form-side consumer in `app/(main)/create-event/page.jsx` in sync — the normalisation step is what keeps the rest of the app from having to defend against model surprises.

---

