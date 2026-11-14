// =====================================================================
// PERFECT XI - SERVER SIDE SCORING
//
// The browser is never trusted with a score. It sends only the seed and
// the eleven players it drafted. This function looks each player up in
// the database to get their REAL rating, re-runs the same Dixon-Coles
// match engine from the same seed, and writes the result itself.
//
// Deploy:  supabase functions deploy score-run
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---- the same seeded random the game uses, so results match exactly ----
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(rnd: () => number, lambda: number) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

// ---- Dixon-Coles, matching the client ----
const RHO = -0.13, HOME = 0.27, BASE = 1.375;
function simulateSeason(rnd: () => number, xiAvg: number) {
  // twenty opponents drawn around a realistic Premier League spread
  const opps: number[] = [];
  for (let i = 0; i < 19; i++) opps.push(62 + (19 - i) * 1.45);
  let pts = 0, gf = 0, ga = 0, w = 0, d = 0, l = 0;
  for (let i = 0; i < opps.length; i++) {
    for (let h = 0; h < 2; h++) {
      const diff = (xiAvg - opps[i]) / 22;
      const att = BASE * Math.exp(diff + (h === 0 ? HOME : 0));
      const def = BASE * Math.exp(-diff + (h === 1 ? HOME : 0));
      let a = poisson(rnd, Math.max(0.18, Math.min(5, att)));
      let b = poisson(rnd, Math.max(0.18, Math.min(5, def)));
      if (a <= 1 && b <= 1 && rnd() < Math.abs(RHO)) { if (RHO < 0 && a === 1 && b === 1) { a = 0; b = 0; } }
      gf += a; ga += b;
      if (a > b) { pts += 3; w++; } else if (a === b) { pts += 1; d++; } else l++;
    }
  }
  return { pts, gf, ga, w, d, l };
}

Deno.serve(async (req) => {
  try {
    const { run_id } = await req.json();
    if (!run_id) return new Response("missing run_id", { status: 400 });

    // service role: this function, and only this function, may write scores
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: run, error } = await db.from("runs")
      .select("id, seed, picks, verified").eq("id", run_id).single();
    if (error || !run) return new Response("run not found", { status: 404 });
    if (run.verified) return new Response(JSON.stringify({ ok: true, already: true }));

    const picks: string[] = Array.isArray(run.picks) ? run.picks : [];
    if (picks.length !== 11) return new Response("an XI is eleven players", { status: 400 });
    if (new Set(picks).size !== 11) return new Response("duplicate players", { status: 400 });

    // every rating comes from the database, never from the browser
    const { data: rows } = await db.from("players").select("name, rtg").in("name", picks);
    const known = new Map((rows || []).map((r) => [r.name, r.rtg]));
    for (const p of picks) {
      if (!known.has(p)) return new Response("unknown player: " + p, { status: 400 });
    }
    const avg = picks.reduce((s, p) => s + (known.get(p) || 0), 0) / 11;

    const rnd = mulberry32(Number(run.seed) >>> 0);
    const r = simulateSeason(rnd, avg);

    // finishing position, from points, against a realistic league
    const cut = [96, 84, 77, 71, 66, 62, 58, 54, 51, 48, 46, 44, 42, 40, 38, 36, 34, 31, 27];
    let finish = 20;
    for (let i = 0; i < cut.length; i++) if (r.pts >= cut[i]) { finish = i + 1; break; }

    await db.from("runs").update({
      pts: r.pts, gf: r.gf, ga: r.ga, finish,
      avg: Math.round(avg * 10) / 10, verified: true,
    }).eq("id", run.id);

    return new Response(JSON.stringify({ ok: true, pts: r.pts, finish }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
