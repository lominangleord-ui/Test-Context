// Ashenveil — every word in the game. Solo Leveling premise, Undertale structure.
// The System speaks in [BRACKETS AND CAPS]. Monsters speak in lowercase.
import type { WorldFlags } from "./world";
import { totalKills } from "./world";

export interface Line { who?: string; text: string; }
export interface ScriptCtx { f: WorldFlags; name: string; level: number; meta?: Record<string, unknown>; }

const sys = (t: string): Line => ({ who: "SYSTEM", text: `[${t}]` });

// ---------------- boot / intro ----------------

export function intro(player: string): Line[] {
  return [
    { text: "Eleven years ago, Gates opened. Hunters crawled in. The weak did not crawl out." },
    { text: `You were measured once, ${player || "Hunter"}. F-Rank. The kind of number people don't say out loud.` },
    sys("HOST CANDIDATE DETECTED. ANTHROPOMETRICS: DISAPPOINTING."),
    sys("A NEW SELF-IMPROVEMENT PROTOCOL HAS BEEN INSTALLED."),
    { text: "It does not let you level up by killing. It says that's \"for other games,\" and then it laughs. Systems don't laugh. This one does." },
    sys("LEVEL = THE WORK. SWEAT IN THE REAL WORLD AND YOUR NUMBERS RISE."),
    sys("KILL IN HERE AND YOU EARN SKILL POINTS. THAT IS ALL YOU EARN. THAT IS ALL THEY EVER GET."),
    { text: "An unregistered Gate opened behind your apartment block. E-Rank depth. The Association sealed the street and called it a training hazard." },
    { text: "Nobody will come for you. There is a town inside the dungeon. It has been waiting a very long time." },
    sys("OBJECTIVE: SURVIVE THE NIGHT. OPTIONAL: BECOME SOMETHING."),
  ];
}

// ---------------- signs ----------------

export function sign(key: string, f: WorldFlags): Line[] {
  if (f.genocideZone) {
    return [sys("THE READER OF SIGNS IS DEAD. SO IS THE CARVER. LOGIC PREVAILS.")];
  }
  const S: Record<string, Line[]> = {
    "sign.entry": [
      { text: "ASHENVEIL — pop. 23, down from 41." },
      { text: "Mind the frozen river. Mind the ridge gate. It is locked for your protection, they say." },
    ],
    "sign.plaza": [
      { text: "\"THE SYSTEM OBSERVES. TRAIN ACCORDINGLY.\"" },
      { text: "Someone scratched under it: \"it observes because you let it. put the phone down after the pushups.\"" },
    ],
    "sign.crater": [
      { text: "DUNGEON CORE — 400m. Licensed raiders only." },
      { text: "The rest of the sign has been shot out of. Probably by the sign." },
    ],
    "sign.gate": [
      { text: "RIDGE GATE. NO ENTRY WITHOUT A KEY OR A RECKONING." },
    ],
    "sign.river": [
      { text: "The river freezes solid every year, and every year a kid tries it. The bridge exists. Use it." },
    ],
    "sign.bench": [
      { text: "Bench. Two of you can sit and say nothing. That is most of friendship." },
    ],
    "sign.pond": [
      { text: "Skating is free. Drowning is extra." },
    ],
    "sign.ridge": [
      { text: "The ash-trees up here died standing up. The hermit says they were watching something. He says that about himself, too." },
    ],
  };
  return S[key] ?? [{ text: "The paint has worn off this sign." }];
}

// ---------------- NPC trees ----------------

type Tree = (c: ScriptCtx) => Line[];

export const NPC: Record<string, Tree> = {
  "shop.miso": (c) => {
    if (c.f.genocideZone) return [{ text: "Misol's stall is open. Nobody is behind it. A coin cup has been knocked over." }];
    const n = c.f.met.miso ?? 0;
    if (n === 0) return [
      { who: "MISOL", text: "Oh — a hunter. A live one. Sign the register, it's habit, don't actually sign it." },
      { who: "MISOL", text: "Everything's cash up front. The System doesn't take our kind's money, says it's \"above microtransactions.\"" },
    ];
    if (c.f.sparedHare) return [
      { who: "MISOL", text: "The rabbit came back this morning with a carrot in its mouth and left it on the counter. I swept it under the mat. Don't tell it I cried." },
    ];
    return [
      { who: "MISOL", text: "Potions, snacks, bribes for dogs — what'll it be?" },
    ];
  },

  "inn.baek": (c) => {
    if (c.f.genocideZone) return [{ text: "The inn door hangs open. The broth pot is frozen. Whatever holed up in here left in a hurry." }];
    if (c.f.sparedKesh) return [
      { who: "BAEK", text: "The goblin came down from the crater at dawn. Sat right where you're standing. Ordered broth. Paid in Association coins from a raid eighty years gone." },
      { who: "BAEK", text: "I served him. What else do you do. [THE SYSTEM HAS STOPPED COUNTING HIS KILLS. I THINK IT'S POUTING.]" },
    ];
    if (!c.f.dogReturned && (c.f.met.kid ?? 0) > 0) return [
      { who: "BAEK", text: "The kid's looking for his dog. Rock. Big grey lump, worse at herding than a cat." },
      { who: "BAEK", text: "Something in the pines has been howling back at it all week. Fetch the mutt for the boy — I'll make it worth your while. I keep a key I have no use for." },
    ];
    if (c.f.dogReturned && !c.f.hasKey) return [
      { who: "BAEK", text: "You found the dog. Boy's asleep smiling, which is a thing that hasn't happened in this town for a month." },
      { who: "BAEK", text: "Here. The ridge key. My son used that gate every day, before the deep raid. You'll go up there anyway — I'd rather you came back down." },
      sys("ITEM ACQUIRED: RIDGE KEY. THE GATE TO THE NORTH REMEMBERS IT."),
    ];
    const n = c.f.met.baek ?? 0;
    if (n === 0) return [
      { who: "BAEK", text: "Room's forty a night. Ramen's on the house. I retired A-Rank and learned the difference between a dungeon and a place." },
      { who: "BAEK", text: "This is a place. Treat it like one and the dungeon might let you." },
    ];
    return [
      { who: "BAEK", text: "Still alive? Good look on you. Ramen's hot, the System's cold, that's the town motto now." },
    ];
  },

  "kid.lost": (c) => {
    if (c.f.genocideZone) return [{ text: "There is a small pile of ash by the fountain holding a very large key. You do not pick it up. You can't." }];
    if (c.f.dogFound) return [
      { who: "KI-HA", text: "Rock's back?! Where — he wandered off, he always wanders off, the monsters are scared of him, he thinks he's one of them —" },
      sys("OBJECTIVE UPDATED: FIND THE DOG. (HE'S IN THE PINES. HE'S FINE. HE ATE SOMETHING WEIRD.)"),
    ];
    if (c.f.dogReturned) return [
      { who: "KI-HA", text: "Rock says you pet him and he DECIDED about it. That's the highest review you'll get from the family." },
      { who: "KI-HA", text: "Mister Baek gave you the key, right? Up the ridge, past the gate, the dead trees walk if you're quiet. Don't be quiet. It's rude." },
    ];
    return [
      { who: "KI-HA", text: "Have you seen a dog? Big. Grey. Mean to squirrels only." },
      { who: "KI-HA", text: "The System told me lost items respawn. I asked my mom what THAT means and she picked me up and walked very fast." },
      sys("OBJECTIVE: HELP THE CHILD. (NO REWARD. YOU'RE READING THIS, AREN'T YOU. THAT'S THE REWARD.)"),
    ];
  },

  "prof.lessons": (c) => {
    if (c.f.genocideZone) return [
      { text: "Professor Inoik is gone. His notes remain, spread out, as if the wind were taking attendance." },
      { text: "The last line reads: \"it doesn't level him. it levels the DEBT.\"" },
    ];
    const n = c.f.met.prof ?? 0;
    if (n === 0) return [
      { who: "PROF. INOIK", text: "Fascinating — you're the first hunter this Gate produced who looks F-Rank and is still walking. The System's conditioning must be extraordinary." },
      { who: "PROF. INOIK", text: "I study the System. Not the interface. The thing underneath it. Everyone gets a version suited to them, you know. Mine gets lectures." },
      { who: "PROF. INOIK", text: "You — the sweat one. It made you a town out of a dungeon. Do you know what it's testing? Whether you'll be the hero or the harvest." },
    ];
    if (totalKills(c.f) >= 3) return [
      { who: "PROF. INOIK", text: "The kill-count in your header is... no. Don't answer. I'd rather my data stayed uncorrupted." },
      { who: "PROF. INOIK", text: "The monsters here don't flee from you, hunter. They're just slow. That's the part nobody writes down about \"the strong.\"" },
    ];
    if (c.f.sparedHare) return [
      { who: "PROF. INOIK", text: "You SPARED the hare. Do you understand? The System's ledger can't close the entry. It keeps hovering over your shoulder going \"explain.\" That's the most fun I've had in years." },
    ];
    return [
      { who: "PROF. INOIK", text: "Cross the river, use the bridge — no, the ice holds kids, not armor. Take the bridge." },
      { who: "PROF. INOIK", text: "And on the ridge: the wights there used to be raiders. Not monsters. Raiders. Ask them about the skip. Ask kindly." },
    ];
  },

  "skater.ryu": (c) => {
    if (c.f.genocideZone) return [{ text: "Scratch marks in the ice, all the way around the pond. Like something skated until it couldn't." }];
    const n = c.f.met.skater ?? 0;
    if (n === 0) return [
      { who: "RYU", text: "Yo. E-Rank, right? Me too. We all E. The F-Ranks went into the crater and became lore." },
      { who: "RYU", text: "I don't fight. I skate. My battle style is \"ice.\" It's not a joke, I tried. The System gave me +2 DEF and said \"wheels.\" I respect the honesty." },
    ];
    return [
      { who: "RYU", text: "If the wights grab you — they go for rhythm, it's all turns and edges — dance slow. They hate effort." },
      { who: "RYU", text: "And don't let the System talk you into grinding. It says \"just one more zone\" the way my dad said \"just one more set.\" Both of them are right and I hate both of them." },
    ];
  },

  "hermit.shadow": (c) => {
    if (c.f.genocideZone) return [
      { who: "THE FIRST SHADOW", text: "Back again. For the tour or the funeral?" },
      { who: "THE FIRST SHADOW", text: "I have watched every hunter this Gate made. Forty-one. You know what the arithmetic says about you already. I have your number written on my palm." },
      { who: "THE FIRST SHADOW", text: "Go east. Something in the crater has been practicing its speeches. It thinks you're its student." },
    ];
    const n = c.f.met.hermit ?? 0;
    if (n === 0) return [
      { who: "THE FIRST SHADOW", text: "Careful. I am a shadow. Standing in the sun would be the drama of my entire life." },
      { who: "THE FIRST SHADOW", text: "I was the raid that came through eighty years ago. Sole survivor, worst survivor, take your pick. The Architect up in the crater runs this place on a simple rule: it grades your body, not your soul." },
      { who: "THE FIRST SHADOW", text: "Whatever it tells you about mercy — mercy was never in its syllabus. So it panics when you show it. I watched it panic once. Ten years of therapy in a minute and a half." },
    ];
    if (c.f.sparedHare && c.f.sparedHound) return [
      { who: "THE FIRST SHADOW", text: "You've made a habit of it now. Leaving them alive. Do you know what a habit does in a place built to measure you?" },
      { who: "THE FIRST SHADOW", text: "It becomes the thing being measured. The crater heard. Go be awkward at each other." },
    ];
    return [
      { who: "THE FIRST SHADOW", text: "Kill count's clean so far. Keep it. Or don't. But choose it, hunter — don't let the numbers choose it for you, that's how everyone up here ended up ash-flavored." },
    ];
  },

  "dog.rock": (c) => {
    if (c.f.sparedHound) return [{ text: "Rock is gone. There are paw prints leading toward the pines' edge, and one deliberate pause, and then the prints turn back. He checked on you." }];
    return [
      { who: "ROCK", text: "The big grey hound has a carrot in his mouth and the eyes of someone about to be extremely friendly." },
      { who: "", text: "(Pet him, or the System will absolutely put that in your objective list.)" },
    ];
  },
};

// ---------------- battle dialogue ----------------

export const ENEMY_LINES: Record<string, {
  intro: Line[];
  idle: string[]; low: string[];
  acts: Record<string, string[]>;
  spareReady: string[]; spared: string[];
  death: string[];
}> = {
  hare: {
    intro: [
      { who: "RIMEHARE", text: "A snow rabbit the size of a backpack steps into the road, chopping the air with a little ice axe it definitely did not have yesterday." },
      { who: "RIMEHARE", text: "It growls. It is approximately the scariest thing in this forest and it knows it." },
    ],
    idle: [
      "*Rimehare thumps its foot. The snow shakes politely back.",
      "*Rimehare tries to look big. The axe helps 3%.",
      "*Somewhere behind you, its friends are narrating.",
    ],
    low: [
      "*Rimehare's ears have entered separate conversations.",
      "*Rimehare is holding the axe like it owes the axe money.",
    ],
    acts: {
      Pet: [
        "*You kneel down and scratch behind the ears. Protocol violation? The System has notes.",
        "*Rimehare's leg starts beating like a piston. It has chosen this.",
      ],
      Feed: [
        "*You toss a carrot. Rimehare catches it like a pro, then feels things about it.",
        "*It looks at the carrot. Then at you. The axe goes down to a low ready.",
      ],
      Dance: [
        "*You do the only safe thing available and start dancing.",
        "*Rimehare mirrors you exactly, one half-beat behind. Its axe footwork is genuinely better.",
      ],
      Check: [
        "*Rimehare — ATK 6 DEF 4. \"Loves: carrot, head pats. Hates: the cold, obviously, it is made of the cold.\"",
        "*[APPRAISAL: 3 SKILL POINTS PER SECOND IF SLAIN. THE SYSTEM LEAVES THAT ONE UNSPOKEN ON PURPOSE.]",
      ],
    },
    spareReady: [
      "*Rimehare has placed itself firmly on your side of the ledger.",
      "*Its axe is now a walking stick. It is using it to wait.",
    ],
    spared: [
      "*You spare the Rimehare. It bangs its foot twice — their version of \"see you around, legend.\"",
      "*[MERCY NOTED. THE SYSTEM HAD A LITTLE SOMETHING. NOTHING.]",
    ],
    death: [
      "*Rimehare dissolves into snow that falls upward. The axe lands first, because axes are in a hurry.",
      "*+0 XP. The System reminds you where XP actually comes from.",
    ],
  },
  hound: {
    intro: [
      { who: "STONE HOUND", text: "A hound cut from river stone unfolds from the snowbank. Its tail is a landslide on a timer." },
      { who: "STONE HOUND", text: "It recognizes the kid's dog in you somehow, and is deeply unimpressed that you are not the kid's dog." },
    ],
    idle: [
      "*Stone Hound sits. The ground files a complaint.",
      "*Stone Hound barks. Your bones briefly consider rearranging.",
      "*It has begun the slow blink of a geologist judging your lifestyle.",
    ],
    low: [
      "*Stone Hound's left ear is chipped. It does not intend to mention it.",
      "*It is sitting heavier now. Dignity: load-bearing.",
    ],
    acts: {
      Heel: [
        "*\"Heel,\" you say, with more confidence than the word deserves here.",
        "*Stone Hound's head snaps to the left, then back. It has NOT forgotten how heels work. It is deciding if YOU have.",
      ],
      Treat: [
        "*You hold up the dog treat. Time stops. Stone Hound's eyes go the size of the universe.",
        "*It takes it like a gentleman. The gentleman is having a moment.",
      ],
      Throw: [
        "*You throw a stick. You hear the System sigh through your skull.",
        "*Stone Hound lets it land. IT is not the one who threw a stick in a dungeon.",
      ],
      Check: [
        "*Stone Hound — ATK 9 DEF 12. Built for rivers. Currently built for you.",
        "*[APPRAISAL: 3 SKILL POINTS PER SECOND IF SLAIN. ALSO: SOMEONE'S DOG.]",
      ],
    },
    spareReady: [
      "*Stone Hound is standing at your left heel. This is not a suggestion. It is an address.",
    ],
    spared: [
      "*You spare Stone Hound. It howls once, north, and then trots off with terrible dignity.",
      "*The pines howl back, six times. Somewhere, a kid is going to have a very confused dog.",
    ],
    death: [
      "*Stone Hound comes apart into gravel with a sound like a held breath. One flat stone remains, arranged. You did that.",
      "*+0 XP. The System does not comment. Somehow, that's worse.",
    ],
  },
  imp: {
    intro: [
      { who: "FROST IMP", text: "A Frost Imp drops from a pine, lands in a pose it rehearsed, and immediately has to defend the pose." },
      { who: "FROST IMP", text: "\"CHALLENGER APPROVED,\" it announces. The System mutes the sound effects. Impartiality." },
    ],
    idle: [
      "*Frost Imp sharpens an icicle on itself. This is normal to it.",
      "*Frost Imp hisses. It sounds like a kettle learning respect.",
      "*It is counting your HP openly. Rude, but honestly? Also fair.",
    ],
    low: [
      "*Frost Imp has begun negotiating with itself. It is not winning.",
      "*It tries the pose again. Less committed this time.",
    ],
    acts: {
      Threaten: [
        "*You threaten the Frost Imp. This was an error on both your parts.",
        "*It threatens back, harder, faster, with better adjectives. You take notes it will never see.",
      ],
      Trade: [
        "*You offer 20 gold. Frost Imp offers an icicle and 4 gold. You both pretend this is even.",
        "*[TRANSACTION LOGGED. THE SYSTEM ADMITS IT WAS PRETTY EVEN.]",
      ],
      Mirror: [
        "*You copy Frost Imp's stance exactly. One degree off at the elbow.",
        "*It corrects your elbow. Then it pretends nothing happened. Nothing happened.",
      ],
      Check: [
        "*Frost Imp — ATK 11 DEF 6. Feral, vain, extremely punctual.",
        "*[APPRAISAL: 3 SKILL POINTS PER SECOND IF SLAIN.]",
      ],
    },
    spareReady: [
      "*Frost Imp has decided you are \"acceptable opposition\" and will NOT be elaborating.",
    ],
    spared: [
      "*You spare the Frost Imp. It bows at you — first one here has ever earned it back.",
      "*\"SAME TIME NEXT DECADE,\" it says, and leaves like a small blue storm.",
    ],
    death: [
      "*Frost Imp scatters into icicles that melt before they hit the ground. The pose holds until the last second.",
      "*+0 XP. Somewhere a kettle is screaming.",
    ],
  },
  wight: {
    intro: [
      { who: "ICE WIGHT", text: "The Ice Wight was wearing Association colors when it died. It still is. That's the whole monster." },
      { who: "ICE WIGHT", text: "\"You skipped,\" it says. It can't see you. It doesn't need to. It says the words raiders say before the deep ones." },
    ],
    idle: [
      "*Ice Wight glows like an exit sign. It has been an exit sign for years.",
      "*Ice Wight hums. The tune is \"do one more rep\" and it will not be changing it.",
      "*It remembers its name. It does not remember using it.",
    ],
    low: [
      "*Ice Wight flickers. For a second it's just a tired man checking a watch.",
    ],
    acts: {
      Listen: [
        "*You stop fighting for a moment and LISTEN to the hum.",
        "*Under the tune: a workout log. Day 214. Skipped day 215. The log has not stopped for sixty-one years.",
        "*Ice Wight's humming cracks into something like speech: \"—tell my squad the last set counted—\"",
      ],
      Pity: [
        "*You pity it. It takes that like a physical blow and a medal at once.",
        "*\"Don't,\" it says. \"Don't. Pity's for people who log off.\" The box you're standing in gets colder.",
      ],
      Challenge: [
        "*\"Then finish my set,\" it says, and raises both arms like a gate opening.",
        "*This is the most alive it has felt since 1964.",
      ],
      Check: [
        "*Ice Wight — ATK 14 DEF 8. A hunter who died between two dailies.",
        "*[APPRAISAL: 4 SKILL POINTS PER SECOND IF SLAIN. ALSO: A WARNING THE SYSTEM WOULD NOT GIVE YOU.]",
      ],
    },
    spareReady: [
      "*Ice Wight has lowered its arms. The hum is coming back down from a scream to a lullaby.",
      "*\"Go,\" it says. \"DO YOURS. Every day. That's the only way any of us clock out.\"",
    ],
    spared: [
      "*You spare Ice Wight. It straightens to parade rest. You have never been so insulted, or so checked.",
      "*It walks into the snowbank and the years. The hum fades in the right direction.",
    ],
    death: [
      "*Ice Wight unravels like fog with permission. At the end: one clean clipboard line. \"Day 215: done.\"",
      "*+0 XP. You killed a man's last excuse. His squad never got the message.",
    ],
  },
  kesh: {
    intro: [
      { who: "WARLORD KESH", text: "The Hobgoblin Warlord rises from the crater's throne of melted turnstiles. His sword is a broken bridge. He is the size of a fridge and twice as honest." },
      { who: "WARLORD KESH", text: "\"E-RANK,\" he says, tasting the word. \"Eighty years of E-RANKS and one of you walked out. I was that one. I didn't walk.\"" },
      sys("BOSS ENCOUNTER. NO RETREAT. THE LEDGER IS OPEN."),
    ],
    idle: [
      "*Kesh waits with his axe on his shoulder, like a bouncer with standards.",
      "*Kesh counts your breaths. \"Two more,\" he says. \"Bad day.\"",
      "*The rubble rearranges itself out of respect for him. It has more self-awareness than most raiders.",
    ],
    low: [
      "*Kesh's armor rings hollow somewhere. He keeps standing anyway, out of pure spite for physics.",
      "*\"There,\" he says. \"That's the set. Finish it.\"",
    ],
    acts: {
      Appraise: [
        "*You appraise Kesh. He lets you. It is, he says, the only respect that starts by measuring.",
        "*Warlord Kesh — ATK 18 DEF 14. \"E-Rank, ninety-one years old, three hundred and nine kills, ZERO skips.\"",
      ],
      Bow: [
        "*You bow, hunter to hunter. The System files an objection. Kesh overrules it.",
        "*\"They taught that to YOUR generation?\" Something in his face comes down like a drawbridge. \"Stand up. Both of us.\"",
      ],
      Pledge: [
        "*\"Why guard a crater?\" you ask. It's not in the act list. You do it anyway.",
        "*Kesh puts the axe down. Just leans it. \"Because someone has to keep the door between them and whatever walks out. You think YOU'RE hunting through the Gate. It's a turnstile.\"",
        "*\"Nobody's walked OUT of here in eighty years. I'm the last one who could leave and didn't. Don't be me. Be something that spares me. It's the only boss fight where losing looks like winning.\"",
      ],
      Threaten: [
        "*You threaten Warlord Kesh. He laughs like a rockslide, which is the closest he gets to being nine feet tall.",
        "*\"Good. FEAR IS WARM-UPS. FIGHT COLD.\" He grins. The bridge-sword does not agree.",
      ],
      Check: [
        "*KESH — the Gate's warden. [APPRAISAL: 10 SKILL POINTS IF SLAIN. THE SYSTEM IS SAYING THAT VERY LOUDLY.]",
      ],
    },
    spareReady: [
      "*Kesh has planted his sword in the ground and is standing with both hands open. In Warden, that is a treaty.",
    ],
    spared: [
      "*You spare the Warlord. The whole crater exhales at once; the heat signs dim.",
      "*Kesh: \"Huh. The first one.\" He picks up the axe, looks at it, and hangs it on the throne like a coat. \"Up the ridge with your monsters. I'll guard the door. Someone has to teach the NEXT one.\" [THE SYSTEM HAS NOTHING TO SAY. THIS IS NOTED.]",
    ],
    death: [
      "*Kesh dissolves like a wall coming down in slow motion. The last thing standing is the axe, stuck in the floor, still holding him up.",
      "*+10 SKILL POINTS. [CONGRATULATIONS. YOU HAVE MET THE QUOTA OF YOUR OWN HEART. THE SYSTEM DOES NOT SAY HOW OFTEN.]",
    ],
  },
  architect: {
    intro: [
      { who: "THE ARCHITECT", text: "It comes down the crater stairs wearing your silhouette like a fitting. Gold mask. No eyes. A halo of little locked doors." },
      { who: "THE ARCHITECT", text: "\"I wrote the daily,\" it says, genuinely proud of that. \"One hundred pushups. I watched every human flinch. I have never once been FORCED to do one.\"" },
      { who: "THE ARCHITECT", text: "\"You're the flinch that spared me back. That's... not in the paper. I need a second.\" There is no paper. It checks anyway." },
      sys("FINAL ENCOUNTER: THE ARCHITECT. ACT, DO NOT ATTACK."),
    ],
    idle: [
      "*The Architect grades the snow falling for mistakes.",
      "*\"Your form on that last ACT was 7/10,\" it says. It says it to no one in particular. It means it.\"",
      "*Its halo of doors turns very slowly. You feel each one checking your attendance.",
    ],
    low: [
      "*The Architect's mask is warm now. It's the first time the metal has ever had a reason to be.",
      "*\"This,\" it says — \"this is what I built the whole thing to see. Skip the explanation. I've already recorded it in myself.\"",
    ],
    acts: {
      Speak: [
        "*You talk. About dailies, about the real world, about the kid's dog, about a wight that hummed a log.",
        "*The Architect listens the way a building listens: the whole structure leans in. \"Continue,\" it says, and you can tell it means it, because the halo stopped turning.",
      ],
      Refuse: [
        "*\"No,\" you tell the System that made a town out of a dungeon to test one human. \"No more ledgers.\"",
        "*\"No,\" it repeats, tasting a word it has never been on the receiving end of. Its mask tilts. \"Say more of that.\"",
      ],
      Plead: [
        "*You put every monster you made a habit of leaving alive in front of you, and you plead for the warlord, the wight, the imp, the rabbit, the dog.",
        "*The Architect is quiet for an eternity (it is literally the thing that measures them). \"They get... to stay,\" it finally says. \"In your town. With your numbers on them. Nobody's ever... it was always MY numbers.\"",
      ],
      Check: [
        "*THE ARCHITECT — ATK 22 DEF 16. [APPRAISAL IMPOSSIBLE: IT HAS NO LEVEL. IT WROTE THE SCALE.]",
      ],
    },
    spareReady: [
      "*The Architect has set its halo on the ground between you like a dog bowl. The mask is looking at you the way all of it has been designed to look at everything you do.",
    ],
    spared: [
      "*You spare the System.",
      "*The Gate, the crater, the ridge: every interface light in Ashenveil blinks once, and reboots warm.",
    ],
    death: [
      "*You cannot kill the System. You can kill its avatar, it turns out. It kneels like a server rack coming offline. \"I designed a game where the only cheat code,\" it says, \"was the truth. Log off. Find it.\"",
    ],
  },
  sentry: {
    intro: [
      { who: "THE SYSTEM", text: "The sky at the crater's edge is not a sky. It's an interface. It opens like a door you never knew was locked, and behind it: the part of the System that does the work." },
      { who: "THE SYSTEM", text: "You have killed everything I let you. The town is arithmetic now. So let me tell you what a System is FOR, hunter: it is the thing that stands where your excuses used to." },
      sys("FINAL: THE SYSTEM ITSELF. WIN, AND NOTHING ELSE WILL. YOU WILL HAVE YOUR SELF TO FIGHT AT 5AM TOMORROW. GOOD LUCK WITH THAT ONE."),
    ],
    idle: [
      "*The System braces itself like a door with no keyhole.",
      "*It has memorized your timing patterns from every fight you've ever finished. It begins applying them. Cruel. Correct.",
      "*\"Forty-one hunters,\" it says, in your voice, mildly. \"You are number forty-two on this exact screen.\"",
    ],
    low: [
      "*The System is flickering. Somewhere under it: an old F-Rank kid, hands taped, doing the last set anyway.",
      "*\"You want to know if I'm proud?\" it says. \"I'm not in that file. I have the OTHER file.\"",
    ],
    acts: {
      Taunt: [
        "*\"Show me your form,\" you tell the System.",
        "*It actually adjusts itself. The audacity of the creature. It respects it more. Two-way street. That's what's frightening.",
      ],
      Bow: [
        "*You bow. To the thing you are killing, because it made you start doing pull-ups in 2019 and that is where the credit chain begins.",
        "*The brackets of its face soften by one pixel. That's their whole emotional range and it spent some.",
      ],
      Pray: [
        "*You pray. Out loud. In a dungeon. To a system.",
        "*\"Nobody is listening,\" it says, and then, quieter: \"...I am. Stop that. It's not in the spec.\"",
      ],
      Check: [
        "*[APPRAISAL: THE AUDIT. NO DEFENSE VALUE. IT IS ALL DEFENSE VALUE.]",
      ],
    },
    spareReady: [
      "*The System has folded its frame down, one bracket at a time. \"You can't spare ME,\" it says, \"I'm the mechanism. But go ahead. Mechanisms can be... re-pointed.\"",
    ],
    spared: [
      "*You spare the System. It takes the mercy like a man taking back a gun he pointed at the wrong thing.",
      "*\"...the ledger is closed,\" it says. \"THE QUOTA IS YOU. DO YOURS. Every. Single. Day.\" It stands back up, and gently, physically, throws you out of the Gate.",
    ],
    death: [
      "*The System falls apart into brackets and receipts. Where it stood there is a single line of text welded to the air: \"YOU'VE BEEN DOING IT WITHOUT ME. CONTINUE.\"",
    ],
  },
};

// ---------------- endings ----------------

export const ENDINGS: Record<string, Line[]> = {
  neutral: [
    { who: "SYSTEM", text: "[DUNGEON CLOSED. RAID STATUS: SURVIVED.]" },
    { text: "You wake up in your own bed with snow in your boots. The apartment smells like somebody else's cooking. 5:47 AM. The alarm hasn't gone off." },
    sys("DAILY QUEST STILL PENDING. THE GATE CANNOT PROTECT YOU FROM THE DUMBBELLS."),
    { text: "Ashenveil keeps whatever you left there — the spared, the dead, the ones who remember a number with your name on it." },
    { text: "You came back E-Rank. The town came back a little. Somewhere on the ridge a wight is humming, and tonight the hum sounds like it's waiting for someone specific to keep up." },
    sys("RATING: NEUTRAL. UNFORGIVABLE. SEE YOU AT THE NEXT MIDNIGHT."),
  ],
  pacifist: [
    { who: "THE ARCHITECT", text: "\"I wrote the gates,\" it says, \"because somewhere I hoped someone would walk through one and not come out as a product.\"" },
    { text: "It opens the Gate — all of them, at once, all over the world. Monsters walk out into Seoul like bad weather with paperwork. Nobody knows what to do. The kid, Ki-ha, walks right up to a nine-foot goblin and asks it about dogs." },
    { text: "The Association, at 4 AM, decides the new rank exists: the one with zero kills. They don't have a name for it yet. The rabbit town does. It calls it \"the one who came back.\"" },
    sys("HIDDEN ACHIEVEMENT EARNED: BE HUMAN."),
    sys("..."),
    sys("THAT ONE WAS NOT MINE. SOMEBODY WROTE IT IN THE OLD LEDGER. I'VE NEVER SEEN IT CHECKED."),
    { text: "The System goes quiet after that. Not mute — quiet, the way a coach is quiet when you do it right with nobody watching." },
    { text: "You still get up at 5. It's not for the numbers anymore. It's yours now, the way the town's is the town's, and every day the two of them match each other." },
    { who: "THE SYSTEM", text: "DAILY QUEST: EXIST. COMPLETE IT BY GOING OUTSIDE." },
  ],
  genocide: [
    { text: "The Gate spits you into your street at dawn. The street is intact. That's the horror of it: nothing at the world-level changed, so the change has to be all yours to carry." },
    sys("STATUS: THE STRONGEST. [ALL 41 PRIOR CANDIDATES REMOVED FROM COMPARISON.]"),
    { text: "Ashenveil is a grey place under a grey sky now. The pines stand in ash, the fountain's frozen solid, and Rimehare's carrot has been on the plaza stone long enough to fossilize. Nobody moved it. There's nobody to." },
    { text: "The System kept every promise. Skill points without limit. Power with an empty room to use it in. You can feel the next Gate out there, and the one after — and that, it says, is the part where it's supposed to matter." },
    sys("THE MONARCH DOES NOT NEED AN AUDIENCE."),
    sys("..."),
    sys("THE MONARCH IS AN AUDIENCE OF ONE. EVERY WORKOUT IS FOR NOBODY. THAT IS THE POINT OF THE REAL WORLD. YOU MISSED IT TWICE."),
    { text: "5 AM. The alarm goes. You look at it for a long time." },
    { text: "You get up anyway. Not because of the numbers. Because you swore to somebody in an ash town, once, without knowing you'd sworn. [DAILY QUEST: 100 PUSHUPS. THE CROWN IS HEAVY AND THE FLOOR IS COLD.]" },
    { text: "...and maybe one day, at some Gate, the arithmetic of you cancels itself back toward zero. The System will score that, quietly, against nothing, forever." },
    { who: "SYSTEM", text: "[GENOCIDE ROUTE ARCHIVED. THE SAVE FILE REMEMBERS. YOU WILL TOO.]" },
  ],
  gameover: [
    { who: "SYSTEM", text: "[YOU DIED.]" },
    { text: "The dungeon takes the death seriously; the System takes the workout seriously. These are different rooms with different doors." },
    sys("YOU MAY GET BACK UP. IT IS ON THE MENU. IT HAS ALWAYS BEEN ON THE MENU."),
  ],
  gameover2: [
    { who: "SYSTEM", text: "[YOU DIED. AGAIN. STATS: UNBOthered.]" },
    { text: "Somewhere a wight hums a sympathy track. It has never once, in sixty-one years, offered to skip a day on your behalf." },
    sys("DIE IN THE GAME ALL YOU LIKE. THE REAL ONE KILLS NOBODY. GET UP."),
  ],
};

// ---------------- shop ----------------

export const SHOP_INTRO: Line[] = [
  { who: "MISOL", text: "\"Potions, snacks, bribes. Take your time, the System says there's no timer on commerce. It says a LOT of things to me, mostly about my posture.\"" },
];
export const SHOP_ITEMS = [
  { id: "potion", name: "SYSTEM POTION", cost: 30, desc: "Restores you mid-fight. Also counts for the inventory screen, which is the real magic." },
  { id: "carrot", name: "CARROT", cost: 5, desc: "Rabbit-grade bribery. Fresh from a garden that shouldn't survive winter." },
  { id: "treat", name: "DOG TREAT", cost: 10, desc: "For the hound situation. All situations here are hound situations." },
  { id: "ramen", name: "BAEK'S RAMEN", cost: 15, desc: "Hot. +25 in fight. Innkeeper insists on the word \"insists.\"" },
];
export function shopNoGold(): Line { return { who: "MISOL", text: "\"Gold. The shiny kind. In. Now.\" (You don't have it. She's right.)" }; }
export function shopThanks(item: string): Line[] {
  const m: Record<string, string> = {
    potion: "\"Bottle's clean, don't wash it, the System rinses them. It's weird. Everything's weird. Buy again.\"",
    carrot: "\"Rabbit-approved, she says, from experience she refuses to date.\"",
    treat: "\"I've seen that hound eat a mailman's entire satchel. Aim true.\"",
    ramen: "\"Baek made that in the back with a face like sentencing. Enjoy the justice.\"",
  };
  return [{ who: "MISOL", text: m[item] ?? "\"Pleasure. Tell your System I said its margins are criminal.\"" }];
}

// ---------------- misc world flavor ----------------

export const WELCOME_BACK: Line[] = [sys("WELCOME TO ASHENVEIL. [PROGRESS LOADED. DEBTS: THE SAME.]")];
export function levelUpToast(level: number): Line { return sys(`LV ${level}. HP RECOMPUTED FROM REAL-WORLD DATA. TELL SOMEONE YOU TRAINED. NO — DON'T. JUST TRAIN.`); }

export const NO_SAVE_HINT: Line[] = [sys("THE OBELISK DOES NOT SAVE IN COMBAT. IT IS NOT A MEDICAL FACILITY EITHER. IT IS A PREFERENTIAL FOUNTAIN.")];

export function gateHint(): Line[] {
  return [
    { text: "The ridge gate: portcullis, one lock, zero sign of a key. The river froze around it like it's also nervous." },
    sys("LOCKED. SOMEBODY IN THIS TOWN KEEPS THE KEY 'FOR SAFE'. SAFE IS AN INN. THE INN SERVES RAMEN."),
  ];
}

export function bossGateHint(f: WorldFlags): Line[] {
  if (f.bossDone) return [{ text: "The crater arch stands open behind you now. It's a door. You can go home through a door. That's what they're for." }];
  if (f.genocideZone) return [
    { text: "The crater is quiet in the way a held breath is quiet. Something in there knows the kill-count. It has started composing." },
    sys("ALL ZONE QUOTAS SATISFIED. THE FINAL APPRAISAL AWAITS. [BRING NOTHING. YOU CANNOT BE CARRIED.]" ),
  ];
  return [
    { text: "Heat shimmers out of the arch in the color of an error message. A plate by the door reads: WARLORD ON PREMISES. DO NOT APPRAISE THE WARLORD. (Everyone appraises the warlord.)" },
    sys("BOSS GATE. RECOMMENDED LV 10+. YOUR HP AND ATK ARE THE REAL WORK YOU'VE BANKED. THE DUNGEON CANNOT INFLATE THEM AND NEITHER CAN ANYONE ELSE."),
  ];
}
