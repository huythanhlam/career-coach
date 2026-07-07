import { useEffect, useState } from "react";
import { Brain, Trash2, Loader2 } from "lucide-react";
import { listMemories, deleteMemory, type UserMemory } from "@/services/coachMemory";

/**
 * "What the coach knows about me" (Roadmap F1). Lets the user see and delete the
 * durable memories the coach has written about them (`user_memories`). Deleting a
 * memory stops it being injected into future coach turns. Read + delete only;
 * memories are created by the post-event memory-writer, never edited here.
 */

const KIND_META: Record<UserMemory["kind"], { label: string; hint: string }> = {
  fact: { label: "Facts", hint: "Durable truths about your situation" },
  preference: { label: "Preferences", hint: "How you like to work and be coached" },
  episode: { label: "Recent activity", hint: "Things that happened in past sessions" },
};

const KIND_ORDER: UserMemory["kind"][] = ["fact", "preference", "episode"];

export function CoachMemoryPanel() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMemories().then((m) => {
      if (!cancelled) {
        setMemories(m);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await deleteMemory(id);
    setDeletingId(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: "var(--muted-foreground)" }}
        >
          What the coach knows about me
        </h3>
        <Brain className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
      </div>
      <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        Your coach remembers a few things from past interviews, applications, and plans so it
        doesn&apos;t re-ask. Delete anything you&apos;d rather it forget.
      </p>

      {loading ? (
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading memories…
        </div>
      ) : memories.length === 0 ? (
        <p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>
          Nothing yet. As you run mock interviews, generate application packages, and save career
          plans, the coach will start remembering the highlights.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {KIND_ORDER.filter((k) => memories.some((m) => m.kind === k)).map((kind) => (
            <div key={kind}>
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                {KIND_META[kind].label}
                <span className="font-normal ml-2" style={{ color: "var(--muted-foreground)" }}>
                  {KIND_META[kind].hint}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {memories
                  .filter((m) => m.kind === kind)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl group"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
                    >
                      <span
                        className="text-xs leading-relaxed flex-1"
                        style={{ color: "var(--foreground)" }}
                      >
                        {m.content}
                      </span>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        aria-label="Delete this memory"
                        title="Delete this memory"
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      >
                        <Trash2
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--muted-foreground)" }}
                        />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
