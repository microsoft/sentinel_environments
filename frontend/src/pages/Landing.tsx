// Landing page
// Soft off-white canvas, bold Hanken Grotesk, cobalt accent. Environments
// rendered as a varied-size bento grid with soft tinted cards.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, RouteConfig } from "../router/routes";
import adamPhoto from "../../../data/author-photos/adam.png";
import amandaPhoto from "../../../data/author-photos/amanda.png";
import gaganPhoto from "../../../data/author-photos/gagan.png";
import husseinPhoto from "../../../data/author-photos/hussein.png";
import matheusPhoto from "../../../data/author-photos/matheus.jpeg";
import mayaPhoto from "../../../data/author-photos/maya.png";

const README_URL = "https://github.com/microsoft/sentinel_environments#readme";
const BLOG_URL =
  "https://www.microsoft.com/en-us/research/blog/tell-me-when-building-agents-that-can-wait-monitor-and-act/";

const FONT =
  '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

const CANVAS = "#F7F6F2";
const INK = "#0f1115";
const INK_SOFT = "#3a3d44";
const MUTED = "#6b6f78";
const RULE = "#e7e3d7";
const ACCENT = "#2A4DBF";

const assetBase = `${import.meta.env.BASE_URL}desktop/`;

interface Author {
  name: string;
  affiliation: string;
  photo: string;
  profileUrl: string;
}

const AUTHORS: Author[] = [
  {
    name: "Matheus Kunzler Maldaner",
    affiliation: "University of Florida",
    photo: matheusPhoto,
    profileUrl: "https://matheuskunzler.com",
  },
  {
    name: "Adam Fourney",
    affiliation: "Microsoft Research",
    photo: adamPhoto,
    profileUrl: "https://www.adamfourney.com",
  },
  {
    name: "Amanda Swearngin",
    affiliation: "Microsoft Research",
    photo: amandaPhoto,
    profileUrl: "https://amaswea.github.io",
  },
  {
    name: "Hussein Mozannar",
    affiliation: "Microsoft Research",
    photo: husseinPhoto,
    profileUrl: "https://husseinmozannar.github.io",
  },
  {
    name: "Gagan Bansal",
    affiliation: "Microsoft Research",
    photo: gaganPhoto,
    profileUrl: "https://homes.cs.washington.edu/~bansalg/",
  },
  {
    name: "Maya Murad",
    affiliation: "Microsoft Research",
    photo: mayaPhoto,
    profileUrl: "https://www.mayamurad.com",
  },
];

type ModalKind = "about" | "authors";

const cardImageMap: Record<string, string> = {
  micromail: `${assetBase}micromail-icon.png`,
  microchat: `${assetBase}teams-icon.png`,
  microdin: `${assetBase}microdin-icon.png`,
  microfy: `${assetBase}microfy-icon.png`,
  microgram: `${assetBase}microgram-icon.png`,
  microhood: `${assetBase}microhood-icon.png`,
  microhub: `${assetBase}github-icon.png`,
  microlendar: `${assetBase}microlendar-icon.png`,
  microscholar: `${assetBase}microscholar-icon.png`,
  microtube: `${assetBase}microtube-icon.png`,
};

// Per-environment tint: { bg (soft tint), ink (deep text), category label }
const envTheme: Record<
  string,
  { bg: string; ink: string; category: string; span: string }
> = {
  micromail: {
    bg: "#E0F2FE",
    ink: "#0c4a6e",
    category: "Email",
    span: "lg:col-span-3",
  },
  microhub: {
    bg: "#E7E5E4",
    ink: "#1f2937",
    category: "Code",
    span: "lg:col-span-3",
  },
  microgram: {
    bg: "#FCE7F3",
    ink: "#9d174d",
    category: "Photos",
    span: "lg:col-span-2",
  },
  microlendar: {
    bg: "#FFE4E6",
    ink: "#9f1239",
    category: "Calendar",
    span: "lg:col-span-2",
  },
  microscholar: {
    bg: "#FEF3C7",
    ink: "#92400e",
    category: "Research",
    span: "lg:col-span-2",
  },
  microchat: {
    bg: "#EDE9FE",
    ink: "#5b21b6",
    category: "Chat",
    span: "lg:col-span-3",
  },
  microdin: {
    bg: "#CCFBF1",
    ink: "#115e59",
    category: "Network",
    span: "lg:col-span-3",
  },
  microhood: {
    bg: "#DCFCE7",
    ink: "#166534",
    category: "Trading",
    span: "lg:col-span-2",
  },
  microtube: {
    bg: "#FECACA",
    ink: "#991b1b",
    category: "Video",
    span: "lg:col-span-2",
  },
  microfy: {
    bg: "#ECFCCB",
    ink: "#3f6212",
    category: "Music",
    span: "lg:col-span-2",
  },
};

const environmentRoutes: RouteConfig[] = routes.filter(
  (route) => route.category === "environment" && route.component !== null
);

const Landing = () => {
  const navigate = useNavigate();
  const [busyEnv, setBusyEnv] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const envSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const openEnvironment = async (route: RouteConfig) => {
    if (busyEnv) return;
    const envName = route.base_task ?? route.path.replace(/^\//, "");
    setBusyEnv(envName);
    setError(null);
    try {
      const res = await fetch(
        `/api/dev_init?environment=${encodeURIComponent(envName)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Init failed (${res.status})`);
      }
      navigate(route.path);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to initialize environment. Is the API server running?"
      );
      setBusyEnv(null);
    }
  };

  return (
    <div
      className="min-h-screen antialiased"
      style={{ background: CANVAS, color: INK, fontFamily: FONT }}
    >
      {/* TOP NAV */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3 sm:px-10">
          <a href="/" className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center text-[14px] font-bold"
              style={{ background: INK, color: CANVAS, borderRadius: 8 }}
            >
              S
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              SentinelBench
            </span>
          </a>
          <nav className="flex items-center gap-1 text-[14px] sm:gap-2">
            <button
              type="button"
              onClick={() => setModal("about")}
              className="rounded-md px-3 py-2 transition hover:bg-black/[0.04]"
              style={{ color: INK_SOFT }}
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setModal("authors")}
              className="rounded-md px-3 py-2 transition hover:bg-black/[0.04]"
              style={{ color: INK_SOFT }}
            >
              Authors
            </button>
            <a
              href={README_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-3 py-2 transition hover:bg-black/[0.04]"
              style={{ color: INK_SOFT }}
            >
              README ↗
            </a>
            <a
              href="https://github.com/microsoft/sentinel_environments"
              target="_blank"
              rel="noreferrer"
              className="ml-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-[14px] font-medium transition hover:opacity-90"
              style={{ background: INK, color: CANVAS }}
            >
              GitHub
              <span aria-hidden>↗</span>
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-[1280px] px-6 pb-12 pt-12 sm:px-10 sm:pb-20 sm:pt-20">
        <div className="max-w-4xl">
          <h1
            className="text-[clamp(2.5rem,7vw,5.75rem)] font-extrabold leading-[1.02] tracking-tight [text-wrap:balance]"
            style={{ color: INK, letterSpacing: "-0.025em" }}
          >
            Build AI agents that{" "}
            <span style={{ color: ACCENT }}>wait, watch, and act.</span>
          </h1>
          <p
            className="mt-7 max-w-2xl text-[18px] leading-[1.55] sm:text-[20px]"
            style={{ color: INK_SOFT }}
          >
            SentinelBench is a benchmark of ten high-fidelity web replicas for
            measuring how AI agents handle <strong>long-horizon</strong>{" "}
            monitoring inside real interfaces. Tasks unfold over minutes,
            hours, or days — and the agent has to notice the moment things
            change.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                envSectionRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold transition hover:opacity-90"
              style={{ background: INK, color: CANVAS }}
            >
              Explore environments
              <span aria-hidden>↓</span>
            </button>
            <a
              href={BLOG_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-[15px] font-semibold transition hover:bg-black/[0.03]"
              style={{ borderColor: RULE, color: INK }}
            >
              Read the paper
              <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ERROR */}
      {error && (
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 sm:px-10">
          <div
            role="alert"
            className="mb-6 rounded-lg border px-4 py-3 text-[14px]"
            style={{ borderColor: ACCENT, background: "#EEF2FF", color: INK }}
          >
            <strong style={{ color: ACCENT }}>Couldn&apos;t open environment.</strong>{" "}
            {error}
          </div>
        </div>
      )}

      {/* BENTO GRID */}
      <section
        ref={envSectionRef}
        className="relative z-10 mx-auto max-w-[1280px] px-6 pb-24 sm:px-10"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: INK, letterSpacing: "-0.02em" }}
            >
              Ten environments to monitor.
            </h2>
            <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
              Pick one — we&apos;ll boot it with sample data, no events
              replayed.
            </p>
          </div>
          <span className="text-[13px]" style={{ color: MUTED }}>
            Click any card to launch
          </span>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-6">
          {environmentRoutes.map((route) => {
            const envName = route.base_task ?? route.path.replace(/^\//, "");
            const theme = envTheme[envName];
            const isBusy = busyEnv === envName;
            const isDisabled = busyEnv !== null && busyEnv !== envName;
            const image = cardImageMap[envName];
            return (
              <li
                key={route.path}
                className={`${theme?.span ?? "lg:col-span-2"}`}
              >
                <button
                  type="button"
                  onClick={() => openEnvironment(route)}
                  disabled={isDisabled}
                  aria-busy={isBusy}
                  className="group relative flex h-full w-full flex-col items-start justify-between gap-8 overflow-hidden rounded-2xl border p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:p-7"
                  style={{
                    background: theme?.bg ?? "#fff",
                    borderColor: "rgba(0,0,0,0.06)",
                    minHeight: 220,
                    color: theme?.ink ?? INK,
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-4">
                    {image ? (
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 backdrop-blur"
                        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                      >
                        <img
                          src={image}
                          alt=""
                          className="h-8 w-8 object-contain"
                          draggable={false}
                        />
                      </span>
                    ) : null}
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
                      style={{
                        background: "rgba(255,255,255,0.55)",
                        color: theme?.ink ?? INK,
                      }}
                    >
                      {theme?.category ?? "App"}
                    </span>
                  </div>
                  <div className="w-full">
                    <h3
                      className="text-[clamp(1.5rem,2.6vw,2.25rem)] font-bold leading-tight tracking-tight"
                      style={{
                        color: theme?.ink ?? INK,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {route.title}
                    </h3>
                    <p
                      className="mt-2 text-[14px] leading-[1.55] [text-wrap:pretty]"
                      style={{ color: theme?.ink ?? INK, opacity: 0.78 }}
                    >
                      {route.description}
                    </p>
                    <div
                      className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider"
                      style={{ color: theme?.ink ?? INK }}
                    >
                      <span>{isBusy ? "Booting" : "Open"}</span>
                      <span
                        aria-hidden
                        className="inline-block transition-transform group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* FOOTER */}
      <footer
        className="relative z-10 border-t"
        style={{ borderColor: RULE }}
      >
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-[13px] sm:px-10"
          style={{ color: MUTED }}
        >
          <span>
            <strong style={{ color: INK }}>SentinelBench</strong> · Microsoft
            Research · AI Frontiers
          </span>
          <div className="flex items-center gap-5">
            <a
              href={README_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{ color: INK_SOFT }}
            >
              README
            </a>
            <a
              href={BLOG_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{ color: INK_SOFT }}
            >
              Paper
            </a>
            <a
              href="https://github.com/microsoft/sentinel_environments"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{ color: INK_SOFT }}
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* MODAL */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,17,21,0.4)" }}
            onClick={() => setModal(null)}
          />
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: "#fff", borderColor: RULE, color: INK }}
          >
            <div
              className="flex items-center justify-between border-b px-6 py-4"
              style={{ borderColor: RULE }}
            >
              <span className="text-[14px] font-semibold tracking-tight">
                {modal === "about" ? "About SentinelBench" : "Authors"}
              </span>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-[14px] transition hover:bg-black/[0.04]"
                style={{ color: INK_SOFT }}
              >
                ✕
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-7 py-7">
              {modal === "about" ? (
                <div className="space-y-5">
                  <h2
                    className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
                    style={{ color: INK, letterSpacing: "-0.025em" }}
                  >
                    AI agents that{" "}
                    <span style={{ color: ACCENT }}>wait, watch, act.</span>
                  </h2>
                  <p
                    className="max-w-prose text-[15px] leading-[1.7]"
                    style={{ color: INK_SOFT }}
                  >
                    SentinelBench evaluates AI agents on{" "}
                    <strong>long-horizon monitoring tasks</strong>. Ten
                    high-fidelity web-app replicas (the Micro* environments),
                    each with twenty task variants configurable to any
                    duration.
                  </p>
                  <p
                    className="max-w-prose text-[15px] leading-[1.7]"
                    style={{ color: INK_SOFT }}
                  >
                    Tasks are scenario JSON files: timed events, a
                    natural-language prompt, and an{" "}
                    <code
                      className="rounded px-1.5 py-0.5 text-[13px]"
                      style={{
                        background: "#F1F5F9",
                        color: ACCENT,
                        fontFamily:
                          '"Cascadia Mono", ui-monospace, "Segoe UI Mono", Menlo, Consolas, monospace',
                      }}
                    >
                      eval_sql
                    </code>{" "}
                    query. The harness runs them against an agent subprocess
                    and evaluates success via SQL when the agent completes.
                  </p>
                  <p
                    className="max-w-prose text-[15px] leading-[1.7]"
                    style={{ color: INK_SOFT }}
                  >
                    All tasks are <strong>time-based</strong> — the condition
                    becomes satisfiable exactly at the specified duration.
                    The hard part isn&apos;t recognising the condition; it&apos;s
                    noticing the moment it arrives.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <a
                      href={README_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg px-4 py-2 text-[14px] font-semibold transition hover:opacity-90"
                      style={{ background: INK, color: CANVAS }}
                    >
                      README ↗
                    </a>
                    <a
                      href={BLOG_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-4 py-2 text-[14px] font-semibold transition hover:bg-black/[0.03]"
                      style={{ borderColor: RULE, color: INK }}
                    >
                      Blog post →
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {AUTHORS.map((author) => (
                      <a
                        key={author.name}
                        href={author.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex flex-col gap-3 rounded-xl p-3 transition hover:bg-black/[0.03]"
                      >
                        <div
                          className="aspect-square w-full overflow-hidden rounded-xl"
                          style={{ background: "#F1F5F9" }}
                        >
                          <img
                            src={author.photo}
                            alt={author.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div>
                          <p
                            className="text-[15px] font-semibold tracking-tight"
                            style={{ color: INK }}
                          >
                            {author.name}
                          </p>
                          <p
                            className="text-[12px]"
                            style={{ color: MUTED }}
                          >
                            {author.affiliation}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
