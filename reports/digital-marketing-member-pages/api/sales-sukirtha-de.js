// Sukirtha / Mahima — DE Sales (ledsone.de), merged endpoint.
// Server-side only: reads SHOPIFY_ADMIN_TOKEN from env, never exposed to client.
// Read-only Shopify Admin GraphQL API — zero mutations.
//
// Merges the former api/sales-sukirtha-de-organic.js (Sukirtha Organic +
// Mahima Organic + Mahima Ads, via ?staff=) and api/sales-sukirtha-de-email.js
// (Sukirtha Email) into one function to stay under the Vercel Hobby-plan
// 12-function cap (freed a slot for api/jefri/product-status.js, 2026-07-20).
// Routing: ?type=email selects the Email logic below; anything else (including
// no type param, for backward compatibility with existing callers) runs the
// original Organic/Mahima/Mahima-Ads logic unchanged.
//
// Credentials: uses the EXISTING SHOPIFY_ADMIN_TOKEN env var (already used
// by api/sukirtha-req2-duplicate-check.js and api/sukirtha-req3-slow-moving-stock.js
// for ledsone-de.myshopify.com) — NOT SHOPIFY_UK_ADMIN_TOKEN. No new env var.

const fs = require('node:fs');
const path = require('node:path');

const STORE_DOMAIN = 'ledsone-de.myshopify.com';
const API_VERSION = '2024-10';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

// LEDSone FR (ledsone.fr) — added 2026-07-21 for Hetheesha (Organic) and
// Thivagini (Google Ads) tabs. Reuses this same merged function (rather
// than a new api/*.js file) to stay under the Vercel Hobby plan's
// 12-function-per-deployment cap.
const STORE_DOMAIN_FR = 'jedsz8-km.myshopify.com';
const TOKEN_FR = process.env.SHOPIFY_FR_ADMIN_TOKEN;

// ledsone.co.uk — added 2026-07-21 for Sajeepan's Google Ads tab. Reuses
// the existing Vercel env vars already set up for api/sales-sukirtha-uk.js
// (no new credential handling needed) rather than a new file, to stay
// under the Vercel Hobby plan's 12-function-per-deployment cap.
const STORE_DOMAIN_UK = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.myshopify.com';
const TOKEN_UK = process.env.SHOPIFY_UK_ADMIN_TOKEN;
const API_VERSION_UK = process.env.SHOPIFY_UK_API_VERSION || '2024-10';

// Sajeepan (ledsone.co.uk, Google Ads) — utm_term exact match, confirmed by
// user 2026-07-21. Raw values as given, lowercased for case-insensitive
// comparison against Shopify's stored utm_term (ValueTrack placeholders
// like "{keyword}" appear literally unsubstituted in some of her campaigns'
// tracking templates, which is expected/normal for certain ad formats).
const SAJEEPAN_TERMS = new Set([
  'genai&keyword=genai&content=sj',
  '{keyword}',
  'top_sell&keyword=gen2&content=asset',
  'lighting_sj&keyword={keyword}',
  'wall_light&keyword=gen2&content=ads',
  'shopping_sj&keyword={keyword}',
  'unnai_nampu',
].map(s => s.toLowerCase()));

// Europe/Berlin month boundaries, DST-aware.
function berlinOffsetMinutesAt(utcGuessMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcGuessMs)).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asIfUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
  return Math.round((asIfUTC - utcGuessMs) / 60000);
}
function berlinMidnightUTCMs(year, month, day) {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMin = berlinOffsetMinutesAt(guess);
  return guess - offsetMin * 60000;
}

// Hetheesha "No Journey Data" orders (ledsone.fr) manually reassigned to
// Thivagini — added 2026-07-21, per explicit user decision after reviewing
// each order individually. Rule used to select these: order's product had
// at least one real Google Ads click (not just an impression) within the
// 90 days before the order's purchase date (Google's own conversion
// attribution window), cross-checked against google_ads.product_performance.
// Covers Jan–Jul 2026 (the months audited so far). Orders NOT in this set
// stay with Hetheesha even if No Journey Data, since they showed zero click
// evidence of ads influence.
const HETHEESHA_TO_THIVAGINI_NOJOURNEY_ORDERS = new Set([
  'LSFR1158','LSFR1185','LSFR1186','LSFR1187','LSFR1192','LSFR1196','LSFR1208',
  'LSFR1214','LSFR1220','LSFR1221','LSFR1228','LSFR1240','LSFR1253','LSFR1262',
  'LSFR1266','LSFR1269','LSFR1273','LSFR1302','LSFR1306','LSFR1318','LSFR1325',
  'LSFR1331','LSFR1345','LSFR1347','LSFR1351','LSFR1360','LSFR1361','LSFR1362',
  'LSFR1370','LSFR1372','LSFR1381','LSFR1384','LSFR1392','LSFR1417','LSFR1425',
  'LSFR1427','LSFR1444','LSFR1476','LSFR1485','LSFR1497','LSFR1516',
]);

// Product IDs owned by Mahima — excluded from Sukirtha's organic sales,
// included (as the inverse filter) for Mahima's own views. Added 2026-07-17.
const MAHIMA_EXCLUDED_PRODUCT_IDS = new Set([
  '8286052679945','8381824893193','5507042934951','5513782329511','5480332558503',
  '5507047325863','5513782722727','7508068237542','8355709321481','5480361951399',
  '7619294232806','7466313384166','7006724915367','7998062264585','7998062199049',
  '7998061904137','8612709892361','7998061412617','5480738062503','8012214862089',
  '6632516419751','5486934786215','6989854310567','7537557176550','5480981332135',
  '6870920921255','7749516820710','5480395735207','8289213153545','8383897665801',
  '8271132229897','5520880697511','6992923787431','7731010568422','6566984482983',
  '6936826151079','8376006082825','5480334000295','7998062625033','5513782624423',
  '7065927647399','5507043852455','7350738059494','5486938161319','5516144181415',
  '5486933344423','8372521697545','8435472761097','7480820957414','7480820760806',
  '7480820498662','8572342403337','8361778741513','6569749708967','9283267887369',
  '6569749643431','7462310609126','7661314539750','8362591846665','8436318273801',
  '8390575456521','7453053354214','8469268627721','8376010998025','7478074245350',
  '8400739991817','8281108578569','8200007057673','8361815638281','5480337408167',
  '9237971665161','6569749610663','5521367171239','8331150000393','8400686940425',
  '5507042640039','8381691986185','8339850297609','5480366899367','8272907174153',
  '5480335540391','7440026075366','7466313122022','5480339964071','6567565099175',
  '7466490265830','8572342665481','6552458133671','5513782788263','5507046277287',
  '7521039319270','5516152144039','8369388552457','5520880599207','5520879943847',
  '5480365490343','5478888538279','8342427664649','5480376598695','7475067945190',
  '8400772366601','5472939475111','5480976777383','6036833042599','8337690362121',
  '7619294101734','8012214993161','7749515903206','5500475080871','5520879845543',
  '5513782198439','5513782919335','7619293642982','7749516427494','8574868095241',
  '9176808227081','8400768205065','5521359634599','5513783312551','5520880763047',
  '8418518958345','8367598829833','9288900247817','7998062067977','7475067191526',
  '5520879222951','9344479985929','7466313187558','5480363983015','7998062592265',
  '7508068401382','5486935605415','7508068303078','7453053223142','5486936457383',
  '8572341125385','7508068565222','8400675995913','5480977465511','7480820629734',
  '7749518131430','8012213649673','8367605612809','5520879354023','5520879616167',
  '6569441460391','8012212764937','7998061969673','5480368439463','8383669960969',
  '9351657521417','6068983267495','9330470027529','8564200734985','9196442681609',
  '9196377374985','9196456116489','9194603806985','9196402278665','9196402573577',
  '6621424124071','6092832997543','7731023249638','7731002671334','7716587503846',
  '7716593959142','7716586881254','7716587307238','6665539092647','6665538764967',
  '7731019383014','7716587176166','7731023479014','7716591108326','7716587536614',
  '6665538961575','7716593434854','7731009945830','7716592320742','7716592681190',
  '6665539223719','6665539420327','7716592845030','7716592877798','6665539059879',
  '7716590452966','7716590125286','7961816858889','7731014238438','7716590878950',
  '7961816891657','7716591010022','7716591468774','7531194482918','7731025510630',
  '7731007455462','7716591861990','7716590551270','7730998378726','8583949189385',
  '8418533671177','7761979703526','7761979670758','8331802509577','5480385642663',
  '7998061084937','7998061281545','5524161659047','7761983570150','8293611929865',
  '7455030214886','7961817514249','9184496845065','9474489516297','6933352120487',
  '7440025944294','8435487179017','15054110556425','8357059789065','5513782001831',
  '5479690961063','6730863968423','8572343124233','8300005490953','15215686811913',
  '15233788576009','7455031558374','9453450789129','7455032443110','15235093135625',
  '9455269019913','9471058968841','5520488267943','5534617895079','5630712938663',
  '5480980054183','6995828375719','8431854485769','5486942978215','9466461978889',
  '5486934098087','8462025195785','8343612883209','7961819873545','15046364299529',
  '8455500726537','5507044311207','5600320553127','8299988975881','7998062362889',
  '5935512486055','7961819611401','8338775703817','8339889062153','6553840386215',
  '7450918125798','9446507708681','7716586029286','7731004211430','6569746792615',
  '7761982587110','7497034891494','5631708758183','5520410247335','7583348392166',
  '8362770759945','8457665315081','7466489610470','7749517410534','8012214698249',
  '15232555942153','7749515542758','5935501312167','7761977540838','5513783640231',
  '9465324077321','6553839894695','8437005320457','7731021709542','7720988639462',
  '9291247517961','8572340338953','7961817317641','8000636977417','7761985241318',
  '8339849773321','7961820135689','9441554759945','7716586782950','8331707810057',
  '5480359657639','8313469108489','5692514697383','8592451272969','5480384495783',
  '9202380833033','8435484295433','8435469877513','8303245820169','7458469970150',
  '15146546430217','5480981168295','8401575575817','8278561882377','9429863825673',
  '7439972335846','8381418864905','5513783181479','7583305531622','8299607425289',
  '8339856097545','6887874560167','7666187206886','7961819480329','8331720360201',
  '15120745201929','7730985992422','8340699873545','8463390933257','7548244426982',
  '5935051964583','6569750495399','7521039843558','6569747021991','8337718935817',
  '6901482356903','7439972401382','5514426515623','8343569957129','8338907889929',
  '8344894800137','8289540931849','7647450988774','5520411754663','15245264388361',
  '7498055483622','9456814457097','5583784149159','15188088684809','7618943746278',
  '7749518328038','8669236166921','8339902464265','8331740217609','8339935494409',
  '8628364476681','7731024724198','7961822101769','8435478692105','9448534278409',
  '8582185713929','7761977737446','5583773925543','8568591614217','8346071466249',
  '6615511498919','7618944368870','7961821577481','15123461013769','8012215058697',
  '7453133766886','7517026779366','7535845441766','5935510552743','7961822396681',
  '5513782493351','5631369740455','8568591909129','8012212633865','7961821774089',
  '7761980719334','8363975835913','8369408180489','7982941012233','5513782984871',
  '7998062100745','8331702763785','5507045327015','15194685309193','5479707836583',
  '6615511367847','7761977901286','6665527689383','5667424534695','15196804088073',
  '8346064847113','7761979343078','7982941339913','8580103995657','7028795474087',
  '5480357101735','7720988803302','5481829335207','6647334338727','8337053909257',
  '7019946049703','7731001753830','15123776143625','8364068602121','7998061707529',
  '7961817448713','15244893520137','7657255207142','8366658355465','7961819119881',
  '7454958747878','8409575751945','8372588216585','5520414015655','8458527441161',
  '6901461385383','7731018858726','5520414179495','5935497871527','8428123291913',
  '7480820531430','7635916882150','5631513329831','6553841074343','6665540567207',
  '8338831114505','5935498657959','15119507423497','7961818956041','7961819840777',
  '7686953795814','5472946716839','7961822363913','8469311291657','8331102093577',
  '9180569370889','7521082671334','8441592611081','7761978523878','8336521691401',
  '5480390590631','5520413884583','15119516205321','5500466888871','7703102619878',
  '7761978654950','8443084079369','8435484524809','7439344632038','8381382754569',
  '5935885713575','8000636780809','7594289823974','7998061510921','7456822132966',
  '7037784129703','7761981112550','15235115614473','8357097537801','7546463289574',
  '8372503937289','9164666536201','5479684079783','7982941470985','7716589797606',
  '10020225876233','7458468823270','8012213125385','8345058410761','5486944845991',
  '7716589437158','10020299047177','5513782427815','7982941405449','8299937825033',
  '8280383029513','8337659461897','5481830482087','8299339088137','5520880271527',
  '8340648493321','7731022954726','8277590245641','7040362381479','8331725013257',
  '7686953205990','8534629024009','8435601146121','6665527263399','7731012239590',
  '15244858786057','6867745734823','5564995174567','7716591927526','5935050555559',
  '5500468363431','7521039483110','6569745973415','7450918322406','15254950510857',
  '15242520461577','15215912288521','15232628392201','15232747667721','15233780515081',
  '15233784086793','15233796866313','15233805451529','15233810104585','15232678854921',
  '15266279981321','15268536287497','15268537434377','15268538188041','15268538876169',
  '15268539695369','15273617817865','15279442493705','15280983179529','15288294703369',
  '15288346247433','15296877756681','15375209464073','15437828948233','15447261708553',
  '15449517228297','15449535742217','15455791218953','15460030939401','15460184064265',
  '15463838187785','15463871807753','15464711291145','15468990464265','15469063799049',
  '15461523095817','15451784380681','15469042532617','15482393919753','15491192520969',
  '15491260481801','15507378471177','15507839877385','15509378171145','15508370686217',
  '15509907538185','15518244667657','15518688346377','15518691393801','15526893846793',
  '15526856687881','15530799005961','15531364385033','15531364778249','15531365138697',
  '15531370643721','15531371954441','15531548639497','15531570594057','15540622721289',
  '15540633370889','15541355905289','15543358357769','15543464034569','15543470817545',
  '15543490281737','15544121098505','15552530284809','15549971923209','15553158709513',
  '15557664112905','15557672567049','15558088524041','15558109561097','15558132367625',
  '15558520078601','15560074232073','15560633811209','15561573171465','15561574482185',
  '15561582510345','15561965666569','15561966158089','15561966420233','15562061021449',
  '15562810982665','15564357730569','15564383256841','15566009499913','15566416085257',
  '15566417133833','15568503210249','15570201870601','15573156364553','15573156725001',
  '15583268143369','15587485221129','15588362617097','15592551252233','15592553414921',
  '15596145017097','15596162810121','15597113377033','15599511568649','15599572877577',
  '15601580212489','15601580507401','15601580835081','15601581162761','15601581555977',
  '15601584341257','15601590829321','15601596367113','15601599086857','15601602953481',
  '15601617010953','15603655049481','15603655508233','15603989119241','15605135442185',
  '15605170667785','15609593168137','15609599459593','15609599951113','15609602605321',
  '15610679755017','15610680738057','15611665645833','15611679637769','15612061417737',
  '15613253124361','15619948380425','15622457426185','15622463750409','15624480751881',
  '15624482849033','15624581677321','15625171599625','15625184215305','15625212821769',
  '15625230549257','15625301721353','15626020716809','15626044702985','15626060628233',
  '15627438588169','15627443142921','15627452121353','15627474010377','15627485282569',
  '15627491082505','15627503862025','15627506712841','15627527651593','15628294816009',
  '15628298191113','15628301598985','15628329320713','15628367200521','15628374671625',
  '15628388696329',
  '8357095440649','8435480625417','8375907352841','8436361494793',
]);

// Ad-platform source strings shared by Google Ads-family traffic on this
// store (Shopping/Pmax feeds routed through these tools) — classifySession()
// often mislabels these as OTHER/REFERRAL since they aren't recognized paid
// mediums, so this substring-on-source check is the reliable way to detect
// "is this Google Ads family traffic" regardless of that mislabeling.
const GOOGLE_FAMILY_SOURCES = ['google', 'klarna', 'shoptimised', 'shoptimise', 'shoparize'];

// Mahima Ads matching: an order belongs to Mahima's Google Ads sales if its
// first session has "mahi" anywhere in source/medium/campaign/term/content
// (see the mahima-ads branch in the handler below). Superseded an earlier
// exact-code-match-against-a-fixed-list approach on 2026-07-20 after the
// user found real Shopify order data proving many of Mahima's ad mediums
// (klarna, shoptimised, shoptimise1/2/3) weren't being recognized as paid
// search at all under the old logic, silently dropping ~half her orders.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SUPPORTED_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
const CURRENT_LIVE_MONTHS = ['2026-07'];

function resolveReportMonth(monthParam) {
  const month = SUPPORTED_MONTHS.includes(monthParam) ? monthParam : '2026-06';
  const [y, m] = month.split('-').map(Number);
  const startMs = berlinMidnightUTCMs(y, m, 1);
  const monthEndMs = m === 12 ? berlinMidnightUTCMs(y + 1, 1, 1) : berlinMidnightUTCMs(y, m + 1, 1);
  const isLive = CURRENT_LIVE_MONTHS.includes(month);
  const endMs = isLive ? Math.min(monthEndMs, Date.now()) : monthEndMs;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDay = isLive ? Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', day: 'numeric' }).format(new Date(endMs))) : daysInMonth;
  return {
    month, startMs, endMs, isLive,
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(endMs).toISOString(),
    label: isLive ? `${MONTH_NAMES[m - 1]} 1–${endDay} (month to date), ${y}` : `${MONTH_NAMES[m - 1]} 1–${daysInMonth}, ${y}`,
    queryStart: new Date(startMs - 24 * 3600 * 1000).toISOString().slice(0, 10),
    queryEnd: new Date(endMs + 24 * 3600 * 1000).toISOString().slice(0, 10),
  };
}

// ---------- Session classification (shared by Organic and Email) ----------
const SEARCH_ENGINES = ['google', 'bing', 'yahoo', 'duckduckgo', 'ecosia', 'yandex', 'baidu', 'aol', 'ask'];
const PAID_UTM_MEDIUMS = ['cpc', 'ppc', 'paid', 'paid_search', 'paidsearch', 'display', 'shopping', 'paid_social', 'cpv', 'cpm', 'cpa', 'pmax', 'performance_max', 'demandgen', 'demand_gen', 'discovery'];
const PAID_CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'dclid'];
const PAID_UTM_SOURCES = ['google_ads', 'googleads', 'google ads', 'bing_ads', 'bingads', 'facebook_ads', 'meta_ads'];
const PAID_SOURCE_TYPES = ['ad'];

function lower(s) { return (s || '').toString().toLowerCase(); }

function hasPaidEvidence(visit) {
  const utm = visit.utmParameters || {};
  const medium = lower(utm.medium);
  if (PAID_UTM_MEDIUMS.includes(medium)) return `paid utm_medium=${medium}`;
  const utmSource = lower(utm.source);
  if (PAID_UTM_SOURCES.some(s => utmSource.includes(s))) return `paid utm_source=${utm.source}`;
  const urlFields = [visit.referrerUrl, visit.landingPage].filter(Boolean).join(' ').toLowerCase();
  for (const id of PAID_CLICK_IDS) {
    if (urlFields.includes(id + '=')) return `paid click id present: ${id}`;
  }
  const sourceType = lower(visit.sourceType);
  if (PAID_SOURCE_TYPES.includes(sourceType)) return `sourceType=${visit.sourceType} (Shopify's paid-ad marketing tactic classification)`;
  return null;
}

function classifySession(visit) {
  if (!visit) return { classification: 'UNKNOWN', evidence: 'no visit data' };
  const paid = hasPaidEvidence(visit);
  if (paid) return { classification: 'PAID_SEARCH', evidence: paid };

  const source = lower(visit.source);
  const sourceDesc = lower(visit.sourceDescription);
  const sourceType = lower(visit.sourceType);
  const utm = visit.utmParameters || {};
  const medium = lower(utm.medium);
  let referrerHost = '';
  try { referrerHost = visit.referrerUrl ? new URL(visit.referrerUrl).hostname.toLowerCase() : ''; } catch (e) { referrerHost = ''; }

  const looksLikeSearchEngine = SEARCH_ENGINES.some(eng => source.includes(eng) || sourceDesc.includes(eng) || referrerHost.includes(eng));
  const organicSignal = medium === 'organic' || sourceType.includes('organic') || sourceType.includes('seo') || (looksLikeSearchEngine && !medium);

  if (looksLikeSearchEngine && organicSignal) {
    return { classification: 'ORGANIC_SEARCH', evidence: `search engine match (${source || sourceDesc || referrerHost}), medium=${medium || 'none'}` };
  }
  if (looksLikeSearchEngine && !medium && !sourceType) {
    return { classification: 'ORGANIC_SEARCH', evidence: `search engine referrer/source with no paid signal (${source || sourceDesc || referrerHost})` };
  }

  if (source === 'direct' || (!visit.referrerUrl && !visit.source && !medium)) {
    return { classification: 'DIRECT', evidence: source === 'direct' ? 'source="direct"' : 'no referrer, no source, no utm' };
  }
  if (['facebook', 'instagram', 'tiktok', 'twitter', 'x.com', 'pinterest', 'linkedin', 'snapchat'].some(s => source.includes(s) || referrerHost.includes(s)) || medium === 'social') {
    return { classification: 'SOCIAL', evidence: `social platform match (${source || referrerHost})` };
  }
  if (sourceType === 'newsletter' || medium === 'email' || source.includes('email') || sourceDesc.includes('email')) {
    return { classification: 'EMAIL', evidence: sourceType === 'newsletter' ? 'sourceType=NEWSLETTER' : 'email source/medium' };
  }
  if (medium === 'affiliate' || sourceType.includes('affiliate')) {
    return { classification: 'AFFILIATE', evidence: 'affiliate source/medium' };
  }
  if (visit.referrerUrl && !looksLikeSearchEngine) {
    return { classification: 'REFERRAL', evidence: `non-search referrer: ${referrerHost}` };
  }
  if (source || sourceDesc || medium) {
    return { classification: 'OTHER', evidence: `unrecognized source: ${source || sourceDesc || medium}` };
  }
  return { classification: 'UNKNOWN', evidence: 'insufficient evidence' };
}

// ---------- Journey / order classification (ORGANIC variant) ----------
function classifyOrderJourneyOrganic(order) {
  if (order.test) return { status: 'EXCLUDED_TEST_ORDER', reason: 'test=true' };
  if (order.cancelledAt) return { status: 'EXCLUDED_CANCELLED_ORDER', reason: `cancelledAt=${order.cancelledAt}` };

  const cjs = order.customerJourneySummary;
  if (!cjs) return { status: 'NO_JOURNEY_DATA', reason: 'customerJourneySummary is null' };
  if (!cjs.ready) return { status: 'ATTRIBUTION_PENDING', reason: 'customerJourneySummary.ready=false' };

  const moments = (cjs.moments && cjs.moments.edges || []).map(e => e.node).filter(n => n.__typename === 'CustomerVisit');
  const visits = moments.length ? moments : [cjs.firstVisit, cjs.lastVisit].filter(Boolean);
  if (!visits.length) return { status: 'NO_JOURNEY_DATA', reason: 'no CustomerVisit moments and no first/last visit' };

  const classifications = visits.map(v => ({ visit: v, ...classifySession(v) }));
  const first = cjs.firstVisit ? classifySession(cjs.firstVisit) : null;
  const last = cjs.lastVisit ? classifySession(cjs.lastVisit) : null;
  const firstSessionOrganic = !!(first && first.classification === 'ORGANIC_SEARCH');

  if (classifications.some(c => c.classification === 'UNKNOWN')) {
    return { status: 'UNKNOWN_ATTRIBUTION', reason: 'at least one session has insufficient evidence', classifications, first, last, firstSessionOrganic };
  }

  const allOrganic = classifications.every(c => c.classification === 'ORGANIC_SEARCH')
    && first && first.classification === 'ORGANIC_SEARCH'
    && last && last.classification === 'ORGANIC_SEARCH';

  if (allOrganic) {
    return { status: 'FULLY_ORGANIC', reason: 'first, last, and every available session confidently Organic Search', classifications, first, last, firstSessionOrganic };
  }

  const anyOrganic = classifications.some(c => c.classification === 'ORGANIC_SEARCH');
  if (anyOrganic) {
    return { status: 'MIXED_JOURNEY', reason: 'mixture of Organic Search and other channel sessions', classifications, first, last, firstSessionOrganic };
  }
  return { status: 'NON_ORGANIC', reason: 'no qualifying Organic Search session found', classifications, first, last, firstSessionOrganic };
}

function deriveChannel(journey) {
  if (journey.status === 'NO_JOURNEY_DATA') return 'No Journey Data';
  if (journey.status === 'ATTRIBUTION_PENDING') return 'Attribution Pending';
  if (journey.status === 'UNKNOWN_ATTRIBUTION') return 'Unknown';
  if (journey.first) {
    const map = {
      ORGANIC_SEARCH: 'Organic Search', PAID_SEARCH: 'Google Ads / Paid Search', DIRECT: 'Direct',
      SOCIAL: 'Social', EMAIL: 'Email', AFFILIATE: 'Affiliate', REFERRAL: 'Referral', OTHER: 'Other', UNKNOWN: 'Unknown',
    };
    return map[journey.first.classification] || 'Unknown';
  }
  return 'Unknown';
}

// ---------- Journey / order classification (EMAIL variant) ----------
function classifyOrderJourneyEmail(order) {
  if (order.test) return { status: 'EXCLUDED_TEST_ORDER', reason: 'test=true' };
  if (order.cancelledAt) return { status: 'EXCLUDED_CANCELLED_ORDER', reason: `cancelledAt=${order.cancelledAt}` };

  const cjs = order.customerJourneySummary;
  if (!cjs) return { status: 'NO_JOURNEY_DATA', reason: 'customerJourneySummary is null' };
  if (!cjs.ready) return { status: 'ATTRIBUTION_PENDING', reason: 'customerJourneySummary.ready=false' };

  const moments = (cjs.moments && cjs.moments.edges || []).map(e => e.node).filter(n => n.__typename === 'CustomerVisit');
  const visits = moments.length ? moments : [cjs.firstVisit, cjs.lastVisit].filter(Boolean);
  if (!visits.length) return { status: 'NO_JOURNEY_DATA', reason: 'no CustomerVisit moments and no first/last visit' };

  const classifications = visits.map(v => ({ visit: v, ...classifySession(v) }));
  const first = cjs.firstVisit ? classifySession(cjs.firstVisit) : null;
  const last = cjs.lastVisit ? classifySession(cjs.lastVisit) : null;
  const firstSessionEmail = !!(first && first.classification === 'EMAIL');

  if (classifications.some(c => c.classification === 'UNKNOWN')) {
    return { status: 'UNKNOWN_ATTRIBUTION', reason: 'at least one session has insufficient evidence', classifications, first, last, firstSessionEmail };
  }

  const allEmail = classifications.every(c => c.classification === 'EMAIL')
    && first && first.classification === 'EMAIL'
    && last && last.classification === 'EMAIL';

  if (allEmail) {
    return { status: 'FULLY_EMAIL', reason: 'first, last, and every available session confidently Email', classifications, first, last, firstSessionEmail };
  }

  const anyEmail = classifications.some(c => c.classification === 'EMAIL');
  if (anyEmail) {
    return { status: 'MIXED_JOURNEY', reason: 'mixture of Email and other channel sessions', classifications, first, last, firstSessionEmail };
  }
  return { status: 'NON_EMAIL', reason: 'no qualifying Email session found', classifications, first, last, firstSessionEmail };
}

// ---------- Shopify GraphQL ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function shopifyGraphQL(query, variables, retryState, storeDomain, token, apiVersion) {
  const domain = storeDomain || STORE_DOMAIN;
  const authToken = token || TOKEN;
  const version = apiVersion || API_VERSION;
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': authToken },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e) {
      retryState.throttleRetries++;
      await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
      retryState.throttleRetries++;
      await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && Array.isArray(json.errors) && json.errors.some(e => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) {
      retryState.throttleRetries++;
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API: exceeded retries (throttling / transient errors)');
}

const ORDERS_QUERY = `
query SukirthaDEOrders($cursor: String, $query: String!) {
  orders(first: 50, after: $cursor, sortKey: CREATED_AT, query: $query) {
    edges {
      node {
        id
        legacyResourceId
        name
        createdAt
        updatedAt
        cancelledAt
        cancelReason
        test
        displayFinancialStatus
        displayFulfillmentStatus
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        currentTotalDiscountsSet { shopMoney { amount currencyCode } }
        customerJourneySummary {
          ready
          customerOrderIndex
          daysToConversion
          firstVisit {
            id occurredAt landingPage referrerUrl source sourceDescription sourceType referralCode
            utmParameters { source medium campaign term content }
          }
          lastVisit {
            id occurredAt landingPage referrerUrl source sourceDescription sourceType referralCode
            utmParameters { source medium campaign term content }
          }
          moments(first: 100) {
            edges {
              node {
                __typename
                ... on CustomerVisit {
                  id occurredAt landingPage referrerUrl source sourceDescription sourceType referralCode
                  utmParameters { source medium campaign term content }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
        lineItems(first: 100) {
          edges {
            node {
              id name title variantTitle sku quantity refundableQuantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedTotalSet { shopMoney { amount currencyCode } }
              taxLines { priceSet { shopMoney { amount currencyCode } } rate title }
              variant {
                id legacyResourceId title sku
                product { id legacyResourceId title handle }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
        refunds {
          id
          createdAt
          refundLineItems(first: 100) {
            edges {
              node {
                quantity
                lineItem { id }
                subtotalSet { shopMoney { amount currencyCode } }
              }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchOrdersForMonth(monthConfig, retryState, storeDomain, token, apiVersion) {
  const q = `created_at:>=${monthConfig.queryStart} AND created_at:<${monthConfig.queryEnd}`;
  const orders = [];
  let after = null;
  let hasNext = true;
  let pages = 0;
  let rawEdgesSeen = 0;
  while (hasNext) {
    const data = await shopifyGraphQL(ORDERS_QUERY, { cursor: after, query: q }, retryState, storeDomain, token, apiVersion);
    rawEdgesSeen += data.orders.edges.length;
    for (const edge of data.orders.edges) {
      const t = new Date(edge.node.createdAt).getTime();
      if (t >= monthConfig.startMs && t < monthConfig.endMs) orders.push(edge.node);
    }
    hasNext = data.orders.pageInfo.hasNextPage;
    after = data.orders.pageInfo.endCursor;
    pages++;
    if (pages > 200) break;
  }
  return { orders, pages, rawEdgesSeen };
}

// ---------- Financials (store-wide, no product filter unless noted) ----------
function amt(moneySet) { return moneySet ? round2(Number(moneySet.shopMoney.amount)) : 0; }
function ccy(moneySet) { return moneySet ? moneySet.shopMoney.currencyCode : null; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// Fix added 2026-07-21: line-item `discountedTotalSet` frequently comes back
// equal to the undiscounted price even when the order has a real discount
// (confirmed via debugOrderRaw on LSFR1366 — order-level discount code
// applied, but not allocated onto discountedTotalSet on this store's data).
// The order's own currentTotalDiscountsSet IS reliable, so: if per-item
// discounts already sum to less than the order-level discount, distribute
// the shortfall across items proportional to gross share (last item takes
// the rounding remainder so the total always ties out exactly). This makes
// Gross/Net Sales reconcile with Shopify's own Gross Sales/Discounts report.
function reconcileOrderDiscounts(items, order) {
  // currentTotalDiscountsSet is on the same tax-inclusive basis as
  // originalUnitPriceSet (see grossInclTax note above), but item.discounts
  // is already ex-tax at this point — convert using this order's actual
  // blended tax rate (real tax / real ex-tax gross) so units match before
  // allocating the shortfall.
  const orderLevelDiscountInclTax = amt(order.currentTotalDiscountsSet);
  if (orderLevelDiscountInclTax <= 0 || !items.length) return;
  const totalGrossExTax = items.reduce((s, i) => s + i.grossSales, 0);
  const totalTax = items.reduce((s, i) => s + (i.taxes || 0), 0);
  if (totalGrossExTax <= 0) return;
  const blendedRate = totalTax / totalGrossExTax;
  const orderLevelDiscount = round2(orderLevelDiscountInclTax / (1 + blendedRate));
  const itemDiscountSum = round2(items.reduce((s, i) => s + i.discounts, 0));
  const shortfall = round2(orderLevelDiscount - itemDiscountSum);
  if (shortfall <= 0) return;
  let allocated = 0;
  items.forEach((item, idx) => {
    const isLast = idx === items.length - 1;
    const extra = isLast ? round2(shortfall - allocated) : round2(shortfall * (item.grossSales / totalGrossExTax));
    allocated = round2(allocated + extra);
    item.discounts = round2(item.discounts + extra);
    item.netSales = round2(item.grossSales - item.discounts - item.refunds);
  });
}

function buildSukirthaOrderRow(order, journey, staff) {
  const items = [];
  for (const edge of order.lineItems.edges) {
    const li = edge.node;

    const productId = li.variant && li.variant.product ? li.variant.product.legacyResourceId : null;
    if (staff === 'mahima') {
      if (!productId || !MAHIMA_EXCLUDED_PRODUCT_IDS.has(String(productId))) continue;
    } else if (productId && MAHIMA_EXCLUDED_PRODUCT_IDS.has(String(productId))) {
      continue;
    }

    const grossUnit = amt(li.originalUnitPriceSet);
    const grossInclTax = round2(grossUnit * li.quantity);
    // Fix added 2026-07-21: this store's prices are tax-inclusive (confirmed
    // via debugOrderRaw on LSFR1366 — FR TVA 20% taxLines present), but
    // Shopify's own Gross Sales/Net Sales report always excludes tax. Without
    // this, our Gross Sales overstated Shopify's report by the full VAT
    // amount on every line item. Subtract the line item's own taxLines here
    // so grossSales matches Shopify's Gross Sales report basis exactly.
    const tax = round2((li.taxLines || []).reduce((s, t) => s + amt(t.priceSet), 0));
    const gross = round2(grossInclTax - tax);
    const discounted = amt(li.discountedTotalSet);
    const discountInclTax = round2(Math.max(0, grossInclTax - discounted));
    const itemTaxRate = grossInclTax > 0 ? tax / (grossInclTax - tax || 1) : 0;
    const discount = round2(discountInclTax / (1 + itemTaxRate));

    let refund = 0;
    for (const rEdge of (order.refunds || [])) {
      for (const rliEdge of (rEdge.refundLineItems && rEdge.refundLineItems.edges || [])) {
        const rli = rliEdge.node;
        if (rli.lineItem && rli.lineItem.id === li.id) refund += amt(rli.subtotalSet);
      }
    }
    refund = round2(refund);

    items.push({
      lineItemId: li.id,
      productTitle: li.title,
      productId: li.variant && li.variant.product ? li.variant.product.legacyResourceId : null,
      variantTitle: li.variantTitle,
      variantId: li.variant ? li.variant.legacyResourceId : null,
      sku: li.sku,
      quantity: li.quantity,
      grossSales: gross,
      taxes: tax,
      discounts: discount,
      refunds: refund,
      netSales: round2(gross - discount - refund),
      currency: ccy(li.originalUnitPriceSet),
    });
  }
  if (!items.length) return null;
  reconcileOrderDiscounts(items, order);

  return {
    orderId: order.id,
    orderLegacyId: order.legacyResourceId,
    orderName: order.name,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    orderTotal: amt(order.currentTotalPriceSet),
    currency: ccy(order.currentTotalPriceSet),
    journeyStatus: journey.status,
    journeyReason: journey.reason,
    journeyReady: order.customerJourneySummary ? order.customerJourneySummary.ready : false,
    customerOrderIndex: order.customerJourneySummary ? order.customerJourneySummary.customerOrderIndex : null,
    daysToConversion: order.customerJourneySummary ? order.customerJourneySummary.daysToConversion : null,
    firstVisit: order.customerJourneySummary ? order.customerJourneySummary.firstVisit : null,
    lastVisit: order.customerJourneySummary ? order.customerJourneySummary.lastVisit : null,
    sessions: (journey.classifications || []).map((c, i) => ({
      sessionNumber: i + 1,
      visitId: c.visit.id,
      occurredAt: c.visit.occurredAt,
      classification: c.classification,
      evidence: c.evidence,
      source: c.visit.source,
      sourceDescription: c.visit.sourceDescription,
      sourceType: c.visit.sourceType,
      referrerUrl: c.visit.referrerUrl,
      landingPage: c.visit.landingPage,
      referralCode: c.visit.referralCode,
      utm: c.visit.utmParameters,
    })),
    matchedItems: items,
  };
}

// Email variant of the row builder: store-wide, no product filter at all
// (matches the original api/sales-sukirtha-de-email.js exactly).
function buildSukirthaOrderRowEmail(order, journey) {
  const items = [];
  for (const edge of order.lineItems.edges) {
    const li = edge.node;

    const grossUnit = amt(li.originalUnitPriceSet);
    const grossInclTax = round2(grossUnit * li.quantity);
    // Fix added 2026-07-21: this store's prices are tax-inclusive (confirmed
    // via debugOrderRaw on LSFR1366 — FR TVA 20% taxLines present), but
    // Shopify's own Gross Sales/Net Sales report always excludes tax. Without
    // this, our Gross Sales overstated Shopify's report by the full VAT
    // amount on every line item. Subtract the line item's own taxLines here
    // so grossSales matches Shopify's Gross Sales report basis exactly.
    const tax = round2((li.taxLines || []).reduce((s, t) => s + amt(t.priceSet), 0));
    const gross = round2(grossInclTax - tax);
    const discounted = amt(li.discountedTotalSet);
    const discountInclTax = round2(Math.max(0, grossInclTax - discounted));
    const itemTaxRate = grossInclTax > 0 ? tax / (grossInclTax - tax || 1) : 0;
    const discount = round2(discountInclTax / (1 + itemTaxRate));

    let refund = 0;
    for (const rEdge of (order.refunds || [])) {
      for (const rliEdge of (rEdge.refundLineItems && rEdge.refundLineItems.edges || [])) {
        const rli = rliEdge.node;
        if (rli.lineItem && rli.lineItem.id === li.id) refund += amt(rli.subtotalSet);
      }
    }
    refund = round2(refund);

    items.push({
      lineItemId: li.id,
      productTitle: li.title,
      productId: li.variant && li.variant.product ? li.variant.product.legacyResourceId : null,
      variantTitle: li.variantTitle,
      variantId: li.variant ? li.variant.legacyResourceId : null,
      sku: li.sku,
      quantity: li.quantity,
      grossSales: gross,
      taxes: tax,
      discounts: discount,
      refunds: refund,
      netSales: round2(gross - discount - refund),
      currency: ccy(li.originalUnitPriceSet),
    });
  }
  if (!items.length) return null;
  reconcileOrderDiscounts(items, order);

  return {
    orderId: order.id,
    orderLegacyId: order.legacyResourceId,
    orderName: order.name,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    orderTotal: amt(order.currentTotalPriceSet),
    currency: ccy(order.currentTotalPriceSet),
    journeyStatus: journey.status,
    journeyReason: journey.reason,
    journeyReady: order.customerJourneySummary ? order.customerJourneySummary.ready : false,
    customerOrderIndex: order.customerJourneySummary ? order.customerJourneySummary.customerOrderIndex : null,
    daysToConversion: order.customerJourneySummary ? order.customerJourneySummary.daysToConversion : null,
    firstVisit: order.customerJourneySummary ? order.customerJourneySummary.firstVisit : null,
    lastVisit: order.customerJourneySummary ? order.customerJourneySummary.lastVisit : null,
    sessions: (journey.classifications || []).map((c, i) => ({
      sessionNumber: i + 1,
      visitId: c.visit.id,
      occurredAt: c.visit.occurredAt,
      classification: c.classification,
      evidence: c.evidence,
      source: c.visit.source,
      sourceDescription: c.visit.sourceDescription,
      sourceType: c.visit.sourceType,
      referrerUrl: c.visit.referrerUrl,
      landingPage: c.visit.landingPage,
      referralCode: c.visit.referralCode,
      utm: c.visit.utmParameters,
    })),
    matchedItems: items,
  };
}

// ---------- Simple in-memory cache (per warm Lambda instance only) ----------
const CACHE = new Map();
const CACHE_TTL_MS = 55 * 1000;

function summarizeRows(rows) {
  let unitsSold = 0, grossSales = 0, discounts = 0, refunds = 0, orderTotalSum = 0;
  const uniqueProducts = new Set();
  const currencies = new Set();
  for (const row of rows) {
    for (const item of row.matchedItems) {
      unitsSold += item.quantity;
      grossSales += item.grossSales;
      discounts += item.discounts;
      refunds += item.refunds;
      uniqueProducts.add(item.productId);
      if (item.currency) currencies.add(item.currency);
    }
    orderTotalSum += row.orderTotal || 0;
  }
  grossSales = round2(grossSales);
  discounts = round2(discounts);
  refunds = round2(refunds);
  orderTotalSum = round2(orderTotalSum);
  const netSales = round2(grossSales - discounts - refunds);
  const currency = currencies.size === 1 ? [...currencies][0] : (currencies.size === 0 ? 'EUR' : 'MIXED');
  const multiCurrencyWarning = currencies.size > 1 ? [...currencies] : null;
  return {
    ordersCount: rows.length, unitsSold, grossSales, discounts, refunds, netSales,
    // orderTotalSum = real Shopify order total (product + tax + shipping),
    // summed from each order's currentTotalPriceSet. grossSales/netSales
    // above are product-line-only (Shopify Sales-channel convention used
    // everywhere on this page) and will NOT match Shopify's own order
    // total/admin reports — orderTotalSum is the one that reconciles.
    orderTotalSum,
    averageRevenuePerOrder: rows.length ? round2(netSales / rows.length) : 0,
    uniqueProductsSold: uniqueProducts.size, currency, multiCurrencyWarning,
  };
}

async function handleEmail(req, res, monthConfig, forceRefresh, startTime) {
  const cacheKey = 'email:' + monthConfig.month;
  const cached = CACHE.get(cacheKey);
  if (!forceRefresh && cached && (Date.now() - cached.generatedAt) < CACHE_TTL_MS) {
    res.status(200).json({ ...cached.data, meta: { ...cached.data.meta, cacheStatus: 'hit' } });
    return;
  }

  if (!forceRefresh) {
    const staticPath = path.join(__dirname, 'data', `sukirtha-de-email-sales-${monthConfig.month}.json`);
    if (fs.existsSync(staticPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
      const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
      CACHE.set(cacheKey, { data: payload, generatedAt: Date.now() });
      res.status(200).json(payload);
      return;
    }
  }

  const retryState = { throttleRetries: 0 };
  const { orders, pages } = await fetchOrdersForMonth(monthConfig, retryState);

  const classificationCounts = {
    fullyEmail: 0, mixedJourney: 0, nonEmail: 0, attributionPending: 0,
    noJourneyData: 0, unknownAttribution: 0, excludedCancelled: 0, excludedTest: 0,
    firstSessionEmail: 0,
  };

  const fullyEmailRows = [];
  const firstSessionEmailRows = [];

  for (const order of orders) {
    const journey = classifyOrderJourneyEmail(order);
    const row = buildSukirthaOrderRowEmail(order, journey);
    if (!row) continue;
    row.channel = journey.first ? journey.first.classification : 'Unknown';

    const isFirstSessionEmailBucket = journey.firstSessionEmail && (journey.status === 'MIXED_JOURNEY' || journey.status === 'NON_EMAIL');

    if (journey.status === 'FULLY_EMAIL') {
      fullyEmailRows.push(row);
      classificationCounts.fullyEmail++;
    } else if (isFirstSessionEmailBucket) {
      row.journeyStatus = 'FIRST_SESSION_EMAIL';
      firstSessionEmailRows.push(row);
      classificationCounts.firstSessionEmail++;
    } else {
      switch (journey.status) {
        case 'MIXED_JOURNEY': classificationCounts.mixedJourney++; break;
        case 'NON_EMAIL': classificationCounts.nonEmail++; break;
        case 'ATTRIBUTION_PENDING': classificationCounts.attributionPending++; break;
        case 'NO_JOURNEY_DATA': classificationCounts.noJourneyData++; break;
        case 'UNKNOWN_ATTRIBUTION': classificationCounts.unknownAttribution++; break;
        case 'EXCLUDED_CANCELLED_ORDER': classificationCounts.excludedCancelled++; break;
        case 'EXCLUDED_TEST_ORDER': classificationCounts.excludedTest++; break;
      }
    }
  }

  const fullyEmailSummary = summarizeRows(fullyEmailRows);
  const firstSessionEmailSummary = summarizeRows(firstSessionEmailRows);
  const combinedSummary = summarizeRows([...fullyEmailRows, ...firstSessionEmailRows]);

  fullyEmailRows.forEach(r => { r.group = 'Fully Email'; });
  firstSessionEmailRows.forEach(r => { r.group = 'First-Session Email'; });
  const allSukirthaOrders = [...fullyEmailRows, ...firstSessionEmailRows];

  const { grossSales, discounts, refunds, netSales, currency, multiCurrencyWarning } = fullyEmailSummary;

  const responsePayload = {
    success: true,
    staff: { name: 'Sukirtha', department: 'Email Marketing', store: 'ledsone.de' },
    reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
    supportedMonths: SUPPORTED_MONTHS,
    isLive: monthConfig.isLive,
    source: {
      scope: 'store-wide — every order counts, no product allocation / matching (mirrors sales-sukirtha-uk.js, DE store)',
      orders: 'Shopify Admin GraphQL API',
      journey: 'Shopify customerJourneySummary',
    },
    summary: {
      fullyEmailOrders: fullyEmailRows.length,
      unitsSold: fullyEmailSummary.unitsSold, grossSales, discounts, refunds, netSales,
      averageRevenuePerOrder: fullyEmailSummary.averageRevenuePerOrder,
      uniqueProductsSold: fullyEmailSummary.uniqueProductsSold,
      currency, multiCurrencyWarning,
    },
    firstSessionEmailSummary,
    combinedSummary,
    allSukirthaOrders,
    classificationCounts,
    meta: {
      generatedAt: new Date().toISOString(),
      cacheStatus: 'miss',
      ordersFetched: orders.length,
      fullyEmailOrders: fullyEmailRows.length,
      firstSessionEmailOrders: firstSessionEmailRows.length,
      pagesFetched: pages,
      throttleRetries: retryState.throttleRetries,
      executionMs: Date.now() - startTime,
    },
  };

  CACHE.set(cacheKey, { data: responsePayload, generatedAt: Date.now() });
  res.status(200).json(responsePayload);
}

async function handleOrganic(req, res, monthConfig, forceRefresh, startTime) {
  const staffParam = req.query && req.query.staff;
  const staff = staffParam === 'mahima' ? 'mahima' : staffParam === 'mahima-ads' ? 'mahima-ads' : staffParam === 'jeffri-ads' ? 'jeffri-ads' : staffParam === 'mahima-id-ads' ? 'mahima-id-ads' : staffParam === 'mahima-total' ? 'mahima-total' : staffParam === 'mahima-ads-term' ? 'mahima-ads-term' : staffParam === 'hetheesha-organic' ? 'hetheesha-organic' : staffParam === 'thivagini-ads' ? 'thivagini-ads' : staffParam === 'thasitha-ads' ? 'thasitha-ads' : staffParam === 'sajeepan-ads' ? 'sajeepan-ads' : 'sukirtha';
  const cacheKey = staff + ':' + monthConfig.month;
  const isFrStaff = staff === 'hetheesha-organic' || staff === 'thivagini-ads';
  const isUkStaff = staff === 'sajeepan-ads';

  const cached = CACHE.get(cacheKey);
  if (!forceRefresh && cached && (Date.now() - cached.generatedAt) < CACHE_TTL_MS) {
    res.status(200).json({ ...cached.data, meta: { ...cached.data.meta, cacheStatus: 'hit' } });
    return;
  }

  if (!forceRefresh) {
    const snapshotName = staff === 'mahima' ? 'mahima-de-organic' : staff === 'mahima-ads' ? 'mahima-de-ads' : staff === 'jeffri-ads' ? 'jeffri-de-ads' : staff === 'mahima-id-ads' ? 'mahima-de-id-ads' : staff === 'mahima-total' ? 'mahima-de-total' : staff === 'mahima-ads-term' ? 'mahima-de-ads-term' : staff === 'hetheesha-organic' ? 'hetheesha-fr-organic' : staff === 'thivagini-ads' ? 'thivagini-fr-ads' : staff === 'thasitha-ads' ? 'thasitha-de-ads' : staff === 'sajeepan-ads' ? 'sajeepan-uk-ads' : 'sukirtha-de-organic';
    const staticPath = path.join(__dirname, 'data', `${snapshotName}-sales-${monthConfig.month}.json`);
    if (fs.existsSync(staticPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
      const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
      CACHE.set(cacheKey, { data: payload, generatedAt: Date.now() });
      res.status(200).json(payload);
      return;
    }
  }

  if (isFrStaff && !TOKEN_FR) {
    res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_FR_ADMIN_TOKEN missing' });
    return;
  }
  if (isUkStaff && !TOKEN_UK) {
    res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' });
    return;
  }

  if (req.query && req.query.debugConfig === '1') {
    res.status(200).json({
      success: true, staff, isFrStaff, isUkStaff,
      domainUsed: isFrStaff ? STORE_DOMAIN_FR : isUkStaff ? STORE_DOMAIN_UK : STORE_DOMAIN,
      apiVersionUsed: isUkStaff ? API_VERSION_UK : API_VERSION,
      tokenPresent: isFrStaff ? !!TOKEN_FR : isUkStaff ? !!TOKEN_UK : !!TOKEN,
      tokenLength: isFrStaff ? (TOKEN_FR || '').length : isUkStaff ? (TOKEN_UK || '').length : (TOKEN || '').length,
      monthConfig: { month: monthConfig.month, startISO: monthConfig.startISO, endISO: monthConfig.endISO, queryStart: monthConfig.queryStart, queryEnd: monthConfig.queryEnd },
    });
    return;
  }

  const retryState = { throttleRetries: 0 };
  const { orders, pages, rawEdgesSeen } = await fetchOrdersForMonth(
    monthConfig, retryState,
    isFrStaff ? STORE_DOMAIN_FR : isUkStaff ? STORE_DOMAIN_UK : undefined,
    isFrStaff ? TOKEN_FR : isUkStaff ? TOKEN_UK : undefined,
    isUkStaff ? API_VERSION_UK : undefined
  );

  if (req.query && req.query.debugFetch === '1') {
    res.status(200).json({ success: true, pages, rawEdgesSeen, ordersInRange: orders.length, sampleOrderNames: orders.slice(0, 3).map(o => o.name) });
    return;
  }
  if (req.query && req.query.debugRawNoFilter === '1') {
    const rs = { throttleRetries: 0 };
    const domain = isFrStaff ? STORE_DOMAIN_FR : isUkStaff ? STORE_DOMAIN_UK : STORE_DOMAIN;
    const tok = isFrStaff ? TOKEN_FR : isUkStaff ? TOKEN_UK : TOKEN;
    const ver = isUkStaff ? API_VERSION_UK : API_VERSION;
    try {
      const data = await shopifyGraphQL(ORDERS_QUERY, { cursor: null, query: '' }, rs, domain, tok, ver);
      res.status(200).json({ success: true, edgeCount: data.orders.edges.length, sample: data.orders.edges.slice(0,3).map(e=>({name:e.node.name, createdAt:e.node.createdAt})) });
    } catch (e) {
      res.status(200).json({ success: false, error: e.message });
    }
    return;
  }

  if (req.query && req.query.debugOrderRaw) {
    const target = orders.find(o => o.name === req.query.debugOrderRaw);
    res.status(200).json({ success: true, found: !!target, order: target || null });
    return;
  }

  if (staff === 'mahima-ads') {
    // Confirmed rule (user, 2026-07-20, verified against real Shopify order
    // data for January before being applied to all months): an order
    // belongs to Mahima's Google Ads sales if its FIRST SESSION ONLY has
    // "mahi" anywhere in source / medium / campaign / term / content —
    // regardless of channel classification (some of her ad mediums, e.g.
    // "klarna", "shoptimised", "shoptimise1/2/3", weren't recognized as
    // PAID_SEARCH by classifySession() and were being silently dropped
    // under the old exact-code/PAID_SEARCH-only logic — that was the bug
    // Mahima flagged). A later session mentioning "mahi" does NOT count if
    // the first session doesn't (explicitly confirmed: Organic Search/Direct/
    // generic Shoptimised-Klarna-Shoparize first touches are excluded even
    // if a later session in the same journey is a confirmed Mahima ad).
    // Store-wide, NOT product-scoped. Applies to every month including the
    // live current month (July onward).
    //
    // Extended 2026-07-20, then partially reverted same day: DB lookup
    // (ledsone Postgres, google_ads.campaigns, group_name='Mahima', 16 rows
    // — matches the "Campaigns (16)" count in the Google Ads UI) found two
    // campaigns whose Shopify utm tags never contain the literal word
    // "mahi": "Pmax DE | Mahi | Shoparize-29-01-26~Mahi" (utm source=
    // Shoparize) and "...LOW-CLICK-SALES | Lowclickssales_2..." (utm
    // campaign=LowClick). Adding "Shoparize" caused the dashboard to exceed
    // Google Ads' own reported conversion value for the month — all
    // Shoparize orders share utm_term=Jeff, the exact same tag the user
    // separately confirmed does NOT belong to Mahima (on a Shoptimised/
    // BlackFriday order) — meaning "Shoparize" traffic in Shopify is not
    // reliably traceable to that one specific DB-confirmed campaign (the
    // platform/tag is likely shared with other, non-Mahima campaigns).
    // Reverted per user confirmation 2026-07-20. "LowClick" had no such
    // contradiction and stays.
    const adsRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRowEmail(order, journey);
      if (!row) continue;
      const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
      const utm = (fv && fv.utmParameters) || {};
      const hasMahiSubstring = ['source', 'medium', 'campaign', 'term', 'content'].some(k => (utm[k] || '').toString().toLowerCase().includes('mahi'));
      const isLowClick = (utm.campaign || '').toString().toLowerCase().includes('lowclick');
      const hasMahi = hasMahiSubstring || isLowClick;
      if (!hasMahi) continue;
      row.campaign = utm.campaign || '(no campaign value)';
      row.firstSessionChannel = journey.first ? journey.first.classification : 'UNKNOWN';
      row.rawCampaign = utm.campaign || null;
      row.firstVisitSource = utm.source || null;
      row.firstVisitMedium = utm.medium || null;
      row.firstVisitTerm = utm.term || null;
      row.firstVisitContent = utm.content || null;
      adsRows.push(row);
    }

    const byCampaign = new Map();
    for (const r of adsRows) {
      if (!byCampaign.has(r.campaign)) byCampaign.set(r.campaign, []);
      byCampaign.get(r.campaign).push(r);
    }
    const campaignSummary = [...byCampaign.keys()].sort()
      .map(code => ({ campaign: code, ...summarizeRows(byCampaign.get(code) || []) }))
      .filter(c => c.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount);

    const combinedSummary = summarizeRows(adsRows);

    const adsPayload = {
      success: true,
      staff: { name: 'Mahima', department: 'Google Ads (Paid Search)', store: 'ledsone.de' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: `store-wide (NOT product-scoped) — every order counts regardless of product or channel classification; an order belongs to Mahima if its first-session source, medium, campaign, term, or content contains "mahi" anywhere, OR campaign contains "lowclick" (DB-confirmed via google_ads.campaigns group_name='Mahima', 2026-07-20; a "shoparize" rule was tried and reverted same day — see code comment)`,
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      campaignList: [...byCampaign.keys()].sort(),
      combinedSummary,
      campaignSummary,
      allMahimaAdsOrders: adsRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        paidSearchMahimaOrders: adsRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: adsPayload, generatedAt: Date.now() });
    res.status(200).json(adsPayload);
    return;
  }

  if (staff === 'jeffri-ads') {
    // Jeffri Ads tab — rule confirmed 2026-07-21 (replaces the earlier
    // substring/Google-family-platform rule): an order belongs to Jeffri
    // if its first-session utm_term is exactly "jeff" or "Jeichitom_Maara"
    // (case-insensitive). Fallback: if the order has NO utm_term at all
    // (empty/null), check utm_medium === "SMARKETER_sale" instead. Store-
    // wide, NOT product-scoped, all months including live July.
    const JEFFRI_TERMS = new Set(['jeff', 'jeichitom_maara']);
    // debugAllTermsJeffri=1: temporary diagnostic, added 2026-07-21 — for
    // every order in the month, dumps first-session source/medium/term/
    // content regardless of match, so all real values can be eyeballed
    // for missed variants of Jeffri's identifiers. Not used by the tab.
    if (req.query && req.query.debugAllTermsJeffri === '1') {
      const rows = [];
      for (const order of orders) {
        const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
        const utm = (fv && fv.utmParameters) || {};
        rows.push({ orderName: order.name, source: utm.source || null, medium: utm.medium || null, campaign: utm.campaign || null, term: utm.term || null, content: utm.content || null });
      }
      res.status(200).json({ success: true, ordersFetched: orders.length, rows });
      return;
    }
    const adsRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRowEmail(order, journey);
      if (!row) continue;
      const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
      const utm = (fv && fv.utmParameters) || {};
      const term = (utm.term || '').toString().toLowerCase();
      const medium = (utm.medium || '').toString().toLowerCase();
      let matched = null;
      if (term && JEFFRI_TERMS.has(term)) {
        matched = utm.term;
      } else if (!term && medium === 'smarketer_sale') {
        matched = '(no term) medium=SMARKETER_sale';
      }
      if (!matched) continue;
      row.campaign = matched;
      row.firstSessionChannel = journey.first ? journey.first.classification : 'UNKNOWN';
      row.rawCampaign = utm.campaign || null;
      row.firstVisitSource = utm.source || null;
      row.firstVisitMedium = utm.medium || null;
      row.firstVisitTerm = utm.term || null;
      row.firstVisitContent = utm.content || null;
      adsRows.push(row);
    }

    const byCampaign = new Map();
    for (const r of adsRows) {
      if (!byCampaign.has(r.campaign)) byCampaign.set(r.campaign, []);
      byCampaign.get(r.campaign).push(r);
    }
    const campaignSummary = [...byCampaign.keys()].sort()
      .map(code => ({ campaign: code, ...summarizeRows(byCampaign.get(code) || []) }))
      .filter(c => c.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount);

    const combinedSummary = summarizeRows(adsRows);

    const jeffriPayload = {
      success: true,
      staff: { name: 'Jeffri', department: 'Google Ads (Paid Search)', store: 'ledsone.de' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: `store-wide (NOT product-scoped) — an order belongs to Jeffri if its first-session utm_term exactly matches "jeff" or "Jeichitom_Maara" (case-insensitive); if there's no utm_term at all, falls back to checking utm_medium === "SMARKETER_sale" (confirmed rule, 2026-07-21)`,
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      campaignList: [...byCampaign.keys()].sort(),
      combinedSummary,
      campaignSummary,
      allJeffriAdsOrders: adsRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        paidSearchJeffriOrders: adsRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: jeffriPayload, generatedAt: Date.now() });
    res.status(200).json(jeffriPayload);
    return;
  }

  if (staff === 'thasitha-ads') {
    // Thasitha Ads tab — added 2026-07-21, mirrors the Jeffri Ads logic
    // exactly: an order belongs to Thasitha if its first-session utm_term
    // exactly matches "thasi" (case-insensitive). Store-wide, NOT
    // product-scoped, all months including live July. ledsone.de store
    // (same as Jeffri and Mahima), Google Ads channel.
    const THASITHA_TERMS = new Set(['thasi']);
    const adsRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRowEmail(order, journey);
      if (!row) continue;
      const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
      const utm = (fv && fv.utmParameters) || {};
      const term = (utm.term || '').toString().toLowerCase();
      if (!THASITHA_TERMS.has(term)) continue;
      row.campaign = utm.term || null;
      row.firstSessionChannel = journey.first ? journey.first.classification : 'UNKNOWN';
      row.rawCampaign = utm.campaign || null;
      row.firstVisitSource = utm.source || null;
      row.firstVisitMedium = utm.medium || null;
      row.firstVisitTerm = utm.term || null;
      row.firstVisitContent = utm.content || null;
      adsRows.push(row);
    }

    const byCampaign = new Map();
    for (const r of adsRows) {
      if (!byCampaign.has(r.campaign)) byCampaign.set(r.campaign, []);
      byCampaign.get(r.campaign).push(r);
    }
    const campaignSummary = [...byCampaign.keys()].sort()
      .map(code => ({ campaign: code, ...summarizeRows(byCampaign.get(code) || []) }))
      .filter(c => c.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount);

    const combinedSummary = summarizeRows(adsRows);

    const thasithaPayload = {
      success: true,
      staff: { name: 'Thasitha', department: 'Google Ads (Paid Search)', store: 'ledsone.de' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: `store-wide (NOT product-scoped) — an order belongs to Thasitha if its first-session utm_term exactly matches "thasi" (case-insensitive) (confirmed rule, 2026-07-21)`,
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      campaignList: [...byCampaign.keys()].sort(),
      combinedSummary,
      campaignSummary,
      allThasithaAdsOrders: adsRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        matchedOrders: adsRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: thasithaPayload, generatedAt: Date.now() });
    res.status(200).json(thasithaPayload);
    return;
  }

  if (staff === 'sajeepan-ads') {
    if (req.query && req.query.debugAllTermsSajeepan === '1') {
      const rows = [];
      for (const order of orders) {
        const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
        const utm = (fv && fv.utmParameters) || {};
        rows.push({ orderName: order.name, source: utm.source || null, medium: utm.medium || null, campaign: utm.campaign || null, term: utm.term || null, content: utm.content || null });
      }
      res.status(200).json({ success: true, ordersFetched: orders.length, rows });
      return;
    }
    // Sajeepan Ads tab — added 2026-07-21, ledsone.co.uk (STORE_DOMAIN_UK),
    // mirrors Jeffri/Thasitha's structure: an order belongs to Sajeepan if
    // its first-session utm_term exactly matches one of her 7 confirmed
    // terms (case-insensitive) — several are literal unsubstituted Google
    // Ads ValueTrack placeholders ("{keyword}") or raw tracking-template
    // fragments, as given directly by the user. Store-wide, NOT
    // product-scoped, all months including live July.
    const adsRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRowEmail(order, journey);
      if (!row) continue;
      const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
      const utm = (fv && fv.utmParameters) || {};
      const term = (utm.term || '').toString().toLowerCase();
      if (!term || !SAJEEPAN_TERMS.has(term)) continue;
      row.campaign = utm.term || null;
      row.firstSessionChannel = journey.first ? journey.first.classification : 'UNKNOWN';
      row.rawCampaign = utm.campaign || null;
      row.firstVisitSource = utm.source || null;
      row.firstVisitMedium = utm.medium || null;
      row.firstVisitTerm = utm.term || null;
      row.firstVisitContent = utm.content || null;
      adsRows.push(row);
    }

    const byCampaign = new Map();
    for (const r of adsRows) {
      if (!byCampaign.has(r.campaign)) byCampaign.set(r.campaign, []);
      byCampaign.get(r.campaign).push(r);
    }
    const campaignSummary = [...byCampaign.keys()].sort()
      .map(code => ({ campaign: code, ...summarizeRows(byCampaign.get(code) || []) }))
      .filter(c => c.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount);

    const combinedSummary = summarizeRows(adsRows);

    const sajeepanPayload = {
      success: true,
      staff: { name: 'Sajeepan', department: 'Google Ads (Paid Search)', store: 'ledsone.co.uk' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/London' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: `store-wide (NOT product-scoped) — an order belongs to Sajeepan if its first-session utm_term exactly matches one of her 7 confirmed values (case-insensitive): "GENAI&keyword=GENAI&Content=SJ", "{keyword}", "Top_SELL&keyword=GEN2&Content=Asset", "LIGHTING_SJ&keyword={keyword}", "Wall_Light&keyword=GEN2&Content=Ads", "Shopping_SJ&keyword={keyword}", "unnai_nampu" (confirmed rule, 2026-07-21)`,
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      campaignList: [...byCampaign.keys()].sort(),
      combinedSummary,
      campaignSummary,
      allSajeepanAdsOrders: adsRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        matchedOrders: adsRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: sajeepanPayload, generatedAt: Date.now() });
    res.status(200).json(sajeepanPayload);
    return;
  }

  if (staff === 'mahima-id-ads') {
    // Mahima "ID Sales" tab — added 2026-07-20, corrected same day per
    // explicit user instruction: product-scoped to Mahima's owned product
    // IDs, Google Ads channel only (Organic excluded — already covered by
    // the Organic sub-tab). "Mahima has only her IDs in all her campaigns"
    // means: no broad Google-Ads-platform test is needed or wanted — an
    // order counts ONLY if its FIRST SESSION has "mahi" (→ Mahima) or
    // "jeff" (→ Jeffri, a different DE staff member). There is no
    // "Other/Unattributed" bucket anymore (the earlier broad
    // isPaidSearch/isAdPlatformFamily test that produced one was wrong —
    // reverted). If the first session is "mahi" but the SECOND session is
    // "jeff", it still counts as Mahima (first-session-only rule,
    // unchanged), but is flagged visibly (row.secondSessionOwner) so this
    // crossover case is never hidden.
    const idAdsRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRow(order, journey, 'mahima');
      if (!row) continue;
      const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
      const utm = (fv && fv.utmParameters) || {};
      const fieldsHave = (u, word) => ['source', 'medium', 'campaign', 'term', 'content'].some(k => (u[k] || '').toString().toLowerCase().includes(word));
      const hasMahi = fieldsHave(utm, 'mahi');
      const hasJeff = fieldsHave(utm, 'jeff');
      const owner = hasMahi ? 'Mahima' : hasJeff ? 'Jeffri' : null;
      if (!owner) continue;
      row.owner = owner;
      const secondSession = row.sessions && row.sessions[1];
      row.secondSessionOwner = secondSession ? (fieldsHave(secondSession.utm || {}, 'mahi') ? 'Mahima' : fieldsHave(secondSession.utm || {}, 'jeff') ? 'Jeffri' : null) : null;
      row.firstSessionChannel = journey.first ? journey.first.classification : 'UNKNOWN';
      row.rawCampaign = utm.campaign || null;
      row.firstVisitSource = utm.source || null;
      row.firstVisitMedium = utm.medium || null;
      row.firstVisitTerm = utm.term || null;
      row.firstVisitContent = utm.content || null;
      idAdsRows.push(row);
    }

    const OWNER_ORDER = ['Mahima', 'Jeffri'];
    const byOwner = new Map();
    for (const r of idAdsRows) {
      if (!byOwner.has(r.owner)) byOwner.set(r.owner, []);
      byOwner.get(r.owner).push(r);
    }
    const ownerSummary = OWNER_ORDER
      .map(owner => ({ owner, ...summarizeRows(byOwner.get(owner) || []) }))
      .filter(o => o.ordersCount > 0);

    const crossoverRows = idAdsRows.filter(r => r.owner === 'Mahima' && r.secondSessionOwner === 'Jeffri');

    const combinedSummary = summarizeRows(idAdsRows);

    const idAdsPayload = {
      success: true,
      staff: { name: 'Mahima', department: 'Google Ads — Product ID Sales', store: 'ledsone.de' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: `product-scoped to Mahima's ${MAHIMA_EXCLUDED_PRODUCT_IDS.size} owned product IDs; an order counts ONLY if its first session has "mahi" (Mahima) or "jeff" (Jeffri) — no other/unattributed bucket. Crossover cases (first session mahi, second session jeff) still count as Mahima per the first-session-only rule, but are flagged separately for visibility (${crossoverRows.length} such orders this month)`,
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      ownerList: OWNER_ORDER,
      combinedSummary,
      ownerSummary,
      crossoverCount: crossoverRows.length,
      allMahimaIdAdsOrders: idAdsRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        matchedOrders: idAdsRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: idAdsPayload, generatedAt: Date.now() });
    res.status(200).json(idAdsPayload);
    return;
  }

  if (staff === 'mahima-total') {
    // Mahima "Total" tab — added 2026-07-21 per explicit user request:
    // product-scoped to Mahima's owned product IDs (same MAHIMA_EXCLUDED_
    // PRODUCT_IDS set used elsewhere). Originally applied no channel
    // filtering at all; user confirmed 2026-07-21 that Social and Email
    // channel sales are NOT Mahima's and must be permanently excluded from
    // this tab (not just hidden in the UI — excluded from the underlying
    // data everywhere/every month, including live). All other channels
    // (Organic, Google Ads/Paid, Direct, Referral, No Journey Data, Other)
    // remain included, unfiltered.
    const EXCLUDED_CHANNELS = ['Social', 'Email'];
    const totalRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRow(order, journey, 'mahima');
      if (!row) continue;
      row.channel = deriveChannel(journey);
      if (EXCLUDED_CHANNELS.includes(row.channel)) continue;
      totalRows.push(row);
    }

    const byChannel = new Map();
    for (const r of totalRows) {
      if (!byChannel.has(r.channel)) byChannel.set(r.channel, []);
      byChannel.get(r.channel).push(r);
    }
    const channelSummary = [...byChannel.keys()].sort()
      .map(channel => ({ channel, ...summarizeRows(byChannel.get(channel) || []) }))
      .filter(c => c.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount);

    const combinedSummary = summarizeRows(totalRows);

    const totalPayload = {
      success: true,
      staff: { name: 'Mahima', department: 'Total Sales (All Channels, Unfiltered)', store: 'ledsone.de' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: `product-scoped to Mahima's ${MAHIMA_EXCLUDED_PRODUCT_IDS.size} owned product IDs — every order containing one of her products counts regardless of Organic/Paid/Direct/Referral/Other channel, EXCEPT Social and Email (confirmed not Mahima's, permanently excluded 2026-07-21)`,
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      channelList: [...byChannel.keys()].sort(),
      combinedSummary,
      channelSummary,
      allMahimaTotalOrders: totalRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        matchedOrders: totalRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: totalPayload, generatedAt: Date.now() });
    res.status(200).json(totalPayload);
    return;
  }

  if (staff === 'mahima-ads-term') {
    // Mahima "Google Ads" tab (fresh build) — added 2026-07-21 per explicit
    // user instruction: match by FIRST SESSION utm_term (exact match,
    // case-insensitive), not by substring-anywhere-in-any-field like the
    // earlier retired "mahima-ads" tab. Confirmed Mahima term values:
    // mahi, bestselling, march_15, sep_25, {searchterm}, april_01,
    // april_15, dec_30. Store-wide (NOT product-scoped) — every order
    // whose first session has one of these exact utm_term values counts,
    // regardless of product. Deployed for April 2026 only per instruction.
    const MAHIMA_AD_TERMS = new Set([
      'mahi', 'bestselling', 'march_15', 'sep_25', '{searchterm}', 'april_01', 'april_15', 'dec_30',
    ]);
    // debugAllTerms=1: temporary diagnostic, added 2026-07-21 — returns
    // every distinct first-session utm_term value seen this month
    // (matched or not), so near-miss variants (typos, casing, extra
    // whitespace) of the 8 confirmed terms can be caught by eye. Not used
    // by the deployed tab.
    if (req.query && req.query.debugAllTerms === '1') {
      const termCounts = new Map();
      for (const order of orders) {
        const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
        const utm = (fv && fv.utmParameters) || {};
        const key = JSON.stringify(utm.term === undefined ? null : utm.term);
        termCounts.set(key, (termCounts.get(key) || 0) + 1);
      }
      res.status(200).json({ success: true, allDistinctFirstSessionTerms: Object.fromEntries(termCounts) });
      return;
    }
    const termRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRowEmail(order, journey);
      if (!row) continue;
      const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
      const utm = (fv && fv.utmParameters) || {};
      const term = (utm.term || '').toString().toLowerCase();
      if (!MAHIMA_AD_TERMS.has(term)) continue;
      row.matchedTerm = utm.term || null;
      row.firstSessionChannel = journey.first ? journey.first.classification : 'UNKNOWN';
      row.rawCampaign = utm.campaign || null;
      row.firstVisitSource = utm.source || null;
      row.firstVisitMedium = utm.medium || null;
      row.firstVisitTerm = utm.term || null;
      row.firstVisitContent = utm.content || null;
      termRows.push(row);
    }

    const byTerm = new Map();
    for (const r of termRows) {
      if (!byTerm.has(r.matchedTerm)) byTerm.set(r.matchedTerm, []);
      byTerm.get(r.matchedTerm).push(r);
    }
    const termSummary = [...MAHIMA_AD_TERMS]
      .map(term => ({ term, ...summarizeRows(byTerm.get(term) || []) }))
      .filter(t => t.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount);

    const combinedSummary = summarizeRows(termRows);

    const termPayload = {
      success: true,
      staff: { name: 'Mahima', department: 'Google Ads (utm_term match)', store: 'ledsone.de' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: `store-wide (NOT product-scoped) — an order belongs to Mahima if its first-session utm_term exactly matches one of 8 confirmed values: mahi, bestselling, march_15, sep_25, {searchterm}, april_01, april_15, dec_30 (2026-07-21)`,
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      termList: [...MAHIMA_AD_TERMS],
      combinedSummary,
      termSummary,
      allMahimaAdsTermOrders: termRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        matchedOrders: termRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: termPayload, generatedAt: Date.now() });
    res.status(200).json(termPayload);
    return;
  }

  if (staff === 'hetheesha-organic') {
    // Hetheesha — Organic Search sales, ledsone.fr — added 2026-07-21.
    // Store-wide (NOT product-scoped, like Sukirtha's DE Organic tab and
    // unlike Kamsi/Dilaksi/Mahima's product-scoped tabs), since Hetheesha
    // and Thivagini split responsibility for ledsone.fr by CHANNEL, not
    // by product. Identical organic-sales definition used everywhere else
    // on this page: Fully Organic, First-Session Organic, Direct,
    // Referral, No Journey Data, AI Tools. Excludes Google Ads/Paid
    // Search (that's Thivagini's tab), Social, Email.
    const heRows = [];
    const heClassificationCounts = {
      fullyOrganic: 0, mixedJourney: 0, nonOrganic: 0, attributionPending: 0,
      noJourneyData: 0, unknownAttribution: 0, excludedCancelled: 0, excludedTest: 0,
      firstSessionOrganic: 0,
    };
    const heFullyOrganicRows = [];
    const heFirstSessionOrganicRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRowEmail(order, journey);
      if (!row) continue;
      row.channel = deriveChannel(journey);
      heRows.push(row);
      const isFirstSessionOrganicBucket = journey.firstSessionOrganic && (journey.status === 'MIXED_JOURNEY' || journey.status === 'NON_ORGANIC');
      if (journey.status === 'FULLY_ORGANIC') {
        heFullyOrganicRows.push(row);
        heClassificationCounts.fullyOrganic++;
      } else if (isFirstSessionOrganicBucket) {
        row.journeyStatus = 'FIRST_SESSION_ORGANIC';
        heFirstSessionOrganicRows.push(row);
        heClassificationCounts.firstSessionOrganic++;
      } else {
        switch (journey.status) {
          case 'MIXED_JOURNEY': heClassificationCounts.mixedJourney++; break;
          case 'NON_ORGANIC': heClassificationCounts.nonOrganic++; break;
          case 'ATTRIBUTION_PENDING': heClassificationCounts.attributionPending++; break;
          case 'NO_JOURNEY_DATA': heClassificationCounts.noJourneyData++; break;
          case 'UNKNOWN_ATTRIBUTION': heClassificationCounts.unknownAttribution++; break;
          case 'EXCLUDED_CANCELLED_ORDER': heClassificationCounts.excludedCancelled++; break;
          case 'EXCLUDED_TEST_ORDER': heClassificationCounts.excludedTest++; break;
        }
      }
    }
    const AI_SOURCES_HE = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'bing chat', 'bingchat', 'character.ai', 'meta ai', 'grok'];
    const heDirectRows = heRows.filter(r => r.channel === 'Direct');
    const heReferralRows = heRows.filter(r => r.channel === 'Referral');
    const heNoJourneyRows = heRows.filter(r => (r.channel === 'No Journey Data' || r.channel === 'Unknown' || r.channel === 'Attribution Pending') && !HETHEESHA_TO_THIVAGINI_NOJOURNEY_ORDERS.has(r.orderName));
    const heAiRows = heRows.filter(r => r.channel === 'Other' && r.firstVisit && AI_SOURCES_HE.some(ai => lower(r.firstVisit.source).includes(ai)));
    heFullyOrganicRows.forEach(r => { r.group = 'Fully Organic'; });
    heFirstSessionOrganicRows.forEach(r => { r.group = 'First-Session Organic'; });
    heDirectRows.forEach(r => { r.group = 'Direct'; });
    heReferralRows.forEach(r => { r.group = 'Referral'; });
    heNoJourneyRows.forEach(r => { r.group = 'No Journey Data'; });
    heAiRows.forEach(r => { r.group = 'AI Tools'; });
    const allHetheeshaOrders = [...heFullyOrganicRows, ...heFirstSessionOrganicRows, ...heDirectRows, ...heReferralRows, ...heNoJourneyRows, ...heAiRows];
    const heCombinedSummary = summarizeRows(allHetheeshaOrders);
    const heFullyOrganicSummary = summarizeRows(heFullyOrganicRows);
    const heFirstSessionOrganicSummary = summarizeRows(heFirstSessionOrganicRows);
    const heDirectSummary = summarizeRows(heDirectRows);
    const heReferralSummary = summarizeRows(heReferralRows);
    const heNoJourneySummary = summarizeRows(heNoJourneyRows);
    const heAiSummary = summarizeRows(heAiRows);

    const hePayload = {
      success: true,
      staff: { name: 'Hetheesha', department: 'Organic Search (SEO)', store: 'ledsone.fr' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Paris' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: 'store-wide — every order counts, no product allocation / matching; mirrors Kamsi/Sukirtha\'s organic-sales definition exactly (Fully Organic, First-Session Organic, Direct, Referral, No Journey Data, AI Tools). Excludes Google Ads/Paid Search (Thivagini\'s tab), Social, Email.',
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      summary: { fullyOrganicOrders: heFullyOrganicRows.length, ...heFullyOrganicSummary },
      firstSessionOrganicSummary: heFirstSessionOrganicSummary,
      combinedSummary: heCombinedSummary,
      directSummary: heDirectSummary, referralSummary: heReferralSummary, noJourneySummary: heNoJourneySummary, aiSummary: heAiSummary,
      allSukirthaOrders: allHetheeshaOrders,
      classificationCounts: heClassificationCounts,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: hePayload, generatedAt: Date.now() });
    res.status(200).json(hePayload);
    return;
  }

  if (staff === 'thivagini-ads') {
    // Thivagini — ledsone.fr — corrected 2026-07-21 per explicit user
    // clarification ("after organic add all to thivagini"): Thivagini
    // gets the BALANCE of every order NOT in Hetheesha's organic bucket —
    // not just Paid Search. Originally built too narrowly (Paid Search
    // only), which left Social/Email/Affiliate/non-AI-Other orders
    // uncounted by either tab (Hetheesha + Thivagini didn't sum to the
    // store total). Fixed by using the exact same group-assignment logic
    // as Hetheesha's tab and taking everything that does NOT fall into
    // one of her 6 groups (Fully Organic, First-Session Organic, Direct,
    // Referral, No Journey Data, AI Tools) — guaranteeing the two tabs
    // always sum to 100% of the store's orders, with a breakdown by
    // channel shown below (Google Ads/Paid Search, Social, Email,
    // Affiliate, Other) for transparency.
    const AI_SOURCES_TV = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'bing chat', 'bingchat', 'character.ai', 'meta ai', 'grok'];
    function isHetheeshaOrganicGroup(row, journey) {
      if (HETHEESHA_TO_THIVAGINI_NOJOURNEY_ORDERS.has(row.orderName)) return false;
      if (journey.status === 'FULLY_ORGANIC') return true;
      const isFirstSessionOrganicBucket = journey.firstSessionOrganic && (journey.status === 'MIXED_JOURNEY' || journey.status === 'NON_ORGANIC');
      if (isFirstSessionOrganicBucket) return true;
      if (row.channel === 'Direct' || row.channel === 'Referral') return true;
      if (row.channel === 'No Journey Data' || row.channel === 'Unknown' || row.channel === 'Attribution Pending') return true;
      if (row.channel === 'Other' && row.firstVisit && AI_SOURCES_TV.some(ai => lower(row.firstVisit.source).includes(ai))) return true;
      return false;
    }
    const tvRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourneyOrganic(order);
      const row = buildSukirthaOrderRowEmail(order, journey);
      if (!row) continue;
      row.channel = deriveChannel(journey);
      if (isHetheeshaOrganicGroup(row, journey)) continue;
      if (HETHEESHA_TO_THIVAGINI_NOJOURNEY_ORDERS.has(row.orderName)) row.channel = 'No Journey Data (Ad-Click Matched)';
      row.firstSessionChannel = row.channel;
      const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
      const utm = (fv && fv.utmParameters) || {};
      row.rawCampaign = utm.campaign || null;
      row.firstVisitSource = utm.source || null;
      row.firstVisitMedium = utm.medium || null;
      row.firstVisitTerm = utm.term || null;
      row.firstVisitContent = utm.content || null;
      tvRows.push(row);
    }
    const tvByChannel = new Map();
    for (const r of tvRows) {
      if (!tvByChannel.has(r.channel)) tvByChannel.set(r.channel, []);
      tvByChannel.get(r.channel).push(r);
    }
    const tvChannelSummary = [...tvByChannel.keys()].sort()
      .map(channel => ({ channel, ...summarizeRows(tvByChannel.get(channel) || []) }))
      .filter(c => c.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount);
    const tvCombinedSummary = summarizeRows(tvRows);

    const tvPayload = {
      success: true,
      staff: { name: 'Thivagini', department: 'Google Ads + Balance (Non-Organic)', store: 'ledsone.fr' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Paris' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: 'store-wide (NOT product-scoped) — every order that does NOT fall into one of Hetheesha\'s 6 organic groups counts here (Google Ads/Paid Search, Social, Email, Affiliate, non-AI Other). Hetheesha + Thivagini always sum to the store\'s full order total for the month.',
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      channelSummary: tvChannelSummary,
      combinedSummary: tvCombinedSummary,
      allThivaginiAdsOrders: tvRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        matchedOrders: tvRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };
    CACHE.set(cacheKey, { data: tvPayload, generatedAt: Date.now() });
    res.status(200).json(tvPayload);
    return;
  }

  const classificationCounts = {
    fullyOrganic: 0, mixedJourney: 0, nonOrganic: 0, attributionPending: 0,
    noJourneyData: 0, unknownAttribution: 0, excludedCancelled: 0, excludedTest: 0,
    firstSessionOrganic: 0,
  };

  const fullyOrganicRows = [];
  const firstSessionOrganicRows = [];
  const allOrderRows = [];

  for (const order of orders) {
    const journey = classifyOrderJourneyOrganic(order);
    const row = buildSukirthaOrderRow(order, journey, staff);
    if (!row) continue;
    row.channel = deriveChannel(journey);
    allOrderRows.push(row);

    const isFirstSessionOrganicBucket = journey.firstSessionOrganic && (journey.status === 'MIXED_JOURNEY' || journey.status === 'NON_ORGANIC');

    if (journey.status === 'FULLY_ORGANIC') {
      fullyOrganicRows.push(row);
      classificationCounts.fullyOrganic++;
    } else if (isFirstSessionOrganicBucket) {
      row.journeyStatus = 'FIRST_SESSION_ORGANIC';
      firstSessionOrganicRows.push(row);
      classificationCounts.firstSessionOrganic++;
    } else {
      switch (journey.status) {
        case 'MIXED_JOURNEY': classificationCounts.mixedJourney++; break;
        case 'NON_ORGANIC': classificationCounts.nonOrganic++; break;
        case 'ATTRIBUTION_PENDING': classificationCounts.attributionPending++; break;
        case 'NO_JOURNEY_DATA': classificationCounts.noJourneyData++; break;
        case 'UNKNOWN_ATTRIBUTION': classificationCounts.unknownAttribution++; break;
        case 'EXCLUDED_CANCELLED_ORDER': classificationCounts.excludedCancelled++; break;
        case 'EXCLUDED_TEST_ORDER': classificationCounts.excludedTest++; break;
      }
    }
  }

  const fullyOrganicSummary = summarizeRows(fullyOrganicRows);
  const firstSessionOrganicSummary = summarizeRows(firstSessionOrganicRows);

  const AI_SOURCES = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'bing chat', 'bingchat', 'character.ai', 'meta ai', 'grok'];
  const directRows = allOrderRows.filter(r => r.channel === 'Direct');
  const referralRows = allOrderRows.filter(r => r.channel === 'Referral');
  const noJourneyRows = allOrderRows.filter(r => r.channel === 'No Journey Data' || r.channel === 'Unknown' || r.channel === 'Attribution Pending');
  const aiRows = allOrderRows.filter(r => r.channel === 'Other' && r.firstVisit && AI_SOURCES.some(ai => lower(r.firstVisit.source).includes(ai)));
  const directSummary = summarizeRows(directRows);
  const referralSummary = summarizeRows(referralRows);
  const noJourneySummary = summarizeRows(noJourneyRows);
  const aiSummary = summarizeRows(aiRows);

  const combinedSummary = summarizeRows([
    ...fullyOrganicRows, ...firstSessionOrganicRows, ...directRows, ...referralRows, ...noJourneyRows, ...aiRows,
  ]);

  fullyOrganicRows.forEach(r => { r.group = 'Fully Organic'; });
  firstSessionOrganicRows.forEach(r => { r.group = 'First-Session Organic'; });
  directRows.forEach(r => { r.group = 'Direct'; });
  referralRows.forEach(r => { r.group = 'Referral'; });
  noJourneyRows.forEach(r => { r.group = 'No Journey Data'; });
  aiRows.forEach(r => { r.group = 'AI Tools'; });
  const allOrders = [...fullyOrganicRows, ...firstSessionOrganicRows, ...directRows, ...referralRows, ...noJourneyRows, ...aiRows];

  const { grossSales, discounts, refunds, netSales, currency, multiCurrencyWarning } = fullyOrganicSummary;

  const responsePayload = {
    success: true,
    staff: staff === 'mahima'
      ? { name: 'Mahima', department: 'Organic Search', store: 'ledsone.de' }
      : { name: 'Sukirtha', department: 'Organic Search (SEO)', store: 'ledsone.de' },
    reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
    supportedMonths: SUPPORTED_MONTHS,
    isLive: monthConfig.isLive,
    source: staff === 'mahima'
      ? { scope: `product-scoped to Mahima's ${MAHIMA_EXCLUDED_PRODUCT_IDS.size} owned product IDs (the same list excluded from Sukirtha's store-wide organic sales below), ORGANIC channel classification`, orders: 'Shopify Admin GraphQL API', journey: 'Shopify customerJourneySummary' }
      : { scope: 'store-wide — every order counts, no product allocation / matching (mirrors sales-sukirtha-uk.js Email pattern, ORGANIC channel instead)', orders: 'Shopify Admin GraphQL API', journey: 'Shopify customerJourneySummary' },
    summary: {
      fullyOrganicOrders: fullyOrganicRows.length,
      unitsSold: fullyOrganicSummary.unitsSold, grossSales, discounts, refunds, netSales,
      averageRevenuePerOrder: fullyOrganicSummary.averageRevenuePerOrder,
      uniqueProductsSold: fullyOrganicSummary.uniqueProductsSold,
      currency, multiCurrencyWarning,
    },
    firstSessionOrganicSummary,
    combinedSummary,
    directSummary, referralSummary, noJourneySummary, aiSummary,
    allSukirthaOrders: allOrders,
    allMahimaOrders: allOrders,
    classificationCounts,
    meta: {
      generatedAt: new Date().toISOString(),
      cacheStatus: 'miss',
      ordersFetched: orders.length,
      fullyOrganicOrders: fullyOrganicRows.length,
      firstSessionOrganicOrders: firstSessionOrganicRows.length,
      pagesFetched: pages,
      throttleRetries: retryState.throttleRetries,
      executionMs: Date.now() - startTime,
    },
  };

  CACHE.set(cacheKey, { data: responsePayload, generatedAt: Date.now() });
  res.status(200).json(responsePayload);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const startTime = Date.now();
  const forceRefresh = req.query && req.query.refresh === '1';
  const monthConfig = resolveReportMonth(req.query && req.query.month);
  const type = req.query && req.query.type === 'email' ? 'email' : 'organic';

  try {
    if (!TOKEN) {
      res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
      return;
    }
    if (type === 'email') {
      await handleEmail(req, res, monthConfig, forceRefresh, startTime);
    } else {
      await handleOrganic(req, res, monthConfig, forceRefresh, startTime);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
