import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_THEME_COLOR = "#1e3a8a";
const FREE_EVENT_LIMIT = 1;

/**
 * Build a URL-friendly slug from an event title.
 * Mirrors lib/slug.js but kept inline because Convex functions
 * can't import from outside the convex/ folder at runtime.
 */
function buildSlug(title) {
  const base = (title || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "event";
  return `${base}-${Date.now().toString(36)}`;
}

// Create a new event
export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    timezone: v.string(),
    locationType: v.union(v.literal("physical"), v.literal("online")),
    venue: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.string(),
    state: v.optional(v.string()),
    country: v.string(),
    capacity: v.number(),
    ticketType: v.union(v.literal("free"), v.literal("paid")),
    ticketPrice: v.optional(v.number()),
    coverImage: v.optional(v.string()),
    themeColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    if (!user) throw new Error("Not authenticated");

    const hasPro = user.hasPro ?? false;

    // Free-tier event limit
    if (!hasPro && user.freeEventsCreated >= FREE_EVENT_LIMIT) {
      throw new Error(
        "Free event limit reached. Please upgrade to Pro to create more events."
      );
    }

    // Free users can't pick a custom theme color
    if (!hasPro && args.themeColor && args.themeColor !== DEFAULT_THEME_COLOR) {
      throw new Error(
        "Custom theme colors are a Pro feature. Please upgrade to Pro."
      );
    }

    const themeColor = hasPro ? args.themeColor : DEFAULT_THEME_COLOR;

    const eventId = await ctx.db.insert("events", {
      ...args,
      themeColor,
      slug: buildSlug(args.title),
      organizerId: user._id,
      organizerName: user.name,
      registrationCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Track free-tier usage
    if (!hasPro) {
      await ctx.db.patch(user._id, {
        freeEventsCreated: user.freeEventsCreated + 1,
      });
    }

    return eventId;
  },
});

// Get event by slug
export const getEventBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

// Get events by organizer
export const getMyEvents = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    if (!user) return [];

    return await ctx.db
      .query("events")
      .withIndex("by_organizer", (q) => q.eq("organizerId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Find events similar to the given one — same category, upcoming,
 * preferably in the same city. Used on the public event-detail page
 * to surface "You might also like" suggestions.
 */
export const getSimilarEvents = query({
  args: {
    eventId: v.id("events"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 4;
    const source = await ctx.db.get(args.eventId);
    if (!source) return [];

    const now = Date.now();

    // Pull a generous batch from the same category, then rank in memory.
    const candidates = await ctx.db
      .query("events")
      .withIndex("by_category", (q) => q.eq("category", source.category))
      .collect();

    const scored = candidates
      .filter((e) => e._id !== source._id && e.startDate > now)
      .map((e) => {
        let score = 0;
        if (e.city === source.city) score += 3;
        if (e.country === source.country) score += 1;
        // Prefer events happening soon
        const daysAway = (e.startDate - now) / (1000 * 60 * 60 * 24);
        if (daysAway < 30) score += 2;
        else if (daysAway < 90) score += 1;
        return { event: e, score };
      })
      .sort((a, b) => b.score - a.score || a.event.startDate - b.event.startDate)
      .slice(0, limit)
      .map((x) => x.event);

    return scored;
  },
});

// Delete event
export const deleteEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    if (!user) throw new Error("Not authenticated");

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    if (event.organizerId !== user._id) {
      throw new Error("You are not authorized to delete this event");
    }

    // Cascade-delete registrations
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    for (const registration of registrations) {
      await ctx.db.delete(registration._id);
    }

    await ctx.db.delete(args.eventId);

    // Refund the free-tier slot so users can recreate after deleting
    const hasPro = user.hasPro ?? false;
    if (!hasPro && user.freeEventsCreated > 0) {
      await ctx.db.patch(user._id, {
        freeEventsCreated: user.freeEventsCreated - 1,
      });
    }

    return { success: true };
  },
});
