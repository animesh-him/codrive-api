export class CoDriveDO {
  constructor(state, env) {
    this.storage = state.storage;
  }

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

    /* ---------- VISITS ---------- */
    if (url.searchParams.has("visit")) {
      const ip = req.headers.get("CF-Connecting-IP") || "x";
      const key = `visit:${ip}:${this.istDate()}`;
      if (!(await this.storage.get(key))) {
        await this.storage.put(key, 1);
        const total = (await this.storage.get("visit_total")) || 0;
        await this.storage.put("visit_total", total + 1);
      }
      return this.json({ ok: true });
    }

    /* ---------- SAVE ---------- */
    if (req.method === "POST") {
      const { date, from, to, time } = await req.json();
      if (!date || !from || !to || !time) {
        return this.json({ error: "Invalid" }, 400);
      }

      const ip = req.headers.get("CF-Connecting-IP") || "x";
      const dayKey = `count:${ip}:${date}`;
      const used = (await this.storage.get(dayKey)) || 0;
      if (used >= 20) {
        return this.json({ error: "Daily limit reached" }, 429);
      }
      await this.storage.put(dayKey, used + 1, {
        expiration: Date.now() + 86400000
      });

      const key = `pop:${date}:${from}:${to}:${time}`;
      const c = (await this.storage.get(key)) || 0;
      await this.storage.put(key, c + 1);

      return this.json({ ok: true });
    }

    /* ---------- GET ---------- */
    const date = url.searchParams.get("date");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!date || !from || !to) return this.json([]);

    const out = [];
    for (let m = 0; m < 1440; m += 30) {
      const f=x=>String(x).padStart(2,"0");
      const t=`${f(m/60|0)}:${f(m%60)}-${f((m+30)/60|0)}:${f((m+30)%60)}`;
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
