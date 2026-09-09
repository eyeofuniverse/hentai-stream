import type { TagCategory } from "@prisma/client";

/**
 * Curated hentai tag vocabulary. MAL barely tags hentai, so tags are derived by
 * keyword-matching the title + synopsis against this list (name + synonyms).
 * Also the seed source of truth for the Tag table.
 */
export type TagDef = {
  name: string;
  category: TagCategory;
  /** extra strings that also match this tag when found in text */
  synonyms?: string[];
  /** genre/theme tags get an editorial landing page; niche fetish tags don't */
  landing?: boolean;
};

export const TAG_DICTIONARY: TagDef[] = [
  // ── genres ──
  { name: "Vanilla", category: "GENRE", synonyms: ["romantic", "loving", "sweet"], landing: true },
  { name: "Romance", category: "GENRE", synonyms: ["love story", "girlfriend", "boyfriend"], landing: true },
  { name: "Comedy", category: "GENRE", synonyms: ["comedic", "hilarious", "parody"], landing: true },
  { name: "Fantasy", category: "GENRE", synonyms: ["magic", "medieval", "sword", "dungeon", "adventurer"], landing: true },
  { name: "Isekai", category: "GENRE", synonyms: ["another world", "reincarnat", "summoned to"], landing: true },
  { name: "Drama", category: "GENRE", synonyms: ["tragic", "emotional"], landing: true },
  { name: "Horror", category: "GENRE", synonyms: ["nightmare", "cursed", "demonic ritual"], landing: true },
  { name: "Sci-Fi", category: "GENRE", synonyms: ["science fiction", "space", "cyberpunk", "android"], landing: true },
  { name: "Slice of Life", category: "GENRE", synonyms: ["everyday life", "daily life"], landing: true },
  { name: "NTR", category: "GENRE", synonyms: ["netorare", "cuckold", "cheating", "cheating wife", "infidelity", "stolen girlfriend", "affair"], landing: true },

  // ── themes / settings ──
  { name: "School", category: "THEME", synonyms: ["schoolgirl", "school girls", "schoolgirls", "school-girls", "jk", "classroom", "student", "classmate", "high school", "academy", "student council", "school club", "culture festival"], landing: true },
  { name: "College", category: "THEME", synonyms: ["university", "campus", "senpai"], landing: true },
  { name: "Office", category: "THEME", synonyms: ["office lady", "coworker", "workplace", "boss", "secretary", "salaryman"], landing: true },
  { name: "MILF", category: "THEME", synonyms: ["mother", "mom", "housewife", "mature woman", "married woman", "stepmother", "mommy"], landing: true },
  { name: "Harem", category: "THEME", synonyms: ["multiple girls", "surrounded by"], landing: true },
  { name: "Reverse Harem", category: "THEME", synonyms: ["multiple men", "many guys"], landing: true },
  { name: "Incest", category: "THEME", synonyms: ["sister", "brother", "step-sister", "stepsister", "step-brother", "sibling", "aunt", "niece", "cousin", "daughter", "father-in-law", "inseki", "family", "step-family", "step family", "step-mom", "step-dad"], landing: true },
  { name: "Teacher", category: "THEME", synonyms: ["sensei", "professor", "female teacher", "homeroom"], landing: true },
  { name: "Nurse", category: "THEME", synonyms: ["hospital", "clinic", "doctor", "infirmary"], landing: true },
  { name: "Maid", category: "THEME", synonyms: ["servant", "butler", "maids", "housemaid"], landing: true },
  { name: "Nun", category: "THEME", synonyms: ["convent", "church", "sister maria", "priestess", "shrine maiden", "miko"] },
  { name: "Idol", category: "THEME", synonyms: ["pop idol", "aidoru", "stage"] },
  { name: "Gyaru", category: "THEME", synonyms: ["gal", "tanned girl", "kogal"], landing: true },
  { name: "Tsundere", category: "THEME", synonyms: [] },
  { name: "Yandere", category: "THEME", synonyms: ["obsessive", "possessive girl"] },
  { name: "Succubus", category: "THEME", synonyms: ["demon girl", "incubus", "lilith"], landing: true },
  { name: "Monster Girl", category: "THEME", synonyms: ["slime girl", "lamia", "harpy", "centaur", "orc", "mermaid", "mermaids", "mamono", "goblin girl"], landing: true },
  { name: "Elf", category: "THEME", synonyms: ["dark elf", "high elf"], landing: true },
  { name: "Kemonomimi", category: "THEME", synonyms: ["catgirl", "cat girl", "nekomimi", "fox girl", "bunny girl", "animal ears"], landing: true },
  { name: "Virgin", category: "THEME", synonyms: ["first time", "inexperienced", "lose her virginity", "deflower", "defloration", "deflowering", "virginity", "virgins"], landing: true },
  { name: "Netori", category: "THEME", synonyms: ["stealing another", "seducing someone else"] },
  { name: "Prostitution", category: "THEME", synonyms: ["hooker", "sex worker", "brothel", "call girl", "escort", "soapland", "delivery health"], landing: true },
  { name: "Blackmail", category: "THEME", synonyms: ["coerc", "extort", "leverage", "compromising photo"] },
  { name: "Mind Control", category: "THEME", synonyms: ["hypnosis", "hypnotis", "brainwash", "brainwashing", "brainwashed", "mind break", "mind control app", "app that", "obey any command"], landing: true },
  { name: "Time Stop", category: "THEME", synonyms: ["stopped time", "frozen time", "time freeze"], landing: true },
  { name: "Corruption", category: "THEME", synonyms: ["fall from grace", "corrupt the", "turned into a slut"], landing: true },
  { name: "Training", category: "THEME", synonyms: ["choukyou", "break her in", "discipline", "obedience training"] },
  { name: "Slave", category: "THEME", synonyms: ["sex slave", "slavery", "enslaved", "servitude", "collar", "human livestock", "livestock", "meat toilet"], landing: true },
  { name: "Cosplay", category: "THEME", synonyms: ["costume", "dressed as"] },
  { name: "Public", category: "THEME", synonyms: ["in public", "public sex", "train", "bus", "outdoor", "outdoors", "exhibitionis", "exhibitionism", "caught in the act"], landing: true },
  { name: "Hot Spring", category: "THEME", synonyms: ["onsen", "bathhouse", "sento", "mixed bath"] },
  { name: "Chikan", category: "THEME", synonyms: ["molest", "groping on", "crowded train"], landing: true },
  { name: "Aphrodisiac", category: "THEME", synonyms: ["drugged", "love potion", "spiked drink", "in heat"] },

  // ── fetish / body ──
  { name: "Big Breasts", category: "FETISH", synonyms: ["huge breasts", "large breasts", "busty", "big tits", "huge tits", "big boobs", "huge boobs", "boobs", "oppai", "massive breasts", "gigantic breasts", "hyper breasts"], landing: true },
  { name: "Small Breasts", category: "FETISH", synonyms: ["flat chest", "petite chest", "modest bust"], landing: true },
  { name: "Big Ass", category: "FETISH", synonyms: ["huge ass", "thick ass", "big butt", "bubble butt"], landing: true },
  { name: "Thick", category: "FETISH", synonyms: ["chubby", "plump", "curvy", "bbw"] },
  { name: "Petite", category: "FETISH", synonyms: ["tiny girl", "small body", "short girl"] },
  { name: "Ahegao", category: "FETISH", synonyms: ["fucked silly", "mind-blowing pleasure", "eyes rolled back"], landing: true },
  { name: "Creampie", category: "FETISH", synonyms: ["nakadashi", "cum inside", "creampied", "filled with", "internal ejaculation"], landing: true },
  { name: "Facial", category: "FETISH", synonyms: ["cum on face", "cumshot on her face"] },
  { name: "Bukkake", category: "FETISH", synonyms: ["covered in cum", "multiple loads"] },
  { name: "Blowjob", category: "FETISH", synonyms: ["fellatio", "oral", "oral sex", "sucking", "deepthroat", "deep throat", "irrumatio", "gokkun", "cock sucking"], landing: true },
  { name: "Anal", category: "FETISH", synonyms: ["anal sex", "ass fucking", "assfuck", "backdoor", "sodomy"], landing: true },
  { name: "Double Penetration", category: "FETISH", synonyms: ["dp", "two at once", "both holes"] },
  { name: "Paizuri", category: "FETISH", synonyms: ["titfuck", "titjob", "breast sex", "boobjob", "boob job", "tits fuck", "titsfuck", "tit fuck"], landing: true },
  { name: "Footjob", category: "FETISH", synonyms: ["feet", "foot fetish", "ashikoki"] },
  { name: "Squirting", category: "FETISH", synonyms: ["squirt", "female ejaculation"] },
  { name: "Lactation", category: "FETISH", synonyms: ["breast milk", "leaking milk", "milking"] },
  { name: "Pregnant", category: "FETISH", synonyms: ["pregnancy", "with child", "impregnat", "belly full"], landing: true },
  { name: "X-Ray", category: "FETISH", synonyms: ["cross-section", "internal view", "see-through"], landing: true },
  { name: "Tentacles", category: "FETISH", synonyms: ["tentacle", "shokushu", "writhing appendages"], landing: true },
  { name: "Futanari", category: "FETISH", synonyms: ["futa", "dickgirl", "hermaphrodite"], landing: true },
  { name: "Trap", category: "FETISH", synonyms: ["femboy", "otokonoko", "crossdress", "crossdressing", "looks like a girl"], landing: true },
  { name: "Pet Play", category: "FETISH", synonyms: ["human pet", "pet-play", "collar and leash", "kept as a pet"] },
  { name: "Armpits", category: "FETISH", synonyms: ["armpit", "waki"] },
  { name: "Breath Play", category: "FETISH", synonyms: ["asphyxiation", "choking", "strangulation"] },
  { name: "Yuri", category: "FETISH", synonyms: ["lesbian", "girl on girl", "girls love", "scissoring", "tribadism"], landing: true },
  { name: "Yaoi", category: "FETISH", synonyms: ["boys love", "gay", "bl", "male on male"] },
  { name: "Bondage", category: "FETISH", synonyms: ["tied up", "shibari", "restrained", "rope", "bdsm", "masochism", "sadism", "sadomasochism", "s and m"], landing: true },
  { name: "Femdom", category: "FETISH", synonyms: ["dominatrix", "dominant woman", "female domination", "pegging", "mistress", "matriarchy", "matriarchal"], landing: true },
  { name: "Maledom", category: "FETISH", synonyms: ["dominant man", "male domination", "forceful man"] },
  { name: "Group", category: "FETISH", synonyms: ["orgy", "gangbang", "gang bang", "group sex", "groupsex", "threesome", "foursome", "multiple partners", "train them", "spitroast", "double team", "oyakodon", "shimaidon", "harem sex"], landing: true },
  { name: "Toys", category: "FETISH", synonyms: ["vibrator", "dildo", "sex toy", "sex toys", "rotor", "onahole"] },
  { name: "Masturbation", category: "FETISH", synonyms: ["touching herself", "self pleasure", "onanie"] },
  { name: "Voyeur", category: "FETISH", synonyms: ["peeping", "watching them", "hidden camera", "spy on"] },
  { name: "Uniform", category: "FETISH", synonyms: ["sailor uniform", "gym clothes", "bloomers", "swimsuit", "school swimsuit"] },
  { name: "Stockings", category: "FETISH", synonyms: ["pantyhose", "thigh highs", "garter"] },
  { name: "Glasses", category: "FETISH", synonyms: ["megane", "bespectacled"] },
  { name: "Dark Skin", category: "FETISH", synonyms: ["tanned", "tanned skin", "brown skin", "dark-skinned", "kuro gyaru"] },
  { name: "Cunnilingus", category: "FETISH", synonyms: ["pussy licking", "eating out", "oral on her"] },
  { name: "Handjob", category: "FETISH", synonyms: ["hand job", "tekoki", "stroking"] },
  { name: "Ugly Bastard", category: "FETISH", synonyms: ["fat old man", "grotesque man", "old man and", "disgusting man"], landing: true },
  { name: "Netorase", category: "FETISH", synonyms: ["consensual sharing", "watch his wife", "lend his girlfriend"] },

  // ── format ──
  { name: "3D", category: "FORMAT", synonyms: ["3dcg", "cgi", "3d cg", "computer generated"], landing: true },
  { name: "Motion Anime", category: "FORMAT", synonyms: ["motion comic", "digital comic animation"], landing: true },

  // ── content warnings ──
  { name: "Rape", category: "CONTENT_WARNING", synonyms: ["non-consensual", "non consensual", "noncon", "forced", "forced sex", "assault", "sexual assault", "against her will", "violated"], landing: true },
  { name: "Guro", category: "CONTENT_WARNING", synonyms: ["gore", "grotesque", "dismember", "torture porn"] },
  { name: "Ryona", category: "CONTENT_WARNING", synonyms: ["brutal", "beaten", "abuse", "violence"] },
];

/** Words that suggest apparent-minor content — flag for manual review, never auto-publish. */
export const MINOR_FLAG_TERMS = [
  "loli",
  "lolita",
  "shota",
  "shotacon",
  "lolicon",
  "elementary school",
  "grade school",
  "primary school",
  "12 year",
  "12-year",
  "11 year",
  "10 year",
  "little sister who is",
  "childlike",
  "prepubescent",
];
