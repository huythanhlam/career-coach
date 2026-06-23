/**
 * Build blog posts with the 3-agent editorial pipeline and write the approved
 * ones as committed markdown (data/blog/posts/<slug>.md). This is the "method"
 * the scheduled routine runs; its output is what a PR pushes for review.
 *
 * Flow: Ideator sources briefs (seed list + web-search trends) → for each brief,
 * runEditorialPipeline (Writer ↔ Editor) → write approved posts. Rejected drafts
 * are skipped and logged, never committed.
 *
 * Usage:
 *   GEMINI_API_KEY=… npx tsx scripts/blog/build.ts                 # ~3 posts (seed + trending)
 *   npx tsx scripts/blog/build.ts --limit 5
 *   npx tsx scripts/blog/build.ts --seed-only --limit 2
 *   npx tsx scripts/blog/build.ts --trending-only
 *   npx tsx scripts/blog/build.ts --limit 1 --dry-run             # generate, don't write
 */
import { parseBuildArgs, sleep } from "./lib.ts";
import { DIR, POSTS_DIR, ensureDir, loadSeedTopics, existingSlugs, writePost } from "./posts.ts";
import { sourceIdeas } from "./agents/ideator.ts";
import { runEditorialPipeline } from "./pipeline.ts";
import { getAdmin, loadPublishedSlugs } from "./db.ts";

const DELAY_MS = 600; // polite gap between briefs (multiple Gemini calls each)
const DEFAULT_TOTAL = 3;

function splitCounts(total: number, seedOnly: boolean, trendingOnly: boolean) {
  if (seedOnly) return { seedCount: total, trendingCount: 0 };
  if (trendingOnly) return { seedCount: 0, trendingCount: total };
  const seedCount = Math.ceil(total / 2);
  return { seedCount, trendingCount: total - seedCount };
}

async function main() {
  const args = parseBuildArgs(process.argv.slice(2));
  ensureDir();

  const seedTopics = loadSeedTopics();
  if (!seedTopics.length && !args.trendingOnly) {
    console.warn("• No seed topics in data/blog/_topics.json — relying on trending only.");
  }

  // Known slugs come from committed files + (when env is present) the DB, so we
  // never re-pitch a topic we've already published.
  const known = new Set(existingSlugs());
  const admin = await getAdmin();
  if (admin) {
    for (const s of await loadPublishedSlugs(admin)) known.add(s);
  } else {
    console.log("• No Supabase env — deduping against committed files only.");
  }

  const total = args.limit && args.limit > 0 ? args.limit : DEFAULT_TOTAL;
  const { seedCount, trendingCount } = splitCounts(total, args.seedOnly, args.trendingOnly);
  console.log(`Sourcing ideas (${seedCount} seed + ${trendingCount} trending)…`);

  const briefs = await sourceIdeas({ seedTopics, existingSlugs: known, seedCount, trendingCount });
  if (!briefs.length) {
    console.log("Ideator returned no new briefs. Nothing to build.");
    return;
  }
  console.log(`Got ${briefs.length} brief(s). Drafting + editing (cap ${total})…`);

  let written = 0;
  for (const brief of briefs) {
    if (written >= total) break;
    if (known.has(brief.slug)) continue;
    console.log(`• ${brief.title}  [${brief.origin}/${brief.category}]`);

    const { post, rejectedReason } = await runEditorialPipeline(brief, {
      log: (m) => console.log(m),
    });
    if (!post) {
      console.log(`    ✗ skipped: ${rejectedReason}`);
      await sleep(DELAY_MS);
      continue;
    }

    known.add(post.slug);
    written++;
    if (args.dryRun) {
      console.log(`    ✓ [dry-run] ${post.slug} — ${post.readingMinutes} min, editor ${post.editorScore}/100, ${post.sources.length} sources`);
    } else {
      const path = writePost(post);
      console.log(`    ✓ wrote ${path} (editor ${post.editorScore}/100, ${post.editorRounds} round(s))`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`Done: ${written} post(s) ${args.dryRun ? "generated (dry-run)" : `written to ${POSTS_DIR}`}.`);
  if (!written) console.log(`(Drafts were generated but none cleared the editor's bar.) Base dir: ${DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
