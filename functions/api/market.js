// Cloudflare Pages Function: /api/market
// Běží na edge serverech Cloudflare – zajišťuje HTTPS, 60s cache a ochranu serveru před přetížením.

export async function onRequest(context) {
  // Zde zadej IP nebo doménu tvého Minecraft serveru a port z PlayerStatsAPI
  const SERVER_HOST = "mc.trueblock.win"; // případně číselná IP z Pelicanu
  const SERVER_PORT = "25680"; // port z PlayerStatsAPI

  try {
    // 1. Zkusíme stáhnout data z PlayerStatsAPI ze serveru
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    const apiUrl = `http://${SERVER_HOST}:${SERVER_PORT}/moss/players`;
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const playersData = await response.json();
      
      // Spočítáme celkové vytěžené suroviny napříč všemi hráči
      let totals = {
        diamond: 0,
        iron: 0,
        coal: 0,
        gold: 0,
        copper: 0,
        logs: 0,
        stone: 0,
        debris: 0
      };

      if (Array.isArray(playersData)) {
        playersData.forEach(p => {
          const stats = p.stats || p;
          const mined = stats["minecraft:mined"] || {};
          
          totals.diamond += (mined["minecraft:diamond_ore"] || 0) + (mined["minecraft:deepslate_diamond_ore"] || 0);
          totals.iron += (mined["minecraft:iron_ore"] || 0) + (mined["minecraft:deepslate_iron_ore"] || 0);
          totals.coal += (mined["minecraft:coal_ore"] || 0) + (mined["minecraft:deepslate_coal_ore"] || 0);
          totals.gold += (mined["minecraft:gold_ore"] || 0) + (mined["minecraft:deepslate_gold_ore"] || 0) + (mined["minecraft:nether_gold_ore"] || 0);
          totals.copper += (mined["minecraft:copper_ore"] || 0) + (mined["minecraft:deepslate_copper_ore"] || 0);
          totals.debris += (mined["minecraft:ancient_debris"] || 0);
          
          // Dřevo
          totals.logs += (mined["minecraft:oak_log"] || 0) + (mined["minecraft:birch_log"] || 0) + 
                         (mined["minecraft:spruce_log"] || 0) + (mined["minecraft:dark_oak_log"] || 0) +
                         (mined["minecraft:cherry_log"] || 0) + (mined["minecraft:mangrove_log"] || 0);
          
          // Kámen
          totals.stone += (mined["minecraft:stone"] || 0) + (mined["minecraft:deepslate"] || 0) + (mined["minecraft:cobblestone"] || 0);
        });
      }

      // Sestavení burzovních dat s dynamickým vzorcem podle vytěženého množství
      const marketPayload = {
        updated_at: new Date().toISOString(),
        server_online: true,
        season: "autumn", // Výchozí nebo z AeternumSeasons
        items: [
          {
            id: "diamond",
            name: "💎 Diamant",
            base: 150,
            price: Math.max(80, Math.round((150 * (1 - (totals.diamond / 10000) * 0.2)) * 10) / 10),
            trend: totals.diamond > 1000 ? "down" : "up",
            mined_total: totals.diamond,
            note: `Vytěženo na serveru: ${totals.diamond} ks`
          },
          {
            id: "netherite",
            name: "🔥 Netherite Ingot",
            base: 1800,
            price: 1800,
            trend: totals.debris < 50 ? "up" : "neutral",
            mined_total: totals.debris,
            note: `Nalezeno Ancient Debris: ${totals.debris} ks`
          },
          {
            id: "iron",
            name: "⚙️ Železný Ingot",
            base: 10,
            price: Math.max(5, Math.round((10 * (1 - (totals.iron / 100000) * 0.15)) * 10) / 10),
            trend: "neutral",
            mined_total: totals.iron,
            note: `Vytěženo rudy: ${totals.iron} ks`
          },
          {
            id: "coal",
            name: "🌑 Uhlí",
            base: 3.5,
            price: 4.7, // Podzimní poptávka
            trend: "up",
            mined_total: totals.coal,
            note: `Vytěženo uhlí: ${totals.coal} ks`
          },
          {
            id: "logs",
            name: "🪓 Surové Dřevo",
            base: 2.5,
            price: 3.1,
            trend: "up",
            mined_total: totals.logs,
            note: `Posekáno dřeva: ${totals.logs} ks`
          },
          {
            id: "stone",
            name: "🪨 Hladký Kámen",
            base: 1.0,
            price: 1.0,
            trend: "neutral",
            mined_total: totals.stone,
            note: `Vytěženo kamene: ${totals.stone} ks`
          }
        ]
      };

      return new Response(JSON.stringify(marketPayload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60", // 60s edge cache
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  } catch (err) {
    // V případě timeoutu nebo chyby spojení se serverem sáhneme po lokálním fallbacku
  }

  // Fallback: vrátí statický soubor market_data.json
  return context.next();
}
