/**
 * Sync committed blog posts into the DB. Runs after a blog-content PR merges to
 * main (see blog-content-sync.yml) — the step that publishes reviewed posts.
 * Service-role upsert; idempotent.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/blog/sync.ts
 *   npx tsx scripts/blog/sync.ts --dry-run   # print, don't write
 */
import { loadPosts } from "./posts.ts";
import { getAdmin, upsertPosts } from "./db.ts";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const posts = loadPosts();
  console.log(`Found ${posts.length} committed post(s).`);
  if (!posts.length) return;

  if (dryRun) {
    for (const p of posts) console.log(`  would upsert ${p.slug} — "${p.title}" [${p.category}]`);
    return;
  }

  const admin = await getAdmin();
  if (!admin) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const synced = await upsertPosts(admin, posts);
  console.log(`Synced ${synced} post(s) into blog_posts.`);
}

// Run only as a CLI entrypoint — not when imported (e.g. by tests).
if (!process.env.VITEST) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
