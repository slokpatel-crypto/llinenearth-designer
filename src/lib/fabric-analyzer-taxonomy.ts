import "server-only";

export const MENSWEAR_MATERIAL_TAXONOMY = [
  "linen","cotton","wool","merino wool","cashmere","mohair","alpaca","silk","hemp","ramie",
  "viscose/rayon","lyocell","modal","cupro","acetate","polyester","nylon/polyamide","acrylic","elastane/spandex",
  "denim","chambray","poplin/broadcloth","oxford","pinpoint oxford","twill","herringbone","flannel","seersucker",
  "velvet","corduroy","fresco/open-weave suiting","gabardine","jersey","pique","interlock","rib knit","fleece",
  "canvas","duck cloth","drill","dobby","jacquard","satin","sateen","voile","lawn","madras","tweed","hopsack",
  "serge","cavalry twill","moleskin","whipcord","sharkskin","birdseye","barathea","faille","terry"
] as const;

export const MENSWEAR_PATTERN_TAXONOMY = [
  "solid/plain","pinstripe","chalk stripe","candy stripe","awning stripe","hairline stripe","Bengal stripe",
  "windowpane","gingham","tattersall","glen check/prince of wales","houndstooth","micro check","madras check",
  "polka dot","paisley","floral","botanical/leaf","geometric","abstract","chevron","ikat-style","melange/heather",
  "herringbone motif","birdseye","nailhead","sharkskin effect","jacquard motif","tonal texture"
] as const;

export const MENSWEAR_COLOR_TAXONOMY = [
  "optic white","ivory","cream","beige","stone","sand","taupe","camel","tan","chocolate brown","espresso",
  "light grey","mid grey","charcoal","black","navy","midnight blue","royal blue","cobalt","sky blue","powder blue",
  "teal","petrol","sage","olive","forest green","bottle green","burgundy","wine","maroon","rust","terracotta",
  "mustard","ochre","blush pink","dusty rose","lavender","lilac","plum","aubergine"
] as const;

export const MENSWEAR_GARMENT_USES = [
  "dress shirt","business shirt","casual shirt","resort shirt","overshirt","polo","t-shirt",
  "formal trouser","casual trouser","chino","jeans","suit","summer suit","blazer","sport coat",
  "dinner jacket","waistcoat","overcoat","casual jacket","technical outerwear","knitwear","tie","pocket square"
] as const;

export const MENSWEAR_OCCASION_TAXONOMY = [
  "boardroom/business formal","office/business","interview","wedding","reception","festive",
  "cocktail/evening","smart-casual dinner","date","brunch","resort/holiday","travel","weekend casual",
  "summer event","black tie/evening formal"
] as const;

export const FABRIC_ANALYZER_EVIDENCE_RULES = [
  "Never convert visual appearance into a claim about exact fiber composition.",
  "Never infer GSM, Lea, yarn count, shrinkage, stretch percentage, breathability or hand-feel from pixels alone.",
  "Use suffixes such as -looking, -like, appearance, visible, or visually when evidence is image-only.",
  "Treat supplier/manufacturer facts separately from visual observations.",
  "Pattern scale, density, contrast, color depth and surface texture may be visually classified with confidence values.",
  "Garment and occasion suitability is styling inference, not a laboratory property."
] as const;
