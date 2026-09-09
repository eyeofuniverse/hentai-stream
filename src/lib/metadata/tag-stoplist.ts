/**
 * External-source tags that are NOT browse genres — AniList's cast / demographic
 * / narrative-technical / sport / hobby / occupation / setting vocabulary. These
 * are never created and are purged from the DB by `scripts/tags-consolidate.mts`.
 *
 * This is deliberately NOT a content filter: every sexual-content / kink / body
 * tag stays. If a term is a real fetish or a real story genre, it does not
 * belong here.
 */
export const NOT_A_GENRE = new Set<string>([
  // ── cast structure / demographics ──
  "male-protagonist", "female-protagonist", "primarily-female-cast",
  "primarily-male-cast", "primarily-adult-cast", "primarily-teen-cast",
  "primarily-child-cast", "primarily-animal-cast", "ensemble-cast",
  "mixed-gender-harem", "josei", "seinen", "shoujo", "shounen", "kids",
  "teens-love", "otaku-culture", "heterosexual", "bisexual", "agender",
  "lgbtq-themes", "gender-bending",
  // ── narrative / technical ──
  "achronological-order", "anachronism", "episodic", "anthology", "meta",
  "no-dialogue", "4-koma", "flash", "full-color", "achromatic", "primarily-cgi",
  "coming-of-age", "unrequited-love", "love-triangle", "amnesia",
  "memory-manipulation", "dissociative-identities", "philosophy", "politics",
  "conspiracy", "noir", "post-apocalyptic", "dystopian", "utopian", "satire",
  "slapstick", "iyashikei", "body-image", "rehabilitation", "revenge",
  "bullying", "suicide", "found-family", "anti-hero", "chosen-one", "prophecy",
  // ── generic descriptors that mean nothing on a hentai site ──
  "body-horror", "surreal-comedy", "coastal", "travel", "foreign", "urban",
  "rural", "work", "language-barrier", "fashion", "advertisement", "meta",
  "cute-girls-doing-cute-things", "cute-boys-doing-cute-things", "disability",
  "amputation", "hypersexuality",
  // ── sports ──
  "tennis", "baseball", "basketball", "volleyball", "football", "american-football",
  "soccer", "swimming", "boxing", "judo", "kendo", "archery", "badminton",
  "bowling", "golf", "rugby", "table-tennis", "cycling", "surfing", "skateboarding",
  "gymnastics", "acrobatics", "cheerleading", "lacrosse", "handball", "athletics",
  "climbing", "fencing", "figure-skating", "ice-skating", "rowing", "sailing",
  "wrestling", "martial-arts", "parkour", "mahjong", "outdoor-activities",
  // ── hobbies / activities ──
  "board-game", "card-battle", "video-games", "go", "shogi", "chess", "cooking",
  "food", "gardening", "agriculture", "fishing", "camping", "hiking",
  "photography", "drawing", "painting", "writing", "calligraphy", "filmmaking",
  "acting", "musical-theater", "band", "dancing", "singing", "music",
  "software-development", "programming", "journalism", "death-game",
  // ── occupations / roles ──
  "firefighters", "police", "detective", "lawyers", "politicians", "yakuza",
  "gangs", "delinquents", "assassins", "spies", "espionage", "military", "army",
  "navy", "pilots", "astronauts", "scientists", "engineers", "fugitive",
  "salaryman-life", "job-hunting", "unemployment",
  // ── world / setting descriptors (not sexual settings) ──
  "war", "crime", "terrorism", "pandemic", "natural-disaster", "historical",
  "period-drama", "americas", "europe", "asia", "class-struggle",
  // ── objects / vehicles / creatures that aren't genres ──
  "robots", "real-robot", "mecha", "guns", "tanks", "ships", "motorcycles",
  "aircraft", "swords", "swordplay", "swordfighting", "skeleton", "alchemy",
  "henshin", "exorcism", "ninja", "samurai", "gods", "ghost", "fairy",
  "fairy-tale", "werewolf", "vampire", "dragons", "animals", "interspecies",
  "virtual-world", "cult", "kaiju",
  // ── structure / relationships (not a sexual genre) ──
  "orphan", "adoption", "estranged-family", "arranged-marriage", "cohabitation",
  "marriage", "wedding", "divorce", "parenthood", "twins",
  // ── character-type labels AniList over-tags (tsundere/yandere stay: dictionary) ──
  "tomboy", "kuudere", "dandere", "himedere", "villainess", "ojou-sama",
  "hikikomori", "shut-in",
  // ── generic / fantasy-noise themes that competitors don't browse by ──
  "nudity", "demons", "aliens", "angels", "youkai", "witch", "goblin", "goblins",
  "zombie", "undead", "curses", "shapeshifting", "chibi", "family-life",
  "royal-affairs", "polyamorous", "konbini", "religion", "bar", "mafia",
  "pirates", "prison", "gambling", "survival", "classic-literature", "mythology",
  "artificial-intelligence", "anthropomorphism", "clone", "age-regression",
  "monster-boy", "real-estate", "space", "time-travel", "time-loop",
  "reincarnation", "parallel-world", "guild", "adventurer", "level-system",
]);

/** slug patterns that are also never genres */
export const NOT_A_GENRE_RE =
  /(^|-)(sport|club|team|championship|tournament|league|hobby|occupation)($|-)/;

export function isNotAGenre(slug: string): boolean {
  return NOT_A_GENRE.has(slug) || NOT_A_GENRE_RE.test(slug);
}
