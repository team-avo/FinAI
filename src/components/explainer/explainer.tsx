"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ================================================================== */
/*  Glossary — every "?" chip opens one of these in plain English.     */
/* ================================================================== */

type Entry = { term: string; plain: string; analogy: string };

const GLOSSARY: Record<string, Entry> = {
  gst: {
    term: "GST",
    plain:
      "Goods and Services Tax — India's single tax added to almost every sale. Businesses collect it from customers and pass it to the government, filing a report every single month.",
    analogy:
      "Like sales tax or VAT elsewhere — but with strict monthly filing and matching rules that constantly trip up small businesses.",
  },
  itc: {
    term: "Input Tax Credit (ITC)",
    plain:
      "The GST a business already paid when buying its supplies. It subtracts that from the GST it collects on sales, so it only pays the government the difference.",
    analogy:
      "A receipt for tax you already paid. Claim it in time and you keep the cash; miss the deadline and it's gone for good.",
  },
  bor: {
    term: "Book of record",
    plain:
      "The official, reliable set of accounts a business, its bank, the tax office and investors can all trust — not a rough notebook or a chat history.",
    analogy: "The difference between a shoebox of receipts and an audited balance sheet.",
  },
  de: {
    term: "Double-entry",
    plain:
      "The core accounting rule: every transaction is recorded in two places, so the books always balance and nothing is left unexplained.",
    analogy:
      "Money never appears from thin air — it always moves from somewhere to somewhere. Double-entry records both ends.",
  },
  journal: {
    term: "Journal entry",
    plain:
      "One transaction written into the books — what happened, which accounts it touched, how much, and how much of it was tax.",
    analogy: "A single, precise line in the official story of the business's money.",
  },
  gstr: {
    term: "GSTR-1 & GSTR-3B",
    plain:
      "The GST reports every registered business files each month — sales detail in GSTR-1, the tax summary and payment in GSTR-3B.",
    analogy: "Monthly tax homework. Late or wrong means fines and notices.",
  },
  gstr2b: {
    term: "GSTR-2B",
    plain:
      "A statement the government generates automatically from what your suppliers reported about selling to you. Your Input Tax Credit is capped to what appears here.",
    analogy:
      "The taxman's own copy of your purchase list. If a supplier forgot to file, your tax refund silently disappears.",
  },
  ca: {
    term: "Chartered Accountant (CA)",
    plain:
      "India's licensed accountant. Most small businesses hand a shoebox of bills to a CA every quarter to sort out their books and taxes.",
    analogy: "Trusted and necessary — but expensive, slow, and a bottleneck.",
  },
  aa: {
    term: "Account Aggregator",
    plain:
      "A government-backed, consent-based system that lets a business securely share its bank and UPI data with an app it chooses.",
    analogy: "A bank-approved 'share my statements' button — the owner stays in control.",
  },
  einv: {
    term: "e-invoicing",
    plain:
      "Government-registered digital invoices, now mandatory for a growing share of businesses. Each invoice gets a unique government-issued number.",
    analogy: "Every invoice gets an official barcode the tax system recognises.",
  },
  wab: {
    term: "WhatsApp Business Platform",
    plain:
      "The official system businesses use to send and receive WhatsApp messages at scale, with its own rules and per-message pricing.",
    analogy:
      "The engine that lets a company run real workflows over the chat app every Indian already uses.",
  },
  reconcile: {
    term: "Reconciliation",
    plain:
      "Checking that two records match — your books against your bank statement, or against the government's GST data — and fixing any gaps.",
    analogy: "Making sure your version of events and everyone else's version agree.",
  },
  wedge: {
    term: "Wedge",
    plain:
      "The sharp, specific first product that gets a startup in the door — before it expands into a much bigger platform.",
    analogy: "The thin end that opens the crack; the rest of the business follows through it.",
  },
  creditgap: {
    term: "MSME credit gap",
    plain:
      "Roughly ₹28 lakh crore of loans India's small businesses need but can't get — largely because they can't prove their numbers.",
    analogy: "A huge pile of lending waiting on one thing: trustworthy books.",
  },
  tam: {
    term: "TAM",
    plain:
      "Total Addressable Market — the full yearly revenue available if every business that could use FinAI actually paid for it.",
    analogy: "The size of the whole pond, before you count the fish you can realistically catch.",
  },
};

const TERM_IDS = Object.keys(GLOSSARY);
const TERM_COUNT = TERM_IDS.length;

/* ================================================================== */
/*  Demo data — the "watch a message become books" interaction.        */
/* ================================================================== */

type Line = { acct: string; dr?: string; cr?: string; tax?: boolean };
type DemoT = {
  key: string;
  icon: string;
  label: string;
  input: string;
  narration: string;
  place: string;
  lines: Line[];
};

const DEMOS: DemoT[] = [
  {
    key: "photo",
    icon: "📸",
    label: "Snap a bill",
    input: "Photo of a bill — Café Coffee Day, ₹472 (incl. GST)",
    narration: "Refreshments — Café Coffee Day",
    place: "Same-state → CGST + SGST",
    lines: [
      { acct: "Refreshments", dr: "400.00" },
      { acct: "Input CGST (9%)", dr: "36.00", tax: true },
      { acct: "Input SGST (9%)", dr: "36.00", tax: true },
      { acct: "Cash", cr: "472.00" },
    ],
  },
  {
    key: "voice",
    icon: "🎤",
    label: "Send a voice note",
    input: "Voice note — “1180 rupaye ka printer paper cash mein liya”",
    narration: "Office supplies — printer paper",
    place: "Same-state → CGST + SGST",
    lines: [
      { acct: "Office Supplies", dr: "1,000.00" },
      { acct: "Input CGST (9%)", dr: "90.00", tax: true },
      { acct: "Input SGST (9%)", dr: "90.00", tax: true },
      { acct: "Cash", cr: "1,180.00" },
    ],
  },
  {
    key: "type",
    icon: "⌨️",
    label: "Type a line",
    input: "“Invoice Acme Corp ₹50,000 + GST for consulting”",
    narration: "Consulting — Acme Corp (other state)",
    place: "Other-state → IGST",
    lines: [
      { acct: "Accounts Receivable", dr: "59,000.00" },
      { acct: "Consulting income", cr: "50,000.00" },
      { acct: "Output IGST (18%)", cr: "9,000.00", tax: true },
    ],
  },
];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export function Explainer() {
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [demoPick, setDemoPick] = useState<string>("photo");
  const [progress, setProgress] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  /* restore per-viewer prefs */
  useEffect(() => {
    try {
      const t = localStorage.getItem("fexp-theme");
      if (t === "light" || t === "dark") setTheme(t);
      const s = localStorage.getItem("fexp-seen");
      if (s) setSeen(new Set(JSON.parse(s)));
    } catch {}
  }, []);

  /* progressive-enhancement reveals + scroll progress */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add("anim");

    const els = Array.from(root.querySelectorAll<HTMLElement>(".rv"));
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (ents) => {
          for (const e of ents) {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io!.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
      );
      els.forEach((el) => io!.observe(el));
    } else {
      els.forEach((el) => el.classList.add("in"));
    }

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        setProgress(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const openGlossary = useCallback((id: string, el?: HTMLButtonElement | null) => {
    lastTrigger.current = el ?? null;
    setOpenTerm(id);
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("fexp-seen", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const closeGlossary = useCallback(() => {
    setOpenTerm(null);
    requestAnimationFrame(() => lastTrigger.current?.focus());
  }, []);

  useEffect(() => {
    if (openTerm) requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, [openTerm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openTerm) {
        e.preventDefault();
        closeGlossary();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTerm, closeGlossary]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("fexp-theme", next);
      } catch {}
      return next;
    });
  }, []);

  /* a "?" term chip */
  const T = useCallback(
    ({ id }: { id: string }) => (
      <button
        type="button"
        className="term"
        data-seen={seen.has(id) ? "1" : undefined}
        onClick={(e) => openGlossary(id, e.currentTarget)}
        aria-label={`What is ${GLOSSARY[id].term}? Open explanation`}
      >
        {GLOSSARY[id].term}
        <span className="q" aria-hidden>
          ?
        </span>
      </button>
    ),
    [seen, openGlossary],
  );

  return (
    <div className="fexp" ref={rootRef} data-theme={theme === "light" ? "light" : undefined}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      />

      {/* scroll progress */}
      <div className="scrollbar" style={{ transform: `scaleX(${progress})` }} aria-hidden />

      {/* sticky header */}
      <header className="bar">
        <Link href="/" className="brand">
          Fin<span>AI</span>
          <em>· explained</em>
        </Link>
        <div className="bar-right">
          <div className="meter" title="Jargon terms you've opened">
            <span className="meter-n">{seen.size}</span>/{TERM_COUNT} terms
            <span className="meter-bar">
              <span className="meter-fill" style={{ width: `${(seen.size / TERM_COUNT) * 100}%` }} />
            </span>
          </div>
          <button type="button" className="theme" onClick={toggleTheme} aria-label="Toggle light or dark">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <Link href="/login" className="mini-cta">
            Start free
          </Link>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section className="hero band">
        <div className="wrap">
          <div className="eyebrow rv">FinAI · explained, for investors</div>
          <h1 className="rv d1">
            The WhatsApp accountant for India&apos;s{" "}
            <span className="hl">15 million</span> small businesses.
          </h1>
          <p className="lead rv d2">
            Snap a bill, send a voice note, or type a line — and FinAI keeps real,{" "}
            <T id="gst" />-correct books that keep themselves. No software to learn, no
            shoebox of receipts. This page walks through the whole story in plain English.
          </p>
          <p className="tip rv d3">
            Tap any <span className="chip-demo">underlined word<span className="q">?</span></span>{" "}
            to see what it means. Scroll to begin.
          </p>
          <div className="cta-row rv d3">
            <Link className="btn btn-p" href="/login">
              Start free →
            </Link>
            <a className="btn btn-g" href="#demo">
              Watch it work
            </a>
          </div>
          <div className="scroll-cue rv d3" aria-hidden>
            <span />
          </div>
        </div>
      </section>

      {/* ---------- 60-SECOND VERSION ---------- */}
      <section className="sec">
        <div className="wrap">
          <div className="kicker rv">The 60-second version</div>
          <h2 className="h2 rv">If you only read one thing.</h2>
          <div className="tldr">
            {[
              { n: "01", h: "The customer", b: <>India has 15 million <T id="gst" />-registered small businesses. Almost all run on WhatsApp &amp; UPI — almost none keep real books.</> },
              { n: "02", h: "The problem", b: <>&ldquo;The books&rdquo; are a shoebox handed to a <T id="ca" /> each quarter. A <T id="gst" /> slip-up becomes a notice — or quietly loses the business its <T id="itc" />.</> },
              { n: "03", h: "What FinAI does", b: <>A chat message becomes a real <T id="de" />, <T id="gst" />-correct <T id="bor" /> — trustworthy enough for a bank or the tax office.</> },
              { n: "04", h: "The prize", b: <>Clean books are the key to the ₹28 lakh crore <T id="creditgap" />. Keep the books, and you can help them borrow.</> },
            ].map((c) => (
              <div className="tcard rv" key={c.n}>
                <div className="tnum">{c.n}</div>
                <div className="th">{c.h}</div>
                <div className="tb">{c.b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- WHO ---------- */}
      <section className="sec band-soft">
        <div className="wrap">
          <div className="kicker rv">Who we serve</div>
          <h2 className="h2 rv">The business that runs on a phone, not a PC.</h2>
          <p className="body rv">
            Picture a kirana store, a small manufacturer, a design studio. The owner takes
            orders on WhatsApp, gets paid on UPI, and stuffs bills in a drawer. They are not
            going to open accounting software — but they already live inside a chat app.
          </p>
          <div className="statband rv">
            <div className="stat"><b>97%</b><span>of MSMEs use WhatsApp for business</span></div>
            <div className="stat"><b>~532M</b><span>WhatsApp users in India</span></div>
            <div className="stat"><b>15M</b><span>GST-registered businesses who must file</span></div>
            <div className="stat"><b>~14%</b><span>of MSMEs have access to formal credit</span></div>
          </div>
          <p className="fine rv">Figures from industry surveys &amp; public data, 2024–26; directional.</p>
        </div>
      </section>

      {/* ---------- THE PROBLEM ---------- */}
      <section className="sec">
        <div className="wrap">
          <div className="kicker rv">The problem</div>
          <h2 className="h2 rv">Today, the books are a shoebox — and GST punishes every mistake.</h2>
          <div className="twocol">
            <div className="col rv">
              <h3 className="h3">The quarterly scramble</h3>
              <p className="body">
                Bills pile up for three months. Then the owner dumps them on a <T id="ca" />,
                who re-types everything into desktop software. It&apos;s slow, expensive, and
                the owner never actually knows where the money stands in between.
              </p>
            </div>
            <div className="col rv">
              <h3 className="h3">The GST machine</h3>
              <p className="body">
                Every month there&apos;s a <T id="gstr" /> to file. Claimed credit must match the
                government&apos;s <T id="gstr2b" /> within a <strong>5% tolerance</strong> — miss it
                and you get a notice. Enforcement is real: <strong>20,000+ notices</strong> and a{" "}
                <strong>₹80,000 crore</strong> demand went out for one audit window alone.
              </p>
            </div>
          </div>
          <div className="pullquote rv">
            And the quiet killer: <T id="itc" /> you forget to claim in time is{" "}
            <span className="hl">cash gone forever</span> — not a fine, just money you never get back.
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS (DEMO) ---------- */}
      <section className="sec band-soft" id="demo">
        <div className="wrap">
          <div className="kicker rv">How it works · try it</div>
          <h2 className="h2 rv">Snap it, say it, or type it — and watch it become books.</h2>
          <p className="body rv">
            Pick how a busy owner might capture a transaction. FinAI reads it and posts a correct{" "}
            <T id="journal" />, tax split and all.
          </p>
          <Demo pick={demoPick} setPick={setDemoPick} Term={T} />

          <div className="pipe rv">
            {[
              { h: "You send", b: "a photo, voice note or line of text on WhatsApp" },
              { h: "FinAI reads it", b: "AI pulls out the vendor, amount, date and tax" },
              { h: "Rules do the maths", b: "a tax engine (not guesswork) computes the GST split" },
              { h: "It posts to your books", b: "a balanced, double-entry journal entry" },
              { h: "You get reports", b: "GST-ready filings and a real balance sheet" },
            ].map((s, i) => (
              <div className="step rv" key={i}>
                <div className="step-n">{i + 1}</div>
                <div className="step-h">{s.h}</div>
                <div className="step-b">{s.b}</div>
              </div>
            ))}
          </div>
          <p className="fine rv">
            Important for trust: the AI only reads and drafts. The actual tax arithmetic is done by
            deterministic rules, so the numbers are right — not an AI&apos;s best guess.
          </p>
        </div>
      </section>

      {/* ---------- REAL BOOK OF RECORD ---------- */}
      <section className="sec">
        <div className="wrap">
          <div className="kicker rv">Why it&apos;s the real thing</div>
          <h2 className="h2 rv">Everyone else gives you a ledger. We give you a <T id="bor" />.</h2>
          <div className="twocol">
            <div className="col rv">
              <h3 className="h3">What <T id="de" /> means</h3>
              <p className="body">
                Money never appears from nowhere — it moves <em>from</em> somewhere <em>to</em> somewhere.
                Recording both ends is what makes books balance and lets a bank or auditor trust them.
                A &ldquo;khata&rdquo; app only writes down who owes whom; it can never become real accounts.
              </p>
            </div>
            <div className="col rv">
              <h3 className="h3">Why the <T id="gst" /> split matters</h3>
              <p className="body">
                Sell inside your state and the tax splits into CGST + SGST; sell to another state and it
                becomes IGST. Get that wrong and your filings are wrong. FinAI figures out which, every
                time, from the buyer&apos;s location — you saw it do exactly that in the demo above.
              </p>
            </div>
          </div>
          <div className="compare rv">
            {[
              { n: "Tally", d: "Lives on one old Windows PC. Nothing is real-time." },
              { n: "“Khata” apps", d: "Just a running tally of who owes whom. Not real accounts." },
              { n: "Zoho / ClearTax", d: "Powerful — but built for an accountant to drive, not the owner." },
              { n: "FinAI", d: <><T id="de" />, <T id="gst" />-correct books from a chat — trusted by a bank or the tax office.</>, win: true },
            ].map((c) => (
              <div className={`cc rv${c.win ? " win" : ""}`} key={c.n}>
                <div className="cc-name">{c.n}</div>
                <div className="cc-note">{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- THE WEDGE ---------- */}
      <section className="sec band-soft">
        <div className="wrap">
          <div className="kicker rv">The wedge — the clever bit</div>
          <h2 className="h2 rv">We claw back the tax refund every rival lets you lose.</h2>
          <p className="body rv">
            Because FinAI keeps the books in real time, it continuously{" "}
            <T id="reconcile" />s them against the government&apos;s <T id="gstr2b" /> and warns you{" "}
            <em>before</em> the deadline when a supplier hasn&apos;t filed — so you don&apos;t silently lose
            your <T id="itc" />. That&apos;s money found, not features added.
          </p>
          <div className="cliff rv">
            <div className="cliff-track">
              <span className="cliff-dot" style={{ left: "6%" }}><i /><em>You buy supplies, pay GST</em></span>
              <span className="cliff-dot warn" style={{ left: "58%" }}><i /><em>Supplier hasn&apos;t filed — FinAI alerts you</em></span>
              <span className="cliff-dot bad" style={{ left: "92%" }}><i /><em>30 Nov: credit lost forever</em></span>
            </div>
            <div className="cliff-cap">The ITC clock — FinAI acts in the gap nobody else watches.</div>
          </div>
          <p className="body rv">
            No one else does this, because the incumbents are fenced out: Tally lives on a desktop, the
            khata apps aren&apos;t real books, and the filing tools only wake up once a quarter. FinAI sits
            in the one spot — continuous, owner-facing, compliant — that each rival&apos;s own business
            model pushes it away from. That&apos;s what makes it a <T id="wedge" />.
          </p>
        </div>
      </section>

      {/* ---------- WHY NOW ---------- */}
      <section className="sec">
        <div className="wrap">
          <div className="kicker rv">Why now</div>
          <h2 className="h2 rv">Four rails all went live in the last three years.</h2>
          <ul className="timeline">
            {[
              { y: "2023", h: <><T id="gst" /> + <T id="einv" /> pushed down to small firms</>, b: "Accounting became must-do, not nice-to-have — and mistakes cost cash." },
              { y: "Live", h: <><T id="aa" /> opened consented data</>, b: "Banks and UPI data can now flow to an app with the owner's permission." },
              { y: "2024–26", h: "Capable AI got cheap", b: "Reading a messy bill and understanding a Hindi/Hinglish voice note now costs almost nothing." },
              { y: "Now", h: "WhatsApp reached ~532M Indians", b: "Zero-install distribution to the exact customer — no app to download." },
            ].map((t, i) => (
              <li className="tl rv" key={i}>
                <span className="tl-y">{t.y}</span>
                <div>
                  <div className="tl-h">{t.h}</div>
                  <div className="tl-b">{t.b}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="pullquote rv">No earlier moment had all four at once.</p>
        </div>
      </section>

      {/* ---------- MARKET & LADDER ---------- */}
      <section className="sec band-soft">
        <div className="wrap">
          <div className="kicker rv">The market &amp; the prize</div>
          <h2 className="h2 rv">A subscription that becomes a lending business.</h2>
          <div className="statband rv">
            <div className="stat"><b>15M</b><span>paying-capable businesses (<T id="tam" />)</span></div>
            <div className="stat"><b>₹750–1,500</b><span>realistic monthly price per business</span></div>
            <div className="stat"><b>₹28L cr</b><span>the <T id="creditgap" /> the data unlocks</span></div>
          </div>
          <p className="body rv">
            Small businesses do pay for software that&apos;s load-bearing for tax — Tally earns ~₹850 crore a
            year from them. FinAI starts as that compliance-critical subscription, then climbs a ladder:
          </p>
          <div className="ladder rv">
            {[
              "Keep the books (subscription)",
              "Handle payments & collections",
              "Offer early settlement / float",
              "Lend, using the books as proof",
            ].map((s, i) => (
              <div className="rung rv" key={i} style={{ marginLeft: `${i * 8}%` }}>
                <span className="rung-n">{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
          <p className="fine rv">
            Market sizes are founder estimates with stated assumptions, not published analyst figures.
          </p>
        </div>
      </section>

      {/* ---------- CLOSE ---------- */}
      <section className="sec close">
        <div className="wrap">
          <div className="kicker rv">You get it now</div>
          <h2 className="h2 big rv">That&apos;s <span className="hl">FinAI</span>.</h2>
          <p className="lead rv">
            The WhatsApp-native accountant for India&apos;s 15 million small businesses — snap a bill, and
            your books keep themselves, <T id="gst" />-correct and lender-ready.
          </p>

          <div className="recap rv">
            <div className="recap-h">Everything you unlocked — tap to revisit</div>
            <div className="g-grid">
              {TERM_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="g-cell"
                  data-seen={seen.has(id) ? "1" : undefined}
                  onClick={(e) => openGlossary(id, e.currentTarget)}
                >
                  <span className="g-dot" aria-hidden>
                    {seen.has(id) ? "✓" : "?"}
                  </span>
                  {GLOSSARY[id].term}
                </button>
              ))}
            </div>
          </div>

          <div className="cta-row rv">
            <Link className="btn btn-p" href="/login">
              Start free →
            </Link>
            <Link className="btn btn-g" href="/">
              See the product
            </Link>
          </div>
        </div>
        <footer className="foot">
          <span className="brand">
            Fin<span>AI</span>
          </span>
          <span className="mono">AI-native accounting · built for India</span>
          <span className="mono">© 2026</span>
        </footer>
      </section>

      {/* ---------- GLOSSARY MODAL ---------- */}
      {openTerm && (
        <div className="overlay" onClick={closeGlossary}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gl-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-tag">in plain English</div>
            <h3 id="gl-title">{GLOSSARY[openTerm].term}</h3>
            <p className="modal-plain">{GLOSSARY[openTerm].plain}</p>
            <div className="modal-analogy">
              <span className="modal-analogy-h">Think of it like…</span>
              {GLOSSARY[openTerm].analogy}
            </div>
            <button type="button" className="modal-x" onClick={closeGlossary} ref={closeBtnRef}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Demo sub-component                                                 */
/* ================================================================== */

function Demo({
  pick,
  setPick,
  Term,
}: {
  pick: string;
  setPick: (k: string) => void;
  Term: ({ id }: { id: string }) => React.ReactNode;
}) {
  const d = DEMOS.find((x) => x.key === pick) ?? DEMOS[0];
  return (
    <div className="demo rv">
      <div className="demo-ins">
        {DEMOS.map((x) => (
          <button
            key={x.key}
            type="button"
            className="demo-in"
            data-on={pick === x.key ? "1" : undefined}
            onClick={() => setPick(x.key)}
          >
            <span className="demo-ic" aria-hidden>{x.icon}</span>
            {x.label}
          </button>
        ))}
      </div>

      <div className="demo-flow" key={d.key}>
        <div className="bubble">{d.input}</div>
        <div className="reads">
          FinAI reads it <span className="dots"><i /><i /><i /></span>
        </div>
        <div className="jcard">
          <div className="jcard-top">
            <span className="jcard-k">Journal entry</span>
            <span className="jcard-place">{d.place}</span>
          </div>
          <div className="jcard-narr">{d.narration}</div>
          <table className="jtab">
            <thead>
              <tr>
                <th>Account</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l, i) => (
                <tr key={i} data-tax={l.tax ? "1" : undefined}>
                  <td>{l.acct}</td>
                  <td className="num">{l.dr ? `₹${l.dr}` : ""}</td>
                  <td className="num">{l.cr ? `₹${l.cr}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="jcard-foot">
            <span className="ok">✓ Posted · balanced (Debit = Credit)</span>
            <span className="auto">
              <Term id="gst" /> split computed automatically
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Scoped styles (.fexp) — dark-first, violet/mint, Schibsted + mono  */
/* ================================================================== */

const CSS = `
.fexp{
  --bg:#0B0714; --surface:#17102A; --surface2:#1E1536; --fg:#F3EEFC;
  --muted:#AEA2CC; --faint:#776B9A; --violet:#B45CFF; --violet-br:#CFA0FF;
  --violet-dp:#8B3DFF; --mint:#49E8AB; --line:#271d45; --glow:rgba(180,92,255,.5);
  --amb-a:rgba(139,61,255,.34); --amb-b:rgba(180,92,255,.16);
  --sans:'Schibsted Grotesk',system-ui,sans-serif; --mono:'IBM Plex Mono',monospace;
  --maxw:980px;
  position:relative; isolation:isolate; min-height:100vh;
  background:var(--bg); color:var(--fg); font-family:var(--sans);
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.fexp[data-theme="light"]{
  --bg:#FBF9FF; --surface:#FFFFFF; --surface2:#F6F1FF; --fg:#190E30;
  --muted:#574C74; --faint:#8E84AC; --violet:#8B3DFF; --violet-br:#6D28D9;
  --violet-dp:#6D28D9; --mint:#0E9E73; --line:#EBE2FB; --glow:rgba(139,61,255,.22);
  --amb-a:rgba(139,61,255,.10); --amb-b:rgba(180,92,255,.06);
}
.fexp *{box-sizing:border-box}
.fexp a{color:inherit;text-decoration:none}
.fexp .wrap{max-width:var(--maxw);margin:0 auto;padding:0 clamp(18px,5vw,40px)}

/* scroll progress */
.fexp .scrollbar{position:fixed;top:0;left:0;right:0;height:3px;z-index:30;transform-origin:0 50%;
  background:linear-gradient(90deg,var(--violet-dp),var(--violet),var(--mint))}

/* header */
.fexp .bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:12px clamp(16px,5vw,40px);background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.fexp .brand{font-weight:800;font-size:18px;letter-spacing:-.02em;display:flex;align-items:baseline;gap:7px}
.fexp .brand span{color:var(--violet-br)}
.fexp .brand em{font-style:normal;font-weight:500;font-size:12px;color:var(--faint);font-family:var(--mono)}
.fexp .bar-right{display:flex;align-items:center;gap:12px}
.fexp .meter{font-family:var(--mono);font-size:11.5px;color:var(--faint);display:flex;align-items:center;gap:7px}
.fexp .meter-n{color:var(--mint);font-weight:600}
.fexp .meter-bar{display:inline-block;width:70px;height:5px;border-radius:4px;background:var(--line);overflow:hidden}
.fexp .meter-fill{display:block;height:100%;background:linear-gradient(90deg,var(--violet),var(--mint));transition:width .4s}
.fexp .theme{width:34px;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--fg);cursor:pointer;font-size:14px}
.fexp .theme:hover{border-color:var(--violet)}
.fexp .mini-cta{font-weight:700;font-size:13px;padding:8px 15px;border-radius:9px;background:var(--violet);color:#fff}
.fexp .mini-cta:hover{background:var(--violet-dp)}

/* sections */
.fexp .sec{padding:clamp(56px,9vw,120px) 0;position:relative}
.fexp .band{position:relative}
.fexp .band::before,.fexp .band::after{content:"";position:absolute;z-index:-1;border-radius:50%;filter:blur(90px);pointer-events:none}
.fexp .band::before{width:62vw;height:62vw;top:-20vw;right:-14vw;background:var(--amb-a)}
.fexp .band::after{width:48vw;height:48vw;bottom:-18vw;left:-12vw;background:var(--amb-b)}
.fexp .band-soft{background:var(--surface)}
.fexp[data-theme="light"] .band-soft{background:var(--surface2)}

.fexp .kicker{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--violet-br);margin-bottom:14px}
.fexp .h2{font-size:clamp(26px,4.4vw,42px);line-height:1.08;letter-spacing:-.03em;font-weight:800;margin:0 0 20px;max-width:18ch}
.fexp .h2.big{font-size:clamp(40px,8vw,84px)}
.fexp .h3{font-size:clamp(18px,2.4vw,22px);font-weight:700;letter-spacing:-.02em;margin:0 0 10px}
.fexp .hl{color:var(--violet-br)}
.fexp .body{font-size:clamp(15px,1.9vw,19px);line-height:1.58;color:var(--muted);max-width:62ch;margin:0 0 14px}
.fexp .body strong{color:var(--fg)}
.fexp .body em,.fexp .lead em{color:var(--mint);font-style:normal;font-weight:600}
.fexp .fine{font-family:var(--mono);font-size:12px;color:var(--faint);margin:16px 0 0}
.fexp .pullquote{font-size:clamp(19px,3vw,28px);line-height:1.3;font-weight:600;letter-spacing:-.02em;margin:28px 0 0;max-width:24ch}

/* hero */
.fexp .hero{padding-top:clamp(40px,7vw,72px);padding-bottom:clamp(48px,8vw,96px)}
.fexp .eyebrow{font-family:var(--mono);font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--violet-br);margin-bottom:18px}
.fexp .hero h1{font-size:clamp(34px,6.6vw,68px);line-height:1.02;letter-spacing:-.035em;font-weight:800;margin:0 0 22px;max-width:16ch}
.fexp .lead{font-size:clamp(16px,2.2vw,22px);line-height:1.5;color:var(--muted);max-width:60ch;margin:0 0 20px}
.fexp .tip{font-family:var(--mono);font-size:12.5px;color:var(--faint);margin:0 0 26px}
.fexp .chip-demo{color:var(--violet-br);border-bottom:1.5px dotted var(--violet);padding-bottom:1px}
.fexp .chip-demo .q{font-size:.7em;vertical-align:super;margin-left:2px}
.fexp .scroll-cue{margin-top:40px;width:26px;height:42px;border:2px solid var(--line);border-radius:14px;position:relative}
.fexp .scroll-cue span{position:absolute;left:50%;top:8px;width:4px;height:8px;border-radius:3px;background:var(--violet);transform:translateX(-50%);animation:cue 1.6s infinite}
@keyframes cue{0%{opacity:0;transform:translate(-50%,0)}30%{opacity:1}100%{opacity:0;transform:translate(-50%,14px)}}

/* term chips */
.fexp .term{font:inherit;color:var(--violet-br);background:none;border:0;padding:0;cursor:pointer;
  border-bottom:1.6px dotted var(--violet);line-height:1.2;transition:background .2s,color .2s}
.fexp .term:hover{color:var(--fg);background:rgba(180,92,255,.12);border-radius:4px}
.fexp .term .q{display:inline-flex;align-items:center;justify-content:center;width:1.05em;height:1.05em;margin-left:3px;
  font-size:.62em;font-weight:700;border-radius:50%;background:var(--violet);color:#fff;vertical-align:super}
.fexp .term[data-seen] .q{background:var(--mint);color:#06301f;font-size:.56em}
.fexp .term[data-seen] .q::before{content:"✓"}

/* cta + buttons */
.fexp .cta-row{display:flex;gap:12px;flex-wrap:wrap}
.fexp .btn{font:inherit;font-weight:700;font-size:15px;padding:13px 22px;border-radius:12px;cursor:pointer;transition:.2s;display:inline-flex;align-items:center;gap:8px}
.fexp .btn-p{background:var(--violet);color:#fff;box-shadow:0 10px 30px -10px var(--glow)}
.fexp .btn-p:hover{background:var(--violet-dp);transform:translateY(-1px)}
.fexp .btn-g{border:1px solid var(--line);background:var(--surface);color:var(--fg)}
.fexp[data-theme="light"] .btn-g{background:#fff}
.fexp .btn-g:hover{border-color:var(--violet)}

/* tldr cards */
.fexp .tldr{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:8px}
.fexp .tcard{border:1px solid var(--line);background:var(--surface);border-radius:16px;padding:22px}
.fexp[data-theme="light"] .tcard{background:#fff}
.fexp .tnum{font-family:var(--mono);font-size:12px;color:var(--violet-br);margin-bottom:10px}
.fexp .th{font-weight:700;font-size:17px;margin-bottom:8px}
.fexp .tb{font-size:14.5px;line-height:1.5;color:var(--muted)}

/* stat band */
.fexp .statband{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:8px}
.fexp .stat{border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:18px}
.fexp[data-theme="light"] .stat{background:#fff}
.fexp .stat b{display:block;font-size:clamp(22px,3.4vw,30px);font-weight:800;color:var(--mint);letter-spacing:-.02em}
.fexp .stat span{display:block;font-size:13px;line-height:1.4;color:var(--muted);margin-top:6px}

/* two column */
.fexp .twocol{display:grid;grid-template-columns:1fr 1fr;gap:clamp(18px,4vw,44px)}
.fexp .col{min-width:0}

/* compare */
.fexp .compare{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:28px}
.fexp .cc{border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:16px 18px}
.fexp[data-theme="light"] .cc{background:#fff}
.fexp .cc-name{font-weight:700;font-size:15px;margin-bottom:6px;color:var(--faint)}
.fexp .cc-note{font-size:14px;line-height:1.45;color:var(--muted)}
.fexp .cc.win{border-color:var(--violet);background:linear-gradient(180deg,rgba(139,61,255,.14),var(--surface));box-shadow:0 0 0 1px var(--violet) inset}
.fexp .cc.win .cc-name{color:var(--violet-br)}
.fexp .cc.win .cc-note{color:var(--fg)}

/* pipeline */
.fexp .pipe{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:30px}
.fexp .step{border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:16px;position:relative}
.fexp[data-theme="light"] .step{background:#fff}
.fexp .step-n{width:26px;height:26px;border-radius:50%;background:var(--violet);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.fexp .step-h{font-weight:700;font-size:14.5px;margin-bottom:6px}
.fexp .step-b{font-size:12.5px;line-height:1.45;color:var(--muted)}

/* cliff timeline */
.fexp .cliff{margin:34px 0 10px}
.fexp .cliff-track{position:relative;height:4px;background:var(--line);border-radius:3px;margin:0 10px 92px}
.fexp .cliff-dot{position:absolute;top:50%;translate:-50% -50%}
.fexp .cliff-dot i{position:absolute;left:50%;top:50%;translate:-50% -50%;width:14px;height:14px;border-radius:50%;background:var(--violet);box-shadow:0 0 0 4px color-mix(in srgb,var(--violet) 25%,transparent)}
.fexp .cliff-dot.warn i{background:#f5b74b;box-shadow:0 0 0 4px rgba(245,183,75,.25)}
.fexp .cliff-dot.bad i{background:#ff5c7a;box-shadow:0 0 0 4px rgba(255,92,122,.25)}
.fexp .cliff-dot em{position:absolute;top:20px;left:50%;translate:-50% 0;width:140px;text-align:center;font-style:normal;font-size:12px;line-height:1.35;color:var(--muted)}
.fexp .cliff-dot.bad em{color:#ff8098;font-weight:600}
.fexp .cliff-cap{font-family:var(--mono);font-size:12px;color:var(--faint);text-align:center}

/* why-now timeline */
.fexp .timeline{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:14px}
.fexp .tl{display:flex;gap:16px;align-items:flex-start;border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:16px 18px}
.fexp[data-theme="light"] .tl{background:#fff}
.fexp .tl-y{font-family:var(--mono);font-size:12px;color:var(--mint);background:rgba(73,232,171,.1);border:1px solid rgba(73,232,171,.3);padding:5px 9px;border-radius:7px;min-width:78px;text-align:center;flex:none}
.fexp .tl-h{font-weight:700;font-size:16px;margin-bottom:4px}
.fexp .tl-b{font-size:14px;line-height:1.45;color:var(--muted)}

/* monetization ladder */
.fexp .ladder{margin:26px 0 8px;display:grid;gap:10px}
.fexp .rung{display:flex;align-items:center;gap:12px;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:14px 16px;font-weight:600;font-size:15px;max-width:620px;transition:.2s}
.fexp[data-theme="light"] .rung{background:#fff}
.fexp .rung:last-child{border-color:var(--violet);background:linear-gradient(90deg,rgba(139,61,255,.16),var(--surface));color:var(--fg)}
.fexp .rung-n{width:24px;height:24px;border-radius:50%;background:var(--violet-dp);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}

/* recap */
.fexp .recap{margin-top:12px}
.fexp .recap-h{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:12px}
.fexp .g-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.fexp .g-cell{font:inherit;font-size:13.5px;text-align:left;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;transition:.2s}
.fexp[data-theme="light"] .g-cell{background:#fff}
.fexp .g-cell:hover{border-color:var(--violet);color:var(--fg)}
.fexp .g-dot{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:var(--violet);color:#fff;flex:none}
.fexp .g-cell[data-seen]{color:var(--fg)}
.fexp .g-cell[data-seen] .g-dot{background:var(--mint);color:#06301f}

/* close */
.fexp .close{text-align:left}
.fexp .close .cta-row{margin-top:30px}

/* demo */
.fexp .demo{margin-top:24px}
.fexp .demo-ins{display:flex;gap:10px;flex-wrap:wrap}
.fexp .demo-in{font:inherit;font-weight:600;font-size:14px;display:inline-flex;align-items:center;gap:8px;padding:12px 16px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--fg);cursor:pointer;transition:.2s}
.fexp[data-theme="light"] .demo-in{background:#fff}
.fexp .demo-in:hover{border-color:var(--violet)}
.fexp .demo-in[data-on]{border-color:var(--violet);background:linear-gradient(180deg,rgba(139,61,255,.18),var(--surface));box-shadow:0 0 18px -6px var(--glow)}
.fexp .demo-ic{font-size:17px}
.fexp .demo-flow{margin-top:20px;animation:rise .45s both}
.fexp .bubble{display:inline-block;max-width:90%;background:var(--violet-dp);color:#fff;padding:12px 16px;border-radius:16px 16px 16px 4px;font-size:14.5px;line-height:1.4}
.fexp .reads{margin:12px 2px;font-family:var(--mono);font-size:12.5px;color:var(--faint);display:flex;align-items:center;gap:8px}
.fexp .dots{display:inline-flex;gap:3px}
.fexp .dots i{width:5px;height:5px;border-radius:50%;background:var(--violet);animation:blink 1.1s infinite}
.fexp .dots i:nth-child(2){animation-delay:.2s}.fexp .dots i:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}
.fexp .jcard{border:1px solid var(--line);background:var(--surface);border-radius:16px;padding:18px;box-shadow:0 20px 50px -30px var(--glow);max-width:560px}
.fexp[data-theme="light"] .jcard{background:#fff}
.fexp .jcard-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.fexp .jcard-k{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--violet-br)}
.fexp .jcard-place{font-family:var(--mono);font-size:11px;color:var(--faint)}
.fexp .jcard-narr{font-weight:700;font-size:16px;margin-bottom:12px}
.fexp .jtab{width:100%;border-collapse:collapse;font-size:14px}
.fexp .jtab th{text-align:left;font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:500;padding:0 0 8px;border-bottom:1px solid var(--line)}
.fexp .jtab td{padding:7px 0;border-bottom:1px solid var(--line)}
.fexp .jtab tr:last-child td{border-bottom:0}
.fexp .jtab .num{text-align:right;font-family:var(--mono)}
.fexp .jtab tr[data-tax] td{color:var(--mint)}
.fexp .jcard-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)}
.fexp .jcard-foot .ok{color:var(--mint);font-size:13px;font-weight:600}
.fexp .jcard-foot .auto{font-size:12.5px;color:var(--muted)}

/* footer */
.fexp .foot{max-width:var(--maxw);margin:60px auto 0;padding:24px clamp(18px,5vw,40px) 0;border-top:1px solid var(--line);display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.fexp .foot .brand{font-weight:800;font-size:16px}
.fexp .foot .mono{font-family:var(--mono);font-size:12px;color:var(--faint)}

/* modal */
.fexp .overlay{position:fixed;inset:0;z-index:40;background:rgba(6,3,14,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fade .2s both}
@keyframes fade{from{opacity:0}to{opacity:1}}
.fexp .modal{width:100%;max-width:460px;background:var(--surface2);border:1px solid var(--violet);border-radius:18px;padding:26px;position:relative;box-shadow:0 30px 80px -20px rgba(0,0,0,.6);animation:pop .28s cubic-bezier(.2,.8,.2,1) both}
@keyframes pop{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:none}}
.fexp .modal-tag{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--violet-br);margin-bottom:8px}
.fexp .modal h3{font-size:23px;margin:0 0 12px;letter-spacing:-.02em}
.fexp .modal-plain{font-size:15.5px;line-height:1.55;color:var(--muted);margin:0 0 16px}
.fexp .modal-analogy{font-size:14.5px;line-height:1.5;color:var(--fg);background:rgba(73,232,171,.08);border:1px solid rgba(73,232,171,.25);border-radius:12px;padding:14px}
.fexp .modal-analogy-h{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mint);margin-bottom:6px}
.fexp .modal-x{margin-top:18px;width:100%;font:inherit;font-weight:700;font-size:14.5px;padding:12px;border:0;border-radius:11px;background:var(--violet);color:#fff;cursor:pointer}
.fexp .modal-x:hover{background:var(--violet-dp)}

/* reveal (progressive enhancement) */
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.fexp.anim .rv{opacity:0;transform:translateY(22px);transition:opacity .6s cubic-bezier(.2,.7,.2,1),transform .6s cubic-bezier(.2,.7,.2,1)}
.fexp.anim .rv.d1{transition-delay:.08s}
.fexp.anim .rv.d2{transition-delay:.16s}
.fexp.anim .rv.d3{transition-delay:.24s}
.fexp.anim .rv.in{opacity:1;transform:none}

/* responsive */
@media (max-width:760px){
  .fexp .tldr,.fexp .compare,.fexp .twocol{grid-template-columns:1fr}
  .fexp .statband{grid-template-columns:repeat(2,1fr)}
  .fexp .pipe{grid-template-columns:1fr 1fr}
  .fexp .meter{display:none}
  .fexp .rung{margin-left:0 !important}
  .fexp .cliff-dot em{width:92px;font-size:11px}
}
@media (prefers-reduced-motion:reduce){
  .fexp.anim .rv{opacity:1;transform:none;transition:none}
  .fexp .demo-flow,.fexp .overlay,.fexp .modal,.fexp .scroll-cue span,.fexp .dots i{animation:none}
}
`;
