export class CoDriveDO {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
  }

  /* ---------- IST HELPERS ---------- */
  istNow() {
    return new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
  }

  istDate() {
    return this.istNow().toISOString().slice(0, 10);
  }

  async fetch(req) {
    const url = new URL(req.url);

    /* =====================================================
       VISITS
    ===================================================== */
    if (url.searchParams.has("visit")) {
      const ip = req.headers.get("CF-Connecting-IP") || "x";
      const date = this.istDate();
      const visitKey = `visit:${ip}:${date}`;

      const seen = await this.storage.get(visitKey);
      if (!seen) {
        await this.storage.put(visitKey, 1);
        const total = (await this.storage.get("visit_total")) || 0;
        await this.storage.put("visit_total", total + 1);
      }

      const total = (await this.storage.get("visit_total")) || 1;
      return this.json({ total });
    }

    /* =====================================================
       POST — SAVE PREFERENCE
    ===================================================== */
    if (req.method === "POST") {
      const { date, from, to, time } = await req.json();
      if (!date || !from || !to || !time) {
        return this.json({ error: "Invalid data" }, 400);
      }

      const ip = req.headers.get("CF-Connecting-IP") || "x";
      const lockKey = `lock:${ip}`;

      // Rate-limit: 1 minute
      if (await this.storage.get(lockKey)) {
        return this.json({ error: "Please wait 1 minute" }, 429);
      }
      await this.storage.put(lockKey, 1, {
        expiration: Date.now() + 60_000
      });

      const popKey = `pop:${date}:${from}:${to}:${time}`;
      const idxKey = `idx:${date}:${from}:${to}`;

      const count = (await this.storage.get(popKey)) || 0;
      await this.storage.put(popKey, count + 1);

      const idx = (await this.storage.get(idxKey)) || [];
      if (!idx.includes(time)) {
        idx.push(time);
        await this.storage.put(idxKey, idx);
      }

      return this.json({ ok: true });
    }

    /* =====================================================
       GET POPULARITY
    ===================================================== */
    const date = url.searchParams.get("date");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!date || !from || !to) return this.json([]);

    const idxKey = `idx:${date}:${from}:${to}`;
    const idx = (await this.storage.get(idxKey)) || [];

    const out = [];
    for (const t of idx) {
      const c = (await this.storage.get(`pop:${date}:${from}:${to}:${t}`)) || 0;
      if (c > 0) out.push({ time: t, count: c });
    }

    return this.json(out);
  }

  json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
