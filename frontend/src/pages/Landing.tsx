import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, RouteConfig } from "../router/routes";

const README_URL = "https://github.com/microsoft/sentinel_environments#readme";
const BLOG_URL =
  "https://www.microsoft.com/en-us/research/blog/tell-me-when-building-agents-that-can-wait-monitor-and-act/";

const assetBase = `${import.meta.env.BASE_URL}desktop/`;

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

// Single signal accent — sodium / flare orange.
const SIGNAL = "#ff5a1f";

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
    photo: "/author-photos/matheus.jpeg",
    profileUrl: "https://matheuskunzler.com",
  },
  {
    name: "Adam Fourney",
    affiliation: "Microsoft Research",
    photo: "/author-photos/adam.png",
    profileUrl: "https://www.adamfourney.com",
  },
  {
    name: "Amanda Swearngin",
    affiliation: "Microsoft Research",
    photo: "/author-photos/amanda.png",
    profileUrl: "https://amaswea.github.io",
  },
  {
    name: "Hussein Mozannar",
    affiliation: "Microsoft Research",
    photo: "/author-photos/hussein.png",
    profileUrl: "https://husseinmozannar.github.io",
  },
  {
    name: "Gagan Bansal",
    affiliation: "Microsoft Research",
    photo: "/author-photos/gagan.png",
    profileUrl: "https://homes.cs.washington.edu/~bansalg/",
  },
  {
    name: "Maya Murad",
    affiliation: "Microsoft Research",
    photo: "/author-photos/maya.png",
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

const environmentRoutes: RouteConfig[] = routes.filter(
  (route) => route.category === "environment" && route.component !== null
);

const padTwo = (n: number) => String(n).padStart(2, "0");

const formatUtc = (d: Date) =>
  `${d.getUTCFullYear()}-${padTwo(d.getUTCMonth() + 1)}-${padTwo(
    d.getUTCDate()
  )} ${padTwo(d.getUTCHours())}:${padTwo(d.getUTCMinutes())}:${padTwo(
    d.getUTCSeconds()
  )}`;

const formatUptime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${padTwo(h)}:${padTwo(m)}:${padTwo(s)}`;
};

const Landing = () => {
  const navigate = useNavigate();
  const [busyEnv, setBusyEnv] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [now, setNow] = useState(() => new Date());
  const mountedAt = useMemo(() => Date.now(), []);

  // Live clock — ticks every second. Cheap; one render/sec is fine.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  const utc = formatUtc(now);
  const uptime = formatUptime(Date.now() - mountedAt);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#0a0a0c] text-[#ece6d8] antialiased"
      style={{ fontFamily: MONO }}
    >
      {/* Background: dot grid + vignette + a single drifting horizon line */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(#ece6d8 0.8px, transparent 0.8px)",
          backgroundSize: "26px 26px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(255,90,31,0.06), transparent 70%), radial-gradient(80% 60% at 100% 100%, rgba(255,90,31,0.04), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-[34vh] h-px bg-[#1d1d22]"
      />

      {/* INSTRUMENT BAR */}
      <div className="relative z-10 border-b border-[#1d1d22] px-6 py-3.5 text-[13px] uppercase tracking-[0.18em] text-[#c2bfb5]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-8 gap-y-2">
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: SIGNAL,
                boxShadow: `0 0 12px ${SIGNAL}`,
                animation: "landing-flicker 5s ease-in-out infinite",
              }}
            />
            <span className="text-[#ece6d8]">SentinelBench</span>
            <span className="text-[#8c8a82]">·</span>
            <span>Observatory</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 tabular-nums">
            <span>
              <span className="text-[#8c8a82]">UTC </span>
              {utc}
            </span>
            <span>
              <span className="text-[#8c8a82]">UPTIME </span>
              {uptime}
            </span>
            <span>
              <span className="text-[#8c8a82]">STATIONS </span>
              {environmentRoutes.length}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setModal("about")}
              className="px-2 py-1 text-[#ece6d8] transition hover:text-[#ff5a1f]"
            >
              [ ABOUT ]
            </button>
            <button
              type="button"
              onClick={() => setModal("authors")}
              className="px-2 py-1 text-[#ece6d8] transition hover:text-[#ff5a1f]"
            >
              [ AUTHORS ]
            </button>
            <a
              href={README_URL}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 text-[#ece6d8] transition hover:text-[#ff5a1f]"
            >
              [ README ↗ ]
            </a>
          </nav>
        </div>
      </div>

      {/* HERO */}
      <header className="relative z-10 mx-auto max-w-[1400px] px-6 pb-16 pt-16 sm:pb-24 sm:pt-24">
        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          <div
            className="col-span-12 lg:col-span-8"
            style={{ animation: "landing-rise 0.8s ease-out both" }}
          >
            <p className="mb-8 text-[10.5px] uppercase tracking-[0.4em] text-[#8c8a82]">
              <span style={{ color: SIGNAL }}>¶ 001</span>
              <span className="mx-3 text-[#54534e]">/</span>
              A benchmark for long-horizon monitoring
            </p>
            <h1
              className="text-[clamp(3.25rem,9.5vw,9rem)] font-normal leading-[0.92] tracking-tight"
              style={{ fontFamily: SERIF }}
            >
              Tell me{" "}
              <span className="italic" style={{ color: SIGNAL }}>
                when
              </span>
              .
            </h1>
            <h2
              className="mt-3 text-[clamp(1.75rem,5vw,4rem)] font-normal leading-[1.05] text-[#8c8a82] [text-wrap:balance]"
              style={{ fontFamily: SERIF }}
            >
              A study of agents that{" "}
              <span className="whitespace-nowrap">
                <span className="italic text-[#ece6d8]">wait</span>,{" "}
                <span className="italic text-[#ece6d8]">watch</span>, and{" "}
                <span className="italic text-[#ece6d8]">act</span>.
              </span>
            </h2>
          </div>

          <aside
            className="col-span-12 lg:col-span-4 lg:pt-16"
            style={{ animation: "landing-rise 0.9s ease-out 0.15s both" }}
          >
            <div className="border-l border-[#1d1d22] pl-6">
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#54534e]">
                Principal observations
              </p>
              <p className="mt-4 max-w-sm text-[13px] leading-[1.7] text-[#ece6d8]/85">
                Ten high-fidelity web applications. Tasks that unfold over
                minutes, hours, days. The agent must decide{" "}
                <em className="italic" style={{ fontFamily: SERIF }}>
                  when
                </em>{" "}
                a condition is satisfied — not just{" "}
                <em className="italic" style={{ fontFamily: SERIF }}>
                  what
                </em>{" "}
                it is.
              </p>
              <p className="mt-7 text-[10px] uppercase tracking-[0.34em] text-[#54534e]">
                Field guide
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-[#8c8a82]">
                Open any station below to boot the environment with its base
                sample data — no event timeline plays.
              </p>
            </div>
          </aside>
        </div>
      </header>

      {/* SECTION RULE */}
      <div className="relative z-10 mx-auto max-w-[1400px] px-6">
        <div className="flex items-center gap-4 text-[12px] uppercase tracking-[0.26em] text-[#a8a69d]">
          <span>§</span>
          <span className="text-[#ece6d8]">Stations</span>
          <span style={{ color: SIGNAL }}>●</span>
          <span>{environmentRoutes.length} active</span>
          <span
            aria-hidden
            className="flex-1 origin-left border-t border-dashed border-[#1d1d22]"
            style={{ animation: "landing-draw 1.2s ease-out 0.4s both" }}
          />
          <span className="tabular-nums">last sync · {utc.slice(11)}</span>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="relative z-10 mx-auto mt-4 max-w-[1400px] px-6">
          <div
            role="alert"
            className="flex items-start gap-3 border border-[#ff5a1f]/40 bg-[#ff5a1f]/[0.06] px-4 py-3 text-[12px] text-[#ece6d8]"
          >
            <span
              className="mt-0.5 text-[10px] uppercase tracking-[0.3em]"
              style={{ color: SIGNAL }}
            >
              ✕ FAULT
            </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* STATIONS LIST */}
      <main className="relative z-10 mx-auto max-w-[1400px] px-2 pb-20 sm:px-6">
        <ul className="mt-4 divide-y divide-[#1d1d22] border-y border-[#1d1d22]">
          {environmentRoutes.map((route, idx) => {
            const envName = route.base_task ?? route.path.replace(/^\//, "");
            const isBusy = busyEnv === envName;
            const isDisabled = busyEnv !== null && busyEnv !== envName;
            const image = cardImageMap[envName];

            return (
              <li key={route.path}>
                <button
                  type="button"
                  onClick={() => openEnvironment(route)}
                  disabled={isDisabled}
                  aria-busy={isBusy}
                  className="group relative grid w-full grid-cols-12 items-center gap-x-4 gap-y-2 px-3 py-5 text-left transition-colors hover:bg-[#101013] focus:outline-none focus-visible:bg-[#101013] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent sm:px-5 sm:py-6"
                  style={{
                    animation: `landing-rise 0.6s ease-out ${
                      0.25 + idx * 0.045
                    }s both`,
                  }}
                >
                  {/* Hover signal bar on the left */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-[2px] origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100 group-focus-visible:scale-y-100"
                    style={{ background: SIGNAL }}
                  />

                  {/* Index */}
                  <span
                    className="col-span-3 text-[14px] tracking-[0.16em] text-[#a8a69d] transition-colors group-hover:text-[#ff5a1f] sm:col-span-1"
                    style={{ fontFamily: MONO }}
                  >
                    [{padTwo(idx + 1)}]
                  </span>

                  {/* Icon stamp */}
                  <span className="col-span-2 flex h-12 w-12 items-center justify-center border border-[#1d1d22] bg-[#0f0f12] sm:col-span-1 sm:h-14 sm:w-14">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                        draggable={false}
                      />
                    ) : (
                      <span
                        className="text-2xl"
                        aria-hidden="true"
                      >
                        {route.icon}
                      </span>
                    )}
                  </span>

                  {/* Name + id + description */}
                  <span className="col-span-7 min-w-0 sm:col-span-6">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span
                        className="text-2xl leading-none sm:text-3xl"
                        style={{ fontFamily: SERIF }}
                      >
                        {route.title}
                      </span>
                      <span className="text-[10.5px] uppercase tracking-[0.22em] text-[#8c8a82]">
                        /{envName}
                      </span>
                    </span>
                    <span className="mt-2 block max-w-2xl text-[12.5px] leading-relaxed text-[#8c8a82]">
                      {route.description}
                    </span>
                  </span>

                  {/* Status pulse */}
                  <span className="col-span-12 flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-[#8c8a82] sm:col-span-2 sm:justify-start">
                    <span className="relative inline-flex h-2 w-2 items-center justify-center">
                      <span
                        className="absolute inline-flex h-full w-full rounded-full opacity-60"
                        style={{
                          background: SIGNAL,
                          animation: "ping 2.4s cubic-bezier(0,0,0.2,1) infinite",
                        }}
                      />
                      <span
                        className="relative inline-flex h-2 w-2 rounded-full"
                        style={{ background: SIGNAL }}
                      />
                    </span>
                    <span>{isBusy ? "Booting" : "Live"}</span>
                  </span>

                  {/* CTA */}
                  <span className="col-span-12 flex items-center justify-end gap-2 text-[11px] uppercase tracking-[0.3em] text-[#ece6d8] transition-colors group-hover:text-[#ff5a1f] sm:col-span-2">
                    <span>{isBusy ? "wait" : "open"}</span>
                    <span
                      aria-hidden
                      className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                    >
                      {isBusy ? "···" : "→"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 mx-auto max-w-[1400px] border-t border-[#1d1d22] px-6 py-8 text-[10px] uppercase tracking-[0.3em] text-[#54534e]">
        <div className="flex flex-wrap items-center justify-between gap-y-2">
          <span>
            <span className="text-[#8c8a82]">SentinelBench</span> · Microsoft
            Research · AI Frontiers
          </span>
          <span className="tabular-nums">
            <span className="text-[#8c8a82]">{utc}</span> UTC
          </span>
          <span className="flex items-center gap-2">
            <span style={{ color: SIGNAL }}>●</span>
            <span>Nominal — all stations online</span>
          </span>
        </div>
      </footer>

      {/* MODAL */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label={modal === "about" ? "About SentinelBench" : "Authors"}
        >
          <div
            className="absolute inset-0 bg-[#06060a]/85 backdrop-blur-sm"
            onClick={() => setModal(null)}
          />
          <div
            className="relative w-full max-w-3xl border border-[#1d1d22] bg-[#0a0a0c] shadow-2xl"
            style={{ animation: "landing-rise 0.25s ease-out both" }}
          >
            {/* Modal instrument bar */}
            <div className="flex items-center justify-between border-b border-[#1d1d22] px-5 py-3 text-[10.5px] uppercase tracking-[0.28em] text-[#8c8a82]">
              <div className="flex items-center gap-3">
                <span style={{ color: SIGNAL }}>●</span>
                <span>
                  {modal === "about" ? "§ About" : "§ Authors"} ·{" "}
                  {modal === "about" ? "002" : "003"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close"
                className="text-[#ece6d8] transition hover:text-[#ff5a1f]"
              >
                [ CLOSE × ]
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-7 text-[#ece6d8]">
              {modal === "about" ? (
                <div className="space-y-5">
                  <h3
                    className="text-4xl leading-none sm:text-5xl"
                    style={{ fontFamily: SERIF }}
                  >
                    Agents that{" "}
                    <span className="italic" style={{ color: SIGNAL }}>
                      wait
                    </span>
                    .
                  </h3>
                  <p className="max-w-prose text-[13px] leading-[1.75] text-[#ece6d8]/90">
                    <span style={{ fontFamily: SERIF }} className="italic">
                      SentinelBench
                    </span>{" "}
                    evaluates AI agents on{" "}
                    <em className="italic" style={{ fontFamily: SERIF }}>
                      long-horizon monitoring tasks
                    </em>
                    . Ten web-app replicas (the Micro* environments), each with
                    twenty task variants configurable to any duration.
                  </p>
                  <p className="max-w-prose text-[13px] leading-[1.75] text-[#ece6d8]/90">
                    Tasks are scenario JSON files: timed events, a
                    natural-language prompt, and an{" "}
                    <code
                      className="bg-[#15151a] px-1.5 py-0.5 text-[12px]"
                      style={{ color: SIGNAL, fontFamily: MONO }}
                    >
                      eval_sql
                    </code>{" "}
                    query. The harness runs them against an agent subprocess and
                    evaluates success when the agent calls it complete.
                  </p>
                  <p className="max-w-prose text-[13px] leading-[1.75] text-[#ece6d8]/90">
                    All tasks are{" "}
                    <em className="italic" style={{ fontFamily: SERIF }}>
                      time-based
                    </em>{" "}
                    — the condition becomes satisfiable exactly at the specified
                    duration. The hard part isn't recognising the condition;
                    it's noticing the moment it arrives.
                  </p>
                  <p className="text-[10.5px] uppercase tracking-[0.32em] text-[#54534e]">
                    Origin
                  </p>
                  <p className="max-w-prose text-[12.5px] leading-relaxed text-[#8c8a82]">
                    Started during an Undergraduate Research Internship at
                    Microsoft Research with the AI Frontiers team.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-3">
                    <a
                      href={README_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-[#1d1d22] px-3 py-2 text-[10.5px] uppercase tracking-[0.26em] text-[#ece6d8] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f]"
                    >
                      [ README ↗ ]
                    </a>
                    <a
                      href={BLOG_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-[#1d1d22] px-3 py-2 text-[10.5px] uppercase tracking-[0.26em] text-[#ece6d8] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f]"
                    >
                      [ BLOG POST ↗ ]
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <h3
                    className="mb-7 text-4xl leading-none sm:text-5xl"
                    style={{ fontFamily: SERIF }}
                  >
                    Authors{" "}
                    <span
                      className="italic text-[#8c8a82]"
                      style={{ fontFamily: SERIF }}
                    >
                      &amp; observers.
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
                    {AUTHORS.map((author, idx) => (
                      <a
                        key={author.name}
                        href={author.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex flex-col gap-3 text-left"
                        style={{
                          animation: `landing-rise 0.5s ease-out ${
                            idx * 0.05
                          }s both`,
                        }}
                      >
                        <div className="relative aspect-square w-full overflow-hidden border border-[#1d1d22] bg-[#0f0f12] transition-colors group-hover:border-[#ff5a1f]">
                          <img
                            src={author.photo}
                            alt={author.name}
                            className="h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
                            style={{
                              filter: "grayscale(40%) contrast(0.95)",
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const initials = author.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("");
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent) {
                                parent.classList.add(
                                  "flex",
                                  "items-center",
                                  "justify-center"
                                );
                                const span = document.createElement("span");
                                span.className = "text-3xl";
                                span.style.fontFamily = SERIF;
                                span.style.color = "#8c8a82";
                                span.textContent = initials;
                                parent.appendChild(span);
                              }
                            }}
                          />
                          <span
                            className="absolute left-2 top-2 text-[9px] uppercase tracking-[0.28em] text-[#ece6d8]/80"
                            style={{ fontFamily: MONO }}
                          >
                            [{padTwo(idx + 1)}]
                          </span>
                        </div>
                        <div>
                          <p
                            className="text-lg leading-tight transition-colors group-hover:text-[#ff5a1f]"
                            style={{ fontFamily: SERIF }}
                          >
                            {author.name}
                          </p>
                          <p
                            className="mt-1 text-[10.5px] uppercase tracking-[0.22em] text-[#54534e]"
                            style={{ fontFamily: MONO }}
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
