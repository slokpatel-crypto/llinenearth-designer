export type FashionResearchSource = {
  id:string;
  name:string;
  baseUrl:string;
  category:
    | "academic" | "university" | "museum" | "standards" | "materials"
    | "technology" | "industry" | "runway" | "forecasting" | "menswear";
  authority:"primary"|"scholarly"|"industry"|"editorial";
};

export type FashionResearchTopic = {
  id:string;
  query:string;
  tags:string[];
};

export type FashionResearchTarget = {
  id:string;
  sourceId:string;
  sourceName:string;
  sourceUrl:string;
  sourceCategory:FashionResearchSource["category"];
  authority:FashionResearchSource["authority"];
  topicId:string;
  query:string;
  tags:string[];
};

/**
 * Broad discovery pool for the V5 research brain.
 * These are research targets, not automatically accepted fashion truths.
 * A source only affects design after a principle is extracted with its URL,
 * transformed into a design move, and reviewed.
 */
export const FASHION_RESEARCH_SOURCES:FashionResearchSource[]=[
  {id:"sciencedirect",name:"ScienceDirect",baseUrl:"https://www.sciencedirect.com",category:"academic",authority:"scholarly"},
  {id:"springer",name:"SpringerLink",baseUrl:"https://link.springer.com",category:"academic",authority:"scholarly"},
  {id:"fashion-textiles",name:"Fashion and Textiles",baseUrl:"https://fashionandtextiles.springeropen.com",category:"academic",authority:"scholarly"},
  {id:"tandf",name:"Taylor & Francis Online",baseUrl:"https://www.tandfonline.com",category:"academic",authority:"scholarly"},
  {id:"wiley",name:"Wiley Online Library",baseUrl:"https://onlinelibrary.wiley.com",category:"academic",authority:"scholarly"},
  {id:"emerald",name:"Emerald Insight",baseUrl:"https://www.emerald.com",category:"academic",authority:"scholarly"},
  {id:"sage",name:"SAGE Journals",baseUrl:"https://journals.sagepub.com",category:"academic",authority:"scholarly"},
  {id:"mdpi",name:"MDPI",baseUrl:"https://www.mdpi.com",category:"academic",authority:"scholarly"},
  {id:"frontiers",name:"Frontiers",baseUrl:"https://www.frontiersin.org",category:"academic",authority:"scholarly"},
  {id:"nature",name:"Nature",baseUrl:"https://www.nature.com",category:"academic",authority:"scholarly"},
  {id:"pubmed",name:"PubMed",baseUrl:"https://pubmed.ncbi.nlm.nih.gov",category:"academic",authority:"scholarly"},
  {id:"ieee",name:"IEEE Xplore",baseUrl:"https://ieeexplore.ieee.org",category:"academic",authority:"scholarly"},
  {id:"acm",name:"ACM Digital Library",baseUrl:"https://dl.acm.org",category:"academic",authority:"scholarly"},
  {id:"arxiv",name:"arXiv",baseUrl:"https://arxiv.org",category:"academic",authority:"scholarly"},
  {id:"jstage",name:"J-STAGE",baseUrl:"https://www.jstage.jst.go.jp",category:"academic",authority:"scholarly"},
  {id:"intechopen",name:"IntechOpen",baseUrl:"https://www.intechopen.com",category:"academic",authority:"scholarly"},
  {id:"researchgate",name:"ResearchGate",baseUrl:"https://www.researchgate.net",category:"academic",authority:"scholarly"},
  {id:"semantic-scholar",name:"Semantic Scholar",baseUrl:"https://www.semanticscholar.org",category:"academic",authority:"scholarly"},
  {id:"crossref",name:"Crossref",baseUrl:"https://www.crossref.org",category:"academic",authority:"primary"},
  {id:"core",name:"CORE",baseUrl:"https://core.ac.uk",category:"academic",authority:"scholarly"},

  {id:"cornell",name:"Cornell Human Ecology",baseUrl:"https://human.cornell.edu",category:"university",authority:"primary"},
  {id:"cornell-rad",name:"Cornell Responsive Apparel Design Lab",baseUrl:"https://rad.human.cornell.edu",category:"university",authority:"primary"},
  {id:"ncsu",name:"NC State Wilson College of Textiles",baseUrl:"https://textiles.ncsu.edu",category:"university",authority:"primary"},
  {id:"ncsu-tai",name:"NC State Textile & Apparel Intelligence",baseUrl:"https://tai.textiles.ncsu.edu",category:"university",authority:"primary"},
  {id:"aalto",name:"Aalto Fashion/Textile Futures",baseUrl:"https://www.aalto.fi",category:"university",authority:"primary"},
  {id:"aalto-research",name:"Aalto Research Portal",baseUrl:"https://research.aalto.fi",category:"university",authority:"primary"},
  {id:"ual",name:"University of the Arts London",baseUrl:"https://www.arts.ac.uk",category:"university",authority:"primary"},
  {id:"rca",name:"Royal College of Art",baseUrl:"https://www.rca.ac.uk",category:"university",authority:"primary"},
  {id:"rca-research",name:"RCA Research Repository",baseUrl:"https://researchonline.rca.ac.uk",category:"university",authority:"primary"},
  {id:"ntu",name:"Nottingham Trent Fashion & Textiles",baseUrl:"https://www.ntu.ac.uk",category:"university",authority:"primary"},
  {id:"rmit",name:"RMIT Fashion & Textiles",baseUrl:"https://www.rmit.edu.au",category:"university",authority:"primary"},
  {id:"polyu",name:"Hong Kong PolyU School of Fashion & Textiles",baseUrl:"https://www.polyu.edu.hk/sft",category:"university",authority:"primary"},
  {id:"polyu-research",name:"PolyU Scholars Hub",baseUrl:"https://research.polyu.edu.hk",category:"university",authority:"primary"},
  {id:"polyu-rctff",name:"PolyU Research Centre of Textiles for Future Fashion",baseUrl:"https://www.polyu.edu.hk/rctff",category:"university",authority:"primary"},
  {id:"leeds-litac",name:"Leeds Institute of Textiles and Colour",baseUrl:"https://litac.leeds.ac.uk",category:"university",authority:"primary"},
  {id:"manchester",name:"University of Manchester Fashion Business Technology",baseUrl:"https://research.manchester.ac.uk",category:"university",authority:"primary"},
  {id:"northumbria",name:"Northumbria Fashion Research",baseUrl:"https://researchportal.northumbria.ac.uk",category:"university",authority:"primary"},
  {id:"heriot-watt",name:"Heriot-Watt School of Textiles & Design",baseUrl:"https://researchportal.hw.ac.uk",category:"university",authority:"primary"},
  {id:"uts",name:"University of Technology Sydney",baseUrl:"https://opus.lib.uts.edu.au",category:"university",authority:"primary"},
  {id:"itu",name:"Istanbul Technical University Textile Engineering",baseUrl:"https://research.itu.edu.tr",category:"university",authority:"primary"},
  {id:"dhu",name:"Donghua University",baseUrl:"https://english.dhu.edu.cn",category:"university",authority:"primary"},
  {id:"ensait",name:"ENSAIT / GEMTEX",baseUrl:"https://www.ensait.fr",category:"university",authority:"primary"},
  {id:"ifm",name:"Institut Français de la Mode",baseUrl:"https://www.ifmparis.fr",category:"university",authority:"primary"},
  {id:"fitnyc",name:"Fashion Institute of Technology",baseUrl:"https://www.fitnyc.edu",category:"university",authority:"primary"},
  {id:"parsons",name:"Parsons School of Design",baseUrl:"https://www.newschool.edu/parsons",category:"university",authority:"primary"},
  {id:"risd",name:"Rhode Island School of Design",baseUrl:"https://www.risd.edu",category:"university",authority:"primary"},
  {id:"polimi",name:"Politecnico di Milano",baseUrl:"https://www.polimi.it",category:"university",authority:"primary"},
  {id:"roma1",name:"Sapienza University of Rome",baseUrl:"https://research.uniroma1.it",category:"university",authority:"primary"},
  {id:"amsterdam-hva",name:"Amsterdam University of Applied Sciences Fashion Research",baseUrl:"https://research.hva.nl",category:"university",authority:"primary"},
  {id:"knutd",name:"Kyiv National University of Technologies and Design",baseUrl:"https://jrnl.knutd.edu.ua",category:"university",authority:"primary"},
  {id:"yuntech",name:"National Yunlin University of Science and Technology",baseUrl:"https://www.yuntech.edu.tw",category:"university",authority:"primary"},

  {id:"met",name:"The Metropolitan Museum of Art Costume Institute",baseUrl:"https://www.metmuseum.org",category:"museum",authority:"primary"},
  {id:"vam",name:"Victoria and Albert Museum",baseUrl:"https://www.vam.ac.uk",category:"museum",authority:"primary"},
  {id:"museum-fit",name:"The Museum at FIT",baseUrl:"https://www.fitnyc.edu/museum",category:"museum",authority:"primary"},
  {id:"kci",name:"Kyoto Costume Institute",baseUrl:"https://www.kci.or.jp",category:"museum",authority:"primary"},
  {id:"galliera",name:"Palais Galliera",baseUrl:"https://www.palaisgalliera.paris.fr",category:"museum",authority:"primary"},
  {id:"smithsonian",name:"Smithsonian",baseUrl:"https://www.si.edu",category:"museum",authority:"primary"},
  {id:"europeana",name:"Europeana",baseUrl:"https://www.europeana.eu",category:"museum",authority:"primary"},
  {id:"cooperhewitt",name:"Cooper Hewitt",baseUrl:"https://www.cooperhewitt.org",category:"museum",authority:"primary"},
  {id:"lacma",name:"LACMA",baseUrl:"https://www.lacma.org",category:"museum",authority:"primary"},
  {id:"risdmuseum",name:"RISD Museum",baseUrl:"https://risdmuseum.org",category:"museum",authority:"primary"},
  {id:"philamuseum",name:"Philadelphia Museum of Art",baseUrl:"https://www.philamuseum.org",category:"museum",authority:"primary"},
  {id:"designmuseum",name:"Design Museum London",baseUrl:"https://designmuseum.org",category:"museum",authority:"primary"},

  {id:"aatcc",name:"AATCC",baseUrl:"https://www.aatcc.org",category:"standards",authority:"primary"},
  {id:"astm",name:"ASTM International",baseUrl:"https://www.astm.org",category:"standards",authority:"primary"},
  {id:"iso",name:"ISO",baseUrl:"https://www.iso.org",category:"standards",authority:"primary"},
  {id:"textile-institute",name:"The Textile Institute",baseUrl:"https://www.textileinstitute.org",category:"standards",authority:"primary"},
  {id:"cie",name:"CIE",baseUrl:"https://cie.co.at",category:"standards",authority:"primary"},

  {id:"textile-exchange",name:"Textile Exchange",baseUrl:"https://textileexchange.org",category:"materials",authority:"industry"},
  {id:"woolmark",name:"The Woolmark Company",baseUrl:"https://www.woolmark.com",category:"materials",authority:"industry"},
  {id:"cottoninc",name:"Cotton Incorporated",baseUrl:"https://www.cottoninc.com",category:"materials",authority:"industry"},
  {id:"oeko",name:"OEKO-TEX",baseUrl:"https://www.oeko-tex.com",category:"materials",authority:"industry"},
  {id:"bluesign",name:"bluesign",baseUrl:"https://www.bluesign.com",category:"materials",authority:"industry"},
  {id:"zdhc",name:"ZDHC",baseUrl:"https://www.roadmaptozero.com",category:"materials",authority:"industry"},

  {id:"clo",name:"CLO",baseUrl:"https://www.clo3d.com",category:"technology",authority:"industry"},
  {id:"browzwear",name:"Browzwear",baseUrl:"https://browzwear.com",category:"technology",authority:"industry"},
  {id:"lectra",name:"Lectra",baseUrl:"https://www.lectra.com",category:"technology",authority:"industry"},
  {id:"optitex",name:"Optitex",baseUrl:"https://optitex.com",category:"technology",authority:"industry"},
  {id:"tukatech",name:"Tukatech",baseUrl:"https://tukatech.com",category:"technology",authority:"industry"},
  {id:"alvanon",name:"Alvanon",baseUrl:"https://alvanon.com",category:"technology",authority:"industry"},
  {id:"human-solutions",name:"Human Solutions",baseUrl:"https://www.human-solutions.com",category:"technology",authority:"industry"},
  {id:"style3d",name:"Style3D",baseUrl:"https://www.linctex.com",category:"technology",authority:"industry"},

  {id:"ellenmacarthur",name:"Ellen MacArthur Foundation",baseUrl:"https://www.ellenmacarthurfoundation.org",category:"industry",authority:"industry"},
  {id:"cascale",name:"Cascale",baseUrl:"https://cascale.org",category:"industry",authority:"industry"},
  {id:"euratex",name:"EURATEX",baseUrl:"https://euratex.eu",category:"industry",authority:"industry"},
  {id:"itmf",name:"International Textile Manufacturers Federation",baseUrl:"https://www.itmf.org",category:"industry",authority:"industry"},
  {id:"bof",name:"The Business of Fashion",baseUrl:"https://www.businessoffashion.com",category:"industry",authority:"editorial"},
  {id:"fashionunited",name:"FashionUnited",baseUrl:"https://fashionunited.com",category:"industry",authority:"editorial"},
  {id:"fashionnetwork",name:"FashionNetwork",baseUrl:"https://ww.fashionnetwork.com",category:"industry",authority:"editorial"},

  {id:"vogue-runway",name:"Vogue Runway",baseUrl:"https://www.vogue.com/fashion-shows",category:"runway",authority:"editorial"},
  {id:"wwd",name:"WWD",baseUrl:"https://wwd.com",category:"runway",authority:"editorial"},
  {id:"showstudio",name:"SHOWstudio",baseUrl:"https://www.showstudio.com",category:"runway",authority:"editorial"},
  {id:"nowfashion",name:"NOWFASHION",baseUrl:"https://nowfashion.com",category:"runway",authority:"editorial"},
  {id:"the-impression",name:"The Impression",baseUrl:"https://theimpression.com",category:"runway",authority:"editorial"},
  {id:"dazed",name:"Dazed",baseUrl:"https://www.dazeddigital.com/fashion",category:"runway",authority:"editorial"},
  {id:"id",name:"i-D",baseUrl:"https://i-d.co",category:"runway",authority:"editorial"},
  {id:"wallpaper",name:"Wallpaper Fashion",baseUrl:"https://www.wallpaper.com/fashion",category:"runway",authority:"editorial"},
  {id:"dezeen",name:"Dezeen Fashion",baseUrl:"https://www.dezeen.com/tag/fashion",category:"runway",authority:"editorial"},
  {id:"another",name:"AnOther",baseUrl:"https://www.anothermag.com/fashion-beauty",category:"runway",authority:"editorial"},

  {id:"gq",name:"GQ Style",baseUrl:"https://www.gq.com/style",category:"menswear",authority:"editorial"},
  {id:"mrporter",name:"MR PORTER Journal",baseUrl:"https://www.mrporter.com/en-us/journal",category:"menswear",authority:"editorial"},
  {id:"permanentstyle",name:"Permanent Style",baseUrl:"https://www.permanentstyle.com",category:"menswear",authority:"editorial"},
  {id:"putthison",name:"Put This On",baseUrl:"https://putthison.com",category:"menswear",authority:"editorial"},
  {id:"highsnobiety",name:"Highsnobiety",baseUrl:"https://www.highsnobiety.com",category:"menswear",authority:"editorial"},
  {id:"hypebeast",name:"Hypebeast",baseUrl:"https://hypebeast.com",category:"menswear",authority:"editorial"},
  {id:"gentlemansgazette",name:"Gentleman's Gazette",baseUrl:"https://www.gentlemansgazette.com",category:"menswear",authority:"editorial"},
  {id:"savilerow",name:"Savile Row Bespoke Association",baseUrl:"https://www.savilerowbespoke.com",category:"menswear",authority:"industry"},
  {id:"huntsman",name:"Huntsman Savile Row",baseUrl:"https://www.huntsmansavilerow.com",category:"menswear",authority:"industry"},
  {id:"anderson-sheppard",name:"Anderson & Sheppard",baseUrl:"https://www.anderson-sheppard.co.uk",category:"menswear",authority:"industry"},

  {id:"wgsn",name:"WGSN",baseUrl:"https://www.wgsn.com",category:"forecasting",authority:"industry"},
  {id:"trendstop",name:"Trendstop",baseUrl:"https://www.trendstop.com",category:"forecasting",authority:"industry"},
  {id:"peclers",name:"Peclers Paris",baseUrl:"https://www.peclersparis.com",category:"forecasting",authority:"industry"},
  {id:"heuritech",name:"Heuritech",baseUrl:"https://www.heuritech.com",category:"forecasting",authority:"industry"},
];

export const FASHION_RESEARCH_TOPICS:FashionResearchTopic[]=[
  {id:"silhouette",query:"menswear silhouette proportion tailoring shape volume",tags:["silhouette","proportion","menswear"]},
  {id:"details",query:"shirt collar cuff placket pocket menswear design detail",tags:["collar","cuff","detail"]},
  {id:"pattern",query:"textile surface pattern repeat placement stripe geometric fashion",tags:["pattern","surface","print"]},
  {id:"colour",query:"clothing colour harmony contrast visual perception textiles",tags:["colour","perception"]},
  {id:"drape",query:"fabric drape bending shear garment appearance tailoring",tags:["drape","fabric-physics"]},
  {id:"fit",query:"menswear garment fit anthropometry ease body scanning",tags:["fit","anthropometry"]},
  {id:"construction",query:"tailoring construction seams interlining canvas shirt trouser",tags:["construction","tailoring"]},
  {id:"movement",query:"garment movement dynamic drape clothing biomechanics",tags:["movement","drape"]},
  {id:"aesthetics",query:"fashion aesthetics visual balance proportion originality research",tags:["aesthetics","visual"]},
  {id:"psychology",query:"clothing perception psychology identity attractiveness menswear",tags:["psychology","perception"]},
  {id:"history",query:"menswear history tailoring archive cultural dress",tags:["history","archive"]},
  {id:"runway",query:"contemporary menswear runway tailoring innovation silhouette",tags:["runway","trend"]},
  {id:"digital",query:"3D garment simulation virtual try-on digital fashion",tags:["3d","digital"]},
  {id:"ai",query:"AI fashion design creativity outfit compatibility computer vision",tags:["ai","computational"]},
  {id:"materials",query:"textile fiber yarn weave finishing apparel performance",tags:["materials","textile-science"]},
  {id:"comfort",query:"clothing comfort moisture thermal tactile garment science",tags:["comfort","textile-science"]},
  {id:"sustainability",query:"circular fashion modular garments zero waste pattern cutting",tags:["circular","modular"]},
  {id:"manufacture",query:"apparel manufacturing sewing automation quality garment engineering",tags:["manufacturing","engineering"]},
];

export function buildFashionResearchTargets():FashionResearchTarget[] {
  return FASHION_RESEARCH_SOURCES.flatMap((source)=>
    FASHION_RESEARCH_TOPICS.map((topic)=>({
      id:`${source.id}:${topic.id}`,
      sourceId:source.id,
      sourceName:source.name,
      sourceUrl:source.baseUrl,
      sourceCategory:source.category,
      authority:source.authority,
      topicId:topic.id,
      query:topic.query,
      tags:[...topic.tags],
    }))
  );
}

export const FASHION_RESEARCH_TARGETS=buildFashionResearchTargets();

export const FASHION_RESEARCH_POOL_STATS={
  websites:FASHION_RESEARCH_SOURCES.length,
  topics:FASHION_RESEARCH_TOPICS.length,
  targets:FASHION_RESEARCH_TARGETS.length,
  highAuthorityWebsites:FASHION_RESEARCH_SOURCES.filter((item)=>item.authority==="primary"||item.authority==="scholarly").length,
} as const;
