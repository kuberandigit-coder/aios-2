"""
jackshan_auto_update.py  — GitHub Actions edition
Runs daily via GitHub Actions scheduler.

Env vars required:
  GSC_SERVICE_ACCOUNT_JSON  — full JSON string of the service account key
  SHOPIFY_TOKEN             — Shopify Admin API token
"""

import json, os, re, time, sys, logging
from datetime import date, timedelta
import requests
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# ── Paths ────────────────────────────────────────────────────────────────────
REPO_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_PATH = os.path.join(REPO_DIR, 'pages', 'jakshan.html')
LOG_DIR   = os.path.join(REPO_DIR, 'scripts', 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

# ── Credentials from env vars ─────────────────────────────────────────────────
GSC_KEY_JSON = os.environ['GSC_SERVICE_ACCOUNT_JSON']
SHOPIFY_TOK  = os.environ['SHOPIFY_TOKEN']
SHOP_DOMAIN  = 'ledsone.myshopify.com'

# ── Logging ──────────────────────────────────────────────────────────────────
log_file = os.path.join(LOG_DIR, f'jackshan_update_{date.today()}.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)s  %(message)s',
    handlers=[logging.FileHandler(log_file, encoding='utf-8'),
              logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger(__name__)

# ── Date windows ─────────────────────────────────────────────────────────────
yesterday  = date.today() - timedelta(days=1)
END_DATE   = str(yesterday)
START_DATE = str(yesterday - timedelta(days=29))
WEEK_START = str(yesterday - timedelta(days=6))

log.info(f'Date range  : {START_DATE} to {END_DATE}')
log.info(f'Weekly range: {WEEK_START} to {END_DATE}')

# ── GSC setup ────────────────────────────────────────────────────────────────
SCOPE    = 'https://www.googleapis.com/auth/webmasters.readonly'
SITE_URL = 'sc-domain:ledsone.co.uk'
creds    = Credentials.from_service_account_info(json.loads(GSC_KEY_JSON), scopes=[SCOPE])
gsc      = build('searchconsole', 'v1', credentials=creds, cache_discovery=False)

# ── Product list (50 handles + correct live URLs) ────────────────────────────
BASE_URL = 'https://ledsone.co.uk/products/'

PRODUCTS = [
    ('ip68-waterproof-junction-box-outdoor-for-electrical-cable-wire-connector-5599',
     BASE_URL + 'ip68-waterproof-junction-box-outdoor-for-electrical-cable-wire-connector-5599'),
    ('rose-gold-lamp-shade-cap-for-pendant-light-socket-holder-fitting', None),
    ('40cm-black-metal-dome-pendant-light', None),
    ('modern-vintage-pendant-light-fitting-retro-industrial-style-e27-lamp-holder', None),
    ('pendant-light-fitting-ceiling-rose-e27-suspension-set-fabric-corded-rose-gold', None),
    ('tiffany-style-ceiling-pendant-hanging-mediterranean-style-lamp-light-decorative-home-4541', None),
    ('brushed-silver-metal-industrial-hanging-pendant-lighting-adjustable-hanging-barn-light', None),
    ('ledsone-industrial-vintage-32cm-orange-pendant-retro-metal-lamp-shade-e27-uk-holder',
     BASE_URL + 'industrial-pendant-lighting-with-32cm-orange-lampshade-over-the-kitchen-island'),
    ('lamp-shade-spring-clip-retainer-for-lamp-part-shades-5963', None),
    ('french-gold-pendant-lights-gold-ceiling-lights-metal-industrial-light-shade', None),
    ('e27-g95-40w-dimmable-antique-globe-industrial-retro-bulb', None),
    ('dc12v-60w-ip20-mini-universal-regulated-switching-led-transformer', None),
    ('industrial-vintage-style-wall-or-ceiling-light-b22-bar-conduits-light', None),
    ('3-light-bulb-guard-cage-cluster-pendant-lights', None),
    ('conduit-pipe-table-lamp-with-dimmer-switch-industrial-steampunk-light-5651', None),
    ('28w-compact-led-driver-ac-230v-to-dc12v-power-supply-transformer', None),
    ('3-light-ceiling-pendant-light-with-pulley-system', None),
    ('light-fixing-strap-brace-ceiling-rose-155mm-bracket-plate-with-accessories', None),
    ('ceramic-porcelain-type-6-es-e27-edison-screw-heat-bulb-variation-lamp-holder',
     BASE_URL + 'ceramic-porcelain-type-6-es-e27-edison-screw-heat-bulb-lamp-holder'),
    ('2pcs-bath-pedestal-rug-set-soft-non-slip-water-absorbent-mat-sets-5393', None),
    ('cone-wall-light', None),
    ('copper-lamp-shade-cap-for-pendant-light-socket-holder-fitting', None),
    ('dc12v-15w-led-driver-power-supply-transformer', None),
    ('warm-white-12v-led-waterproof-modules-ip67-outdoor-5677', None),
    ('5-x-vintage-pendant-cord-grip-strain-relief-metal-cable-lock-10mm-nut-6048', None),
    ('pipe-lighting-accessories-iron-5way-cross', None),
    ('industrial-vintage-various-colours-ceiling-light-fitting-e27-pendant-holder', None),
    ('3-core-army-green-round-vintage-italian-braided-fabric-cable-flex-0-75mm-uk', None),
    ('dc24v-ip67-30w-waterproof-led-driver-power-supply-transformer', None),
    ('screw-e27-white-plain-holder-bakelite-lamp-holder', None),
    ('vintage-e27-edison-screw-3w-filament-bulb-warm-white-2000k-amber-glass-5073', None),
    ('3-outlet-500mm-black-metal-ceiling-rose-square', None),
    ('red-wicker-rattan-lampshade-ceiling-pendant-light', None),
    ('black-finished-industrial-adjustable-pendant-light-fixture', None),
    ('plug-in-wall-light-kit-dimmer-uk-plug-flex-wire', None),
    ('orange-painted-metal-shade-lighting-vintage-pendant-light', None),
    ('vintage-edison-led-filament-bulb-g80-b22-4w-dimmable', None),
    ('fabric-hemp-flex-cable-kit-black-plug-in-pendant-lamp-light-e27-fitting-vintage-lamp', None),
    ('industrial-style-ceiling-light-three-b22-bar-conduits-light', None),
    ('black-bakelite-lamp-holder-industrial-socket-light-bulb-holder-5735', None),
    ('1m-white-pendant-light-holder', None),
    ('hemp-rope-metal-pendant-light-spider-light-hanging-light', None),
    ('fisherman-caged-conduit-pipe-light-shade-3-4-entry-wall-lantern-with-glass',
     BASE_URL + 'conduit-light-shade-5570'),
    ('retro-vintage-1cm-hole-barrel-cage-design-rattan-style-lamp-light-shades-4219', None),
    ('105mm-bracket-strap-brace-plate-with-accessories-ceiling-rose-light-fixing', None),
    ('linear-cage-pendant-light-fixture', None),
    ('b22-t185-60w-dimmable-vintage-light-filament-bulb', None),
    ('design-women-toe-post-flip-flop-beach-slipper-for-sea', None),
    ('industrial-ribbed-glass-wall-lights-replacement-lampshades-for-wall-lights', None),
    ('3-way-modern-black-ceiling-pendant-cluster-light-fitting-industrial-pendant-lampshade', None),
]

TITLES = {
    'ip68-waterproof-junction-box-outdoor-for-electrical-cable-wire-connector-5599': 'IP68 External Coaxial Junction Box For Electrical Cable Wire Connector',
    'rose-gold-lamp-shade-cap-for-pendant-light-socket-holder-fitting': 'Rose Gold Lamp Shade Cap For Pendant Light Socket Holder Fitting',
    '40cm-black-metal-dome-pendant-light': '40cm Black Metal Dome Pendant Light',
    'modern-vintage-pendant-light-fitting-retro-industrial-style-e27-lamp-holder': 'Modern Vintage Pendant Light Fitting Retro Industrial Style E27 Lamp Holder',
    'pendant-light-fitting-ceiling-rose-e27-suspension-set-fabric-corded-rose-gold': 'E27 Rose Gold Pendant Light Fitting Ceiling Rose Fabric Cable',
    'tiffany-style-ceiling-pendant-hanging-mediterranean-style-lamp-light-decorative-home-4541': 'Tiffany Style Ceiling Pendant Hanging Mediterranean Style Lamp Light',
    'brushed-silver-metal-industrial-hanging-pendant-lighting-adjustable-hanging-barn-light': 'Brushed Silver Metal Industrial Hanging Pendant Lighting Adjustable Barn Light',
    'ledsone-industrial-vintage-32cm-orange-pendant-retro-metal-lamp-shade-e27-uk-holder': 'Industrial Pendant Lighting with 32cm Orange Lampshade Over the Kitchen Island',
    'lamp-shade-spring-clip-retainer-for-lamp-part-shades-5963': 'Lamp Shade Spring Clip Retainer For Lamp Part Shades',
    'french-gold-pendant-lights-gold-ceiling-lights-metal-industrial-light-shade': 'French Gold Pendant Lights Gold Ceiling Lights Metal Industrial Light Shade',
    'e27-g95-40w-dimmable-antique-globe-industrial-retro-bulb': 'Edison Style E27 G95 Bulb 4W Dimmable Screw Vintage Globe Decorative Bulb',
    'dc12v-60w-ip20-mini-universal-regulated-switching-led-transformer': 'DC12V 60W IP20 Mini Universal Regulated Switching LED Transformer',
    'industrial-vintage-style-wall-or-ceiling-light-b22-bar-conduits-light': 'Industrial Vintage Style Wall or Ceiling Light B22 Bar Conduits Light',
    '3-light-bulb-guard-cage-cluster-pendant-lights': '3 Light Bulb Guard Cage Cluster Pendant Lights',
    'conduit-pipe-table-lamp-with-dimmer-switch-industrial-steampunk-light-5651': 'Conduit Pipe Table Lamp with Dimmer Switch Industrial Steampunk Light',
    '28w-compact-led-driver-ac-230v-to-dc12v-power-supply-transformer': '28W Compact LED Driver AC 230V to DC12V Power Supply Transformer',
    '3-light-ceiling-pendant-light-with-pulley-system': '3 Light Ceiling Pendant Light With Pulley System',
    'light-fixing-strap-brace-ceiling-rose-155mm-bracket-plate-with-accessories': 'Light Fixing Strap Brace Ceiling Rose 155mm Bracket Plate With Accessories',
    'ceramic-porcelain-type-6-es-e27-edison-screw-heat-bulb-variation-lamp-holder': 'High-Temp Porcelain Ceramic Heat Bulb Lamp Holder',
    '2pcs-bath-pedestal-rug-set-soft-non-slip-water-absorbent-mat-sets-5393': '2PCS Bath Pedestal Rug Set Soft Non-Slip Water Absorbent Mat Sets',
    'cone-wall-light': 'Black Cone Wall Light',
    'copper-lamp-shade-cap-for-pendant-light-socket-holder-fitting': 'Copper Lamp Shade Cap For Pendant Light Socket Holder Fitting',
    'dc12v-15w-led-driver-power-supply-transformer': 'DC12V 15W LED Driver Power Supply Transformer',
    'warm-white-12v-led-waterproof-modules-ip67-outdoor-5677': 'Warm White 12V LED Waterproof Modules IP67 Outdoor',
    '5-x-vintage-pendant-cord-grip-strain-relief-metal-cable-lock-10mm-nut-6048': '5x Vintage Pendant Cord Grip Strain Relief Metal Cable Lock 10mm Nut',
    'pipe-lighting-accessories-iron-5way-cross': 'Pipe Lighting Accessories Iron 5-Way Cross',
    'industrial-vintage-various-colours-ceiling-light-fitting-e27-pendant-holder': 'Industrial Vintage Various Colours Ceiling Light Fitting E27 Pendant Light',
    '3-core-army-green-round-vintage-italian-braided-fabric-cable-flex-0-75mm-uk': '3 Core Round Braided Army Green Fabric Lighting Cable',
    'dc24v-ip67-30w-waterproof-led-driver-power-supply-transformer': 'DC24V IP67 30W Waterproof LED Driver Power Supply Transformer',
    'screw-e27-white-plain-holder-bakelite-lamp-holder': 'Screw E27 White Plain Holder Bakelite Lamp Holder',
    'vintage-e27-edison-screw-3w-filament-bulb-warm-white-2000k-amber-glass-5073': 'Vintage E27 Edison Screw 3W Filament Bulb Warm White 2000K Amber Glass',
    '3-outlet-500mm-black-metal-ceiling-rose-square': '3 Outlet 500mm Black Metal Ceiling Rose Square',
    'red-wicker-rattan-lampshade-ceiling-pendant-light': 'Red Wicker Rattan Lampshade Ceiling Pendant Light',
    'black-finished-industrial-adjustable-pendant-light-fixture': 'Black Finished Industrial Adjustable Pendant Light Fixture',
    'plug-in-wall-light-kit-dimmer-uk-plug-flex-wire': 'Plug-In Wall Light Kit Dimmer UK Plug Flex Wire',
    'orange-painted-metal-shade-lighting-vintage-pendant-light': 'Orange Painted Metal Shade Lighting Vintage Pendant Light',
    'vintage-edison-led-filament-bulb-g80-b22-4w-dimmable': 'Vintage Edison LED Filament Bulb G80 B22 4W Dimmable',
    'fabric-hemp-flex-cable-kit-black-plug-in-pendant-lamp-light-e27-fitting-vintage-lamp': 'Fabric Hemp Flex Cable Kit Black Plug-In Pendant Lamp Light E27 Fitting',
    'industrial-style-ceiling-light-three-b22-bar-conduits-light': 'Industrial Style Ceiling Light Three B22 Bar Conduits Light',
    'black-bakelite-lamp-holder-industrial-socket-light-bulb-holder-5735': 'E27 Black Bakelite Lamp Holder Industrial Socket Light Bulb Holder',
    '1m-white-pendant-light-holder': '1m White Pendant Light Holder',
    'hemp-rope-metal-pendant-light-spider-light-hanging-light': 'Hemp Rope Metal Pendant Light Spider Light Hanging Light',
    'fisherman-caged-conduit-pipe-light-shade-3-4-entry-wall-lantern-with-glass': 'Fisherman Caged Conduit Pipe Light Shade Wall Lantern with Glass',
    'retro-vintage-1cm-hole-barrel-cage-design-rattan-style-lamp-light-shades-4219': 'Retro Vintage 1cm Hole Barrel Cage Design Rattan Style Lamp Light Shade',
    '105mm-bracket-strap-brace-plate-with-accessories-ceiling-rose-light-fixing': '105mm Bracket Strap Brace Plate With Accessories Ceiling Rose Light Fixing',
    'linear-cage-pendant-light-fixture': 'Linear Cage Pendant Light Fixture',
    'b22-t185-60w-dimmable-vintage-light-filament-bulb': 'B22 T185 60W Dimmable Vintage Light Filament Bulb',
    'design-women-toe-post-flip-flop-beach-slipper-for-sea': 'Design Women Toe Post Flip Flop Beach Slipper For Sea',
    'industrial-ribbed-glass-wall-lights-replacement-lampshades-for-wall-lights': 'Industrial Ribbed Glass Wall Lights Replacement Lampshades For Wall Lights',
    '3-way-modern-black-ceiling-pendant-cluster-light-fitting-industrial-pendant-lampshade': '3 Way Modern Black Ceiling Pendant Cluster Light Fitting Industrial Lampshade',
}

META = {
    'ip68-waterproof-junction-box-outdoor-for-electrical-cable-wire-connector-5599': ('Multi way IP68 Waterproof Coax junction box | LEDSone UK', 'Shop heavy-duty, IP68 waterproof satellite cable junction boxes at LEDSone. Ideal for outdoor, TV, coax, & satellite wire connections. Fast UK shipping!', 'IP68  external coaxial junction box For Electrical Cable Wire Connector~5599'),
    'rose-gold-lamp-shade-cap-for-pendant-light-socket-holder-fitting': ('Rose Gold Pendant Cap | Ceiling Light Shade Fitter Ring - LEDSone', 'Premium rose gold light ceiling cap designed to secure shades or cover bare threads on E27 pendant fittings. Perfect for sleek minimalist DIY lighting- UK stock', 'Rose Gold Lamp Shade Cap for Pendant Light Socket Holder Fitting~1030'),
    '40cm-black-metal-dome-pendant-light': ('Modern Large Black Metal Dome Pendant Light', 'Raise the Dimensions in the area! with use this Modern Black Metal Dome Pendant. Ideal for living spaces and bedrooms.', 'Modern Large Ceiling Black Metal Dome Pendant Light ~1845'),
    'modern-vintage-pendant-light-fitting-retro-industrial-style-e27-lamp-holder': ('E27 Copper shiny Vintage Retro Industrial Style Lamp Holder', 'Free UK Shipping On Order Over £20 This Brass Socket is a great addition to any style space with an exposed vintage bulb.', 'Lamp Bulb Holder For E27 Lamp Base~2496'),
    'pendant-light-fitting-ceiling-rose-e27-suspension-set-fabric-corded-rose-gold': ('E27 Rose Gold Pendant Light Fitting with Ceiling Rose', 'Rose gold E27 pendant light fitting with ceiling rose and 90cm fabric cable. Vintage suspension set ideal for kitchens, dining rooms and DIY lighting.', 'E27 Rose Gold Pendant Light Fitting Ceiling Rose Fabric Cable~2383'),
    'tiffany-style-ceiling-pendant-hanging-mediterranean-style-lamp-light-decorative-home-4541': ('Tiffany Style Stained Glass Lampshades only', 'Find Stained Glass Tiffany Style Lampshades! Shop Lamps & Lampshades at our Ledsone.co.uk Enjoy Free shipping Over £20 in UK Free return within 30days!', 'Tiffany style Pendant Hanging Mediterranean Style Decorative Light Shade~4541'),
    'brushed-silver-metal-industrial-hanging-pendant-lighting-adjustable-hanging-barn-light': ('Brushed Silver Metal Industrial Pendant Hanging Barn Light~1432', 'Features: Vintage country style pendant light, elegant and finely. Metal lamp holder, retro vintage look pendant lamp shades.', 'Brushed Silver Metal Industrial Hanging Pendant Lighting Adjustable Hanging Barn Light~1432'),
    'ledsone-industrial-vintage-32cm-orange-pendant-retro-metal-lamp-shade-e27-uk-holder': ('Industrial Pendant Lighting with Orange Metal Lampshade | LEDSone UK', "Don't miss out stylish industrial pendant lighting in orange for your kitchen island. Brighten your space with unique designs Buy now and enjoy!", 'Industrial Pendant Lighting with 32cm Orange Lampshade Over the kitchen island ~3685'),
    'lamp-shade-spring-clip-retainer-for-lamp-part-shades-5963': ('Lamp Shade Spring Clip Retainer - Glass Ceiling Light Cover Fix', 'Secure glass or metal shades tightly with high-tension, British standards-tested spring clip retainers. Durable replacement parts by LEDSone.', 'Lamp Shade Spring Clip Retainer for Lamp Part Shades~5963'),
    'french-gold-pendant-lights-gold-ceiling-lights-metal-industrial-light-shade': ('Gold Metal Ceiling Light | Industrial Pendant light| LEDSone', 'Shop our French gold metal ceiling light from £14.29. Features a modern industrial dome shade & adjustable E27 base. Ideal for kitchen islands. UK stock', 'French Gold Pendant Lights Gold Ceiling Lights Metal Industrial Light Shade~1519'),
    'e27-g95-40w-dimmable-antique-globe-industrial-retro-bulb': ('G95 Bulb E27 - 40W Dimmable Vintage Globe Light 95mm UK', 'G95 E27 bulb with 95mm globe size. Dimmable vintage light bulb perfect for decorative lighting. Ideal for pendant lights, homes & industrial interiors.', 'Edison Style E27 G95 Bulb 4W Dimmable Screw Vintage Globe Decorative Bulb~1531'),
    'dc12v-60w-ip20-mini-universal-regulated-switching-led-transformer': ('12V 60W LED Transformer Switching Power Supply 5A', '12V 60W LED transformer with 5A output for LED strip lights, displays, and low-voltage electronics.', '12V 60W LED Transformer 5A Switching Power Supply AC to DC~3332'),
    'industrial-vintage-style-wall-or-ceiling-light-b22-bar-conduits-light': ('Ceiling Light Bar', 'Transform your space with a ceiling light bar. Find the perfect blend of style and functionality with our range of modern and elegant designs.', 'Vintage Style B22 Single Conduit Ceiling Light - Industrial Retro Lighting Fitting~1555'),
    '3-light-bulb-guard-cage-cluster-pendant-lights': ('Cage Pendant light fixture | 3 cluster pendant Lights Uk', 'Discover our cage pendant light fixture cluster of three lights, perfect for Stair case Over Dining table living Room Free shipping on Eligible orders.', 'Stylish Light Bulb Cages & Cluster Ceiling Lights ~ 5168'),
    'conduit-pipe-table-lamp-with-dimmer-switch-industrial-steampunk-light-5651': ('Industrial Steampunk Dimmable Lamp', 'Vintage Conduit Pipe Table Lamp with dimmer switch for adjustable brightness. Perfect for lofts, kitchens, and living rooms.', 'Conduit Pipe Table Lamp Kit with Dimmer Switch Steampunk Light -5651'),
    '28w-compact-led-driver-ac-230v-to-dc12v-power-supply-transformer': ('28W 2Amp DC 12V LED Driver Adapter Power Supply Transformer', 'Explore our website for compact LED drivers and constant voltage power supply transformers.', '28W 2Amp Compact LED Driver AC 230V to DC12V Power Supply Transformer~1001'),
    '3-light-ceiling-pendant-light-with-pulley-system': ('Ceiling Light Pulley System - 3 Light Industrial Pendant Chandelier UK', 'Adjustable ceiling light pulley system with 3 pendant lights. Industrial chandelier design with height control. Perfect for kitchens, dining & loft spaces.', 'Ceiling Light Pulley System - 3 Light Industrial Pendant Chandelier ~5952'),
    'light-fixing-strap-brace-ceiling-rose-155mm-bracket-plate-with-accessories': ('Light Fixing brace ceiling rose 155mm bracket Plate with accessories', 'Free UK Shipping On Order Over £20 | Brand New Ceiling Plate Bracket Material: iron + plating. Ideal for hanging chandeliers & light fittings.', '155mm Ceiling Rose Strap Side fitting Bracket~2399'),
    'ceramic-porcelain-type-6-es-e27-edison-screw-heat-bulb-variation-lamp-holder': ('Ceramic Heat Bulb Lamp Holder E27 Edison', 'Find the perfect replacement for your damaged bulb sockets with our High-Temp Porcelain Ceramic Heat Bulb Lamp Holder. AC110V-250V. Claim your offer today!', 'High-Temp Porcelain Ceramic Heat Bulb Lamp Holder~2961'),
    '2pcs-bath-pedestal-rug-set-soft-non-slip-water-absorbent-mat-sets-5393': ('2PCS U shape Bath and pedestal mats', 'Discover the perfect modern rubber door mat for your outdoor or indoor kitchen. FREE SHIPPING.', '2PCS Bath & Pedestal Rug Set Soft Non-Slip Water Absorbent Mat Sets~5393'),
    'cone-wall-light': ('Swan Neck Wall Light Indoor | Ledsone.co.uk', 'Buy Swan neck wall lights and get the best deals at the lowest price at our ledsone.co.uk Great Savings & Free delivery!', 'Black Cone Wall Light~2673'),
    'copper-lamp-shade-cap-for-pendant-light-socket-holder-fitting': ('Decorative Lamp Shade Cap for Pendant Lights Copper', 'Check out our amazing range of copper decorative light shade caps for pendant lights.', 'Copper Lampshade Fitter Cap | Premium Pendant Finish ~1035'),
    'dc12v-15w-led-driver-power-supply-transformer': ('AC DC Adapter 12V', 'Power up your devices with our selection of AC DC Adapter 12V options. Find the perfect adapter for your needs at our online store.', '12V LED Driver Power Supply 15W - Reliable Transformer for LED Strips ~3265'),
    'warm-white-12v-led-waterproof-modules-ip67-outdoor-5677': ('Water Resistant Led Module Warm White', 'Explore our collection of water-resistant led module cool white, designed for versatility and longevity. Shop online now!', 'Industrial 12V IP67 Waterproof Warm White Injection LED Modules ~ 5677'),
    '5-x-vintage-pendant-cord-grip-strain-relief-metal-cable-lock-10mm-nut-6048': ('5x Vintage Pendant Cord Grips | 10mm Metal Cable Lock | LedsOne', 'Secure your pendant lights safely with this 5-pack of vintage metal cord grips. 10mm strain relief cable locks for a professional, clean finish.', '5 Pack Pendant M10 Cord Grip Strain Relief Metal Lock nut - 6048'),
    'pipe-lighting-accessories-iron-5way-cross': ('Pipe lighting accessories - iron 5Way Cross', 'Perfect for all big and little DIY projects around the home such as lamps, coffee tables, benches, bookshelves, hangers, vintage lighting.', 'Pipe lighting accessories - iron 5Way Cross~2398'),
    'industrial-vintage-various-colours-ceiling-light-fitting-e27-pendant-holder': ('E27 Pendant Holder Ceiling Light Fitting Vintage Industrial Burgundy', 'E27 Pendant Holder Ceiling Light Fitting Vintage Industrial Burgundy', 'Industrial Vintage Various colours Ceiling Light Fitting E27 Pendant Light ~4050'),
    '3-core-army-green-round-vintage-italian-braided-fabric-cable-flex-0-75mm-uk': ('3 Core Round Braided Army Green Fabric Lighting Cable 1M/5M/10M', 'Upgrade indoor lighting with 3 core round braided army green fabric cable. Flexible, vintage-style cord ideal for pendant, table, and floor lamps.', '3 Core Round Braided Army Green Fabric Lighting Cable 1M/5M/10M~3184'),
    'dc24v-ip67-30w-waterproof-led-driver-power-supply-transformer': ('DC24V IP67 30W Waterproof LED Driver Power Supply Transformer', 'constant current led driver led transformer 24v, 24v led transformer, 24 volt led driver.', 'IP67 DC24V 30W  LED Driver Power Supply Transformer~3349'),
    'screw-e27-white-plain-holder-bakelite-lamp-holder': ('E27 White Plain Bakelite Lamp Holder', 'Discover the perfect socket for vintage lamps with our E27 White Plain Holder Bakelite Lamp Holder. Upgrade your lighting and enhance your space.', 'E27 White Bakelite Lamp Holder | Vintage Style Socket~2982'),
    'vintage-e27-edison-screw-3w-filament-bulb-warm-white-2000k-amber-glass-5073': ('Warm White Light Bulbs', 'Warm white lightbulbs can completely change your house! Feel the calming atmosphere they provide in your home.', 'D64-200 Lumens E27 Vintage Bulb- Incandescent~5073'),
    '3-outlet-500mm-black-metal-ceiling-rose-square': ('Square Ceiling Rose Plate - Black Metal Light Fixture Mount (3 Outlet)', 'Black square ceiling rose plate with 3 outlets for pendant lighting setups. Ideal for mounting multiple lights securely. Durable metal design for modern interiors.', 'Black Square Ceiling Rose - 3 Outlet Light Plate ~1169'),
    'red-wicker-rattan-lampshade-ceiling-pendant-light': ('[DATA ERROR - Shopify meta title set to wrong product]', 'Bring warm, boho vibes to your home with this red wicker rattan lampshade. A stunning ceiling pendant light for living rooms & bedrooms.', 'Red Wicker Rattan Lampshade Ceiling Pendant Light~1811'),
    'black-finished-industrial-adjustable-pendant-light-fixture': ('Vintage Adjustable Pendant Light Fixture', 'Huge Metal Adjustable Pendant Light Fixture - Free Shipping over £20. Discover a wide range of hanging pendant lights for every style.', 'Industrial Adjustable Single Pendant Light Fixture ~3745'),
    'plug-in-wall-light-kit-dimmer-uk-plug-flex-wire': ('Plug In Pendant Light Kit with Dimmer - Wall Light Wiring Kit UK', 'Add dimmable accent lighting without complex wiring using a tested plug-in wall light kit with a fused UK plug from LEDSone.', 'Plug-in Wall Light Kit | Dimmer, UK Plug, Flex Wire ~ 5763'),
    'orange-painted-metal-shade-lighting-vintage-pendant-light': ('Retro Orange Pendant Light - Vintage Metal Ceiling Hanging Lamp UK', 'Retro orange pendant light with vintage metal shade. Perfect for kitchens, dining rooms & bold interior styles. Stylish hanging ceiling light for modern and retro decor.', 'Orange Painted Metal Shade Lighting Vintage Pendant Light~1507'),
    'vintage-edison-led-filament-bulb-g80-b22-4w-dimmable': ('Dimmable Bayonet Bulb', 'Brighten up your home with dimmable bayonet bulbs. Shop now for the best deals on energy-saving lighting options.', 'Vintage Edison LED Filament Bulb G80 B22 4W Dimmable ~3078'),
    'fabric-hemp-flex-cable-kit-black-plug-in-pendant-lamp-light-e27-fitting-vintage-lamp': ('Fabric Hemp Flex Cable kit Black Plug In Pendant Light E27 Fitting', 'Free Uk Shipping on order over £20 EXPRESS 24Hrs delivery available. 30 days return policy available.', 'Fabric Hemp Flex Cable kit Black Plug In Pendant Lamp Light E27~3692'),
    'industrial-style-ceiling-light-three-b22-bar-conduits-light': ('Industrial Style Ceiling Light', 'Illuminate your space with our industrial style ceiling light. Create a trendy and modern atmosphere in any room.', 'Industrial Style Ceiling Light Three B22 Bar Conduits Light ~1557'),
    'black-bakelite-lamp-holder-industrial-socket-light-bulb-holder-5735': ('Black Bakelite Lamp Holder E27 - Vintage Industrial Bulb Socket UK | LEDSone', 'Shop our black bakelite E27 lamp holder - heat-resistant, vintage industrial style, compatible with all E27 bulbs. Available in packs of 1-10. UK stock, free delivery over £25.', 'E27 Black Bakelite Lamp Holder Industrial Socket Light Bulb Holder ~5735'),
    '1m-white-pendant-light-holder': ('1m White Pendant Light Holder', 'Bulb socket | lamp socket | bracket bulb | base socket | bulb holder | lamp rings | threaded holders | Screw holders.', '1m White Pendant Light Holder~1695'),
    'hemp-rope-metal-pendant-light-spider-light-hanging-light': ('Hemp Rope Pendant Light with Green Lampshade | Spider Light | Ledsone UK', 'Buy Industrial Ceiling Pendant Light and Get the Best Price On Ledsone. UK Free shipping orders over £25.', 'Hemp Rope Metal Hooked Pendant Light ~5045'),
    'fisherman-caged-conduit-pipe-light-shade-3-4-entry-wall-lantern-with-glass': ('Fisherman Wall Lantern E27 - Caged Conduit Pipe Light UK - LEDSONE', 'Industrial fisherman wall lantern with removable cage and frosted glass shade. E27 fitting, weather-resistant. UK stock, free delivery over £25.', 'Fisherman Caged Conduit Pipe Light Shade 3/4" Entry Wall Lantern with Glass -5570'),
    'retro-vintage-1cm-hole-barrel-cage-design-rattan-style-lamp-light-shades-4219': ('Rattan Barrel Cage Lamp Shade E27 - Boho Easy Fit UK | LEDSone', 'Natural rattan barrel cage lamp shade with E27 fitting. Boho-style, easy fit, eco-friendly material. UK stock, free delivery over £25.', '1cm Hole Barrel Cage Design E27 Rattan Style Lamp Light Shade~4219'),
    '105mm-bracket-strap-brace-plate-with-accessories-ceiling-rose-light-fixing': ('105mm bracket strap brace Plate with accessories ceiling rose Light.', 'Free UK Shipping On Order Over £20 | Brand New Ceiling Plate Bracket Material: iron + plating. Ideal for hanging chandeliers & light fittings up to 5kg.', '105mm Ceiling Rose Strap Side fitting Bracket~2392'),
    'linear-cage-pendant-light-fixture': ('Rectangular Cage Chandelier - Linear Island Pendant Light UK', 'Rectangular cage chandelier with 3 linear pendant lights. Brass or black, dimmable, E27. Ideal for kitchen islands & dining tables. UK stock.', 'Linear Cage Pendant Light Fixture~3775'),
    'b22-t185-60w-dimmable-vintage-light-filament-bulb': ('E27 T130 60W Dimmable Vintage Light Filament Bulb', 'B22 T185 60W Vintage Retro Industrial Filament Bulb Base: B22 Input Voltage: AC 220-240V Certification: CE & RoHS certified.', 'E27 T130 60W Dimmable Vintage Light Filament Bulb~3070'),
    'design-women-toe-post-flip-flop-beach-slipper-for-sea': ("Rubber seaside women's toe post Flip Flop beach Slipper", "Explore our website for the trendiest rubber seaside women's toe post flip flop beach slipper. Get 10% off.", 'Design Rubber Women Toe Post Flip Flop Beach Slipper for Sea ~5212'),
    'industrial-ribbed-glass-wall-lights-replacement-lampshades-for-wall-lights': ('ribbed glass wall light uk | glass wall lights', 'View our collection of gorgeous stunning ribbed glass wall lights ideal for adding flair to your house!', 'Industrial Ribbed Glass Wall Light Fits Standard UK Wall Lights (E27) ~1774'),
    '3-way-modern-black-ceiling-pendant-cluster-light-fitting-industrial-pendant-lampshade': ('3 Way Modern Black Ceiling Pendant Cluster Light Fitting Industrial Pendant Lampshade', 'Vintage Retro Modern Black Ceiling Pendant Lights Check Our Store for More Vintage Lighting Products.', 'Flat Modern Black 3 Light Pendant Ceiling Light ~2137'),
}

# ── STEP 1: Shopify Admin API — fetch sales by handle ────────────────────────
log.info('--- Shopify: fetching sales data ---')

SHOPIFY_GQL = f'https://{SHOP_DOMAIN}/admin/api/2024-01/graphql.json'
HEADERS = {'X-Shopify-Access-Token': SHOPIFY_TOK, 'Content-Type': 'application/json'}

HANDLE_OVERRIDE = {
    'ledsone-industrial-vintage-32cm-orange-pendant-retro-metal-lamp-shade-e27-uk-holder':
        'industrial-pendant-lighting-with-32cm-orange-lampshade-over-the-kitchen-island',
    'ceramic-porcelain-type-6-es-e27-edison-screw-heat-bulb-variation-lamp-holder':
        'ceramic-porcelain-type-6-es-e27-edison-screw-heat-bulb-lamp-holder',
    'fisherman-caged-conduit-pipe-light-shade-3-4-entry-wall-lantern-with-glass':
        'conduit-light-shade-5570',
}

def shopify_order_count(start, end):
    counts = {}
    cursor = None
    page = 0
    while True:
        page += 1
        after = f', after: "{cursor}"' if cursor else ''
        query = f'''
        {{
          orders(first: 250{after}, query: "created_at:>={start} created_at:<={end} financial_status:paid") {{
            edges {{
              node {{
                lineItems(first: 50) {{
                  edges {{
                    node {{
                      product {{ handle }}
                    }}
                  }}
                }}
              }}
            }}
            pageInfo {{ hasNextPage endCursor }}
          }}
        }}'''
        resp = requests.post(SHOPIFY_GQL, headers=HEADERS, json={'query': query}, timeout=30)
        data = resp.json()
        orders = data.get('data', {}).get('orders', {})
        for edge in orders.get('edges', []):
            for li in edge['node']['lineItems']['edges']:
                prod = li['node'].get('product')
                if prod:
                    h = prod['handle']
                    counts[h] = counts.get(h, 0) + 1
        pi = orders.get('pageInfo', {})
        if not pi.get('hasNextPage'):
            break
        cursor = pi['endCursor']
        time.sleep(0.3)
    log.info(f'  Orders page {page}: {sum(counts.values())} line items across {len(counts)} products')
    return counts

monthly_counts = shopify_order_count(START_DATE, END_DATE)
weekly_counts  = shopify_order_count(WEEK_START, END_DATE)
log.info(f'Monthly sales fetched: {len(monthly_counts)} products with orders')
log.info(f'Weekly sales fetched:  {len(weekly_counts)} products with orders')

def get_sales(dash_handle, counts):
    live = HANDLE_OVERRIDE.get(dash_handle, dash_handle)
    return counts.get(live, 0)

# ── STEP 2: GSC API ───────────────────────────────────────────────────────────
log.info('--- GSC: querying all 50 products ---')

def page_filter(url):
    return [{'filters': [{'dimension': 'page', 'operator': 'equals', 'expression': url}]}]

def get_page_totals(url):
    resp = gsc.searchanalytics().query(siteUrl=SITE_URL, body={
        'startDate': START_DATE, 'endDate': END_DATE,
        'dimensions': ['page'],
        'dimensionFilterGroups': page_filter(url),
        'rowLimit': 1,
    }).execute()
    rows = resp.get('rows', [])
    if not rows: return None
    r = rows[0]
    clk = int(r['clicks']); imp = int(r['impressions'])
    return {'pageClicks': clk, 'pageImpressions': imp,
            'pageCtr': round(clk / imp * 100, 2) if imp else 0.0,
            'pageAvgPosition': round(r['position'], 1)}

def get_priority_keyword(url):
    resp = gsc.searchanalytics().query(siteUrl=SITE_URL, body={
        'startDate': START_DATE, 'endDate': END_DATE,
        'dimensions': ['page', 'query'],
        'dimensionFilterGroups': page_filter(url),
        'rowLimit': 1000,
    }).execute()
    rows = resp.get('rows', [])
    if not rows: return None
    ranked = sorted(rows, key=lambda r: (-int(r['clicks']), -int(r['impressions']), r['position'], r['keys'][1]))
    top = ranked[0]
    return {'priorityKeyword': top['keys'][1],
            'kwClicks': int(top['clicks']),
            'kwImpressions': int(top['impressions']),
            'kwAvgPosition': round(top['position'], 1)}

GSC_DATA = {}
for i, (handle, override_url) in enumerate(PRODUCTS):
    url = override_url if override_url else BASE_URL + handle
    try:
        totals = get_page_totals(url); time.sleep(0.2)
        kw = get_priority_keyword(url) if totals else None; time.sleep(0.2)
        if totals:
            GSC_DATA[handle] = {'url': url, **totals, **(kw or {})}
            log.info(f'  [{i+1:02d}] {handle[:50]} clk={totals["pageClicks"]} imp={totals["pageImpressions"]}')
        else:
            GSC_DATA[handle] = {'url': url}
            log.info(f'  [{i+1:02d}] {handle[:50]} no GSC data')
    except Exception as e:
        GSC_DATA[handle] = {'url': url}
        log.error(f'  [{i+1:02d}] {handle[:50]} ERROR: {e}')

# ── STEP 3: Build datasets ────────────────────────────────────────────────────
log.info('--- Building datasets ---')

def req1_action(clk, imp, has_gsc):
    if not has_gsc: return 'Data validation required'
    if clk >= 1:    return 'Rewrite meta tags + re-optimize keywords'
    if imp >= 100:  return 'Check intent mismatch before optimizing'
    return 'Do not optimize'

REQ1_ROWS = []
REQ2_ROWS = []

for handle, _ in PRODUCTS:
    g   = GSC_DATA.get(handle, {})
    url = g.get('url', BASE_URL + handle)
    mt, md, h1 = META.get(handle, ('Missing', 'Missing', 'Missing'))

    has_gsc = g.get('pageImpressions') is not None
    pc  = g.get('pageClicks', 0)
    pi  = g.get('pageImpressions', 0)
    ctr = g.get('pageCtr', None) if has_gsc else None
    pap = g.get('pageAvgPosition', None)
    kw  = g.get('priorityKeyword') or ('No keyword data' if has_gsc else 'No GSC data')
    kwc = g.get('kwClicks', 0)
    kwi = g.get('kwImpressions', 0)
    kwa = g.get('kwAvgPosition', None)
    act = req1_action(pc, pi, has_gsc)
    ds  = 'GSC data available' if has_gsc else 'Product resolved - no matched GSC data'

    REQ1_ROWS.append({
        'productUrl': url, 'priorityKeyword': kw,
        'pageImpressions': pi, 'pageClicks': pc,
        'pageCtr': ctr, 'pageAvgPosition': pap,
        'kwImpressions': kwi, 'kwClicks': kwc, 'kwAvgPosition': kwa,
        'metaTitle': mt, 'metaDescription': md, 'h1': h1,
        'recommendedAction': act, 'dataStatus': ds,
    })

    monthly_s = get_sales(handle, monthly_counts)
    weekly_s  = get_sales(handle, weekly_counts)
    ctr_val   = ctr if ctr is not None else 0.0
    optimize  = (monthly_s <= 1) and (ctr_val < 5.0)
    status    = 'Optimize' if optimize else 'Do Not Optimize'
    r2_action = ('Review title | Improve meta description | Improve H1 | Add internal links | Improve product content'
                 if optimize else 'Continue monitoring')

    REQ2_ROWS.append({
        'handle': handle, 'productUrl': url,
        'productTitle': TITLES[handle],
        'weeklySales': weekly_s, 'monthlySales': monthly_s,
        'monthlyClicks': pc, 'monthlyImpressions': pi,
        'monthlyCtr': round(ctr_val, 2),
        'avgPosition': pap,
        'status': status, 'action': r2_action,
    })

# ── KPI calculations ──────────────────────────────────────────────────────────
r1_rewrite    = sum(1 for r in REQ1_ROWS if 'Rewrite' in r['recommendedAction'])
r1_intent     = sum(1 for r in REQ1_ROWS if 'intent' in r['recommendedAction'])
r1_dno        = sum(1 for r in REQ1_ROWS if r['recommendedAction'] == 'Do not optimize')
r1_validation = sum(1 for r in REQ1_ROWS if r['recommendedAction'] == 'Data validation required')
r1_with_gsc   = sum(1 for r in REQ1_ROWS if r['dataStatus'] == 'GSC data available')
r1_no_gsc     = 50 - r1_with_gsc

r2_optimize  = sum(1 for r in REQ2_ROWS if r['status'] == 'Optimize')
r2_dno       = sum(1 for r in REQ2_ROWS if r['status'] == 'Do Not Optimize')
r2_total_clk = sum(r['monthlyClicks'] for r in REQ2_ROWS)
r2_total_imp = sum(r['monthlyImpressions'] for r in REQ2_ROWS)
r2_avg_ctr   = round(r2_total_clk / r2_total_imp * 100, 2) if r2_total_imp else 0.0

log.info(f'Req1 — Rewrite:{r1_rewrite} Intent:{r1_intent} DNO:{r1_dno} Val:{r1_validation}')
log.info(f'Req2 — Optimize:{r2_optimize} DNO:{r2_dno} Avg CTR:{r2_avg_ctr}%')

# ── STEP 4: Build HTML ────────────────────────────────────────────────────────
log.info('--- Building HTML ---')

def js_str(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    s = str(v).replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
    return f'"{s}"'

def r1_obj(r):
    return ('{' + ','.join([
        f'productUrl:{js_str(r["productUrl"])}',
        f'priorityKeyword:{js_str(r["priorityKeyword"])}',
        f'pageImpressions:{js_str(r["pageImpressions"])}',
        f'pageClicks:{js_str(r["pageClicks"])}',
        f'pageCtr:{js_str(r["pageCtr"])}',
        f'pageAvgPosition:{js_str(r["pageAvgPosition"])}',
        f'kwImpressions:{js_str(r["kwImpressions"])}',
        f'kwClicks:{js_str(r["kwClicks"])}',
        f'kwAvgPosition:{js_str(r["kwAvgPosition"])}',
        f'metaTitle:{js_str(r["metaTitle"])}',
        f'metaDescription:{js_str(r["metaDescription"])}',
        f'h1:{js_str(r["h1"])}',
        f'recommendedAction:{js_str(r["recommendedAction"])}',
        f'dataStatus:{js_str(r["dataStatus"])}',
    ]) + '}')

def r2_obj(r):
    return ('{' + ','.join([
        f'handle:{js_str(r["handle"])}',
        f'productUrl:{js_str(r["productUrl"])}',
        f'productTitle:{js_str(r["productTitle"])}',
        f'weeklySales:{js_str(r["weeklySales"])}',
        f'monthlySales:{js_str(r["monthlySales"])}',
        f'monthlyClicks:{js_str(r["monthlyClicks"])}',
        f'monthlyImpressions:{js_str(r["monthlyImpressions"])}',
        f'monthlyCtr:{js_str(r["monthlyCtr"])}',
        f'avgPosition:{js_str(r["avgPosition"])}',
        f'status:{js_str(r["status"])}',
        f'action:{js_str(r["action"])}',
    ]) + '}')

r1_data_js = 'const RAW_DATA = [\n' + ',\n'.join(r1_obj(r) for r in REQ1_ROWS) + '\n];'
r2_data_js = 'const REQ2_DATA = [\n' + ',\n'.join(r2_obj(r) for r in REQ2_ROWS) + '\n];'

generated_stamp = f'Auto-updated: {date.today()} | Period: {START_DATE} to {END_DATE}'

with open(HTML_PATH, encoding='utf-8') as f:
    html = f.read()

html = re.sub(r'const RAW_DATA = \[.*?\];', r1_data_js, html, flags=re.DOTALL)
html = re.sub(r'const REQ2_DATA = \[.*?\];', r2_data_js, html, flags=re.DOTALL)
html = re.sub(r'Generated: \d{4}-\d{2}-\d{2}', f'Generated: {date.today()}', html)
html = re.sub(r'Auto-updated: .*?\|.*?(?=<)', generated_stamp, html)

def upd_kpi(h, kpi_id, val):
    return re.sub(rf'(id="{kpi_id}">)[^<]*(</div>)', rf'\g<1>{val}\g<2>', h)

html = upd_kpi(html, 'kpi-rewrite',    r1_rewrite)
html = upd_kpi(html, 'kpi-intent',     r1_intent)
html = upd_kpi(html, 'kpi-dno',        r1_dno)
html = upd_kpi(html, 'kpi-validation', r1_validation)
html = upd_kpi(html, 'r2-kpi-opt',     r2_optimize)
html = upd_kpi(html, 'r2-kpi-dno',     r2_dno)

html = re.sub(r'(Avg CTR</div><div class="kpi-value"[^>]*>)[^<]*(</div>)',
              rf'\g<1>{r2_avg_ctr}%\g<2>', html)
html = re.sub(r'(Total Monthly Clicks</div><div class="kpi-value">)[^<]*(</div>)',
              rf'\g<1>{r2_total_clk}\g<2>', html)
html = re.sub(r'(Total Monthly Impressions</div><div class="kpi-value"[^>]*>)[^<]*(</div>)',
              rf'\g<1>{r2_total_imp:,}\g<2>', html)

with open(HTML_PATH, 'w', encoding='utf-8') as f:
    f.write(html)

log.info(f'HTML written: {len(html):,} bytes -> {HTML_PATH}')
log.info('--- Update complete ---')
log.info(f'Req1: Rewrite={r1_rewrite} Intent={r1_intent} DNO={r1_dno} NoGSC={r1_no_gsc}')
log.info(f'Req2: Optimize={r2_optimize} DNO={r2_dno} AvgCTR={r2_avg_ctr}% Clicks={r2_total_clk} Imp={r2_total_imp:,}')
