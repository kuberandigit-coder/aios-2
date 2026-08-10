// members-api.js — unified member dashboard handler
// Route by ?member=hetheesha|jakshan|sajeepan|sonya|theekshy|thivajini
// Each member sub-routes by ?type=

const { Client } = require('pg');
const https      = require('https');

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function errResponse(res, err) {
  const msg = err.message || '';
  let cause = 'unknown';
  if (/password|authentication|SASL/i.test(msg))                cause = 'authentication';
  else if (/timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg)) cause = 'network_timeout';
  else if (/ssl|TLS/i.test(msg))                                cause = 'ssl';
  else if (/permission denied/i.test(msg))                      cause = 'missing_permissions';
  return res.status(500).json({ ok: false, cause, error: msg });
}

// ─── HETHEESHA — shared Shopify helpers ───────────────────────────────────────

const SHOP  = 'jedsz8-km.myshopify.com';
const TOKEN = (process.env.SHOPIFY_FR_ADMIN_TOKEN || process.env.SHOPIFY_FR_TOKEN);

function shopifyGQL(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: SHOP,
      path: '/admin/api/2025-01/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Shopify parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchShopifyBatch(handles) {
  const handleQuery = handles.map(h => `handle:${h}`).join(' OR ');
  const gql = `{
    products(first: ${handles.length}, query: ${JSON.stringify(handleQuery)}) {
      edges {
        node {
          handle
          seo { title description }
          images(first: 50) { edges { node { altText } } }
          metafield(namespace: "custom", key: "faq_schema") { value }
        }
      }
    }
  }`;
  const resp = await shopifyGQL(gql);
  const out = {};
  if (resp.data?.products?.edges) {
    resp.data.products.edges.forEach(({ node: p }) => {
      const missingAlt = p.images.edges.filter(
        e => !e.node.altText || e.node.altText.trim() === ''
      ).length;
      out[p.handle] = {
        meta_title : p.seo?.title       || null,
        meta_desc  : p.seo?.description || null,
        alt_missing: missingAlt,
        faq        : p.metafield?.value ? 'Present' : 'Missing',
      };
    });
  }
  return out;
}

async function fetchAllShopify(handles) {
  const results = {};
  const BATCH = 10;
  for (let i = 0; i < handles.length; i += BATCH) {
    const data = await fetchShopifyBatch(handles.slice(i, i + BATCH));
    Object.assign(results, data);
  }
  return results;
}

// ─── HETHEESHA REQ1 — helpers ─────────────────────────────────────────────────

const SNAPSHOT = [
 {k:1, h:"ledsone-industrial-vintage-32cm-green-pendant-retro-metal-lamp-shade-e27-uk-holder",rev:369.20,mtr:"Suspension Vintage Verte 32cm E27 – Abat-jour M\xe9tal Cuisine",mdr:"Suspension abat-jour en m\xe9tal vert 32 cm, style industriel vintage. Douille E27. Parfaite au-dessus d'une table de cuisine ou d'un \xeelot. -10% actuellement.",alt:0,imp:null,ctr:null,faq:"Present"},
 {k:2, h:"5-way-spider-light-fixture-3399",rev:248.70,mtr:"Lustre Araign\xe9e 5 Ampoules R\xe9glable E27 | LEDsone",mdr:"Suspension araign\xe9e 5 ampoules E27, hauteur r\xe9glable, finition m\xe9tal noir. Design industriel pour salle \xe0 manger. Livraison France rapide.",alt:3,imp:404,ctr:0.50,faq:"Missing"},
 {k:3, h:"ledsone-luminaire-suspendu-vintage-trois-bras-avec-abat-jour-conique-plat",rev:198.00,mtr:null,mdr:null,alt:13,imp:null,ctr:null,faq:"Missing"},
 {k:4, h:"galvanised-conduit-metal-pipe-light-fittings-accessories-4646",rev:195.73,mtr:null,mdr:null,alt:0,imp:null,ctr:null,faq:"Missing"},
 {k:5, h:"adjustable-height-metal-spider-led-suspension",rev:182.22,mtr:"Lustre Suspension Vintage 5 T\xeates R\xe9glable en Hauteur",mdr:"Apportez style et fonctionnalit\xe9 \xe0 votre int\xe9rieur avec ce lustre araign\xe9e LED 5 t\xeates.Hauteur r\xe9glable, E27 compatible, id\xe9al salon, chambre ou salle \xe0 manger.",alt:11,imp:142,ctr:0.70,faq:"Missing"},
 {k:6, h:"20mm-galvanized-steel-conduit-lighting-box-fitting",rev:165.75,mtr:"Raccord Conduit 20mm Galvanis\xe9 | Bornes – LEDsone",mdr:"Raccord bo\xeete \xe0 bornes pour conduit 20mm en acier galvanis\xe9. Compatible \xe9clairage industriel DIY, style steampunk. Certifi\xe9. Livraison France 5-7j. D\xe8s 2,25€.",alt:0,imp:null,ctr:null,faq:"Present"},
 {k:7, h:"industrial-vintage-ratio-2-head-hemp-spider-chandelier-e27-uk-holder",rev:129.66,mtr:"Lustre Suspension Chanvre 2 T\xeates Industriel Vintage E27",mdr:"Lustre suspension chanvre 2 t\xeates industriel vintage E27. Chandelier r\xe9tro en corde de chanvre naturel, fer noir \xd840cm. Salon, salle \xe0 manger, loft. C\xe2ble 2m.",alt:21,imp:261,ctr:0.00,faq:"Present"},
 {k:8, h:"vintage-ceiling-pendant-light-lamp-shade-industrial-chandelier-spider-lamp",rev:121.60,mtr:null,mdr:null,alt:2,imp:null,ctr:null,faq:"Present"},
 {k:9, h:"1m-twisted-cable-e27-base-holder",rev:121.01,mtr:null,mdr:null,alt:11,imp:null,ctr:null,faq:"Missing"},
 {k:10,h:"applique-murale-led-reglable-e27-industrielle",rev:110.76,mtr:"Applique murale LED r\xe9glable E27 industrielle",mdr:"D\xe9couvrez l'applique murale vintage LEDSone avec bras pivotant E27. \xc9clairage industriel r\xe9glable \xe0 180 degr\xe9s pour une ambiance chaleureuse.",alt:0,imp:null,ctr:null,faq:"Missing"},
 {k:11,h:"bottle-shaped-led-pendant-light",rev:101.42,mtr:"Lustre salon 5 t\xeates – Suspension bouteille de vin en verre | LEDSone",mdr:"Suspension design \xe0 5 t\xeates avec abat-jour en verre bouteille de vin. Lustre id\xe9al pour salon, cuisine ou restaurant. Style r\xe9tro, livraison rapide en France.",alt:0,imp:null,ctr:null,faq:"Present"},
 {k:12,h:"industrial-style-led-ceiling-light-fixtures",rev:94.00,mtr:"Luminaires Vintage Industriels - Suspensions Design pour",mdr:"\xc9clairage int\xe9rieur vintage pour cuisine, salon, chambre ou salle \xe0 manger. Style industriel, design \xe9l\xe9gant.",alt:8,imp:null,ctr:null,faq:"Missing"},
 {k:13,h:"suspension-ledsone-8-voies-forme-araignee-e27-reglable",rev:89.16,mtr:"Lustre araign\xe9e 8 bras vintage – Suspension laiton & cuivre E27",mdr:"Suspension araign\xe9e 8 bras en laiton & cuivre. Style vintage r\xe9tro, id\xe9ale pour salon ou salle \xe0 manger. Compatible E27, livraison rapide en France.",alt:0,imp:64,ctr:0.00,faq:"Missing"},
 {k:14,h:"vintage-industrial-metal-retro-ceiling-pendant-light-copper-shade",rev:85.56,mtr:"Suspension Vintage Cuivre E27 – Plafonnier M\xe9tal R\xe9tro 1m",mdr:"Suspension vintage finition cuivre, abat-jour m\xe9tal r\xe9tro. C\xe2ble r\xe9glable 1m, douille E27.Id\xe9al salon, chambre ou cuisine. -10% en ce moment. Livraison rapide.",alt:12,imp:null,ctr:null,faq:"Missing"},
 {k:15,h:"applique-murale-en-metal-avec-abat-jour-facile-a-installer",rev:81.96,mtr:"Applique Murale Industrielle et R\xe9tro en M\xe9tal",mdr:"Sublimez votre int\xe9rieur avec l'applique murale industrielle LEDSone en m\xe9tal noir. Style vintage Edison parfait pour chambre, bar ou loft. Livraison Rapide !",alt:9,imp:null,ctr:null,faq:"Missing"},
 {k:16,h:"vintage-e27-bulb-holder-suspension-light-fitting-ceiling-hanging-pendant-light",rev:79.35,mtr:"Suspension Ext\xe9rieure IP65 E27 – Luminaire Noir \xc9tanche 1m",mdr:"Suspension ext\xe9rieure \xe9tanche IP65, m\xe9tal noir, c\xe2ble 1m. Compatible E27.Id\xe9ale terrasse, pergola, jardin. R\xe9sistante aux intemp\xe9ries. Livraison rapide France.",alt:0,imp:799,ctr:0.88,faq:"Present"},
 {k:17,h:"ledsone-suspension-industrielle-lustre-retro-plafonnier-metal",rev:77.72,mtr:"Suspension industrielle vintage en m\xe9tal Lustre r\xe9tro plafonnier E27",mdr:"Luminaire suspendu industriel vintage en m\xe9tal E27. Id\xe9al pour salle \xe0 manger, loft ou cuisine. Style r\xe9tro tendance, livraison rapide en France.",alt:5,imp:60,ctr:0.00,faq:"Present"},
 {k:18,h:"industrial-vintage-retro-adjustable-ceiling-various-colours-pendant-light-with-e27-uk-holder",rev:57.27,mtr:"LEDSone Suspension Luminaire Industrielle E27 en M\xe9tal 15 cm",mdr:"D\xe9couvrez notre suspension luminaire industrielle LEDSone. Abat-jour m\xe9tal 15cm, c\xe2ble r\xe9glable et culot E27. Id\xe9al pour \xeelot de cuisine et salon. Livraison rapide !",alt:42,imp:null,ctr:null,faq:"Missing"},
 {k:19,h:"vintage-e27-bulb-holder-suspension-light-fitting-ceiling-2m-hanging-pendant-light-4907",rev:55.34,mtr:"Suspension plafonnier 2m support ampoule E27 vintage",mdr:"D\xe9couvrez notre suspension plafonnier de 2m avec support ampoule E27 au style vintage. Parfaite pour illuminer votre int\xe9rieur avec \xe9l\xe9gance.",alt:12,imp:101,ctr:0.99,faq:"Missing"},
 {k:20,h:"modern-blue-ceiling-light-shade-hanging-pendant-lamp-metal-dome-shade",rev:52.72,mtr:"Abat-jour D\xf4me M\xe9tal 30cm E27 – Industriel Vintage",mdr:"Abat-jour suspendu industriel en m\xe9tal 30 cm. Compatible E27, installation facile avec plaque r\xe9ductrice gratuite. Id\xe9al salon, chambre ou cuisine.",alt:31,imp:null,ctr:null,faq:"Missing"},
 {k:21,h:"plafonnier-retro-moderne-a-3-ampoules-eclairage-e27",rev:51.83,mtr:"Plafonnier r\xe9tro moderne \xe0 3 ampoules - \xc9clairage E27",mdr:"\xc9l\xe9gant plafonnier design \xe0 3 ampoules E27, id\xe9al pour cuisine, salon ou salle \xe0 manger. Livr\xe9 en kit, finition laiton jaune. Commandez d\xe8s maintenant !",alt:12,imp:null,ctr:null,faq:"Missing"},
 {k:22,h:"ledsone-industriel-suspension-luminaire-retro-vintage",rev:51.66,mtr:"Suspension Luminaire Industriel Vintage C\xe2ble 95cm R\xe9glable | LEDSone",mdr:"Suspension industrielle vintage en m\xe9tal d\xf4me. C\xe2ble r\xe9glable 95cm, douille E27, id\xe9ale salon, salle \xe0 manger, restaurant ou loft. Livraison rapide LEDSone.",alt:13,imp:30,ctr:3.33,faq:"Present"},
 {k:23,h:"wall-scone",rev:51.26,mtr:"Applique Murale Vintage Noire 180\xb0 – \xc9clairage Industriel Chic",mdr:"Applique murale vintage noire orientable 180\xb0 – parfaite pour restaurants, gal\xe9ries, couloirs ou cuisines. Style industriel chic et installation facile.",alt:10,imp:null,ctr:null,faq:"Missing"},
 {k:24,h:"suspension-vintage-ledsone-5-lumieres-industriel-e27",rev:50.57,mtr:"Lustre Araign\xe9e 5 Bras Vintage E27 | LEDsone France",mdr:"Lustre araign\xe9e industriel vintage 5 lumi\xe8res E27. M\xe9tal noir mat, c\xe2ble r\xe9glable, id\xe9al salle \xe0 manger, restaurant, loft. Livraison France 5–7j.",alt:1,imp:null,ctr:null,faq:"Present"},
 {k:25,h:"suspension-araign-e-lampe-3-voies-suspension-cuivre-bross-plafonnier-clairage",rev:46.58,mtr:"Lustre Araign\xe9e 3 T\xeates – Suspension Industrielle Vintage E27",mdr:"Suspension araign\xe9e 3 t\xeates cuivre bross\xe9, douilles E27, c\xe2bles r\xe9glables 2m. Style industriel vintage cuisine, salon, loft. Livraison France 5-7j.",alt:0,imp:176,ctr:0.57,faq:"Missing"},
 {k:26,h:"agunnaryd-pendant-lamp",rev:45.09,mtr:"Suspension Industrielle Noire Steampunk LEDSone – Lustre 3 voies E27",mdr:"Suspension industrielle noire Steampunk LEDSone, 3 voies, abat-jour m\xe9tal 21 cm, fil r\xe9glable 95 cm. Id\xe9ale pour salon, salle \xe0 manger, bar ou restaurant.",alt:5,imp:null,ctr:null,faq:"Missing"},
 {k:27,h:"swan-neck-wall-light-indoor-lamp",rev:44.56,mtr:"Applique Murale Industrielle Col de Cygne E27 | 7 Finitions",mdr:"Applique murale col de cygne, m\xe9tal, 7 finitions (laiton, or rose, chrome, noir...). Douille E27, garantie 3 ans. Note 4.7/5. Livraison France.",alt:27,imp:null,ctr:null,faq:"Present"},
 {k:28,h:"copper-ceiling-rose-light-pendant-for-cable",rev:43.63,mtr:"Rosace de Plafond 100mm — Cuivre, Noir, Chrome | LEDSone",mdr:"Rosace de plafond ronde 100mm en m\xe9tal robuste. 5 finitions : cuivre, noir, chrome, laiton. Cache-fil \xe9l\xe9gant, montage facile, livraison rapide en France.",alt:3,imp:null,ctr:null,faq:"Present"},
 {k:29,h:"ledsone-abat-jour-design-moderne-en-m-tal-pour-suspension-et-plafonnier-32-cm",rev:41.67,mtr:"Abat-jour M\xe9tal Moderne 32 cm – Suspension & Plafonnier",mdr:"Abat-jour m\xe9tal 32 cm pour suspension et plafonnier – moderne, \xe9l\xe9gant et durable. Commandez vite pour un \xe9clairage chic !",alt:14,imp:null,ctr:null,faq:"Missing"},
 {k:30,h:"applique-murale-vintage-led-eclairage-retro-ajustable",rev:40.38,mtr:"Applique murale vintage LED - \xc9clairage r\xe9tro ajustable",mdr:"Transformez votre int\xe9rieur avec l'applique murale vintage LEDSone. Finition nickel satin\xe9, douille E27 r\xe9glable et style industriel. Livraison rapide. Shoppez !",alt:0,imp:null,ctr:null,faq:"Missing"},
 {k:31,h:"2-way-retro-vintage-chandelier-ceiling-spider-light-industrial-pendant-lamp-e27-4945",rev:39.70,mtr:"Suspension Araign\xe9e Vintage 2 Bras E27 – Luminaire Industriel R\xe9tro",mdr:"Lustre araign\xe9e dimmable 2 bras, style industriel vintage. Compatible variateur de lumi\xe8re E27. C\xe2ble r\xe9glable. Id\xe9al chambre ou salon. Livraison rapide France.",alt:3,imp:156,ctr:1.28,faq:"Missing"},
 {k:32,h:"applique-murale-vintage-retro-moderne-e27-pour-interieur",rev:36.86,mtr:"Applique Murale Vintage R\xe9tro Moderne E27 pour Int\xe9rieur",mdr:"\xc9l\xe9gante applique murale vintage r\xe9tro avec bras en m\xe9tal E27, id\xe9ale pour salon, cuisine, chambre ou salle \xe0 manger. Style industriel, design intemporel.",alt:10,imp:null,ctr:null,faq:"Missing"},
 {k:33,h:"suspension-luminaire-industrielle-3-lampes-metal-noir-ledsone",rev:34.80,mtr:"Suspension Industrielle 3 Lampes Noir | Cuisine & Bar",mdr:"Suspension 3 lampes m\xe9tal noir mat, style loft. C\xe2bles ajustables 1m, compatible variateur. Id\xe9ale cuisine, bar, salle \xe0 manger.",alt:9,imp:null,ctr:null,faq:"Present"},
 {k:34,h:"c-ble-plafonnier-industriel-r-tro-2-voies-e27-suspension",rev:34.06,mtr:"C\xe2ble Plafonnier Industriel R\xe9tro 2 Voies E27 Suspension",mdr:null,alt:8,imp:null,ctr:null,faq:"Missing"},
 {k:35,h:"vintage-retro-pendant-light-with-metal-shade",rev:32.70,mtr:"Suspension Vintage M\xe9tal Noir E27 – Luminaire Industriel Loft",mdr:"Suspension vintage en m\xe9tal au design industriel \xe9pur\xe9. Id\xe9ale pour cuisine, salon ou bar. Douille E27 compatible LED. Installation facile et Livraison 24h.",alt:9,imp:null,ctr:null,faq:"Missing"},
 {k:36,h:"ancienne-suspension-lustre-plafonnier-araign-e-industriel",rev:31.00,mtr:"Ancienne Suspension Lustre Araign\xe9e | LEDsone France",mdr:"Ancienne suspension lustre araign\xe9e industriel, style authentique r\xe9tro. Plafonnier m\xe9tal E27, c\xe2ble r\xe9glable. Livraison France. LEDsone.",alt:5,imp:null,ctr:null,faq:"Missing"},
 {k:37,h:"2m-black-white-round-cable-e27-base-satin-nickel-holder",rev:29.98,mtr:"E27 cable suspension luminaire 2m",mdr:"Cette suspension c\xe2ble textile est compos\xe9e de 2m m\xe8tres de c\xe2ble, d'une rosace en m\xe9tal avec une douille E27 Max 60w.",alt:2,imp:166,ctr:0.60,faq:"Missing"},
 {k:38,h:"plafonnier-cage-cristal-verre-moderne-e27",rev:29.28,mtr:"Plafonnier Cage Cristal Verre Moderne Luminaire Plafond Design E27",mdr:null,alt:0,imp:null,ctr:null,faq:"Present"},
 {k:39,h:"lot-de-3-abat-jours-vintage-suspension-industrielle-incurvee-e27",rev:28.09,mtr:"LEDSONE Lot de 3 abat-jours vintage incurv\xe9s, installation",mdr:"Ajoutez une touche chaleureuse \xe0 votre int\xe9rieur avec ces abat-jours vintage design. Parfaits pour salon, chambre ou salle \xe0 manger.",alt:5,imp:null,ctr:null,faq:"Missing"},
 {k:40,h:"dc24v-ip67-150w-waterproof-led-driver-power-supply-transformer",rev:25.19,mtr:"Transformateur LED 24V 150W \xc9tanche IP67 Alimentation Ruban LED",mdr:"Alimentation LED 24V 150W IP67 waterproof pour ruban LED, spots et \xe9clairage ext\xe9rieur. Sortie DC 24V constante, protections surcharge/court-circuit.",alt:3,imp:117,ctr:0.00,faq:"Present"},
 {k:41,h:"vintage-industrial-retro-metal-indoor-ceiling-light-flush-mount-retro-cone-shade-lamp-uk",rev:22.40,mtr:null,mdr:null,alt:0,imp:null,ctr:null,faq:"Missing"},
 {k:42,h:"suspension-lustre-suspension-lampe-suspension-plafonnier-industriel-2-t-tes",rev:22.39,mtr:"Lustre Suspension Araign\xe9e Industriel 2 T\xeates - LEDSone",mdr:"D\xe9couvrez le plafonnier araign\xe9e LEDSone noir \xe0 2 t\xeates. Un lustre industriel vintage id\xe9al pour cuisine, salon ou bar. C\xe2bles r\xe9glables. Livraison rapide !",alt:16,imp:null,ctr:null,faq:"Missing"},
 {k:43,h:"vintage-industrial-pendant-light-metal-e27",rev:21.21,mtr:"Suspension Industrielle M\xe9tal E27 | 9 Coloris – Style Loft",mdr:"Suspension industrielle en m\xe9tal, douille E27, 9 coloris (noir, vert, orange...). Style loft pour salon, restaurant, caf\xe9. Livraison France 4-10j.",alt:19,imp:null,ctr:null,faq:"Present"},
 {k:44,h:"e27-lamp-holder-20mm-female-thread-conduit-ceiling-light-socket",rev:20.97,mtr:null,mdr:null,alt:0,imp:null,ctr:null,faq:"Missing"},
 {k:45,h:"plafonnier-semi-encastre-style-ancien",rev:19.59,mtr:"Plafonnier semi‑encastr\xe9 vintage | Style ancien m\xe9tal E27",mdr:"Plafonnier semi‑encastr\xe9 style ancien en m\xe9tal E27. \xc9clairage r\xe9tro id\xe9al pour salon, chambre ou cuisine. Durable, \xe9l\xe9gant et livraison rapide en France.",alt:28,imp:null,ctr:null,faq:"Missing"},
 {k:46,h:"applique-murale-industrielle-vintage-avec-motif-c-ne",rev:19.14,mtr:"Applique Murale Industrielle C\xf4ne Vintage E27 | LEDsone",mdr:"Applique murale industrielle vintage, design c\xf4ne en m\xe9tal, culot E27. Style loft pour salon, couloir, caf\xe9 & restaurant. Livraison France.",alt:2,imp:null,ctr:null,faq:"Present"},
 {k:47,h:"indoor-wall-fitting-lounge-light-fittings",rev:18.69,mtr:"Appliques Murales Industrielles Design",mdr:"D\xe9couvrez nos appliques murales industrielles au design \xe9l\xe9gant en m\xe9tal. Id\xe9ales pour cr\xe9er une atmosph\xe8re chaleureuse et accueillante chez vous.",alt:16,imp:null,ctr:null,faq:"Present"},
 {k:48,h:"abat-jour-m-tal-pluton-plafonnier-suspension-luminaire-abat-jour",rev:18.28,mtr:"Abat-jour M\xe9tal Pluton – Suspension & Plafonnier",mdr:"D\xe9couvrez l'\xe9l\xe9gance de l'Abat-jour M\xe9tal Pluton, une suspension et plafonnier qui allie design moderne et fonctionnalit\xe9 pour sublimer votre int\xe9rieur.",alt:0,imp:null,ctr:null,faq:"Present"},
 {k:49,h:"vintage-ceiling-light-pendant-lamp-shade",rev:16.86,mtr:"Suspension Style Fermier en M\xe9tal | Luminaire \xcelet de Cuisine",mdr:"D\xe9couvrez notre suspension de style fermier avec abat-jour bol m\xe9tallique. Cordon r\xe9glable, design industriel chic, id\xe9al pour cuisine et couloir. Livraison rapide !",alt:13,imp:null,ctr:null,faq:"Present"},
 {k:50,h:"ledsone-200mm-kit-rosace-cylindrique-en-metal-a-3-trous",rev:16.46,mtr:"LEDSone Rosace Plafond Vintage 3 Trous M\xe9tal 200mm",mdr:"Rosace de plafond LEDSone 200mm en m\xe9tal, 3 trous. Parfaite pour suspensions industrielles vintage, installation facile et design \xe9l\xe9gant int\xe9rieur.",alt:4,imp:73,ctr:5.48,faq:"Missing"},
];

const SNAP_SCHEMAS   = ['staff', 'order_management', 'listings'];
let   SNAP_SCHEMA    = null;

const SNAPSHOT_DATE  = '2026-07-06';
const BEFORE_FROM    = '2026-06-22';
const BEFORE_TO      = '2026-07-06';
const AFTER_FROM     = '2026-07-07';
const AFTER_TO       = '2026-07-18';

function buildTracker(snapshot, shopifyMap) {
  const items = [];
  const FIELDS = [
    { key: 'meta_title', snapKey: 'mtr', label: 'Meta Title',  isMissing: v => !v },
    { key: 'meta_desc',  snapKey: 'mdr', label: 'Meta Desc',   isMissing: v => !v },
    { key: 'faq',        snapKey: 'faq', label: 'FAQ Schema',  isMissing: v => v === 'Missing' },
    { key: 'alt_missing',snapKey: 'alt', label: 'Alt Text',    isMissing: v => v > 0 },
  ];
  snapshot.forEach(s => {
    const live = shopifyMap[s.h];
    FIELDS.forEach(f => {
      const snapVal    = s[f.snapKey];
      const wasMissing = f.isMissing(snapVal);
      const liveVal    = live ? live[f.key] : null;
      const nowMissing = live && f.isMissing(liveVal);
      const nowFixed   = live && !f.isMissing(liveVal);
      if (wasMissing) {
        items.push({ rank: s.k, handle: s.h, field: f.label, field_key: f.key,
          before: snapVal, after: liveVal, was_missing: true, now_fixed: nowFixed,
          new_issue: false, live_value: liveVal });
      } else if (nowMissing) {
        items.push({ rank: s.k, handle: s.h, field: f.label, field_key: f.key,
          before: snapVal, after: liveVal, was_missing: false, now_fixed: false,
          new_issue: true, live_value: liveVal });
      }
    });
  });
  return items;
}

async function ensureSnapshotTable(db) {
  if (SNAP_SCHEMA) return;
  for (const schema of SNAP_SCHEMAS) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.hetheesha_product_snapshot (
          handle TEXT PRIMARY KEY, snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
          revenue NUMERIC(10,2), meta_title TEXT, meta_desc TEXT,
          faq_status TEXT, alt_count INTEGER, impressions INTEGER, ctr NUMERIC(6,2)
        )
      `);
      SNAP_SCHEMA = schema;
      return;
    } catch(e) {}
  }
  console.warn('[members-api/hetheesha] Could not create snapshot table in any schema');
}

async function loadDbSnapshots(db) {
  if (!SNAP_SCHEMA) return {};
  const { rows } = await db.query(`
    SELECT handle, snapshot_date::text, revenue, meta_title, meta_desc,
           faq_status, alt_count, impressions, ctr
    FROM ${SNAP_SCHEMA}.hetheesha_product_snapshot
  `);
  const map = {};
  rows.forEach(r => { map[r.handle] = r; });
  return map;
}

async function upsertNewSnapshots(db, handles, revenueMap, shopifyMap, gscMap, existingSnaps) {
  const newHandles = handles.filter(h => !existingSnaps[h]);
  if (!newHandles.length) return;
  for (const h of newHandles) {
    const sh  = shopifyMap[h] || {};
    const gsc = gscMap[h]    || {};
    const rev = revenueMap[h];
    await db.query(`
      INSERT INTO ${SNAP_SCHEMA}.hetheesha_product_snapshot
        (handle, snapshot_date, revenue, meta_title, meta_desc, faq_status, alt_count, impressions, ctr)
      VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (handle) DO NOTHING
    `, [h, rev?.rev ?? null, sh.meta_title ?? null, sh.meta_desc ?? null,
        sh.faq ?? null, sh.alt_missing ?? null, gsc.imp ?? null, gsc.ctr ?? null]);
  }
}

async function handleBA(db, handle, beforeFrom, beforeTo, afterFrom, afterTo) {
  const pat = '%/products/' + handle + '%';
  const gsc = await db.query(`
    SELECT period,
      SUM(impressions) AS imp, SUM(clicks) AS clicks,
      ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions),0) * 100, 2) AS ctr_pct,
      ROUND(AVG(position)::numeric, 1) AS avg_pos
    FROM (
      SELECT 'before' AS period, impressions, clicks, position
      FROM google_search_console.page
      WHERE sub_source=233 AND search_type='web' AND page ILIKE $5
        AND date BETWEEN $1 AND $2
      UNION ALL
      SELECT 'after' AS period, impressions, clicks, position
      FROM google_search_console.page
      WHERE sub_source=233 AND search_type='web' AND page ILIKE $5
        AND date BETWEEN $3 AND $4
    ) p GROUP BY period
  `, [beforeFrom, beforeTo, afterFrom, afterTo, pat]);

  const sales = await db.query(`
    SELECT period,
      ROUND(SUM(CAST(oii.item_price AS NUMERIC)*CAST(oii.item_quantity AS INTEGER))::numeric,2) AS sales
    FROM (
      SELECT 'before' AS period, id AS oid FROM order_management.orders
      WHERE sub_source_id=233 AND status='Completed' AND order_date BETWEEN $2 AND $3
      UNION ALL
      SELECT 'after' AS period, id AS oid FROM order_management.orders
      WHERE sub_source_id=233 AND status='Completed' AND order_date BETWEEN $4 AND $5
    ) o
    JOIN order_management.order_item_info oii ON oii.order_id=o.oid
    WHERE oii.handle=$1 GROUP BY period
  `, [handle, beforeFrom, beforeTo, afterFrom, afterTo]);

  const result = { before: null, after: null };
  gsc.rows.forEach(r => {
    result[r.period] = { imp: parseInt(r.imp)||0, clicks: parseInt(r.clicks)||0,
      ctr: parseFloat(r.ctr_pct)||0, avg_pos: r.avg_pos!==null?parseFloat(r.avg_pos):null, sales: 0 };
  });
  sales.rows.forEach(r => {
    if (!result[r.period]) result[r.period] = { imp:0, clicks:0, ctr:0, avg_pos:null, sales:0 };
    result[r.period].sales = parseFloat(r.sales)||0;
  });
  return { ok:true, handle, before:result.before, after:result.after,
    ba_meta:{ before_from:beforeFrom, before_to:beforeTo, after_from:afterFrom, after_to:afterTo } };
}

async function handleHetheeshaReq1(req, res) {
  if (!TOKEN) return res.status(500).json({ ok: false, error: 'SHOPIFY_FR_TOKEN env var not set' });

  const { type, handle, before_from, before_to, after_from, after_to } = req.query || {};

  if (type === 'ba') {
    if (!handle || !before_from || !before_to || !after_from || !after_to)
      return res.status(400).json({ ok:false, error:'handle, before_from, before_to, after_from, after_to required' });
    const db2 = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false });
    try {
      await db2.connect();
      const data = await handleBA(db2, handle, before_from, before_to, after_from, after_to);
      await db2.end();
      return res.status(200).json(data);
    } catch(err) {
      await db2.end().catch(()=>{});
      return res.status(500).json({ ok:false, error:err.message });
    }
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false });
  try {
    await db.connect();
    const snapshotHandles = SNAPSHOT.map(s => s.h);

    const revRes = await db.query(`
      SELECT oii.handle,
             SUM(CAST(oii.item_price AS NUMERIC) * CAST(oii.item_quantity AS INTEGER)) AS revenue
      FROM order_management.orders o
      JOIN order_management.order_item_info oii ON oii.order_id = o.id
      WHERE o.sub_source_id = 233 AND o.status = 'Completed'
        AND o.order_date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE
        AND oii.handle IS NOT NULL AND oii.handle != ''
      GROUP BY oii.handle ORDER BY revenue DESC LIMIT 50
    `);

    const handles    = revRes.rows.map(r => r.handle);
    const revenueMap = {};
    revRes.rows.forEach((r, i) => { revenueMap[r.handle] = { rank: i + 1, rev: parseFloat(r.revenue) }; });

    const gscRes = await db.query(`
      SELECT
        regexp_replace(split_part(regexp_replace(p.page,'^https?://[^/]+',''),'?',1),'^/products/','') AS handle,
        SUM(p.impressions) AS impressions,
        ROUND(AVG(p.ctr)*100,2) AS ctr_pct
      FROM google_search_console.page p
      WHERE p.sub_source=233 AND p.search_type='web' AND p.page LIKE '%/products/%'
        AND p.date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE
        AND regexp_replace(split_part(regexp_replace(p.page,'^https?://[^/]+',''),'?',1),'^/products/','') = ANY($1)
      GROUP BY handle
    `, [handles]);

    const gscMap = {};
    gscRes.rows.forEach(r => { gscMap[r.handle] = { imp: parseInt(r.impressions), ctr: parseFloat(r.ctr_pct) }; });

    const gscBARes = await db.query(`
      SELECT period,
        regexp_replace(split_part(regexp_replace(p.page,'^https?://[^/]+',''),'?',1),'^/products/','') AS handle,
        SUM(p.impressions) AS imp, SUM(p.clicks) AS clicks,
        ROUND(SUM(p.clicks)::numeric/NULLIF(SUM(p.impressions),0)*100,2) AS ctr_pct,
        ROUND(AVG(p.position)::numeric,1) AS avg_pos
      FROM (
        SELECT 'before' AS period, impressions, clicks, position, page FROM google_search_console.page
        WHERE sub_source=233 AND search_type='web' AND page LIKE '%/products/%'
          AND date BETWEEN $2 AND $3
        UNION ALL
        SELECT 'after' AS period, impressions, clicks, position, page FROM google_search_console.page
        WHERE sub_source=233 AND search_type='web' AND page LIKE '%/products/%'
          AND date BETWEEN $4 AND $5
      ) p
      WHERE regexp_replace(split_part(regexp_replace(p.page,'^https?://[^/]+',''),'?',1),'^/products/','') = ANY($1)
      GROUP BY period, handle
    `, [snapshotHandles, BEFORE_FROM, BEFORE_TO, AFTER_FROM, AFTER_TO]);

    const salesBARes = await db.query(`
      SELECT period, oii.handle,
        ROUND(SUM(CAST(oii.item_price AS NUMERIC)*CAST(oii.item_quantity AS INTEGER))::numeric,2) AS sales
      FROM (
        SELECT 'before' AS period, id AS oid FROM order_management.orders
        WHERE sub_source_id=233 AND status='Completed' AND order_date BETWEEN $2 AND $3
        UNION ALL
        SELECT 'after' AS period, id AS oid FROM order_management.orders
        WHERE sub_source_id=233 AND status='Completed' AND order_date BETWEEN $4 AND $5
      ) o
      JOIN order_management.order_item_info oii ON oii.order_id=o.oid
      WHERE oii.handle=ANY($1) AND oii.handle IS NOT NULL AND oii.handle!=''
      GROUP BY period, oii.handle
    `, [snapshotHandles, BEFORE_FROM, BEFORE_TO, AFTER_FROM, AFTER_TO]);

    const baMap = {};
    snapshotHandles.forEach(h => { baMap[h] = { before: null, after: null }; });
    gscBARes.rows.forEach(r => {
      if (!baMap[r.handle]) return;
      baMap[r.handle][r.period] = { imp: parseInt(r.imp)||0, clicks: parseInt(r.clicks)||0,
        ctr: parseFloat(r.ctr_pct)||0, avg_pos: r.avg_pos!==null?parseFloat(r.avg_pos):null, sales: 0 };
    });
    salesBARes.rows.forEach(r => {
      if (!baMap[r.handle]) return;
      if (!baMap[r.handle][r.period]) baMap[r.handle][r.period] = { imp:0, clicks:0, ctr:0, sales:0 };
      baMap[r.handle][r.period].sales = parseFloat(r.sales)||0;
    });

    await ensureSnapshotTable(db);
    const dbSnapshots = await loadDbSnapshots(db);
    await db.end();

    const allHandles = [...new Set([...handles, ...snapshotHandles])];
    const shopifyMap = await fetchAllShopify(allHandles);

    const db2 = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false });
    try {
      await db2.connect();
      await upsertNewSnapshots(db2, handles, revenueMap, shopifyMap, gscMap, dbSnapshots);
      const freshSnaps = await loadDbSnapshots(db2);
      Object.assign(dbSnapshots, freshSnaps);
      await db2.end();
    } catch(e) {
      await db2.end().catch(()=>{});
      console.warn('[members-api/hetheesha/req1] snapshot upsert failed:', e.message);
    }

    const rows = handles.map(h => {
      const rev = revenueMap[h];
      const gsc = gscMap[h]     || { imp: null, ctr: null };
      const sh  = shopifyMap[h] || { meta_title: null, meta_desc: null, alt_missing: 0, faq: 'Missing' };
      return { rank: rev.rank, handle: h, revenue: rev.rev,
        meta_title: sh.meta_title, meta_desc: sh.meta_desc,
        alt_missing: sh.alt_missing, faq: sh.faq, impressions: gsc.imp, ctr: gsc.ctr };
    });

    const tracker = buildTracker(SNAPSHOT, shopifyMap);
    tracker.forEach(i => { i.in_snapshot = true; });

    const snapshotHandleSet = new Set(snapshotHandles);
    const FIELDS_DEF = [
      { key: 'meta_title',  snapKey: 'meta_title', label: 'Meta Title',  isMissing: v => !v },
      { key: 'meta_desc',   snapKey: 'meta_desc',  label: 'Meta Desc',   isMissing: v => !v },
      { key: 'faq',         snapKey: 'faq_status', label: 'FAQ Schema',  isMissing: v => v==='Missing'||!v },
      { key: 'alt_missing', snapKey: 'alt_count',  label: 'Alt Text',    isMissing: v => v > 0 },
    ];
    handles.forEach(h => {
      if (snapshotHandleSet.has(h)) return;
      const sh = shopifyMap[h]; if (!sh) return;
      const rank   = revenueMap[h]?.rank ?? 99;
      const dbSnap = dbSnapshots[h];
      FIELDS_DEF.forEach(f => {
        const snapVal    = dbSnap ? dbSnap[f.snapKey] : null;
        const liveVal    = sh[f.key];
        const wasMissing = snapVal !== null ? f.isMissing(snapVal) : f.isMissing(liveVal);
        const nowFixed   = !f.isMissing(liveVal);
        const nowMissing = f.isMissing(liveVal);
        if (wasMissing || nowMissing) {
          tracker.push({ rank, handle: h, field: f.label, field_key: f.key,
            before: snapVal, after: liveVal, was_missing: wasMissing,
            now_fixed: wasMissing && nowFixed, new_issue: !wasMissing && nowMissing,
            live_value: liveVal, in_snapshot: false, snapshot_date: dbSnap?.snapshot_date ?? null });
        }
      });
    });
    tracker.sort((a, b) => a.rank - b.rank);

    return res.status(200).json({
      ok: true, fetched_at: new Date().toISOString(),
      period: `${new Date(Date.now()-30*864e5).toISOString().slice(0,10)} to ${new Date().toISOString().slice(0,10)} (rolling 30d)`,
      rows, snapshot: SNAPSHOT, db_snapshots: dbSnapshots, tracker, before_after: baMap,
      ba_meta: { before_from: BEFORE_FROM, before_to: BEFORE_TO, after_from: AFTER_FROM, after_to: AFTER_TO, snapshot_date: SNAPSHOT_DATE },
    });

  } catch (err) {
    await db.end().catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── HETHEESHA REQ2 — helpers ─────────────────────────────────────────────────

const SNAPSHOT2 = [
 {h:'frontpage',stl:0,sdl:0,faq:0},
 {h:'lumiere-daraignee',stl:63,sdl:157,faq:1},
 {h:'lampes-suspendues',stl:67,sdl:153,faq:0},
 {h:'applique-murale',stl:53,sdl:157,faq:0},
 {h:'eclairage-de-table',stl:68,sdl:152,faq:0},
 {h:'abat-jour',stl:48,sdl:152,faq:0},
 {h:'eclairage-de-tuyaux',stl:58,sdl:148,faq:0},
 {h:'plafonniers',stl:56,sdl:146,faq:0},
 {h:'cage-metallique',stl:52,sdl:157,faq:0},
 {h:'support-de-lampe',stl:58,sdl:139,faq:0},
 {h:'transformateurs-led',stl:40,sdl:143,faq:0},
 {h:'5v-transformateurs-led',stl:58,sdl:152,faq:0},
 {h:'ip20-transformateurs-led',stl:43,sdl:141,faq:0},
 {h:'12-v-transformateur',stl:54,sdl:150,faq:0},
 {h:'ip67-transformateur-led',stl:0,sdl:146,faq:0},
 {h:'ip45transformateur-led',stl:0,sdl:0,faq:0},
 {h:'24v-transformateurs-led',stl:0,sdl:157,faq:0},
 {h:'ampoule-led',stl:48,sdl:135,faq:0},
 {h:'ampoules-e27',stl:60,sdl:150,faq:0},
 {h:'ampoules-b22',stl:57,sdl:139,faq:0},
 {h:'decor-led',stl:69,sdl:130,faq:1},
 {h:'ampoules-e14',stl:52,sdl:156,faq:0},
 {h:'transformateur-de-courant-constant',stl:51,sdl:155,faq:0},
 {h:'cables',stl:59,sdl:123,faq:0},
 {h:'cable-rond-a-2-conducteurs',stl:52,sdl:167,faq:0},
 {h:'cable-rond-a-3-conducteurs',stl:60,sdl:136,faq:0},
 {h:'cable-torsade-a-2-conducteurs',stl:0,sdl:0,faq:0},
 {h:'cable-torsade-a-3-conducteurs',stl:0,sdl:149,faq:0},
 {h:'luminaires-tendance',stl:53,sdl:144,faq:0},
 {h:'lumieres-led-dinterieur',stl:44,sdl:142,faq:0},
 {h:'ajustement-facile',stl:0,sdl:0,faq:0},
 {h:'meilleure-vente',stl:0,sdl:0,faq:0},
 {h:'rideau-de-douche',stl:26,sdl:143,faq:0},
 {h:'panneaux-led',stl:70,sdl:144,faq:0},
 {h:'eclairage-de-cuisine',stl:63,sdl:115,faq:0},
 {h:'rosaces-de-plafond',stl:55,sdl:138,faq:0},
 {h:'horloge',stl:44,sdl:147,faq:0},
 {h:'anneau-dombrage',stl:55,sdl:144,faq:0},
 {h:'eclairage-de-plug-in',stl:0,sdl:0,faq:0},
 {h:'livraison-gratuite',stl:0,sdl:144,faq:0},
 {h:'tapis-de-sol',stl:0,sdl:0,faq:0},
 {h:'eclairage-des-conduits',stl:0,sdl:0,faq:0},
 {h:'interrupteurs-et-prises',stl:0,sdl:0,faq:0},
 {h:'crochets-et-anneaux',stl:61,sdl:142,faq:0},
 {h:'connecteurs-de-fils-boite-de-jonction',stl:48,sdl:158,faq:0},
 {h:'duree-limitee-jusqua-50-de-reduction',stl:0,sdl:0,faq:0},
 {h:'produits-tendance',stl:0,sdl:0,faq:0},
 {h:'lumieres-de-conduit-metal',stl:46,sdl:158,faq:0},
 {h:'clients-achetent',stl:0,sdl:0,faq:0},
 {h:'eclairage-dombre-a-motif',stl:0,sdl:0,faq:0},
 {h:'conduit-metallique',stl:49,sdl:155,faq:0},
 {h:'tous-les-produits',stl:70,sdl:113,faq:0},
 {h:'eclairage-de-la-chambre',stl:0,sdl:0,faq:0},
 {h:'suspension-rotin',stl:16,sdl:158,faq:0},
 {h:'luminaire-salon',stl:0,sdl:133,faq:0},
 {h:'produits-les-plus-vendus',stl:41,sdl:158,faq:0},
 {h:'offres-du-nouvel-an-2026',stl:0,sdl:0,faq:0},
 {h:'promotion-hebdomadaire',stl:52,sdl:159,faq:0},
 {h:'nouveautes-derniers-produits-arrives',stl:47,sdl:140,faq:0},
 {h:'eclairage-led',stl:56,sdl:146,faq:0},
 {h:'vente-en-liquidation',stl:0,sdl:0,faq:0},
 {h:'supports-de-rosace-de-plafond',stl:49,sdl:147,faq:0},
 {h:'offres-speciales',stl:0,sdl:0,faq:0},
 {h:'modules-led',stl:0,sdl:0,faq:0},
 {h:'appliques-murales-dexterieur',stl:0,sdl:0,faq:0},
 {h:'illuminez-votre-interieur',stl:0,sdl:0,faq:0},
];

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchAllCollections() {
  const collections = [];
  let cursor = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const afterArg = cursor ? `, after: "${cursor}"` : '';
    const gql = `{
      collections(first: 100${afterArg}) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            handle title
            seo { title description }
            descriptionHtml
            metafield(namespace: "custom", key: "faq_schema") { value }
          }
        }
      }
    }`;
    const resp = await shopifyGQL(gql);
    const page = resp.data?.collections;
    if (!page) break;
    page.edges.forEach(({ node: c }) => {
      const plain     = stripHtml(c.descriptionHtml);
      const wordCount = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
      const intLinks  = ((c.descriptionHtml || '').match(/href=/gi) || []).length;
      const seoTitle  = c.seo?.title       || '';
      const seoDesc   = c.seo?.description || '';
      collections.push({ handle: c.handle, title: c.title, word_count: wordCount,
        seo_title: seoTitle||null, seo_title_len: seoTitle.length,
        seo_desc: seoDesc||null, seo_desc_len: seoDesc.length,
        has_faq: c.metafield?.value ? 1 : 0, int_links: intLinks });
    });
    hasNextPage = page.pageInfo.hasNextPage;
    cursor      = page.pageInfo.endCursor;
  }
  return collections;
}

function buildTracker2(snapshot, collectionMap) {
  const items = [];
  const FIELDS = [
    { key: 'seo_title', snapKey: 'stl', label: 'Meta Title', isMissing: v => v === 0 },
    { key: 'seo_desc',  snapKey: 'sdl', label: 'Meta Desc',  isMissing: v => v === 0 },
    { key: 'has_faq',   snapKey: 'faq', label: 'FAQ Schema', isMissing: v => v === 0 },
  ];
  snapshot.forEach((s, idx) => {
    const live = collectionMap[s.h];
    FIELDS.forEach(f => {
      const snapVal    = s[f.snapKey];
      const wasMissing = f.isMissing(snapVal);
      if (!wasMissing) return;
      const liveVal  = live ? live[f.key] : null;
      const nowFixed = live && !f.isMissing(
        f.key === 'has_faq'   ? (liveVal || 0) :
        f.key === 'seo_title' ? (live.seo_title_len || 0) :
                                (live.seo_desc_len  || 0)
      );
      items.push({ rank: idx+1, handle: s.h, field: f.label, field_key: f.key,
        before: snapVal, now_fixed: nowFixed,
        live_value: f.key === 'has_faq' ? (liveVal===1?'Present':null) : liveVal });
    });
  });
  return items;
}

async function handleHetheeshaReq2(req, res) {
  if (!TOKEN) return res.status(500).json({ ok: false, error: 'SHOPIFY_FR_TOKEN env var not set' });

  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false });
  try {
    await db.connect();
    const gscRes = await db.query(`
      SELECT
        regexp_replace(split_part(regexp_replace(p.page,'^https?://[^/]+',''),'?',1),'^/collections/','') AS handle,
        SUM(p.clicks) AS clicks, SUM(p.impressions) AS impressions,
        ROUND(AVG(p.ctr)*100,2) AS ctr_pct, ROUND(AVG(p.position),1) AS avg_pos
      FROM google_search_console.page p
      WHERE p.sub_source=233 AND p.search_type='web' AND p.page LIKE '%/collections/%'
        AND p.date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE
      GROUP BY handle
    `);
    await db.end();

    const gscMap = {};
    gscRes.rows.forEach(r => { gscMap[r.handle] = { clicks: parseInt(r.clicks)||0,
      imp: parseInt(r.impressions)||0, ctr: parseFloat(r.ctr_pct)||0, pos: parseFloat(r.avg_pos)||0 }; });

    const collections   = await fetchAllCollections();
    const collectionMap = {};
    collections.forEach(c => { collectionMap[c.handle] = c; });

    const rows = collections.map(c => {
      const gsc = gscMap[c.handle] || { clicks:0, imp:0, ctr:0, pos:0 };
      return [c.handle, c.title, c.word_count, c.seo_title_len, c.seo_desc_len,
        c.has_faq, c.int_links, gsc.clicks, gsc.imp, gsc.ctr, gsc.pos, 1];
    });

    const tracker = buildTracker2(SNAPSHOT2, collectionMap);

    return res.status(200).json({ ok: true, fetched_at: new Date().toISOString(),
      period_gsc: `${new Date(Date.now()-30*864e5).toISOString().slice(0,10)} to ${new Date().toISOString().slice(0,10)} (rolling 30d)`,
      collection_count: rows.length, rows, tracker });

  } catch (err) {
    await db.end().catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── JAKSHAN ──────────────────────────────────────────────────────────────────

const JAKSHAN_SUB_SOURCE = 104;
const JAKSHAN_BASE_URL   = 'https://ledsone.co.uk/products/';

const JAKSHAN_HANDLES = [
  'ip68-waterproof-junction-box-outdoor-for-electrical-cable-wire-connector-5599',
  'rose-gold-lamp-shade-cap-for-pendant-light-socket-holder-fitting',
  '40cm-black-metal-dome-pendant-light',
  'modern-vintage-pendant-light-fitting-retro-industrial-style-e27-lamp-holder',
  'pendant-light-fitting-ceiling-rose-e27-suspension-set-fabric-corded-rose-gold',
  'tiffany-style-ceiling-pendant-hanging-mediterranean-style-lamp-light-decorative-home-4541',
  'brushed-silver-metal-industrial-hanging-pendant-lighting-adjustable-hanging-barn-light',
  'industrial-pendant-lighting-with-32cm-orange-lampshade-over-the-kitchen-island',
  'lamp-shade-spring-clip-retainer-for-lamp-part-shades-5963',
  'french-gold-pendant-lights-gold-ceiling-lights-metal-industrial-light-shade',
  'e27-g95-40w-dimmable-antique-globe-industrial-retro-bulb',
  'dc12v-60w-ip20-mini-universal-regulated-switching-led-transformer',
  'industrial-vintage-style-wall-or-ceiling-light-b22-bar-conduits-light',
  '3-light-bulb-guard-cage-cluster-pendant-lights',
  'conduit-pipe-table-lamp-with-dimmer-switch-industrial-steampunk-light-5651',
  '28w-compact-led-driver-ac-230v-to-dc12v-power-supply-transformer',
  '3-light-ceiling-pendant-light-with-pulley-system',
  'light-fixing-strap-brace-ceiling-rose-155mm-bracket-plate-with-accessories',
  'ceramic-porcelain-type-6-es-e27-edison-screw-heat-bulb-lamp-holder',
  '2pcs-bath-pedestal-rug-set-soft-non-slip-water-absorbent-mat-sets-5393',
  'cone-wall-light',
  'copper-lamp-shade-cap-for-pendant-light-socket-holder-fitting',
  'dc12v-15w-led-driver-power-supply-transformer',
  'warm-white-12v-led-waterproof-modules-ip67-outdoor-5677',
  '5-x-vintage-pendant-cord-grip-strain-relief-metal-cable-lock-10mm-nut-6048',
  'pipe-lighting-accessories-iron-5way-cross',
  'industrial-vintage-various-colours-ceiling-light-fitting-e27-pendant-holder',
  '3-core-army-green-round-vintage-italian-braided-fabric-cable-flex-0-75mm-uk',
  'dc24v-ip67-30w-waterproof-led-driver-power-supply-transformer',
  'screw-e27-white-plain-holder-bakelite-lamp-holder',
  'vintage-e27-edison-screw-3w-filament-bulb-warm-white-2000k-amber-glass-5073',
  '3-outlet-500mm-black-metal-ceiling-rose-square',
  'red-wicker-rattan-lampshade-ceiling-pendant-light',
  'black-finished-industrial-adjustable-pendant-light-fixture',
  'plug-in-wall-light-kit-dimmer-uk-plug-flex-wire',
  'orange-painted-metal-shade-lighting-vintage-pendant-light',
  'vintage-edison-led-filament-bulb-g80-b22-4w-dimmable',
  'fabric-hemp-flex-cable-kit-black-plug-in-pendant-lamp-light-e27-fitting-vintage-lamp',
  'industrial-style-ceiling-light-three-b22-bar-conduits-light',
  'black-bakelite-lamp-holder-industrial-socket-light-bulb-holder-5735',
  '1m-white-pendant-light-holder',
  'hemp-rope-metal-pendant-light-spider-light-hanging-light',
  'conduit-light-shade-5570',
  'retro-vintage-1cm-hole-barrel-cage-design-rattan-style-lamp-light-shades-4219',
  '105mm-bracket-strap-brace-plate-with-accessories-ceiling-rose-light-fixing',
  'linear-cage-pendant-light-fixture',
  'b22-t185-60w-dimmable-vintage-light-filament-bulb',
  'design-women-toe-post-flip-flop-beach-slipper-for-sea',
  'industrial-ribbed-glass-wall-lights-replacement-lampshades-for-wall-lights',
  '3-way-modern-black-ceiling-pendant-cluster-light-fitting-industrial-pendant-lampshade',
];

const JAKSHAN_PAGES = JAKSHAN_HANDLES.map(h => JAKSHAN_BASE_URL + h);

function jakshanCalcAction(clicks, impressions) {
  if (clicks >= 1)        return 'Rewrite meta tags + re-optimize keywords';
  if (impressions >= 50)  return 'Check intent mismatch before optimizing';
  return 'Do not optimize';
}

function jakshanCalcOptimize(monthlySales, ctr) {
  if (monthlySales >= 1 && ctr >= 5) return 'Do Not Optimize';
  return 'Optimize';
}

async function handleJakshanReq1(client, days, fromOverride, toOverride) {
  let fromStr, toStr;
  if (fromOverride && toOverride) {
    fromStr = fromOverride; toStr = toOverride;
  } else {
    const d = days > 0 ? days - 1 : 89;
    const from = new Date(); from.setDate(from.getDate() - d);
    fromStr = from.toISOString().slice(0, 10);
    toStr   = new Date().toISOString().slice(0, 10);
  }

  const { rows: pageRows } = await client.query(`
    SELECT page,
      SUM(clicks)::int AS page_clicks, SUM(impressions)::int AS page_imp,
      ROUND(AVG(ctr)::numeric*100,2) AS avg_ctr, ROUND(AVG(position)::numeric,1) AS avg_pos
    FROM google_search_console.page
    WHERE sub_source=$1 AND search_type='web'
      AND page=ANY($2::text[]) AND date BETWEEN $3 AND $4
    GROUP BY page
  `, [JAKSHAN_SUB_SOURCE, JAKSHAN_PAGES, fromStr, toStr]);
  const pageMap = {};
  pageRows.forEach(r => { pageMap[r.page] = r; });

  const { rows: kwRows } = await client.query(`
    SELECT DISTINCT ON (page) page, query,
      SUM(clicks) OVER (PARTITION BY page, query)::int AS kw_clicks,
      SUM(impressions) OVER (PARTITION BY page, query)::int AS kw_imp,
      ROUND(AVG(position) OVER (PARTITION BY page, query)::numeric,1) AS kw_pos
    FROM google_search_console.query_page
    WHERE sub_source=$1 AND search_type='web'
      AND page=ANY($2::text[]) AND date BETWEEN $3 AND $4
    ORDER BY page, SUM(clicks) OVER (PARTITION BY page,query) DESC,
             SUM(impressions) OVER (PARTITION BY page,query) DESC
  `, [JAKSHAN_SUB_SOURCE, JAKSHAN_PAGES, fromStr, toStr]);
  const kwMap = {};
  kwRows.forEach(r => { kwMap[r.page] = r; });

  const { rows: metaRows } = await client.query(`
    SELECT sl.shopify_handle, m.title_tag, m.description_tag, sl.title AS h1
    FROM listings.shopify_listings sl
    LEFT JOIN listings.shopify_listing_meta m ON m.product_id=sl.item_id::bigint
    WHERE sl.sub_source=$1 AND sl.is_parent=1 AND sl.shopify_handle=ANY($2::text[])
  `, [JAKSHAN_SUB_SOURCE, JAKSHAN_HANDLES]);
  const metaMap = {};
  metaRows.forEach(r => { metaMap[r.shopify_handle] = r; });

  const n = v => Number(v) || 0;
  const products = JAKSHAN_HANDLES.map(handle => {
    const url  = JAKSHAN_BASE_URL + handle;
    const pg   = pageMap[url] || {};
    const kw   = kwMap[url]   || {};
    const meta = metaMap[handle] || {};
    const clicks = n(pg.page_clicks), imp = n(pg.page_imp);
    return { url, handle, keyword: kw.query||'No keyword data',
      pageClicks: clicks, pageImp: imp, pageCtr: n(pg.avg_ctr), pagePos: n(pg.avg_pos),
      kwClicks: n(kw.kw_clicks), kwImp: n(kw.kw_imp), kwPos: n(kw.kw_pos),
      metaTitle: meta.title_tag||'', metaDesc: meta.description_tag||'', h1: meta.h1||'',
      action: jakshanCalcAction(clicks, imp), hasGsc: !!pg.page_imp };
  });

  return { products, meta: { from: fromStr, to: toStr } };
}

async function handleJakshanReq2(client, days, fromOverride, toOverride) {
  const now = new Date();
  let from30Str, from7Str, toStr;
  if (fromOverride && toOverride) {
    from30Str = fromOverride; toStr = toOverride;
    const to = new Date(toOverride);
    const f7 = new Date(to); f7.setDate(f7.getDate() - 6);
    from7Str = f7.toISOString().slice(0, 10);
  } else {
    const d = days > 0 ? days - 1 : 29;
    const fromMain = new Date(now); fromMain.setDate(fromMain.getDate() - d);
    const from7    = new Date(now); from7.setDate(from7.getDate() - 6);
    from30Str = fromMain.toISOString().slice(0, 10);
    from7Str  = from7.toISOString().slice(0, 10);
    toStr     = now.toISOString().slice(0, 10);
  }

  const { rows: pageRows } = await client.query(`
    SELECT page, SUM(clicks)::int AS clicks, SUM(impressions)::int AS imp,
      ROUND(AVG(ctr)::numeric*100,2) AS ctr, ROUND(AVG(position)::numeric,1) AS pos
    FROM google_search_console.page
    WHERE sub_source=$1 AND search_type='web'
      AND page=ANY($2::text[]) AND date BETWEEN $3 AND $4
    GROUP BY page
  `, [JAKSHAN_SUB_SOURCE, JAKSHAN_PAGES, from30Str, toStr]);
  const pageMap = {};
  pageRows.forEach(r => { pageMap[r.page] = r; });

  const { rows: ordRows } = await client.query(`
    SELECT oi.handle,
      COUNT(DISTINCT CASE WHEN o.order_date::date>=$3 THEN o.id END)::int AS weekly_sales,
      COUNT(DISTINCT CASE WHEN o.order_date::date>=$2 THEN o.id END)::int AS monthly_sales
    FROM order_management.orders o
    JOIN order_management.order_item_info oi ON oi.order_id=o.id
    WHERE o.sub_source_id=$1 AND o.order_date::date BETWEEN $2 AND $5
      AND oi.handle=ANY($4::text[])
    GROUP BY oi.handle
  `, [JAKSHAN_SUB_SOURCE, from30Str, from7Str, JAKSHAN_HANDLES, toStr]);
  const ordMap = {};
  ordRows.forEach(r => { ordMap[r.handle] = r; });

  const { rows: titleRows } = await client.query(`
    SELECT shopify_handle, title FROM listings.shopify_listings
    WHERE sub_source=$1 AND is_parent=1 AND shopify_handle=ANY($2::text[])
  `, [JAKSHAN_SUB_SOURCE, JAKSHAN_HANDLES]);
  const titleMap = {};
  titleRows.forEach(r => { titleMap[r.shopify_handle] = r.title; });

  const n = v => Number(v) || 0;
  const products = JAKSHAN_HANDLES.map(handle => {
    const url = JAKSHAN_BASE_URL + handle;
    const pg  = pageMap[url] || {};
    const ord = ordMap[handle] || {};
    const ctr = n(pg.ctr), ms = n(ord.monthly_sales);
    return { url, handle, title: titleMap[handle]||handle,
      weeklySales: n(ord.weekly_sales), monthlySales: ms,
      clicks: n(pg.clicks), imp: n(pg.imp), ctr, pos: n(pg.pos),
      status: jakshanCalcOptimize(ms, ctr) };
  });

  return { products, meta: { from: from30Str, to: toStr } };
}

async function handleJakshan(req, res) {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) return res.status(500).json({ ok: false, error: 'DATABASE_URL not configured' });

  const type   = req.query.type || 'req1';
  const client = new Client({ connectionString: connStr, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000, statement_timeout: 55000 });
  try {
    await client.connect();
    const days  = parseInt(req.query.days, 10) || 0;
    const fromP = req.query.from || null;
    const toP   = req.query.to   || null;
    let result;
    if      (type === 'req1') result = await handleJakshanReq1(client, days||90, fromP, toP);
    else if (type === 'req2') result = await handleJakshanReq2(client, days||30, fromP, toP);
    else return res.status(400).json({ ok: false, error: 'Unknown type: ' + type });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return errResponse(res, err);
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── SAJEEPAN ─────────────────────────────────────────────────────────────────

const SJ_CAMPAIGN_IDS = [21069663519, 23110323532, 23516313256, 23590572906, 22079334413, 21242723265];
const SJ_TARGET_ROAS  = {
  '21069663519': 320, '23110323532': 320, '23516313256': 400,
  '23590572906': 400, '22079334413': 380, '21242723265': 380,
};

async function handleSajeepanProdDetail(client, itemId, fromDate, toDate, prevFrom, prevTo) {
  const n = v => Number(v) || 0;

  const { rows: trendRows } = await client.query(`
    SELECT date, SUM(impressions) AS imp, SUM(clicks) AS clk,
      ROUND(SUM(cost)::numeric,2) AS cost, ROUND(SUM(conversion_value)::numeric,2) AS cv,
      ROUND(SUM(conversions)::numeric,4) AS conv
    FROM google_ads.product_performance
    WHERE campaign_id=ANY($1::bigint[]) AND LOWER(product_item_id)=LOWER($2)
      AND date BETWEEN $3 AND $4
    GROUP BY date ORDER BY date ASC
  `, [SJ_CAMPAIGN_IDS, itemId, fromDate, toDate]);

  const { rows: prevRows } = await client.query(`
    SELECT SUM(impressions) AS imp, SUM(clicks) AS clk,
      ROUND(SUM(cost)::numeric,2) AS cost, ROUND(SUM(conversion_value)::numeric,2) AS cv,
      ROUND(SUM(conversions)::numeric,4) AS conv
    FROM google_ads.product_performance
    WHERE campaign_id=ANY($1::bigint[]) AND LOWER(product_item_id)=LOWER($2)
      AND date BETWEEN $3 AND $4
  `, [SJ_CAMPAIGN_IDS, itemId, prevFrom, prevTo]);

  const { rows: metaRows } = await client.query(`
    SELECT DISTINCT ON (LOWER(product_id)) product_id, description, feed_label,
      product_category AS category, product_types AS ptype, custom_label3 AS label3
    FROM google_ads.merchant_products WHERE LOWER(product_id)=LOWER($1)
    ORDER BY LOWER(product_id)
  `, [itemId]);

  const p = prevRows[0] || {};
  const prev = { imp: n(p.imp), clk: n(p.clk), cost: n(p.cost), cv: n(p.cv), conv: n(p.conv) };
  prev.roas = prev.cost > 0 ? Math.round(prev.cv / prev.cost * 10000) / 100 : 0;

  const trend = trendRows.map(r => {
    const cost = n(r.cost), cv = n(r.cv), imp = n(r.imp), clk = n(r.clk);
    return { d: r.date.toISOString().slice(0,10), imp, clk, cost, cv, conv: n(r.conv),
      ctr:  imp  > 0 ? Math.round(clk/imp*10000)/100  : 0,
      roas: cost > 0 ? Math.round(cv/cost*10000)/100 : 0 };
  });

  const m = metaRows[0] || {};
  const extra = { description: m.description||null, feed_label: m.feed_label||null,
    category: m.category||null, ptype: m.ptype||null, label3: m.label3||null };

  return { prev, trend, extra };
}

async function handleSajeepanReq2(client, toDate, fromDate, prevFrom, prevTo) {
  const n = v => Number(v) || 0;

  const { rows: wasteRows } = await client.query(`
    SELECT product_item_id, campaign_id::text,
      SUM(clicks) AS clicks, ROUND(SUM(cost)::numeric,2) AS cost, SUM(impressions) AS imps
    FROM google_ads.product_performance
    WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3 AND product_item_id!=''
    GROUP BY product_item_id, campaign_id
    HAVING SUM(conversions)=0 AND SUM(cost)>5 AND SUM(clicks)>0
    ORDER BY cost DESC
  `, [SJ_CAMPAIGN_IDS, fromDate, toDate]);

  const wasteIds = wasteRows.map(r => r.product_item_id.toLowerCase());
  let wasteMeta = {};
  if (wasteIds.length > 0) {
    const { rows: wm } = await client.query(`
      SELECT DISTINCT ON (LOWER(product_id)) product_id, title, image_link, link, price, availability
      FROM google_ads.merchant_products WHERE LOWER(product_id)=ANY($1::text[])
      ORDER BY LOWER(product_id),(CASE WHEN country='GB' THEN 0 ELSE 1 END)
    `, [wasteIds]);
    wm.forEach(r => { wasteMeta[r.product_id.toLowerCase()] = r; });
  }

  const waste_products = wasteRows.map(r => {
    const m = wasteMeta[r.product_item_id.toLowerCase()] || {};
    return { item: r.product_item_id, cid: r.campaign_id, clicks: n(r.clicks), cost: n(r.cost),
      imps: n(r.imps), title: m.title||`Product #${r.product_item_id.split('_').pop()}`,
      img: m.image_link||'', url: m.link||'', price: m.price?Number(m.price):null, avail: m.availability||'unknown' };
  });

  const { rows: kwRows } = await client.query(`
    SELECT search_term, campaign_id::text,
      ROUND(SUM(cost)::numeric,2) AS cost, SUM(clicks) AS clicks, SUM(impressions) AS imps
    FROM google_ads.pmax_campaign_search_term_data
    WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3 AND conversions=0
    GROUP BY search_term, campaign_id HAVING SUM(cost)>2 ORDER BY cost DESC
  `, [SJ_CAMPAIGN_IDS, fromDate, toDate]);

  const neg_kw = kwRows.map(r => ({ term: r.search_term, cid: r.campaign_id, cost: n(r.cost),
    clicks: n(r.clicks), imps: n(r.imps),
    ctr: n(r.imps)>0 ? Math.round(n(r.clicks)/n(r.imps)*10000)/100 : 0 }));

  const { rows: bwRows } = await client.query(`
    SELECT campaign_id::text,
      ROUND(SUM(CASE WHEN date BETWEEN $1 AND $2 THEN cost             ELSE 0 END)::numeric,2) AS cost_l,
      ROUND(SUM(CASE WHEN date BETWEEN $1 AND $2 THEN conversion_value ELSE 0 END)::numeric,2) AS cv_l,
      ROUND(SUM(CASE WHEN date BETWEEN $3 AND $4 THEN cost             ELSE 0 END)::numeric,2) AS cost_p,
      ROUND(SUM(CASE WHEN date BETWEEN $3 AND $4 THEN conversion_value ELSE 0 END)::numeric,2) AS cv_p
    FROM google_ads.campaign_performance
    WHERE campaign_id=ANY($5::bigint[]) AND date BETWEEN $3 AND $2
    GROUP BY campaign_id
  `, [fromDate, toDate, prevFrom, prevTo, SJ_CAMPAIGN_IDS]);

  const budget_waste = bwRows.map(r => {
    const cl=n(r.cost_l),cvl=n(r.cv_l),cp=n(r.cost_p),cvp=n(r.cv_p);
    const roas_l=cl>0?Math.round(cvl/cl*10000)/100:0, roas_p=cp>0?Math.round(cvp/cp*10000)/100:0;
    return { cid: r.campaign_id, cost_l:cl, cv_l:cvl, roas_l, cost_p:cp, cv_p:cvp, roas_p,
      cost_chg: cp>0?Math.round((cl-cp)/cp*100):null, is_waste: cl>cp&&roas_l<roas_p };
  });

  const { rows: cpRows } = await client.query(`
    SELECT s.source_name, oii.item_sku,
      COUNT(DISTINCT o.id) AS orders_30d, SUM(CAST(oii.item_quantity AS int)) AS qty_30d,
      (SELECT mp.title FROM google_ads.merchant_products mp
       WHERE LOWER(mp.mpn)=LOWER(oii.item_sku) AND mp.country='GB' LIMIT 1) AS product_title
    FROM order_management.orders o
    JOIN order_management.sub_source ss ON ss.id=o.sub_source_id
    JOIN order_management.source s ON s.id=ss.source_id
    JOIN order_management.order_item_info oii ON oii.order_id=o.id
    WHERE o.order_date>=$1 AND s.source_name IN ('AMAZON','EBAY')
      AND oii.item_sku IS NOT NULL AND oii.item_sku!=''
    GROUP BY s.source_name, oii.item_sku HAVING COUNT(DISTINCT o.id)>=3
    ORDER BY orders_30d DESC LIMIT 15
  `, [fromDate]);

  const { rows: stTopRows } = await client.query(`
    SELECT search_term, SUM(clicks) AS clicks, SUM(impressions) AS imps, ROUND(SUM(cost)::numeric,2) AS cost
    FROM google_ads.pmax_campaign_search_term_data
    WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3
    GROUP BY search_term ORDER BY (SUM(clicks)+SUM(impressions)) DESC LIMIT 300
  `, [SJ_CAMPAIGN_IDS, fromDate, toDate]);

  const STOP = new Set(['the','and','for','with','led','light','watt','pack','set','new','uk','in','a','of','to','cm','mm']);
  function matchTermsForTitle(title) {
    if (!title) return [];
    const words = title.toLowerCase().split(/[\s\-\/]+/).filter(w => w.length>3 && !STOP.has(w));
    if (!words.length) return [];
    return stTopRows.filter(st => words.some(w => st.search_term.toLowerCase().includes(w)))
      .slice(0,5).map(st => ({ term: st.search_term, clicks: n(st.clicks), imps: n(st.imps), cost: n(st.cost) }));
  }

  const cross_platform = cpRows.map(r => ({ source: r.source_name, sku: r.item_sku,
    title: r.product_title||null, orders_30d: n(r.orders_30d), qty_30d: n(r.qty_30d),
    search_terms: matchTermsForTitle(r.product_title) }));

  const d = new Date(toDate);
  const d30=new Date(d); d30.setDate(d30.getDate()-29);
  const d60=new Date(d); d60.setDate(d60.getDate()-59);
  const d90=new Date(d); d90.setDate(d90.getDate()-89);
  const fmt = x => x.toISOString().slice(0,10);

  const { rows: windowRows } = await client.query(`
    SELECT
      ROUND(SUM(CASE WHEN date>=$1 THEN cost             ELSE 0 END)::numeric,2) AS cost_30,
      ROUND(SUM(CASE WHEN date>=$1 THEN conversion_value ELSE 0 END)::numeric,2) AS cv_30,
      ROUND(SUM(CASE WHEN date>=$1 THEN conversions      ELSE 0 END)::numeric,2) AS conv_30,
      ROUND(SUM(CASE WHEN date>=$2 THEN cost             ELSE 0 END)::numeric,2) AS cost_60,
      ROUND(SUM(CASE WHEN date>=$2 THEN conversion_value ELSE 0 END)::numeric,2) AS cv_60,
      ROUND(SUM(CASE WHEN date>=$2 THEN conversions      ELSE 0 END)::numeric,2) AS conv_60,
      ROUND(SUM(CASE WHEN date>=$3 THEN cost             ELSE 0 END)::numeric,2) AS cost_90,
      ROUND(SUM(CASE WHEN date>=$3 THEN conversion_value ELSE 0 END)::numeric,2) AS cv_90,
      ROUND(SUM(CASE WHEN date>=$3 THEN conversions      ELSE 0 END)::numeric,2) AS conv_90
    FROM google_ads.campaign_performance
    WHERE campaign_id=ANY($4::bigint[]) AND date>=$3
  `, [fmt(d30), fmt(d60), fmt(d90), SJ_CAMPAIGN_IDS]);

  const w = windowRows[0] || {};
  const windows = {
    d30: { cost:n(w.cost_30),cv:n(w.cv_30),conv:n(w.conv_30), roas:n(w.cost_30)>0?Math.round(n(w.cv_30)/n(w.cost_30)*10000)/100:0 },
    d60: { cost:n(w.cost_60),cv:n(w.cv_60),conv:n(w.conv_60), roas:n(w.cost_60)>0?Math.round(n(w.cv_60)/n(w.cost_60)*10000)/100:0 },
    d90: { cost:n(w.cost_90),cv:n(w.cv_90),conv:n(w.conv_90), roas:n(w.cost_90)>0?Math.round(n(w.cv_90)/n(w.cost_90)*10000)/100:0 },
  };

  return { waste_products, neg_kw, budget_waste, cross_platform, windows };
}

async function handleSajeepan(req, res) {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) return res.status(500).json({ ok: false, error: 'DATABASE_URL not configured' });

  const client = new Client({ connectionString: connStr, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  try {
    await client.connect();

    let fromDate, toDate;
    if (req.query.from && req.query.to) {
      fromDate = req.query.from; toDate = req.query.to;
    } else {
      const { rows } = await client.query(
        `SELECT MAX(date) AS latest FROM google_ads.campaign_performance WHERE campaign_id=ANY($1::bigint[])`,
        [SJ_CAMPAIGN_IDS]
      );
      const d = new Date(rows[0].latest);
      toDate   = d.toISOString().slice(0,10);
      const f  = new Date(d); f.setDate(f.getDate()-29);
      fromDate = f.toISOString().slice(0,10);
    }

    const spanDays = Math.round((new Date(toDate)-new Date(fromDate))/86400000);
    const prevEnd  = new Date(fromDate); prevEnd.setDate(prevEnd.getDate()-1);
    const prevStart= new Date(prevEnd);  prevStart.setDate(prevStart.getDate()-spanDays);
    const fmt = d => d.toISOString().slice(0,10);
    const prevFrom = fmt(prevStart), prevTo = fmt(prevEnd);

    const type = req.query.type || 'req1';

    if (type === 'req2') {
      const r2 = await handleSajeepanReq2(client, toDate, fromDate, prevFrom, prevTo);
      return res.status(200).json({ ok:true, meta:{from:fromDate,to:toDate,prev_from:prevFrom,prev_to:prevTo}, ...r2 });
    }

    if (type === 'proddetail') {
      const item = (req.query.item || '').trim();
      if (!item) return res.status(400).json({ ok:false, error:'item param required' });
      const detail = await handleSajeepanProdDetail(client, item, fromDate, toDate, prevFrom, prevTo);
      return res.status(200).json({ ok:true, meta:{from:fromDate,to:toDate,prev_from:prevFrom,prev_to:prevTo}, ...detail });
    }

    // req1 — campaign overview + daily trend + products
    const { rows: campRows } = await client.query(`
      SELECT cp.campaign_id, c.campaign_name, c.budget, c.campaign_status,
        ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.cost             ELSE 0 END)::numeric,2) AS cost_l,
        ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.conversions      ELSE 0 END)::numeric,2) AS conv_l,
        ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS cv_l,
        SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.impressions ELSE 0 END) AS imp_l,
        SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.clicks      ELSE 0 END) AS clk_l,
        ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.cost             ELSE 0 END)::numeric,2) AS cost_p,
        ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.conversions      ELSE 0 END)::numeric,2) AS conv_p,
        ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS cv_p,
        SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.impressions ELSE 0 END) AS imp_p,
        SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.clicks      ELSE 0 END) AS clk_p
      FROM google_ads.campaign_performance cp
      JOIN google_ads.campaigns c ON c.campaign_id=cp.campaign_id
      WHERE cp.campaign_id=ANY($5::bigint[]) AND cp.date BETWEEN $3 AND $2
      GROUP BY cp.campaign_id,c.campaign_name,c.budget,c.campaign_status
      ORDER BY cost_l DESC NULLS LAST
    `, [fromDate, toDate, prevFrom, prevTo, SJ_CAMPAIGN_IDS]);

    const { rows: trendRows } = await client.query(`
      SELECT date, ROUND(SUM(cost)::numeric,2) AS cost,
        ROUND(SUM(conversion_value)::numeric,2) AS cv, ROUND(SUM(conversions)::numeric,2) AS conv
      FROM google_ads.campaign_performance
      WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3
      GROUP BY date ORDER BY date ASC
    `, [SJ_CAMPAIGN_IDS, fromDate, toDate]);

    const { rows: perfRows } = await client.query(`
      SELECT pp.product_item_id, pp.campaign_id::text AS campaign_id,
        SUM(pp.impressions) AS imp, SUM(pp.clicks) AS clk,
        ROUND(SUM(pp.cost)::numeric,2) AS cost, ROUND(SUM(pp.conversions)::numeric,4) AS conv,
        ROUND(SUM(pp.conversion_value)::numeric,2) AS cv
      FROM google_ads.product_performance pp
      WHERE pp.campaign_id=ANY($1::bigint[]) AND pp.date BETWEEN $2 AND $3 AND pp.product_item_id!=''
      GROUP BY pp.product_item_id, pp.campaign_id ORDER BY cv DESC LIMIT 500
    `, [SJ_CAMPAIGN_IDS, fromDate, toDate]);

    const ids = perfRows.map(r => r.product_item_id.toLowerCase());
    let metaMap = {};
    if (ids.length > 0) {
      const { rows: metaRows } = await client.query(`
        SELECT DISTINCT ON (LOWER(product_id)) product_id, title, image_link, link, price, availability,
          brand, mpn AS sku, feed_label, product_category AS category, product_types AS ptype, custom_label3 AS label3
        FROM google_ads.merchant_products WHERE LOWER(product_id)=ANY($1::text[])
        ORDER BY LOWER(product_id)
      `, [ids]);
      metaRows.forEach(m => { metaMap[m.product_id.toLowerCase()] = m; });
    }

    const n = v => Number(v) || 0;
    const campaigns = campRows.map(r => {
      const cost_l=n(r.cost_l),cv_l=n(r.cv_l),conv_l=n(r.conv_l),imp_l=n(r.imp_l),clk_l=n(r.clk_l);
      const cost_p=n(r.cost_p),cv_p=n(r.cv_p),conv_p=n(r.conv_p);
      const id = String(r.campaign_id);
      return { id, name:r.campaign_name, status:r.campaign_status, budget:r.budget?Number(r.budget):null,
        target_roas: SJ_TARGET_ROAS[id]||300,
        l:   { cost:cost_l,cv:cv_l,conv:conv_l,imp:imp_l,clk:clk_l, roas:cost_l>0?Math.round(cv_l/cost_l*10000)/100:0 },
        prev:{ cost:cost_p,cv:cv_p,conv:conv_p, roas:cost_p>0?Math.round(cv_p/cost_p*10000)/100:0 } };
    });

    const trend = trendRows.map(r => ({ d:r.date.toISOString().slice(5,10).replace('-','/'),
      cost:n(r.cost),cv:n(r.cv),conv:n(r.conv),
      roas:n(r.cost)>0?Math.round(n(r.cv)/n(r.cost)*10000)/100:0 }));

    const products = perfRows.map(r => {
      const meta=metaMap[r.product_item_id.toLowerCase()]||{};
      const cost=n(r.cost),cv=n(r.cv),conv=n(r.conv),imp=n(r.imp),clk=n(r.clk);
      return { item:r.product_item_id, cid:r.campaign_id, cost, cv, conv, imps:imp, clicks:clk,
        roas:cost>0?Math.round(cv/cost*10000)/100:0,
        title:meta.title||`Product #${r.product_item_id.split('_').pop()}`,
        img:meta.image_link||'', url:meta.link||'', price:meta.price?Number(meta.price):null,
        avail:meta.availability||'unknown', brand:meta.brand||'LEDSone', type:meta.ptype||'Lighting',
        sku:meta.sku||null, feed_label:meta.feed_label||null, cat:meta.category||null, label3:meta.label3||null };
    });

    return res.status(200).json({ ok:true,
      meta:{from:fromDate,to:toDate,prev_from:prevFrom,prev_to:prevTo,total_products:products.length},
      campaigns, trend, products });

  } catch (err) {
    return errResponse(res, err);
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── SONYA ────────────────────────────────────────────────────────────────────

function makeSonyaClient(connStr, timeout) {
  return new Client({ connectionString: connStr, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000, statement_timeout: timeout || 30000 });
}

async function handleSonyaDailyOrders(req, res) {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) return res.status(500).json({ ok: false, error: 'DATABASE_URL not configured' });

  const client = new Client({ connectionString: connStr, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000, statement_timeout: 55000 });
  try {
    await client.connect();

    let targetDate;
    if (req.query.date) {
      targetDate = req.query.date;
    } else {
      const { rows: maxRows } = await client.query(
        `SELECT DATE(MAX(order_date)) - INTERVAL '1 day' AS d FROM order_management.orders`
      );
      targetDate = maxRows[0].d.toISOString().slice(0, 10);
    }

    const l7Start = new Date(targetDate); l7Start.setDate(l7Start.getDate() - 6);
    const l7From  = l7Start.toISOString().slice(0, 10);

    const { rows: summaryRows } = await client.query(`
      SELECT COUNT(DISTINCT o.id) AS total_uk_orders,
        COUNT(DISTINCT o.id) FILTER (WHERE ss.source_id=3) AS ledsone_uk_orders
      FROM order_management.orders o
      LEFT JOIN order_management.sub_source ss ON ss.id=o.sub_source_id
      WHERE DATE(o.order_date)=$1 AND o.market_place='23'
    `, [targetDate]);

    const summary = { total_uk_orders: Number(summaryRows[0].total_uk_orders),
      ledsone_uk_orders: Number(summaryRows[0].ledsone_uk_orders),
      date: targetDate, refreshed_at: new Date().toISOString() };

    const { rows: orderRows } = await client.query(`
      SELECT oi.real_sku AS sku, ss.name AS sub_source, ss.source_id,
        SUM(oi.item_quantity::int) AS qty, MAX(oi.item_price::numeric) AS sold_price,
        MAX(oi.item_img) AS image, MAX(oi.item_title) AS title
      FROM order_management.orders o
      JOIN order_management.order_item_info oi ON oi.order_id=o.id
      LEFT JOIN order_management.sub_source ss ON ss.id=o.sub_source_id
      WHERE DATE(o.order_date)=$1 AND o.market_place='23'
        AND oi.real_sku IS NOT NULL AND oi.real_sku<>''
      GROUP BY oi.real_sku, ss.name, ss.source_id
      ORDER BY SUM(oi.item_quantity::int) DESC
    `, [targetDate]);

    if (!orderRows.length) return res.status(200).json({ ok: true, summary, rows: [] });

    const skus = [...new Set(orderRows.map(r => r.sku))];

    const { rows: stockRows } = await client.query(`
      SELECT ip.sku, SUM(pps.quantity) AS total_stock
      FROM inventory.products ip
      JOIN inventory.physical_product_stock pps ON pps.inventory=ip.id
      WHERE ip.sku=ANY($1::text[]) GROUP BY ip.sku
    `, [skus]);
    const stockMap = {};
    stockRows.forEach(r => { stockMap[r.sku] = Number(r.total_stock); });

    const { rows: listingRows } = await client.query(`
      SELECT DISTINCT ON (sku) sku, price::numeric AS ledsone_uk_price, listing_url AS ledsone_url
      FROM listings.shopify_listings
      WHERE sku=ANY($1::text[]) AND site='UK' AND listing_url ILIKE '%ledsone.co.uk%' AND is_parent=0
      ORDER BY sku, price::numeric ASC
    `, [skus]);
    const listingMap = {};
    listingRows.forEach(r => { listingMap[r.sku] = {
      ledsone_uk_price: r.ledsone_uk_price!==null ? Number(r.ledsone_uk_price) : null,
      ledsone_url: r.ledsone_url || null }; });

    const { rows: l7Rows } = await client.query(`
      SELECT oi.real_sku, SUM(oi.item_quantity::int) AS l7_qty
      FROM order_management.orders o
      JOIN order_management.order_item_info oi ON oi.order_id=o.id
      JOIN order_management.sub_source ss ON ss.id=o.sub_source_id
      WHERE DATE(o.order_date) BETWEEN $1 AND $2 AND o.market_place='23'
        AND oi.real_sku=ANY($3::text[]) AND ss.source_id=3
      GROUP BY oi.real_sku
    `, [l7From, targetDate, skus]);
    const l7Map = {};
    l7Rows.forEach(r => { l7Map[r.real_sku] = Number(r.l7_qty); });

    const rows = orderRows.map(r => {
      const listing = listingMap[r.sku] || {};
      return { sku: r.sku, sub_source: r.sub_source||'—', source_id: Number(r.source_id),
        qty: r.qty!==null?Number(r.qty):null, sold_price: r.sold_price!==null?Number(r.sold_price):null,
        image: r.image||null, title: r.title||'—',
        stock: stockMap[r.sku]!==undefined?stockMap[r.sku]:null,
        ledsone_uk_price: listing.ledsone_uk_price!==undefined?listing.ledsone_uk_price:null,
        ledsone_url: listing.ledsone_url||null, l7_shopify_uk: l7Map[r.sku]||0 };
    });

    return res.status(200).json({ ok: true, summary, rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    await client.end().catch(() => {});
  }
}

async function handleSonyaCampaignPerformance(client, req, res) {
  let fromDate, toDate;
  if (req.query.from && req.query.to) {
    fromDate = req.query.from; toDate = req.query.to;
  } else {
    const { rows } = await client.query(`SELECT MAX(date) AS latest FROM google_ads.campaign_performance`);
    const latest = rows[0].latest;
    if (!latest) throw new Error('No data in google_ads.campaign_performance');
    const d = new Date(latest);
    toDate = d.toISOString().slice(0,10);
    const f = new Date(d); f.setDate(f.getDate()-29);
    fromDate = f.toISOString().slice(0,10);
  }
  const span=Math.round((new Date(toDate)-new Date(fromDate))/86400000);
  const blEnd=new Date(fromDate); blEnd.setDate(blEnd.getDate()-1);
  const blStart=new Date(blEnd); blStart.setDate(blStart.getDate()-span);
  const d60Start=new Date(toDate); d60Start.setDate(d60Start.getDate()-59);
  const d90Start=new Date(toDate); d90Start.setDate(d90Start.getDate()-89);
  const fmt = d => (d instanceof Date?d:new Date(d)).toISOString().slice(0,10);
  const w = { l_from:fromDate, l_to:toDate, bl_from:fmt(blStart), bl_to:fmt(blEnd),
    d60_from:fmt(d60Start), d60_to:toDate, d90_from:fmt(d90Start), d90_to:toDate };

  const { rows: campaigns } = await client.query(`
    SELECT cp.campaign_id, c.campaign_name, c.budget, c.campaign_status,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.cost             ELSE 0 END)::numeric,2) AS l_cost,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.conversions      ELSE 0 END)::numeric,4) AS l_conv,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS l_cv,
      COUNT(DISTINCT CASE WHEN cp.date BETWEEN $1 AND $2 AND cp.cost>0 THEN cp.date END) AS l_days,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.cost             ELSE 0 END)::numeric,2) AS bl_cost,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.conversions      ELSE 0 END)::numeric,4) AS bl_conv,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS bl_cv,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $5 AND $6 THEN cp.cost             ELSE 0 END)::numeric,2) AS d60_cost,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $5 AND $6 THEN cp.conversions      ELSE 0 END)::numeric,4) AS d60_conv,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $5 AND $6 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS d60_cv,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $7 AND $8 THEN cp.cost             ELSE 0 END)::numeric,2) AS d90_cost,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $7 AND $8 THEN cp.conversions      ELSE 0 END)::numeric,4) AS d90_conv,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $7 AND $8 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS d90_cv
    FROM google_ads.campaign_performance cp
    JOIN google_ads.campaigns c ON c.campaign_id=cp.campaign_id
    WHERE (c.campaign_name ILIKE '%Sonya%' OR cp.campaign_id=20810136438) AND cp.date BETWEEN $7 AND $8
    GROUP BY cp.campaign_id,c.campaign_name,c.budget,c.campaign_status
    ORDER BY l_cost DESC NULLS LAST
  `, [w.l_from,w.l_to,w.bl_from,w.bl_to,w.d60_from,w.d60_to,w.d90_from,w.d90_to]);

  const roas=(cost,cv)=>Number(cost)>0?Math.round((Number(cv)/Number(cost))*10000)/100:0;
  const result=campaigns.map(r=>({
    id:String(r.campaign_id),name:r.campaign_name,budget:r.budget?Number(r.budget):null,status:r.campaign_status,
    days:Number(r.l_days),
    l:  {cost:Number(r.l_cost),  conv:Number(r.l_conv),  cv:Number(r.l_cv),  roas:roas(r.l_cost,  r.l_cv)  },
    bl: {cost:Number(r.bl_cost), conv:Number(r.bl_conv), cv:Number(r.bl_cv), roas:roas(r.bl_cost, r.bl_cv) },
    d60:{cost:Number(r.d60_cost),conv:Number(r.d60_conv),cv:Number(r.d60_cv),roas:roas(r.d60_cost,r.d60_cv)},
    d90:{cost:Number(r.d90_cost),conv:Number(r.d90_conv),cv:Number(r.d90_cv),roas:roas(r.d90_cost,r.d90_cv)},
  }));
  return res.status(200).json({ ok:true,
    meta:{...w,total:result.length,active:result.filter(c=>c.l.cost>0).length}, campaigns:result });
}

async function handleSonyaProductPerformance(client, req, res) {
  let fromDate, toDate;
  if (req.query.from && req.query.to) { fromDate=req.query.from; toDate=req.query.to; }
  else {
    const { rows }=await client.query(`SELECT MAX(date) AS latest FROM google_ads.product_performance`);
    const d=new Date(rows[0].latest); toDate=d.toISOString().slice(0,10);
    const f=new Date(d); f.setDate(f.getDate()-59); fromDate=f.toISOString().slice(0,10);
  }
  const { rows: perfRows }=await client.query(`
    SELECT pp.product_item_id, pp.parent_id,
      SUM(pp.impressions) AS impressions, SUM(pp.clicks) AS clicks,
      ROUND(SUM(pp.cost)::numeric,2) AS cost, ROUND(SUM(pp.conversions)::numeric,4) AS conversions,
      ROUND(SUM(pp.conversion_value)::numeric,2) AS conversion_value
    FROM google_ads.product_performance pp
    JOIN google_ads.campaigns c ON c.campaign_id=pp.campaign_id
    WHERE (c.campaign_name ILIKE '%Sonya%' OR pp.campaign_id=20810136438)
      AND pp.date BETWEEN $1 AND $2 AND pp.product_item_id!=''
    GROUP BY pp.product_item_id,pp.parent_id ORDER BY cost DESC LIMIT 3000
  `, [fromDate, toDate]);
  const ids=perfRows.map(r=>r.product_item_id.toLowerCase());
  const { rows: metaRows }=await client.query(`
    SELECT product_id, title, image_link, link, price, availability, mpn AS sku
    FROM google_ads.merchant_products WHERE LOWER(product_id)=ANY($1::text[])
  `, [ids]);
  const metaMap={};
  metaRows.forEach(m=>{ metaMap[m.product_id.toLowerCase()]=m; });
  const products=perfRows.map(r=>{
    const meta=metaMap[r.product_item_id.toLowerCase()]||{};
    return { id:r.product_item_id, parent_id:r.parent_id, title:meta.title||null,
      img:meta.image_link||null, url:meta.link||null, price:meta.price?Number(meta.price):null,
      availability:meta.availability||null, sku:meta.sku||null,
      imp:Number(r.impressions), clk:Number(r.clicks), cost:Number(r.cost),
      conv:Number(r.conversions), cv:Number(r.conversion_value) };
  });
  return res.status(200).json({ ok:true, meta:{from:fromDate,to:toDate,total:products.length}, products });
}

async function handleSonyaTrendPerformance(client, req, res) {
  let fromDate, toDate;
  if (req.query.from && req.query.to) { fromDate=req.query.from; toDate=req.query.to; }
  else {
    const { rows }=await client.query(`SELECT MAX(date) AS latest FROM google_ads.product_performance`);
    const d=new Date(rows[0].latest); toDate=d.toISOString().slice(0,10);
    const f=new Date(d); f.setDate(f.getDate()-29); fromDate=f.toISOString().slice(0,10);
  }
  const spanDays=Math.round((new Date(toDate)-new Date(fromDate))/86400000);
  const blEnd=new Date(fromDate); blEnd.setDate(blEnd.getDate()-1);
  const blStart=new Date(blEnd); blStart.setDate(blStart.getDate()-spanDays);
  const fmt=d=>d.toISOString().slice(0,10);
  const blFrom=fmt(blStart), blTo=fmt(blEnd);
  const { rows: perfRows }=await client.query(`
    SELECT pp.product_item_id, pp.parent_id,
      SUM(CASE WHEN pp.date BETWEEN $1 AND $2 THEN pp.impressions  ELSE 0 END) AS l_imp,
      SUM(CASE WHEN pp.date BETWEEN $1 AND $2 THEN pp.clicks       ELSE 0 END) AS l_clk,
      ROUND(SUM(CASE WHEN pp.date BETWEEN $1 AND $2 THEN pp.cost             ELSE 0 END)::numeric,2) AS l_cost,
      ROUND(SUM(CASE WHEN pp.date BETWEEN $1 AND $2 THEN pp.conversions      ELSE 0 END)::numeric,4) AS l_conv,
      ROUND(SUM(CASE WHEN pp.date BETWEEN $1 AND $2 THEN pp.conversion_value ELSE 0 END)::numeric,2) AS l_cv,
      SUM(CASE WHEN pp.date BETWEEN $3 AND $4 THEN pp.impressions  ELSE 0 END) AS bl_imp,
      SUM(CASE WHEN pp.date BETWEEN $3 AND $4 THEN pp.clicks       ELSE 0 END) AS bl_clk,
      ROUND(SUM(CASE WHEN pp.date BETWEEN $3 AND $4 THEN pp.cost             ELSE 0 END)::numeric,2) AS bl_cost,
      ROUND(SUM(CASE WHEN pp.date BETWEEN $3 AND $4 THEN pp.conversions      ELSE 0 END)::numeric,4) AS bl_conv,
      ROUND(SUM(CASE WHEN pp.date BETWEEN $3 AND $4 THEN pp.conversion_value ELSE 0 END)::numeric,2) AS bl_cv
    FROM google_ads.product_performance pp
    JOIN google_ads.campaigns c ON c.campaign_id=pp.campaign_id
    WHERE (c.campaign_name ILIKE '%Sonya%' OR pp.campaign_id=20810136438)
      AND pp.date BETWEEN $3 AND $2 AND pp.product_item_id!=''
    GROUP BY pp.product_item_id,pp.parent_id ORDER BY l_cost DESC, bl_cost DESC LIMIT 3000
  `, [fromDate, toDate, blFrom, blTo]);
  const ids=perfRows.map(r=>r.product_item_id.toLowerCase());
  const { rows: metaRows }=await client.query(`
    SELECT product_id, mpn AS sku FROM google_ads.merchant_products WHERE LOWER(product_id)=ANY($1::text[])
  `, [ids]);
  const metaMap={};
  metaRows.forEach(m=>{ metaMap[m.product_id.toLowerCase()]=m; });
  const li=n=>Number(n)||0;
  const products=perfRows.map(r=>{
    const meta=metaMap[r.product_item_id.toLowerCase()]||{};
    const l_imp=li(r.l_imp),l_clk=li(r.l_clk),l_cost=li(r.l_cost),l_conv=li(r.l_conv),l_cv=li(r.l_cv);
    const bl_imp=li(r.bl_imp),bl_clk=li(r.bl_clk),bl_cost=li(r.bl_cost),bl_conv=li(r.bl_conv),bl_cv=li(r.bl_cv);
    let trend='None';
    if (bl_cv>0) { if (l_cv>bl_cv*1.1) trend='Seasonal'; else if (l_cv<bl_cv*0.7) trend='Drop-off'; }
    return { id:r.product_item_id, parent_id:r.parent_id, sku:meta.sku||null, trend,
      l:  {imp:l_imp, clk:l_clk, cost:l_cost, conv:l_conv, cv:l_cv,
           ctr:l_imp>0?Math.round(l_clk/l_imp*10000)/100:0, cvr:l_clk>0?Math.round(l_conv/l_clk*10000)/100:0, roas:l_cost>0?Math.round(l_cv/l_cost*10000)/100:0},
      bl: {imp:bl_imp,clk:bl_clk,cost:bl_cost,conv:bl_conv,cv:bl_cv,
           ctr:bl_imp>0?Math.round(bl_clk/bl_imp*10000)/100:0,cvr:bl_clk>0?Math.round(bl_conv/bl_clk*10000)/100:0,roas:bl_cost>0?Math.round(bl_cv/bl_cost*10000)/100:0} };
  });
  return res.status(200).json({ ok:true, meta:{from:fromDate,to:toDate,bl_from:blFrom,bl_to:blTo,total:products.length}, products });
}

async function handleSonyaOpportunity(client, req, res) {
  let fromDate, toDate;
  if (req.query.from && req.query.to) { fromDate=req.query.from; toDate=req.query.to; }
  else {
    const { rows }=await client.query(`SELECT MAX(order_date)::date AS latest FROM order_management.orders`);
    const d=new Date(rows[0].latest); toDate=d.toISOString().slice(0,10);
    const f=new Date(d); f.setDate(f.getDate()-29); fromDate=f.toISOString().slice(0,10);
  }
  const { rows: salesRows }=await client.query(`
    SELECT oi.real_sku AS sku,
      SUM(CASE WHEN s.source_name='AMAZON'                       THEN oi.item_quantity::numeric ELSE 0 END) AS amz,
      SUM(CASE WHEN s.source_name='EBAY'                         THEN oi.item_quantity::numeric ELSE 0 END) AS ebay,
      SUM(CASE WHEN s.source_name='B&Q'                          THEN oi.item_quantity::numeric ELSE 0 END) AS bq,
      SUM(CASE WHEN s.source_name='SHOPIFY'                      THEN oi.item_quantity::numeric ELSE 0 END) AS shopify,
      SUM(CASE WHEN s.source_name IN ('MANUAL OM','MANUALORDER') THEN oi.item_quantity::numeric ELSE 0 END) AS manual,
      SUM(oi.item_quantity::numeric) AS combined
    FROM order_management.orders o
    JOIN order_management.sub_source ss ON ss.id=o.sub_source_id
    JOIN order_management.source s ON s.id=ss.source_id
    JOIN order_management.order_item_info oi ON oi.order_id=o.id
    WHERE o.order_date::date BETWEEN $1 AND $2
      AND o.status NOT IN ('Canceled','Cancelled','Refunded','Deleted')
      AND s.source_name IN ('AMAZON','EBAY','B&Q','SHOPIFY','MANUAL OM','MANUALORDER')
      AND oi.real_sku IS NOT NULL AND oi.real_sku!=''
    GROUP BY oi.real_sku HAVING SUM(oi.item_quantity::numeric)>2 ORDER BY combined DESC LIMIT 500
  `, [fromDate, toDate]);
  if (!salesRows.length) return res.status(200).json({ ok:true, meta:{from:fromDate,to:toDate,total:0}, products:[] });
  const skus=salesRows.map(r=>r.sku);
  const [listingRes,stockRes,mpRes]=await Promise.all([
    client.query(`SELECT DISTINCT ON (sku) sku,title,main_image_url,listing_url,price::numeric AS price FROM listings.shopify_listings WHERE sku=ANY($1::text[]) AND site='UK' ORDER BY sku,(listing_url ILIKE '%ledsone.co.uk%') DESC`, [skus]),
    client.query(`SELECT p.sku, SUM(ps.quantity) AS stock FROM inventory.products p JOIN inventory.physical_product_stock ps ON ps.inventory::varchar=p.id::varchar WHERE p.sku=ANY($1::text[]) GROUP BY p.sku`, [skus]),
    client.query(`SELECT mpn AS sku, product_id FROM google_ads.merchant_products WHERE mpn=ANY($1::text[])`, [skus]),
  ]);
  const listingMap={}, stockMap={};
  listingRes.rows.forEach(l=>{ listingMap[l.sku]=l; });
  stockRes.rows.forEach(s=>{ stockMap[s.sku]=Number(s.stock)||0; });
  const allProductIds=[...new Set(mpRes.rows.map(m=>m.product_id.toLowerCase()))];
  let adsMap={};
  if (allProductIds.length>0) {
    const { rows: adsRows }=await client.query(`
      SELECT pp.product_item_id,
        SUM(pp.impressions) AS imp, SUM(pp.clicks) AS clk,
        ROUND(SUM(pp.cost)::numeric,2) AS cost, ROUND(SUM(pp.conversions)::numeric,4) AS conv,
        ROUND(SUM(pp.conversion_value)::numeric,2) AS cv
      FROM google_ads.product_performance pp
      JOIN google_ads.campaigns c ON c.campaign_id=pp.campaign_id
      WHERE (c.campaign_name ILIKE '%Sonya%' OR pp.campaign_id=20810136438)
        AND pp.date BETWEEN $1 AND $2 AND LOWER(pp.product_item_id)=ANY($3::text[])
      GROUP BY pp.product_item_id
    `, [fromDate, toDate, allProductIds]);
    adsRows.forEach(a=>{
      const pid=a.product_item_id.toLowerCase();
      mpRes.rows.forEach(m=>{
        if (m.product_id.toLowerCase()===pid) {
          const sku=m.sku;
          if (!adsMap[sku]) adsMap[sku]={imp:0,clk:0,cost:0,conv:0,cv:0};
          adsMap[sku].imp  += Number(a.imp)  ||0;
          adsMap[sku].clk  += Number(a.clk)  ||0;
          adsMap[sku].cost += Number(a.cost)  ||0;
          adsMap[sku].conv += Number(a.conv)  ||0;
          adsMap[sku].cv   += Number(a.cv)    ||0;
        }
      });
    });
  }
  const products=salesRows.map(r=>{
    const listing=listingMap[r.sku]||{};
    const ads=adsMap[r.sku]||{imp:0,clk:0,cost:0,conv:0,cv:0};
    return { sku:r.sku, amz:Number(r.amz)||0, ebay:Number(r.ebay)||0, bq:Number(r.bq)||0,
      shopify:Number(r.shopify)||0, manual:Number(r.manual)||0, combined:Number(r.combined)||0,
      imp:ads.imp, clk:ads.clk, cost:Math.round(ads.cost*100)/100, conv:Math.round(ads.conv*10000)/10000,
      cv:Math.round(ads.cv*100)/100, img:listing.main_image_url||null, url:listing.listing_url||null,
      title:listing.title||null, price:listing.price?Number(listing.price):null, stock:stockMap[r.sku]||0 };
  });
  return res.status(200).json({ ok:true, meta:{from:fromDate,to:toDate,total:products.length}, products });
}

async function handleSonyaStopWasteSpend(client, req, res) {
  const { rows: dateRows }=await client.query(`SELECT MAX(date) AS latest FROM google_ads.campaign_performance`);
  const latest=new Date(dateRows[0].latest);
  const toDate=latest.toISOString().slice(0,10);
  const fmt=d=>d.toISOString().slice(0,10);
  const l30Start=new Date(latest); l30Start.setDate(l30Start.getDate()-29);
  const p30End  =new Date(l30Start); p30End.setDate(p30End.getDate()-1);
  const p30Start=new Date(p30End);   p30Start.setDate(p30Start.getDate()-29);
  const p60Start=new Date(p30End);   p60Start.setDate(p60Start.getDate()-30);
  const d90Start=new Date(latest);   d90Start.setDate(d90Start.getDate()-89);
  const w={ l30_from:fmt(l30Start),l30_to:toDate, p30_from:fmt(p30Start),p30_to:fmt(p30End),
    p60_from:fmt(p60Start),p60_to:fmt(p30End), d90_from:fmt(d90Start),d90_to:toDate };

  const { rows: campRows }=await client.query(`
    SELECT cp.campaign_id, c.campaign_name, c.budget, c.campaign_status,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.cost             ELSE 0 END)::numeric,2) AS cost30,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.conversions      ELSE 0 END)::numeric,2) AS conv30,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS cv30,
      SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.impressions ELSE 0 END) AS imp30,
      SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.clicks      ELSE 0 END) AS clk30,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.cost             ELSE 0 END)::numeric,2) AS cost60,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.conversions      ELSE 0 END)::numeric,2) AS conv60,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS cv60,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $5 AND $6 THEN cp.cost             ELSE 0 END)::numeric,2) AS cost90,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $5 AND $6 THEN cp.conversions      ELSE 0 END)::numeric,2) AS conv90,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $5 AND $6 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS cv90
    FROM google_ads.campaign_performance cp
    JOIN google_ads.campaigns c ON c.campaign_id=cp.campaign_id
    WHERE (c.campaign_name ILIKE '%Sonya%' OR cp.campaign_id=20810136438) AND cp.date BETWEEN $7 AND $2
    GROUP BY cp.campaign_id,c.campaign_name,c.budget,c.campaign_status ORDER BY cost30 DESC NULLS LAST
  `, [w.l30_from,w.l30_to,w.p30_from,w.p30_to,w.p60_from,w.p60_to,w.d90_from]);

  let assetsByCamp={};
  try {
    const { rows: assetRows }=await client.query(`
      SELECT ap.campaign_id::text AS campaign_id, ap.asset_id::text AS asset_id,
        ROUND(SUM(ap.cost)::numeric,2) AS cost, SUM(ap.clicks) AS clicks
      FROM google_ads.asset_performance ap
      JOIN google_ads.campaigns c ON c.campaign_id::text=ap.campaign_id::text
      WHERE (c.campaign_name ILIKE '%Sonya%' OR c.campaign_id=20810136438)
        AND ap.date BETWEEN $1 AND $2 AND ap.conversions<0.001
      GROUP BY ap.campaign_id,ap.asset_id HAVING SUM(ap.cost)>3 AND SUM(ap.clicks)>2
      ORDER BY SUM(ap.cost) DESC
    `, [w.d90_from,w.d90_to]);
    assetRows.forEach(a=>{ if (!assetsByCamp[a.campaign_id]) assetsByCamp[a.campaign_id]=[];
      assetsByCamp[a.campaign_id].push({asset_id:a.asset_id,cost:Number(a.cost),clicks:Number(a.clicks)}); });
  } catch(e) { console.error('asset_performance query failed:',e.message); }

  let kwByCamp={};
  try {
    const { rows: kwRows }=await client.query(`
      SELECT st.campaign_id::text AS campaign_id, st.search_term,
        SUM(st.clicks) AS clicks, ROUND(SUM(st.cost)::numeric,2) AS cost
      FROM google_ads.pmax_campaign_search_term_data st
      JOIN google_ads.campaigns c ON c.campaign_id::text=st.campaign_id::text
      WHERE (c.campaign_name ILIKE '%Sonya%' OR c.campaign_id=20810136438)
        AND st.date BETWEEN $1 AND $2 AND st.conversions<0.001
      GROUP BY st.campaign_id,st.search_term HAVING SUM(st.clicks)>5
      ORDER BY SUM(st.clicks) DESC
    `, [w.d90_from,w.d90_to]);
    kwRows.forEach(k=>{ if (!kwByCamp[k.campaign_id]) kwByCamp[k.campaign_id]=[];
      kwByCamp[k.campaign_id].push(k.search_term); });
  } catch(e) { console.error('pmax search term query failed:',e.message); }

  const campaigns=campRows.map(r=>({
    name:r.campaign_name, id:String(r.campaign_id), budget:r.budget?Number(r.budget):null,
    status:r.campaign_status, cost30:Number(r.cost30), conv30:Number(r.conv30), cv30:Number(r.cv30),
    imp30:Number(r.imp30), clk30:Number(r.clk30), cost60:Number(r.cost60), conv60:Number(r.conv60),
    cv60:Number(r.cv60), cost90:Number(r.cost90), conv90:Number(r.conv90), cv90:Number(r.cv90),
    wasteful_assets:assetsByCamp[String(r.campaign_id)]||[], neg_keywords:kwByCamp[String(r.campaign_id)]||[],
    geo_excludes:[] }));

  return res.status(200).json({ ok:true, meta:w, campaigns });
}

async function handleSonya(req, res) {
  const type = req.query.type || '';

  if (type === 'daily-orders') return handleSonyaDailyOrders(req, res);

  const timeouts = {
    'campaign-performance': 12000, 'product-performance': 20000,
    'trend-performance': 25000, 'opportunity': 25000, 'stop-waste-spend': 30000,
  };
  if (!timeouts[type]) {
    return res.status(400).json({ ok:false, error:`Unknown type "${type}". Valid: daily-orders, ${Object.keys(timeouts).join(', ')}` });
  }

  const connStr = process.env.DATABASE_URL;
  if (!connStr) return res.status(500).json({ ok:false, cause:'missing_env', error:'DATABASE_URL not configured' });

  const client = makeSonyaClient(connStr, timeouts[type]);
  try {
    await client.connect();
    if (type === 'campaign-performance') return await handleSonyaCampaignPerformance(client, req, res);
    if (type === 'product-performance')  return await handleSonyaProductPerformance(client, req, res);
    if (type === 'trend-performance')    return await handleSonyaTrendPerformance(client, req, res);
    if (type === 'opportunity')          return await handleSonyaOpportunity(client, req, res);
    if (type === 'stop-waste-spend')     return await handleSonyaStopWasteSpend(client, req, res);
  } catch (err) {
    return errResponse(res, err);
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── THEEKSHY ─────────────────────────────────────────────────────────────────

const TH_CAMPAIGNS = [23714290257, 23684837882];
const TH_LABELS    = { '23714290257': 'THEE_GEMS', '23684837882': 'THEE_MYSTERY' };

function thCsvCampStatus(roasPct) {
  if (roasPct < 300) return 'critical';
  if (roasPct < 450) return 'monitor';
  return 'healthy';
}

function thCsvProdStatus(roasPct, conv, cost, stockOut) {
  if (stockOut)               return 'paused';
  if (conv === 0 && cost > 0) return 'critical';
  if (roasPct < 300)          return 'critical';
  if (roasPct < 450)          return 'monitor';
  return 'healthy';
}

async function handleTheekshy1(client, fromDate, toDate) {
  const spanDays=Math.round((new Date(toDate)-new Date(fromDate))/86400000);
  const pEnd=new Date(fromDate); pEnd.setDate(pEnd.getDate()-1);
  const pStart=new Date(pEnd); pStart.setDate(pStart.getDate()-spanDays);
  const fmt=d=>d.toISOString().slice(0,10);
  const prevFrom=fmt(pStart), prevTo=fmt(pEnd);

  const { rows: campRows }=await client.query(`
    SELECT cp.campaign_id, c.campaign_name, c.budget, c.campaign_status,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.cost             ELSE 0 END)::numeric,2) AS cost_l,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.conversions      ELSE 0 END)::numeric,4) AS conv_l,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS cv_l,
      SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.impressions ELSE 0 END) AS imp_l,
      SUM(CASE WHEN cp.date BETWEEN $1 AND $2 THEN cp.clicks      ELSE 0 END) AS clk_l,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.cost             ELSE 0 END)::numeric,2) AS cost_p,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.conversions      ELSE 0 END)::numeric,4) AS conv_p,
      ROUND(SUM(CASE WHEN cp.date BETWEEN $3 AND $4 THEN cp.conversion_value ELSE 0 END)::numeric,2) AS cv_p
    FROM google_ads.campaign_performance cp
    JOIN google_ads.campaigns c ON c.campaign_id=cp.campaign_id
    WHERE cp.campaign_id=ANY($5::bigint[]) AND cp.date BETWEEN $3 AND $2
    GROUP BY cp.campaign_id,c.campaign_name,c.budget,c.campaign_status
  `, [fromDate,toDate,prevFrom,prevTo,TH_CAMPAIGNS]);

  const { rows: dailyRows }=await client.query(`
    SELECT date, campaign_id::text AS cid,
      ROUND(SUM(cost)::numeric,2) AS cost, SUM(clicks) AS clicks, SUM(impressions) AS imp,
      ROUND(SUM(conversions)::numeric,4) AS conv, ROUND(SUM(conversion_value)::numeric,2) AS cv
    FROM google_ads.campaign_performance
    WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3
    GROUP BY date,campaign_id ORDER BY date ASC, campaign_id ASC
  `, [TH_CAMPAIGNS,fromDate,toDate]);

  const { rows: perfRows }=await client.query(`
    SELECT pp.product_item_id, pp.campaign_id::text AS cid,
      SUM(pp.impressions) AS imp, SUM(pp.clicks) AS clicks,
      ROUND(SUM(pp.cost)::numeric,2) AS cost, ROUND(SUM(pp.conversions)::numeric,4) AS conv,
      ROUND(SUM(pp.conversion_value)::numeric,2) AS cv
    FROM google_ads.product_performance pp
    WHERE pp.campaign_id=ANY($1::bigint[]) AND pp.date BETWEEN $2 AND $3 AND pp.product_item_id!=''
    GROUP BY pp.product_item_id,pp.campaign_id ORDER BY cost DESC LIMIT 300
  `, [TH_CAMPAIGNS,fromDate,toDate]);

  const ids=perfRows.map(r=>r.product_item_id.toLowerCase());
  let metaMap={};
  if (ids.length>0) {
    const { rows: metaRows }=await client.query(`
      SELECT DISTINCT ON (LOWER(product_id)) product_id, title, image_link, link, price, mpn AS sku
      FROM google_ads.merchant_products WHERE LOWER(product_id)=ANY($1::text[])
      ORDER BY LOWER(product_id)
    `, [ids]);
    metaRows.forEach(m=>{ metaMap[m.product_id.toLowerCase()]=m; });
  }

  const n=v=>Number(v)||0;
  const campaigns=campRows.map(r=>{
    const id=String(r.campaign_id);
    const [cl,vl,nl,il,kl]=[n(r.cost_l),n(r.cv_l),n(r.conv_l),n(r.imp_l),n(r.clk_l)];
    const [cp,vp,np]=[n(r.cost_p),n(r.cv_p),n(r.conv_p)];
    const roasPct=cl>0?Math.round(vl/cl*10000)/100:0;
    return { id, name:r.campaign_name, label:TH_LABELS[id]||id, budget:r.budget?Number(r.budget):null,
      status:r.campaign_status, csvStatus:thCsvCampStatus(roasPct),
      l:{cost:cl,cv:vl,conv:nl,imp:il,clk:kl,roas:roasPct},
      prev:{cost:cp,cv:vp,conv:np,roas:cp>0?Math.round(vp/cp*10000)/100:0} };
  });
  const daily=dailyRows.map(r=>({d:r.date.toISOString().slice(0,10),cid:r.cid,
    cost:n(r.cost),clicks:n(r.clicks),imp:n(r.imp),conv:n(r.conv),cv:n(r.cv)}));
  const products=perfRows.map(r=>{
    const m=metaMap[r.product_item_id.toLowerCase()]||{};
    return {pid:r.product_item_id,cid:r.cid,cost:n(r.cost),clicks:n(r.clicks),
      imp:n(r.imp),conv:n(r.conv),cv:n(r.cv),title:m.title||null,sku:m.sku||null,url:m.link||null};
  });
  return {campaigns,daily,products,meta:{from:fromDate,to:toDate,prev_from:prevFrom,prev_to:prevTo}};
}

async function handleTheekshy2(client, fromDate, toDate) {
  const { rows }=await client.query(`
    SELECT LOWER(TRIM(search_term)) AS term, campaign_id::text AS cid,
      SUM(impressions) AS imp, SUM(clicks) AS clk,
      ROUND(SUM(conversions)::numeric,4) AS conv, ROUND(SUM(conversions_value)::numeric,2) AS cv,
      ROUND(SUM(cost)::numeric,2) AS cost, match_type
    FROM google_ads.pmax_campaign_search_term_data
    WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3
    GROUP BY LOWER(TRIM(search_term)),campaign_id,match_type
    HAVING SUM(clicks)>0 OR SUM(cost)>0
    ORDER BY cost DESC NULLS LAST, clk DESC LIMIT 200
  `, [TH_CAMPAIGNS,fromDate,toDate]);
  const n=v=>Number(v)||0;
  const terms=rows.map(r=>[r.term,r.cid,n(r.imp),n(r.clk),n(r.conv),n(r.cv),n(r.cost),r.match_type||'PMax']);
  return {terms,meta:{from:fromDate,to:toDate}};
}

async function handleTheekshy3(client, fromDate, toDate) {
  const { rows: perfRows }=await client.query(`
    SELECT pp.product_item_id, pp.campaign_id::text AS cid,
      SUM(pp.impressions) AS impr, SUM(pp.clicks) AS clicks,
      ROUND(SUM(pp.cost)::numeric,2) AS cost, ROUND(SUM(pp.conversions)::numeric,4) AS conv,
      ROUND(SUM(pp.conversion_value)::numeric,2) AS cv
    FROM google_ads.product_performance pp
    WHERE pp.campaign_id=ANY($1::bigint[]) AND pp.date BETWEEN $2 AND $3 AND pp.product_item_id!=''
    GROUP BY pp.product_item_id,pp.campaign_id ORDER BY cost DESC LIMIT 200
  `, [TH_CAMPAIGNS,fromDate,toDate]);

  const ids=perfRows.map(r=>r.product_item_id.toLowerCase());
  if (ids.length===0) return {products:[],meta:{from:fromDate,to:toDate}};

  let gmcMap={}, shopMap={}, invMap={};
  try {
    const { rows: gmcRows }=await client.query(`
      SELECT DISTINCT ON (LOWER(product_id)) product_id, title, availability, price, currency, mpn AS sku, image_link, link
      FROM google_ads.merchant_products WHERE LOWER(product_id)=ANY($1::text[])
      ORDER BY LOWER(product_id),(CASE WHEN currency='GBP' THEN 0 ELSE 1 END)
    `, [ids]);
    gmcRows.forEach(m=>{ gmcMap[m.product_id.toLowerCase()]={title:m.title,gmc_avail:m.availability,
      gmc_price:m.price?Number(m.price):null,gmc_currency:m.currency||null,sku:m.sku,img:m.image_link||'',url:m.link||''}; });
  } catch(e) {}

  try {
    const { rows: shopRows }=await client.query(`
      SELECT DISTINCT ON (sl.item_id::text) sl.item_id::text AS variant_id, sl.sku,
        sl.title AS variant_title, sl.price AS shop_price, sl.status AS shop_status, sl.listing_url AS url
      FROM listings.shopify_listings sl
      WHERE sl.site='UK' AND sl.item_id::text=ANY($1::text[])
      ORDER BY sl.item_id::text,(CASE WHEN sl.listing_url ILIKE '%ledsone.co.uk%' THEN 0 ELSE 1 END)
    `, [ids]);
    shopRows.forEach(r=>{ shopMap[r.variant_id]={sku:r.sku,vtitle:r.variant_title,
      shop_price:r.shop_price?Number(r.shop_price):null,shop_status:r.shop_status,url:r.url}; });
  } catch(e) {}

  try {
    const skus=Object.values(shopMap).map(r=>r.sku).filter(Boolean);
    if (skus.length>0) {
      const { rows: invRows }=await client.query(`
        SELECT p.sku, SUM(ps.quantity::numeric)::int AS total_stock
        FROM inventory.products p JOIN inventory.physical_product_stock ps ON ps.inventory::varchar=p.id::varchar
        WHERE p.sku=ANY($1::text[]) GROUP BY p.sku
      `, [skus]);
      invRows.forEach(r=>{ invMap[r.sku]=r.total_stock; });
    }
  } catch(e) {}

  const n=v=>Number(v)||0;
  const products=perfRows.map(r=>{
    const id=r.product_item_id;
    const gmc=gmcMap[id.toLowerCase()]||{};
    const shop=shopMap[id]||{};
    const sku=shop.sku||gmc.sku||null;
    const inv=sku?(invMap[sku]!==undefined?invMap[sku]:null):null;
    let gmc_note='';
    if (!gmc.gmc_avail&&!gmc.gmc_price) gmc_note='No GMC record';
    else if (!shop.shop_price) gmc_note='No Shopify variant price/stock — parent product';
    else if (gmc.gmc_currency&&gmc.gmc_currency!=='GBP') gmc_note=gmc.gmc_currency+' record only — UK GBP price unverifiable';
    return {id,cid:r.cid,cost:n(r.cost),clicks:n(r.clicks),impr:n(r.impr),conv:n(r.conv),cv:n(r.cv),
      title:gmc.title||null,sku,img:gmc.img||'',url:shop.url||gmc.url||'',
      shop_price:shop.shop_price||null,shop_stock:inv,shop_status:shop.shop_status||'active',
      gmc_avail:gmc.gmc_avail||null,gmc_price:gmc.gmc_price||null,gmc_currency:gmc.gmc_currency||null,gmc_note,
      vtitle:shop.vtitle||null,camp:r.cid==='23714290257'?'THEE_GEMS':'THEE_MYSTERY',
      inv,gmc_p:gmc.gmc_price||null,upd:toDate};
  });
  return {products,meta:{from:fromDate,to:toDate}};
}

async function handleTheekshy4(client, fromDate, toDate) {
  const { rows: perfRows }=await client.query(`
    SELECT pp.product_item_id, pp.campaign_id::text AS cid,
      SUM(pp.impressions) AS imp, SUM(pp.clicks) AS clicks,
      ROUND(SUM(pp.cost)::numeric,2) AS cost, ROUND(SUM(pp.conversions)::numeric,4) AS conv,
      ROUND(SUM(pp.conversion_value)::numeric,2) AS cv
    FROM google_ads.product_performance pp
    WHERE pp.campaign_id=ANY($1::bigint[]) AND pp.date BETWEEN $2 AND $3 AND pp.product_item_id!=''
    GROUP BY pp.product_item_id,pp.campaign_id ORDER BY cost DESC LIMIT 300
  `, [TH_CAMPAIGNS,fromDate,toDate]);

  const ids=perfRows.map(r=>r.product_item_id.toLowerCase());
  if (ids.length===0) return {products:[],ga4_available:false,meta:{from:fromDate,to:toDate}};

  let gmcMap={}, shopMap={}, invMap={};
  try {
    const { rows: gmcRows }=await client.query(`
      SELECT DISTINCT ON (LOWER(product_id)) product_id, title, availability, price, currency, mpn AS sku, image_link
      FROM google_ads.merchant_products WHERE LOWER(product_id)=ANY($1::text[])
      ORDER BY LOWER(product_id),(CASE WHEN currency='GBP' THEN 0 ELSE 1 END)
    `, [ids]);
    gmcRows.forEach(m=>{ gmcMap[m.product_id.toLowerCase()]={title:m.title,avail:m.availability,
      price:m.price?Number(m.price):null,sku:m.sku,img:m.image_link||''}; });
  } catch(e) {}

  try {
    const { rows: shopRows }=await client.query(`
      SELECT DISTINCT ON (sl.item_id::text) sl.item_id::text AS variant_id, sl.sku, sl.status AS shop_status
      FROM listings.shopify_listings sl WHERE sl.site='UK' AND sl.item_id::text=ANY($1::text[])
      ORDER BY sl.item_id::text
    `, [ids]);
    shopRows.forEach(r=>{ shopMap[r.variant_id]={sku:r.sku,shop_status:r.shop_status}; });
  } catch(e) {}

  try {
    const skus=Object.values(shopMap).map(r=>r.sku).filter(Boolean);
    if (skus.length>0) {
      const { rows: invRows }=await client.query(`
        SELECT p.sku, SUM(ps.quantity::numeric)::int AS total_stock
        FROM inventory.products p JOIN inventory.physical_product_stock ps ON ps.inventory::varchar=p.id::varchar
        WHERE p.sku=ANY($1::text[]) GROUP BY p.sku
      `, [skus]);
      invRows.forEach(r=>{ invMap[r.sku]=r.total_stock; });
    }
  } catch(e) {}

  const n=v=>Number(v)||0;
  const products=perfRows.map(r=>{
    const gmc=gmcMap[r.product_item_id.toLowerCase()]||{};
    const shop=shopMap[r.product_item_id]||{};
    const sku=shop.sku||gmc.sku||null;
    const stock=sku?(invMap[sku]!==undefined?invMap[sku]:null):null;
    const cost=n(r.cost),conv=n(r.conv),cv=n(r.cv);
    const roasPct=cost>0?Math.round(cv/cost*10000)/100:0;
    const stockOut=stock!==null&&stock===0;
    const csvStatus=thCsvProdStatus(roasPct,conv,cost,stockOut);
    const conditions=[];
    if (stockOut)              conditions.push('Out of Stock');
    else if (conv===0&&cost>0) conditions.push('High Spend / 0 Conversions');
    else if (roasPct<300)      conditions.push('ROAS Below Target (<3.0×)');
    else if (roasPct<450)      conditions.push('ROAS Borderline (3.0–4.5×)');
    else                       conditions.push('ROAS Healthy (≥4.5×)');
    return {pid:r.product_item_id,cid:r.cid,cost,clicks:n(r.clicks),imp:n(r.imp),
      conv,cv,roas:roasPct,title:gmc.title||null,sku,img:gmc.img||'',
      gmc_avail:gmc.avail||null,stock,csvStatus,conditions,
      camp:r.cid==='23714290257'?'THEE_GEMS':'THEE_MYSTERY'};
  });
  return {products,ga4_available:false,meta:{from:fromDate,to:toDate}};
}

async function handleTheekshy(req, res) {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) return res.status(500).json({ ok: false, error: 'DATABASE_URL not configured' });
  const type = req.query.type || 'req1';

  const client = new Client({ connectionString: connStr, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000, statement_timeout: 50000 });
  try {
    await client.connect();

    let fromDate, toDate;
    if (req.query.from && req.query.to) {
      fromDate = req.query.from; toDate = req.query.to;
    } else {
      const { rows }=await client.query(
        `SELECT MAX(date) AS latest FROM google_ads.campaign_performance WHERE campaign_id=ANY($1::bigint[])`,
        [TH_CAMPAIGNS]
      );
      const d=new Date(rows[0].latest);
      toDate=d.toISOString().slice(0,10);
      const f=new Date(d); f.setDate(f.getDate()-29);
      fromDate=f.toISOString().slice(0,10);
    }

    let result;
    if      (type==='req1')    result=await handleTheekshy1(client,fromDate,toDate);
    else if (type==='req2')    result=await handleTheekshy2(client,fromDate,toDate);
    else if (type==='feed')    result=await handleTheekshy3(client,fromDate,toDate);
    else if (type==='prodopt') result=await handleTheekshy4(client,fromDate,toDate);
    else return res.status(400).json({ ok:false, error:'Unknown type: '+type });

    return res.status(200).json({ ok:true, ...result });
  } catch (err) {
    return errResponse(res, err);
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── THIVAJINI ────────────────────────────────────────────────────────────────

const TV_CAMPAIGNS = [23103582865, 23533025729, 23405519670];
const TV_CAMP_LABELS = {
  '23103582865': 'Topsell',
  '23533025729': 'Imp_Click',
  '23405519670': 'Best Sellers',
};
const TV_LOW_STOCK = 5;
const TV_HERO_CLICKS = 6;

function tvClassify(imp, clicks, conv, cost, cv) {
  if (imp === 0)    return 'Zombie';
  if (clicks === 0) return 'Low Engagement';
  const roas = cost > 0 ? (cv / cost) * 100 : 0;
  if (conv > 0) {
    if (roas >= 400 && clicks >= TV_HERO_CLICKS) return 'Hero';
    if (roas >= 400)  return 'Green';
    if (roas >= 300)  return 'Amber';
    if (roas >= 250)  return 'Orange';
    return 'High Priority Cut';
  }
  if (clicks >= 5) return 'Bleeding';
  return 'Monitor Cut';
}

const TV_UTM_TO_LABEL = {
  'tr-pmax-topsell':     'Topsell',
  'pmax_allproduct':     'Imp_Click',
  'pmax_bestselling_tr': 'Best Sellers',
};

function tvIsoWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function tvFetchShopifyUTMOrders(fromDate, toDate) {
  const token = (process.env.SHOPIFY_FR_ADMIN_TOKEN || process.env.SHOPIFY_FR_TOKEN);
  if (!token) return {};

  const QUERY = `
    query($cursor: String, $query: String!) {
      orders(first: 50, after: $cursor, query: $query) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name createdAt
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          customerJourneySummary {
            firstVisit { utmParameters { source medium campaign } }
            lastVisit  { utmParameters { source medium campaign } }
            moments(first: 20) {
              nodes { ... on CustomerVisit { utmParameters { source medium campaign } } }
            }
          }
        }
      }
    }`;

  const shopifyRequest = (variables) => new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: QUERY, variables });
    const options = {
      hostname: 'ledsone-fra.myshopify.com',
      path: '/admin/api/2024-10/graphql.json',
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-Shopify-Access-Token':token,
        'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });

  const byWeekCamp = {};
  let cursor = null, pages = 0;
  const queryStr = `created_at:>=${fromDate} created_at:<=${toDate} financial_status:paid`;
  do {
    const result = await shopifyRequest({ cursor, query: queryStr });
    const ordersPage = result?.data?.orders;
    if (!ordersPage) break;
    for (const order of ordersPage.nodes) {
      const journey = order.customerJourneySummary;
      if (!journey) continue;
      const touchpoints = [];
      if (journey.firstVisit?.utmParameters) touchpoints.push(journey.firstVisit.utmParameters);
      if (journey.moments?.nodes) { for (const m of journey.moments.nodes) { if (m?.utmParameters) touchpoints.push(m.utmParameters); } }
      if (journey.lastVisit?.utmParameters) touchpoints.push(journey.lastVisit.utmParameters);
      let lastGoogleCampaign = null;
      for (const tp of touchpoints) { if (tp.source==='google_ads'&&tp.medium==='cpc') lastGoogleCampaign=tp.campaign||null; }
      if (!lastGoogleCampaign) continue;
      const campLabel = TV_UTM_TO_LABEL[lastGoogleCampaign] || lastGoogleCampaign;
      const weekStart = tvIsoWeekStart(order.createdAt);
      const rev = parseFloat(order.currentTotalPriceSet?.shopMoney?.amount || 0);
      const key = `${weekStart}|${campLabel}`;
      if (!byWeekCamp[key]) byWeekCamp[key] = { orders:0, revenue:0 };
      byWeekCamp[key].orders += 1;
      byWeekCamp[key].revenue = Math.round((byWeekCamp[key].revenue + rev) * 100) / 100;
    }
    cursor = ordersPage.pageInfo.hasNextPage ? ordersPage.pageInfo.endCursor : null;
    pages++;
  } while (cursor && pages < 40);
  return byWeekCamp;
}

function tvSplitPart(str, sep, n) { return str.split(sep)[n - 1] || ''; }

async function handleThivajini1(client, fromDate, toDate) {
  const [adsResult, shopUtm] = await Promise.all([
    client.query(`
      SELECT DATE_TRUNC('week',date)::date AS week_start, campaign_id::text AS cid,
        ROUND(SUM(cost)::numeric,2) AS cost, ROUND(SUM(conversions)::numeric,2) AS conv,
        ROUND(SUM(conversion_value)::numeric,2) AS cv, SUM(impressions) AS imp, SUM(clicks) AS clicks
      FROM google_ads.campaign_performance
      WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3
      GROUP BY week_start,campaign_id ORDER BY week_start DESC, campaign_id
    `, [TV_CAMPAIGNS, fromDate, toDate]),
    tvFetchShopifyUTMOrders(fromDate, toDate),
  ]);
  const n = v => Number(v) || 0;
  const weeks = adsResult.rows.map(r => {
    const campLabel = TV_CAMP_LABELS[r.cid] || r.cid;
    const week = r.week_start.toISOString().slice(0, 10);
    const shopData = shopUtm[`${week}|${campLabel}`] || { orders:0, revenue:0 };
    return { week, camp:campLabel, cid:r.cid, ads_conv:n(r.conv), ads_val:n(r.cv),
      cost:n(r.cost), imp:n(r.imp), clicks:n(r.clicks),
      shop_ord:shopData.orders, shop_rev:shopData.revenue };
  });
  const totShopOrd = Object.values(shopUtm).reduce((s,v)=>s+v.orders,0);
  const totShopRev = Math.round(Object.values(shopUtm).reduce((s,v)=>s+v.revenue,0)*100)/100;
  let pass=0,review=0,fail=0,incomplete=0;
  for (const w of weeks) {
    if (w.ads_val===0||w.shop_rev===0) { incomplete++; continue; }
    const ratio=w.ads_val/w.shop_rev;
    if (ratio>=0.95&&ratio<=1.05) pass++;
    else if (ratio>=0.80&&ratio<=1.20) review++;
    else fail++;
  }
  return { weeks, kpi:{shop_ord:totShopOrd,shop_rev:totShopRev,pass,review,fail,incomplete},
    meta:{from:fromDate,to:toDate} };
}

async function handleThivajini2(client, fromDate, toDate) {
  const { rows: perfRows }=await client.query(`
    SELECT product_item_id,
      CASE WHEN product_item_id ILIKE 'shopify_%' THEN SPLIT_PART(LOWER(product_item_id),'_',4)
        ELSE LOWER(product_item_id) END AS variant_id,
      SUM(impressions) AS imp, SUM(clicks) AS clicks,
      ROUND(SUM(cost)::numeric,2) AS cost, ROUND(SUM(conversions)::numeric,4) AS conv,
      ROUND(SUM(conversion_value)::numeric,2) AS cv
    FROM google_ads.product_performance
    WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3 AND product_item_id!=''
    GROUP BY product_item_id ORDER BY cost DESC LIMIT 800
  `, [TV_CAMPAIGNS, fromDate, toDate]);

  const fullIds    = perfRows.map(r=>r.product_item_id.toLowerCase());
  const variantIds = perfRows.map(r=>r.variant_id);
  const allLookups = [...new Set([...fullIds,...variantIds])];
  const parentIdsJs= [...new Set(perfRows.filter(r=>r.product_item_id.toLowerCase().startsWith('shopify_'))
    .map(r=>tvSplitPart(r.product_item_id.toLowerCase(),'_',3)))];

  let metaMap={}, parentMap={};
  if (allLookups.length>0) {
    const { rows: metaRows }=await client.query(`
      SELECT DISTINCT ON (lookup_key) lookup_key, LOWER(product_id) AS pid, title, availability, price::numeric AS pr, link AS url
      FROM (
        SELECT product_id, feed_label, title, availability, price, link,
          CASE WHEN product_id ILIKE 'shopify_%' THEN SPLIT_PART(LOWER(product_id),'_',4)
            ELSE LOWER(product_id) END AS lookup_key
        FROM google_ads.merchant_products
        WHERE merchant_id='5551466539' AND currency='EUR'
          AND (LOWER(product_id)=ANY($1::text[]) OR SPLIT_PART(LOWER(product_id),'_',4)=ANY($2::text[]))
      ) sub
      ORDER BY lookup_key, CASE feed_label WHEN 'FR' THEN 0 WHEN 'EUR_16475062347' THEN 1 ELSE 2 END
    `, [allLookups, variantIds]);
    metaRows.forEach(m=>{ if (!metaMap[m.lookup_key]) metaMap[m.lookup_key]=m; if (!metaMap[m.pid]) metaMap[m.pid]=m; });
  }
  if (parentIdsJs.length>0) {
    const { rows: parentRows }=await client.query(`
      SELECT DISTINCT ON (SPLIT_PART(LOWER(product_id),'_',3))
        SPLIT_PART(LOWER(product_id),'_',3) AS parent_key, title, availability, price::numeric AS pr, link AS url
      FROM google_ads.merchant_products
      WHERE merchant_id='5551466539' AND currency='EUR' AND SPLIT_PART(LOWER(product_id),'_',3)=ANY($1::text[])
      ORDER BY SPLIT_PART(LOWER(product_id),'_',3),
        CASE feed_label WHEN 'FR' THEN 0 WHEN 'EUR_16475062347' THEN 1 ELSE 2 END
    `, [parentIdsJs]);
    parentRows.forEach(m=>{ if (!parentMap[m.parent_key]) parentMap[m.parent_key]=m; });
  }

  const unresolvedIds=perfRows.filter(r=>{
    const k=r.product_item_id.toLowerCase().startsWith('shopify_')?tvSplitPart(r.product_item_id.toLowerCase(),'_',4):r.product_item_id.toLowerCase();
    const pk=tvSplitPart(r.product_item_id.toLowerCase(),'_',3);
    return !metaMap[k]&&!metaMap[r.product_item_id.toLowerCase()]&&!parentMap[pk];
  }).map(r=>r.product_item_id);

  let shopifyMap={};
  if (unresolvedIds.length>0) {
    try {
      const { rows: shopRows }=await client.query(`
        SELECT v.item_id::text AS vid, p.title, v.listing_url AS url, v.price::numeric AS pr, v.status AS availability
        FROM listings.shopify_listings v
        JOIN listings.shopify_listings p
          ON SPLIT_PART(v.listing_url,'?',1)=SPLIT_PART(p.listing_url,'/',1)||'//'||SPLIT_PART(p.listing_url,'/',3)||'/products/'||SPLIT_PART(p.listing_url,'/',5)
          AND p.site='France' AND p.is_parent=1
        WHERE v.site='France' AND v.is_parent=0 AND v.item_id::text=ANY($1::text[])
        UNION ALL
        SELECT p.item_id::text AS vid, p.title, p.listing_url AS url, p.price::numeric AS pr, p.status AS availability
        FROM listings.shopify_listings p WHERE p.site='France' AND p.is_parent=1 AND p.item_id::text=ANY($1::text[])
      `, [unresolvedIds]);
      shopRows.forEach(r=>{ shopifyMap[r.vid]=r; });
    } catch(e) {}
  }

  const n=v=>Number(v)||0;
  const products=perfRows.map(r=>{
    const lookupKey=r.product_item_id.toLowerCase().startsWith('shopify_')?tvSplitPart(r.product_item_id.toLowerCase(),'_',4):r.product_item_id.toLowerCase();
    const parentKey=tvSplitPart(r.product_item_id.toLowerCase(),'_',3);
    const m=metaMap[lookupKey]||metaMap[r.product_item_id.toLowerCase()]||parentMap[parentKey]||shopifyMap[r.product_item_id]||{};
    const imp=n(r.imp),clicks=n(r.clicks),cost=n(r.cost),conv=n(r.conv),cv=n(r.cv);
    const price=m.pr?Number(m.pr):0;
    const ctr =imp   >0?Math.round(clicks/imp  *10000)/100:0;
    const cvr =clicks>0?Math.round(conv/clicks *10000)/100:0;
    const roas=cost  >0?Math.round(cv/cost     *10000)/100:0;
    const spp =price >0?Math.round(cost/price  *1000) /10 :0;
    return { id:r.product_item_id, t:m.title||'Unknown', url:m.url||'', av:m.availability||'unknown',
      pr:price, im:imp, cl:clicks, sp:cost, or:conv, sa:cv, ctr, cvr, roas, spp,
      seg:tvClassify(imp,clicks,conv,cost,cv) };
  });
  return {products,meta:{from:fromDate,to:toDate}};
}

async function handleThivajini3(client, fromDate, toDate) {
  const { rows: perfRows }=await client.query(`
    SELECT product_item_id,
      CASE WHEN product_item_id ILIKE 'shopify_%' THEN SPLIT_PART(LOWER(product_item_id),'_',4)
        ELSE LOWER(product_item_id) END AS variant_id,
      MIN(campaign_id::text) AS cid,
      SUM(impressions) AS imp, SUM(clicks) AS clicks,
      ROUND(SUM(cost)::numeric,2) AS cost, ROUND(SUM(conversions)::numeric,4) AS conv,
      ROUND(SUM(conversion_value)::numeric,2) AS cv
    FROM google_ads.product_performance
    WHERE campaign_id=ANY($1::bigint[]) AND date BETWEEN $2 AND $3 AND product_item_id!=''
    GROUP BY product_item_id ORDER BY cost DESC LIMIT 400
  `, [TV_CAMPAIGNS, fromDate, toDate]);

  const fullIds3   =perfRows.map(r=>r.product_item_id.toLowerCase());
  const variantIds =perfRows.map(r=>r.variant_id);
  const allLookups3=[...new Set([...fullIds3,...variantIds])];
  let shopMap={}, invMap={}, gmcMap={};

  if (allLookups3.length>0) {
    try {
      const { rows: shopRows }=await client.query(`
        SELECT DISTINCT ON (item_id::text) item_id::text AS vid, sku, title, status, listing_url AS url, price::numeric AS shop_price
        FROM listings.shopify_listings WHERE site='France' AND item_id::text=ANY($1::text[])
        ORDER BY item_id::text
      `, [variantIds]);
      shopRows.forEach(r=>{ shopMap[r.vid]=r; });
    } catch(e) {}

    try {
      const skus=Object.values(shopMap).map(r=>r.sku).filter(Boolean);
      if (skus.length>0) {
        const { rows: invRows }=await client.query(`
          SELECT p.sku, SUM(ps.quantity::numeric)::int AS stock
          FROM inventory.products p JOIN inventory.physical_product_stock ps ON ps.inventory::varchar=p.id::varchar
          WHERE p.sku=ANY($1::text[]) GROUP BY p.sku
        `, [skus]);
        invRows.forEach(r=>{ invMap[r.sku]=r.stock; });
      }
    } catch(e) {}

    try {
      const { rows: gmcRows }=await client.query(`
        SELECT DISTINCT ON (LOWER(product_id)) LOWER(product_id) AS pid, title, availability, price::numeric AS pr, link AS url
        FROM google_ads.merchant_products WHERE currency='EUR' AND LOWER(product_id)=ANY($1::text[])
        ORDER BY LOWER(product_id)
      `, [allLookups3]);
      gmcRows.forEach(m=>{ gmcMap[m.pid]=m; });
    } catch(e) {}
  }

  const n=v=>Number(v)||0;
  const products=perfRows.map(r=>{
    const shop=shopMap[r.variant_id]||{};
    const gmc=gmcMap[r.product_item_id.toLowerCase()]||gmcMap[r.variant_id]||{};
    const sku=shop.sku||null;
    const stock=(sku&&invMap[sku]!==undefined)?invMap[sku]:null;
    const spend=n(r.cost);
    let flag='OK', ws=0;
    if (stock===0&&spend>0)                             { flag='STOP';     ws=spend; }
    else if (stock!==null&&stock<=TV_LOW_STOCK)         { flag='ACT SOON'; }
    else if (stock===null||stock===undefined)            { flag='MONITOR';  }
    return { id:r.product_item_id, sku:sku||'', t:shop.title||gmc.title||'',
      camp:TV_CAMP_LABELS[r.cid]||r.cid,
      av:gmc.availability||(shop.status==='active'?'in stock':'')||'',
      url:shop.url||gmc.url||'', pr:gmc.pr?Number(gmc.pr):(shop.shop_price?Number(shop.shop_price):0),
      st:stock, sp:spend, cl:n(r.clicks), or:n(r.conv), cv:n(r.cv), im:n(r.imp), fl:flag, ws };
  });
  return {products,meta:{from:fromDate,to:toDate}};
}

async function handleThivajini4(client, toDate) {
  const from90=addDays(toDate,-89);
  const from60=addDays(toDate,-59);
  const from30=addDays(toDate,-29);

  const { rows: adsRows }=await client.query(`
    SELECT
      CASE WHEN product_item_id ILIKE 'shopify_%' THEN SPLIT_PART(LOWER(product_item_id),'_',4)
        ELSE LOWER(product_item_id) END AS variant_id,
      ROUND(SUM(CASE WHEN date>=$2 THEN conversions ELSE 0 END)::numeric,2) AS ad90,
      ROUND(SUM(CASE WHEN date>=$3 THEN conversions ELSE 0 END)::numeric,2) AS ad60,
      ROUND(SUM(CASE WHEN date>=$4 THEN conversions ELSE 0 END)::numeric,2) AS ad30
    FROM google_ads.product_performance
    WHERE campaign_id=ANY($1::bigint[]) AND date>=$2 AND product_item_id!=''
    GROUP BY variant_id HAVING SUM(conversions)>0 ORDER BY ad90 DESC LIMIT 300
  `, [TV_CAMPAIGNS,from90,from60,from30]);

  const variantIds=adsRows.map(r=>r.variant_id);
  let varToShop={};
  if (variantIds.length>0) {
    const { rows: shopRows }=await client.query(`
      SELECT DISTINCT ON (item_id::text) item_id::text AS vid, sku, title, price::numeric AS pr
      FROM listings.shopify_listings WHERE site='France' AND item_id::text=ANY($1::text[])
      ORDER BY item_id::text
    `, [variantIds]);
    shopRows.forEach(r=>{ varToShop[r.vid]=r; });
  }

  const skus=[...new Set(Object.values(varToShop).map(r=>r.sku).filter(Boolean))];
  let shopOrdMap={};
  if (skus.length>0) {
    const { rows: ordRows }=await client.query(`
      SELECT ii.item_sku AS sku,
        COUNT(CASE WHEN o.order_date::date>=$2 THEN 1 END)::int AS sh90,
        COUNT(CASE WHEN o.order_date::date>=$3 THEN 1 END)::int AS sh60,
        COUNT(CASE WHEN o.order_date::date>=$4 THEN 1 END)::int AS sh30
      FROM order_management.orders o
      JOIN order_management.order_item_info ii ON ii.order_id=o.id
      WHERE o.sub_source_id=233 AND o.order_date::date>=$1 AND ii.item_sku=ANY($5::text[])
      GROUP BY ii.item_sku
    `, [from90,from90,from60,from30,skus]);
    ordRows.forEach(r=>{ shopOrdMap[r.sku]=r; });
  }

  const n=v=>Number(v)||0;
  const products=adsRows.map(r=>{
    const shop=varToShop[r.variant_id]||{};
    const sku=shop.sku||'';
    const ord=shopOrdMap[sku]||{};
    const ad90=n(r.ad90),ad60=n(r.ad60),ad30=n(r.ad30);
    const sh90=n(ord.sh90),sh60=n(ord.sh60),sh30=n(ord.sh30);
    const diff=sh30-ad30, pct=ad30>0?Math.round(sh30/ad30*100):0;
    let st='No Orders';
    if (sh30>0||ad30>0) {
      if (sh30>0&&ad30===0) st='Organic Only';
      else if (ad30>0&&sh30===0) st='Ads Driven';
      else { const ratio=sh30/ad30; if (ratio>=0.8&&ratio<=1.2) st='Balanced'; else if (sh30>ad30) st='Organic Heavy'; else st='Ads Driven'; }
    }
    return {id:r.variant_id,sku,t:shop.title||'',pr:shop.pr?Number(shop.pr):0,sh90,sh60,sh30,ad90,ad60,ad30,diff,pct,st};
  }).filter(p=>p.sh90>0||p.ad90>0);

  return {products,meta:{from:from90,to:toDate}};
}

async function handleThivajini(req, res) {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) return res.status(500).json({ ok: false, error: 'DATABASE_URL not configured' });
  const type = req.query.type || 'req1';

  const client = new Client({ connectionString: connStr, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000, statement_timeout: 55000 });
  try {
    await client.connect();

    let fromDate, toDate;
    if (req.query.from && req.query.to) {
      fromDate = req.query.from; toDate = req.query.to;
    } else {
      const { rows }=await client.query(
        `SELECT MAX(date) AS latest FROM google_ads.campaign_performance WHERE campaign_id=ANY($1::bigint[])`,
        [TV_CAMPAIGNS]
      );
      const d=new Date(rows[0].latest);
      toDate=d.toISOString().slice(0,10);
      const f=new Date(d);
      if (type==='req1') f.setDate(f.getDate()-97);
      else if (type==='req3') f.setDate(f.getDate()-29);
      else f.setDate(f.getDate()-89);
      fromDate=f.toISOString().slice(0,10);
    }

    let result;
    if      (type==='req1') result=await handleThivajini1(client,fromDate,toDate);
    else if (type==='req2') result=await handleThivajini2(client,fromDate,toDate);
    else if (type==='req3') result=await handleThivajini3(client,fromDate,toDate);
    else if (type==='req4') result=await handleThivajini4(client,toDate);
    else return res.status(400).json({ ok:false, error:'Unknown type: '+type });

    return res.status(200).json({ ok:true, ...result });
  } catch (err) {
    return errResponse(res, err);
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const member = req.query.member;
  const type   = req.query.type || 'req1';

  if (!member) return res.status(400).json({ ok: false, error: 'member param required' });

  // ── hetheesha ──────────────────────────────────────────────────────────────
  if (member === 'hetheesha') {
    if (type === 'req2') return handleHetheeshaReq2(req, res);
    return handleHetheeshaReq1(req, res); // req1 + ba handled inside
  }

  // ── jakshan ───────────────────────────────────────────────────────────────
  if (member === 'jakshan') return handleJakshan(req, res);

  // ── sajeepan ──────────────────────────────────────────────────────────────
  if (member === 'sajeepan') return handleSajeepan(req, res);

  // ── sonya ─────────────────────────────────────────────────────────────────
  if (member === 'sonya') return handleSonya(req, res);

  // ── theekshy ──────────────────────────────────────────────────────────────
  if (member === 'theekshy') return handleTheekshy(req, res);

  // ── thivajini ─────────────────────────────────────────────────────────────
  if (member === 'thivajini') return handleThivajini(req, res);

  return res.status(400).json({ ok: false, error: `Unknown member "${member}"` });
};
