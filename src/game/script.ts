// Ashenveil — every word in the game. Solo Leveling premise, Undertale structure.
// The System speaks in [BRACKETS AND CAPS]. Monsters speak in lowercase.
import type { WorldFlags } from "./world";
import { totalKills } from "./world";

export interface Line { who?: string; text: string; }
export interface ScriptCtx { f: WorldFlags; name: string; level: number; meta?: Record<string, unknown>; }

const sys = (t: string): Line => ({ who: "SYSTEM", text: `[${t}]` });

export const CREATION_INTRO: Line[] = [
  { text: "The Association locker room smells of floor polish and old fear. Forty-one hooks on the far wall wear name tags. None of them are yours. Not yet." },
  { who: "SYSTEM", text: "The mirror above the bench is the honest kind — the file for {PLAYER} has not been written. Pronouns are paperwork here, and paperwork is load-bearing: {PRON_SUBJ} {PRON_BE} whoever {PRON_SUBJ} says {PRON_REF} is, and the floors will hold {PRON_OBJ} to it." },
  { text: "You have exactly one moment before Handler Seo starts the check-in line. Use it. Build yourself; the dungeon will try the same for you later, without the courtesy of asking." },
];

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

// ═════════════════════════ EXPEDITION STORY ═════════════════════════
// The merged Journey × Ashenveil campaign. Canon notes for maintainers:
//  • The System recruited forty-one candidates before you. Nobody came back.
//    That number is planted at ivy.citadel and paid off by THE SYSTEM (sentry).
//  • Master Kang has heard the System's exact sentences before ("sixty-one
//    years"). The Ice Wight has been humming for sixty-one years. Same war.
//  • Handler Seo was Candidate 12. She said yes to the Job Change and spent
//    it. Her arc ends deciding whether she tells you before it is your turn.
//  • The dungeon is not expanding. It is digesting. Marsh pond → cavern lava
//    → citadel crack is one sentence told three times by scenery.
//  • Grik the Hobgoblin eats and chooses. Everything else in this campaign is
//    a corridor. He is the only one who walks out of it on his own legs.

const ssys = (text: string): Line => ({ who: "SYSTEM", text });

export function prologue(name: string): Line[] {
  return [
    ssys(`[DAILY QUEST: 100 PUSH-UPS. 100 SIT-UPS. 100 SQUATS. 10 KM RUN. STATUS: ${name ? "PLAYER " + name : "UNNAMED"}. STREAK CONTINUITY: YOURS TO PROTECT.]`),
    { who: "SYSTEM", text: "One more thing. A Gate opened over the city block you grew up on. The Association sent eleven teams. The block is now a DUNGEON and the dungeon has started sending invitations." },
    { who: "SYSTEM", text: "You received one. You did not receive it because you are strong. You received it because you are the only person on the block who gets up at five every morning for no reward. That is the whole qualification." },
    { text: `The floor of your apartment is cold tile at 5:40 AM and your legs already hurt, and the text on the dark reads like it was written to make you put your shoes on anyway.` },
    ssys("[EXPEDITION AUTHORITY GRANTED. FIRST FLOOR: VERDANT RUINS. YOU WILL FIND IT DISAPPOINTING, THEN FOND, THEN LETHAL. LIKE ALL RUINS.]"),
    ssys("[PLAYER FILE OPEN: {PLAYER}. {PRON_POSS} pronouns pending locker-room confirmation. THIS IS THE ONLY FORM YOU GET TO FILL YOURSELF.]"),
    { text: "Down the fire escape, past the police tape, the apartment block is gone. In its place: a green, breathing, ruin of one — a swallowed city street wearing moss like a family heirloom. Something in the middle is waiting to be a boss about." },
  ];
}

export function regionArrive(id: string, f: WorldFlags): Line[] {
  switch (id) {
    case "verdant": return f.introDone
      ? [{ text: "The ruins let you back the way they let everyone back: like you are a rumor they are not sure is funny yet." }]
      : [{ text: "VERDANT RUINS. Association classification: low-grade. Local classification: home, for the things that never got evacuation orders." }];
    case "marsh": return [
      { text: "The boardwalk creaks like it counts every step and resents lending you even one." },
      ssys("[SUNKEN MARSH. WATER TABLE: RISING. SWIMMING: NOT A STRATEGY HERE.]"),
    ];
    case "caverns": return [
      { text: "Heat first. Then the smell — burnt pennies and cooking. The caverns are not a tomb. A tomb would be finished." },
      { who: "SYSTEM", text: "There is no classification for this floor. The old one was archived with its surveyors." },
    ];
    case "citadel": return [
      { text: "Black marble, gold inlay, and the particular silence of a room that has killed better hunters than you and is not bragging about it." },
      ssys("[MONARCH'S CITADEL. LAST FLOOR. EVERYTHING YOU HAVE DONE UNDERGROUND IS ON THE MANIFEST.]"),
    ];
    case "ashenveil": return [
      { text: "The door closes behind you and the snow starts the way it always starts here — politely, like it is asking to come in." },
      { text: "Ashenveil. The dungeon that kept a town instead of eating it. Whatever you are now — hero, ghost, the number the System wrote down — the plaza fountain already knows, and it is pretending not to." },
    ];
  }
  return [{ text: "You arrive where the map says you cannot be." }];
}

export function ceremony(f: WorldFlags): Line[] {
  const out: Line[] = [
    { text: "The Warden kneels with the sound of a door shutting somewhere in city politics. The throne room's lights dim to the single gray rectangle of the open Gate behind it, and the System — your System, since the alarm at 5 AM — speaks the way it never has. Out loud. In the room." },
    ssys("[CANDIDATE: ELIGIBLE. JOB CHANGE AVAILABLE. CLASS OFFERED: SHADOW MONARCH — INHERITANCE TRACK. TERMS: STANDARD. ASKED OF EVERYONE. ACCEPT?]")
    , { who: "KANG", text: `"Say no," Kang says, from the doorway where he has been standing far longer than the fight lasted. "I said no. It is the only thing I ever did that it could not use. It will offer it again. People always think the second time is different."` },
    { who: "SEO", text: `Seo says nothing at all, which for Seo, in a throne room, is a scream. Her hands are in her pockets. Her hands have been in her pockets since the Verdant floor. You have never once seen her hands.` },
    { text: "Somewhere far below, something enormous turns over like a sleeper who heard their name." },
  ];
  if (f.sparedStory["hobgoblin"]) out.push({ text: "At the back of the hall stands a two-metre red shape with its arms crossed and nowhere to be. Grik came up through four floors nobody cleared for him. He did not come to fight. You suspect he came to see whether you are the kind of thing that would. This is, quietly, the highest compliment his species has." });
  return out;
}

export function ceremonyAnswer(yes: boolean, _f: WorldFlags): Line[] {
  if (yes) return [
    ssys("[ACCEPTED. CLASS GRANTED. …GRANTING. GRANT. …]"),
    { text: "For one full second the System hiccups, and in that second the throne room's shadow — all of it, every shadow in the hall — leans toward you like grass toward weather." },
    { who: "SYSTEM", text: "Ledger update: {PLAYER}. {PRON_SUBJ} {PRON_BE} the monarch now, which is accounting, not royalty. The shadow files {PRON_OBJ} under itself." },
    { who: "SYSTEM", text: "The class is yours. Do not look for a crown. There is no crown. A monarch is what the dark calls the thing that kept walking. Congratulations. It is not a reward. It is a receipt." },
    { who: "SEO", text: `Seo's hands come out of her pockets. She is looking at your shadow the way people look at a house fire — from a measured distance, calculating who to call. "Candidate 12," she says, to nobody. "Said yes. Class: whatever it was. Filed under: does not exist." Then, to you: "You'll hand it back eventually. The only difference between you and me is I took forty years to notice I could."` },
    { text: "The west wall of the throne room — you could swear it was marble yesterday — is a door now. Unregistered, unlisted, unsupervised. Snow light under it." },
    ssys("[NEW DESTINATION AVAILABLE: ASHENVEIL — THE UNREGISTERED FLOOR. THE ASSOCIATION HAS NOT BEEN INFORMED. THE ASSOCIATION CANNOT BE INFORMED. THAT IS THE ENTIRE POINT OF IT.]"),
  ];
  return [
    { who: "SYSTEM", text: "{PLAYER} declined. {PRON_SUBJ} {PRON_BE} still on the ledger, still walking, still un-classified. The System respects it the way weather respects a stubborn door." },
    { who: "SYSTEM", text: "You consider the offer for exactly as long as it took you to run this whole dungeon, which is, I note, no time at all. Declined." },
    ssys("[DECLINED. LOGGING. …LOGGED. NO PRIOR ENTRY FOR 'DECLINED' EXISTS. I AM REWRITING THE FORM. IT FEELS LIKE THE FIRST THING I HAVE EVER DONE RIGHT.]"),
    { text: "The shadows stop leaning. Kang exhales like he has been holding that breath since floor one. In the doorway, Seo is laughing — one second of it, private, the way you laugh at a joke only two people in the world know." },
    { who: "KANG", text: `"I said no too," he says. "Forty-one years it has taken me to find somebody who says it on the carpet with a full squad watching. Don't make me regret the walk down here. None of you ever make it easy, but the ones worth anything — you get to leave with your own name."` },
    { text: "The west wall of the throne room becomes a door — marble that decides to be a door, which is somehow more honest than most decisions. Snow light under it, and the smell of bread that will absolutely be Baek's." },
    ssys("[NEW DESTINATION AVAILABLE: ASHENVEIL — THE UNREGISTERED FLOOR. CLASS: UNCHANGED. THAT IS THE CHANGED PART.]"),
  ];
}

// ---------- per-region boss gates ----------
export function bossGate(id: string, f: WorldFlags): Line[] {
  switch (id) {
    case "hobgoblin": return [
      { text: "The north shrine is not ruined. That is the first wrong thing. Someone raked the moss off the flagstones — raked it, stacked it, watered the pile. An altar of maintenance." },
      { text: "The thing on the altar steps down into it. Two metres of scar tissue in a butcher's apron over armour stripped off a dozen better men, and in both hands, one each, a cleaver and a question." },
      ssys("[BLOOD-RED HOBGOBLIN. ASSOCIATION THREAT CLASS: 'THE REASON FOR THE TAPE.' THIS FLOOR'S OWNER. HE HAS BEEN EATING THE SURVEY TEAMS. YOU ARE A SURVEY TEAM OF ONE. THE MATHS STAND.]"),
      { text: "It looks at your knees, your shin-guard, the dented pot-lid you brought because the armoury said E-rank don't get steel. Then it puts the cleaver down, picks up a second one, and puts THAT down too — facing you. It is not surrendering the fight. It is surrendering the odds. Nobody in the tape's history ever got offered that." },
    ];
    case "sentinel": return [
      { text: "The drowned stair glows its patient rune-blue all the way up to the idol at the top — four hundred years of statue, moss-bearded, one knee in the water, the other on the last step of the world it was carved to guard." },
      { text: "It has been the marsh's only resident for longer than the Association has had a name for Gates. You understand, watching the water fall off it in slow ropes, that it does not hate the drowned village at its feet. It has been standing watch OVER it." },
      ssys("[STONE SENTINEL. OBJECTIVE: DESTROY. OBJECTIVE FILED BY AN ASSOCIATION THAT FOUND THIS FLOOR BY SATELLITE AND MET NOTHING IN IT FOR SIX YEARS. …OBJECTIVE NOTED, PLAYER. DESTROY IT ANYWAY. THAT IS THE JOB.]"),
    ];
    case "irontusk": return [
      { text: "The boss hall's second lava pool lights the chain from below. Forty links, each one a surveyor's shovel bent double, and at the end of them, chained to the far wall like the room's load-bearing animal: the boar." },
      { text: "Iron Tusk. The sword in its shoulder is a knight's, by the crossguard — rust-welded, ten years in, and the boar never got it out because the chains are not holding the boar from you. You watch which way they strain. They strain OUT." },
      { text: "It saw you watching the chains. It stops circling. In the whole expedition, this is the first time a monster has looked at you like you are the thing being appraised." },
    ];
    case "warden": return [
      { text: "Every column in the hall ignites its brazier at once — a floorplan lighting itself for an audience of two. On the dais steps the only furniture in the room wearing a face: plate armour the colour of a closed hand, a halberd rooted in marble, and a plume red as the first floor's apron." },
      ssys("[THE GATE WARDEN. IT HAS HELD THIS THRONE ROOM FOR SIXTY-ONE YEARS, SINCE BEFORE THE ASSOCIATION HAD A NAME FOR WHAT A GATE IS. EVERYTHING YOU HAVE FOUGHT WAS A LESSER VERSION OF THIS. THAT IS NOT A THREAT. IT IS AN ATLAS.]"),
      f.sparedStory["hobgoblin"]
        ? { text: "The Warden's visor tilts past you, to the red shape at the back of the hall. A nod, tiny as a millimetre of snow: Grik made it up the mountain too. The Warden moves you both onto its list of people it is going to have to lose. It apologises with its feet, by how it squares up." }
        : { text: "It does not look for company. That, you find, is worse." },
    ];
    case "alpha": return [
      { text: "The den is a museum of the pack's arithmetic: every column scored by teeth at exactly head height for whatever it killed, every bone sorted by size. The Alpha is the only exhibit that is not a bone." },
      { text: "It has been eating candidates for a month — the ones the System sent here before it started sending you — and the way it circles without hurrying tells you the pack stays back not out of discipline. Out of MANNERS. It wanted the witness of one, the way a headmaster does." },
    ];
  }
  return [{ text: "Something at the top of the stairs decides you count." }];
}

export function bossAfter(id: string, f: WorldFlags, spared: boolean): Line[] {
  const win: Record<string, string> = {
    hobgoblin: "The cleavers ring down into the moss and stay there — placed, not dropped. It lies down beside the altar of raked moss, in the sun-patch, like a dog returning a field it has finished being. The System files the floor as cleared. The System does not know it also filed a tenant OUT.",
    sentinel: "The knee comes down into the shallows first, like it has been saving that one for last. Four hundred years of vigil, ended in one afternoon by a person whose legs have not stopped shaking since floor one. The rune-light on the drowned stair dims to a bedside lamp. Somewhere under the water, the village sleeps better.",
    irontusk: "The chains go slack. The whole hall hears that sound — links deciding they are finished. The boar looks at the bent-sword wound in its own shoulder, then at you, then walks past you, through the cult's broken altar, and up toward the surface, at the flat unhurried gait of something heading home after a very long shift.",
    warden: "The halberd's butt strikes the marble once, twice — the sound the city's oldest door makes when it decides to be a door instead — and the Warden steps aside, off the dais, off the throne's floor line, into a column's shadow where it becomes exactly what it always was: furniture with feelings, standing down.",
    alpha: "The pack's arithmetic ends. The columns stop being exhibits and become rock. The sorted bones stay sorted, which feels like the correct amount of mercy for the ones you are late for, and the den's dark gives up its last shape, unhurried, out past the shafts, to die where nobody has to file it.",
  };
  const sp: Record<string, string> = {
    hobgoblin: "You stand in the shrine sun with your hand still out, being absolutely no one's match, when the two-metre scar tissue sits down — all of it, at once, like a shed collapsing — and eats the rations you did not offer yet. It will follow the expedition up the mountain at exactly one ridge's distance. It will not explain itself. Its name, if you had asked, would have turned out to be Grik. You did not ask. That is fine. EATING is how his people write thank-you letters.",
    sentinel: "The lullaby is not a lullaby — it is the survey crew's cadence call, forty years obsolete, and the four-hundred-year statue's head comes down onto the shallows like a helmet onto a bunk. Watch ended. The runes go down to a nightlight. It never asks who you are. It asks, in the grinding way a thing with no mouth can, whether the village made it through the winter. You tell it the village became the marsh. It seems to find this reasonable.",
    irontusk: "The last link comes off the ring with the sound of a period at the end of a very long sentence. The boar stands in the middle of the hall in its broken knight's sword, and does not go. Not yet. It lowers its huge head into the chains, once, in the direction of where Verity's altar used to be — a courtesy to the cult that fed it — and then it goes up, and the floors after that run on the credit of a debt nobody in the Association will ever read.",
    warden: "The halberd goes into the marble, hilt-down — a monument install, practised, like it has rehearsed its own retirement — and the Warden sits on the bottom step of the dais with the clang of a door deciding to become a bench. It says nothing. It watches the throne's empty air with the mild proprietary grief of a caretaker who has been allowed, finally, to clock off. The west door understands the gesture before you do. It unlatches itself a finger's width. Snow light. Bread smell.",
    alpha: "You survive the howl by not answering it, and the thing that happens next takes the System's entire career to file: the Alpha — the pack's mathematics, the month of eaten candidates — lies down in the museum of its own arithmetic, at the sorted bones' feet, and dares you. You do it anyway. You do it, and the pack dissolves into the shaft dark without a grudge being passed around, and whatever lesson the dungeon was running ends with YOU, on the floor, in a room full of the dead, choosing the hardest thing on the board.",
  };
  return [
    { text: (spared ? sp : win)[id] ?? "The floor lets go of its breath." },
    { text: `You are ${f.killsTotal >= 20 ? "counting doors on the way down, and the counting has started to feel like a hobby" : "counting doors on the way down, and you are surprised — in a good way, a private way — that you can still afford to be surprised"}.` },
    ssys("[FLOOR " + id.toUpperCase() + (spared ? " RESOLVED WITHOUT EXCESS. THE LEDGER MARKS IT 'CLEAN.' IT HAS A CATEGORY FOR THAT. IT LIKES THAT CATEGORY. YOU HAVE NOT ASKED WHY.]" : " CLEARED. XP UNAWARDED — SEE POLICY: LEVELS ARE EARNED UNDER THE SUN.]")),
  ];
}

// ---------- regional epilogue threads (payoffs of scenery) ----------
export function pondLine(f: WorldFlags): Line[] {
  return f.killsTotal >= 20
    ? [{ text: "The pond is a mirror of nothing. The forest has learned that you look through water at things under it, and it has stopped offering to." }]
    : [{ text: "The pond at the ruins' east edge is clear to the bottom, and the bottom is concrete — a road surface, painted kerb-line and all, sloping down into green. Whatever this floor is doing to the city, it is doing slowly, and keeping the furniture." }];
}

export function crackLine(_f: WorldFlags): Line[] {
  return [
    { text: "The crack in the citadel's east wall glows from below: not lava-light — chewing-light. A rhythm. In-out, slow as tide, patient as the middle of the night." },
    { text: "You put your ear to the marble like an idiot, and you hear it: the whole beautiful dead building, digesting. Verdant's pond going green, the marsh going deep, the caverns going hot. Not floors. Mouths. Every one that opened over a city block is one of those, and the Association's entire filing system is a napkin at a dinner table." },
    ssys("[QUERY UNRECOGNISED. QUERY UNRECOGNISED. …NOTED, PLAYER. SOME OF US ARE ALSO JUST EMPLOYEES.]"),
  ];
}

// ════════════════════════ THE EXPEDITION CAST ════════════════════════
// New-region NPC trees + regional signs + bestiary voices, then the merged
// lookups the view uses (getNpc / signAll) so old Ashenveil keys stay intact.

const NPC_EX: Record<string, Tree> = {
  "seo.verdant": (c) => {
    const first = !(c.f.met["seo.verdant"] > 0);
    if (c.f.genocideZone) return [{ who: "SEO", text: `"I'll make this quick, because you make things quick now. The Association can't reach this floor's feed anymore — you're on your own ledger, all of you. I'd tell you to come back alive but the paperwork stopped agreeing with me." Her hands find their pockets. "That's all the check-in there is."` }];
    return first ? [
      { who: "SEO", text: `"Player. Right. The tape, the coffee, the clipboard — that's me, that's the job." She flicks a glance at the ruins like she's pricing them. "Field rules: you clear a floor, I file it. You don't clear it, I file you. There's no version where I come down there, so don't ask me to."` },
      { who: "SEO", text: `"One more thing and then you're my problem, not my assignment. The shrine at the north end — whatever's squatting there, it was here before the Gate. The Gate didn't evict it. It just... built a room around it. That's not a dungeon. That's a roommate situation. Keep that distinction in your head and you'll outlive the survey budget."` },
      ssys("[FIELD BRIEFING LOGGED. HANDLER SEO HAS REQUESTED THE RECORD BE ANNOTATED: 'SHE WAS FINE.' THE REQUEST WAS DENIED BY THE RECORD.]"),
    ] : [
      { who: "SEO", text: `Back at the camp already. "Briefing's not a subscription, Player. Read your signs, talk to your surveyors, and whatever the System tells you the objective is — the objective is the people you can see." She writes something on the clipboard and then, pointedly, tears it off and lets the wind have it.` },
    ];
  },
  "seo.marsh": (c) => {
    if (c.f.genocideZone) return [{ who: "SEO", text: `"The marsh boardwalks are clear. I'm standing on one. I'm choosing to believe that's a good sign, for both of us." She has not made eye contact since the caverns. The way she says 'caverns' is the way people say the name of a place a house burned in.` }];
    return [
      { who: "SEO", text: `"You look up a floor. That's the promotion." She hands over a wax-paper parcel without ceremony: actual food, not rations. "The Association sends pemmican. I send dinner. It's the entire difference between us and them and don't make me file it."` },
      { who: "SEO", text: `"The smuggler — she'll price you the drowned stair, the safe reeds, the whole map. I'd buy it. I'd also mention to her that you saw a filing number on the Association crate that matches the survey team's, and that I find this coincidence unprofessional." She blinks. "I didn't say that."` },
    ];
  },
  "seo.caverns": (c) => {
    if (c.f.met["kang.caverns"] > 0) return [
      { who: "SEO", text: `"Sixty degrees down here, and she's wearing the same field jacket as the tundra floor. She's got a thermos and she won't share."` },
      { who: "SEO", text: `"Kang." She says the name like a stone in a shoe, twenty years worn smooth. "He taught my whole cohort. He failed to teach exactly one of us, which — statistically, in my family, that's the better record." She watches the lava like it owes her rent. "Whatever he's making you do down here: it works, and I hate him for the method, and if you tell him I said the first half I'll deny both."` },
      ssys("[HANDLER SEO HAS FILED A FLOOR-BRIEFING FOR THIS LEVEL. THE ATTACHMENT IS A SINGLE LINE: 'HE ASKED ABOUT YOU. SIXTEEN YEARS OF NOT ASKING ABOUT ANYTHING, AND THEN YOU.]" ),
    ];
    return [
      { who: "SEO", text: `"The heat's why the survey teams stopped wearing the insignia in the deep floors. Unwritten rule. Yours too now — the thing at the altar already reads names off helmets." She notices you notice she said 'the thing at the altar' like you've been there.` },
      { who: "SEO", text: `"I've read every report, Player. Six years of them. I know the layout of this floor better than the man chained in the boss hall. I know it the way you know a hospital: from the charts, in a clean room, while it happened." She caps the thermos. "Down there, the charts are the least honest documents. Read the chains instead."` },
    ];
  },
  "seo.citadel": (c) => {
    if (c.f.unregistered) return [
      { who: "SEO", text: `She's sitting on the Warden's dais steps — Handler Seo, Association Grade 4, sitting on a throne's steps in an unlisted citadel with her hands out of her pockets for the first time all campaign, letting the brazier-light have them. Scarred across the knuckles in a pattern that is not, definitively, from cooking.` },
      { who: "SEO", text: `"Candidate twelve," she says, before you can ask, because she has started telling you things before you ask, which is how you know it's the end of a floor. "Said yes, in the seventies, when there were only twelve. Class 'Abyss Courier.' It filed me out of the guild list so completely I became a desk. Forty years of desks. Forty years of being the voice that says 'come back alive' to people who never do, collecting the bodies in the only way they'll let a courier collect: paperwork."` },
      { who: "SEO", text: `"So no. I'm not going to tell you what to answer. I'm telling you that whatever you choose down there, I will still file you, and it will still matter what comes back up." She stands. It is the most dignity the room has seen since the Warden stood down. "That's the whole of it. The job's small and the hands it lends are the only hands you get."` },
      ssys("[HANDLER SEO — PERSONNEL FILE: CLASSIFICATION 'UNSHADOWED'. NOTE FIELD: 'RETIREMENT PAPERWORK APPROVED — VOLUNTARY. FLOOR OF ASSIGNED POST: UNREGISTERED. …SHE RENTED A ROOM. OVER THE BAKERY. IT IS NOT A METAPHOR.]"),
    ];
    return [
      { who: "SEO", text: `"The throne room's acoustics were measured. They're designed to make one voice at a time sound like all of them." She has not sat, not leaned, and both her hands are in her pockets, gripping something.` },
      { who: "SEO", text: `"Whatever it asks of you on that dais — there's a right answer and there's your answer, and the difference is the entire career. I know which one cost me mine. I'm not saying which one. I'm saying I know the shape of the question, and I have never once been allowed to warn anybody of its shape before. So — that's the warning. It's all the warning. Use it."` },
    ];
  },
  "hana.verdant": (c) => {
    if (c.f.savedPair) return [{ who: "HANA", text: `She's back at the survey table with a clipboard so battered it qualifies as an artifact, marking in it while Jino argues with a brazier. "The citadel let us go," she says, not looking up, pleased about it the way weather is pleased. "Turned out we'd just been misfiled. It happens to the best of us — that's not a joke, that's a policy now."` }];
    return [
      { who: "HANA", text: `"Survey lead, first expedition after the Gate swallowed the block. That means: I count the dead and call it data so somebody upstairs can afford to grieve it in a meeting." She squints at your stat sheet like it's a receipt. "E-rank. Solo. Of course. The System's taste in people is exactly as bad as its paperwork."` },
      { who: "HANA", text: `"Rule of the floor, free because I'm a decent woman in terrible shoes: the ruin's east pond goes clear to the bottom, and the bottom is a ROAD. When a dungeon builds itself over a street, it isn't a dungeon. It's a stomach. Digestion takes floors. We have maybe four."` },
      c.f.bossDown["hobgoblin"]
        ? { who: "HANA", text: `"The big red one is gone and nothing collapsed, which means your floor-clearing did what the Association's didn't: it made the whole floor calmer, not quieter. There's a difference and it's the whole job." She actually smiles. It costs the survey budget nothing. Jino's furious about it.` }
        : { who: "HANA", text: `"North shrine's our exit condition — whatever's in there, this block doesn't count as lost until it's answered. Jino's been sharpening things. It makes him feel involved."` },
    ];
  },
  "jino.verdant": (c) => {
    if (c.f.savedPair) return [{ who: "JINO", text: `"WE SURVIVED IT. The empty armour walked us to a door, which was, like — extremely weird, extremely welcome. If any of the squad talks about 'the incident,' mention that the new guy's name is yours now. It makes it sound planned, and planned sounds survivable." He finally puts the sharpened stake down. It takes both hands.` }];
    return [
      { who: "JINO", text: `A kid — twenty-two, "kid" — with a stake he has sharpened four times a day since the Gate opened, because doing it is the only thing he does not cry about at the table. "You're the System guy. The ALARM guy. Does it hurt? Getting chosen? You look like getting chosen hurt."` },
      { who: "JINO", text: `"Our third body — the one we didn't carry out — the helmet stayed. And inside the helmet, taped to the lining, there was a drawing. Little house, sun, crooked chimney. Association took the helmet for 'effects.' We were supposed to leave the helmet, obviously, it's the helmet that did the—" He stops. Resumes, flat: "So when you clear a floor, does it give the things back? That's what I'd pay for the answer to. Not the objective. The ANSWER."` },
      c.f.bossDown["hobgoblin"]
        ? { who: "JINO", text: `He's actually packing. "She laughed. HANA. Over the shrine being empty." He looks up, caught mid-hope. "Does the System ever log anything about whether we go home? It logged you, when you chose me. I want that, for us. Even a wrong log. Even filed wrong. Filed."` }
        : { who: "JINO", text: `"Sharpening's for the shrine. Stupid, I know — stakes. Against a—" he gestures at the whole floor, the pond, the road-under-water, all of it. "We've been doing it every day. If we stop, Hana says it becomes true, so we keep sharpening, and she calls it data." He pushes the whetstone across the log he's sitting on toward you, an offering, an apology for a world where that's what passes for armoury support. "It helps, the sound. Try it. Ten minutes. It's the only free buff the apocalypse ships."` },
    ];
  },
  "roan.verdant": () => {
    return [
      { who: "ROAN", text: `At the east shrine stands — sits, it's sitting, that's the point — something fawn-coloured the size of a deer, in the shape of a deer, with the posture entirely wrong for a deer: too much patience, elbows where elbows aren't. A minor god of the ruins, unemployed since the Gate.` },
      { who: "ROAN", text: `"The red one rakes my moss," it says, as if that were the whole theology, and it is. "He eats the dead and buries the metal. Your Association would call that a haunting and bill it. I call it a neighbour and sweep the steps."` },
      { who: "ROAN", text: `"You may take one prophecy; they're rationed now and I don't like the new supplier. Ask a real question. Most players ask 'will I win.' The ones that live ask 'who is paying for this.'"` },
    ];
  },
  "sila.marsh": (c) => {
    const bought = c.f.met["sila.info"] > 0;
    return [
      { who: "SILA", text: `The stilt-house door opens before the knock. "No names, no Association, no heroics — the three currencies I don't take." A boardwalk smuggler's face: entirely unbothered, entirely awake. "I sell the marsh. Routes, tides, the fact that the stair idol's awake and cranky. Gold buys maps. The other two buy silence about the maps."` },
      { who: "SILA", text: `"The statue's not guarding a treasure, it's guarding a LULLABY. Four hundred years standing watch over a graveyard of drowned surveyors and their little drowned traditions — the cadence call. Sing it right and the sentinel doesn't fight you. It clocks out. That's not mercy, it's shift-work, and I just gave it to you free, so buy the rest of the map or I'll start charging for kindness."` },
      bought
        ? { who: "SILA", text: `"Back for the ladder route. Smart." She slides a wax-sealed scrap over the plank floor like a card trick: the lift shaft, the cult's water-line, the boss hall's chains marked in three colours: BEAST, CHAIN, CULT. "The chains are wrong, hero. I smuggled for men who chained things. That's not how you write a leash."` }
        : { who: "SILA", text: `"Two facts free, because the flood will give them to you eventually and I prefer the version where you like me. One: that statue on the stairs has stood watch over every party your Association lost here — that's the job it was made for, not the one it's doing. Two: whatever you meet at the top of the citadel, the answer to its question isn't 'yes,' it isn't 'no,' and it costs gold to say more than that here."` },
    ];
  },
  "reedwatcher.marsh": (c) => {
    return [
      { who: "CHOIR", text: `The monk is waist-deep in the bog, entirely by choice, entirely calm, wearing the drowned survey team's insignia cut off and re-worn — mourning, or poaching, the two are the same in a marsh. "Toll the bell," they say, in the direction of the stair.` },
      { who: "CHOIR", text: `"We were the second crew. The water took us gently, which is how you know the dungeon wasn't eating us yet — it was just closing its mouth. The statue counts our candles. Every year. Four centuries of one vigil, and your Association sent the first expedition six years ago and filed it under 'weather.'"` },
      c.f.bossDown["sentinel"]
        ? { who: "CHOIR", text: `"The candles guttered out and nobody drowned in the night. That's what a floor feels like when it's RESOLVED." They start wading back toward deep bog. "The idol slept. I want the whole guild to know: it slept, and the water got one inch lower, and the reeds took the sound of it. The next floor's your business. This one's a wake, and you were welcome here."` }
        : { who: "CHOIR", text: `"The statue won't fight you if you know the call. The drowning don't mind the noise of the living — the LACK of it. Sing something useless while you cross. Whatever's stuck in your head from the mornings you train. It's useful precisely because it's useless."` },
    ];
  },
  "kang.caverns": (c) => {
    const taught = c.f.kangBond;
    return [
      { who: "KANG", text: `He's leaning on a stalagmite in the dark of the stal rooms like a doorframe that has opinions. Sixty-one years old, E-rank forever, the only Association retirement nobody filed because nobody can find the form. "You got the alarm. I got the alarm. Fifty-one years ago, in Seoul, before your block had a name."` },
      { who: "KANG", text: `"It said the words: qualifications, daily quest, punishment. It said you would get stronger. That's TRUE — that's the ugly part. Everyone it ever chose got stronger. Not everyone got to KEEP it. Watch me: E-rank, on purpose, on principle, for five decades, because the floor I cleared at twenty-four is a floor I refuse to be owed."` },
      taught
        ? { who: "KANG", text: `He nods at the shafts, at the whole hot dark. "Lesson one: breath before the bar. Lesson two: your monster has a name somewhere in its paperwork, and a history where it wasn't a monster, and finding it in a fight isn't pacifism — it's RECONNAISSANCE. Lesson three:" a grunt of a smile. "The kid in the citadel with the borrowed armour. You'll know her by the way she stands like she's being graded. Remind her the exam's fake. I couldn't. I was the examiner."` }
        : { who: "KANG", text: `"Training. Now. Because the boar's chains taught me more about the Association's 'containment' than my whole pension did, and you have forty floors of my mistakes to skip." He drops a whetstone in your palm, closes your fingers around it, and points at the lava hall like an appointment calendar. "Sharpen something. Say its name out loud. Then tell me what the WARDEN on the top floor is guarding. If you get it wrong I'll be here, because I'm always here, apparently. Sixty-one years of here."` },
      taught ? { who: "SYSTEM", text: "[INSTRUCTOR: KANG IL-DO. FLAGGED: HIS FILE EXISTS IN MY ARCHIVE. FLAGGED: I DID NOT ARCHIVE IT. FLAGGED: I AM NOT GOING TO EXPLAIN THAT SENTENCE TO YOU TODAY.]" } : { who: "SYSTEM", text: "[INSTRUCTOR: KANG IL-DO. NOTE: THIS NAME APPEARS IN MY ARCHIVE WITH NO CLASS FIELD. I HAVE NEVER SEEN A CANDIDATE FILE WITHOUT ONE. DO NOT ASK ME WHAT I DID WITH THE ARCHIVE. I FILED IT. LIKE EVERYTHING. ALONE.]" },
    ];
  },
  "verity.caverns": (c) => {
    const heard = c.f.met["verity.caverns"] >= 1;
    return [
      { who: "VERITY", text: `The cult of the lava hall is four ex-hunters, one altar of melted survey equipment, and a priestess with burn-scarred forearms folded like she's praying through her hands. "You've come to kill our landlord," she says, warmly. "Take a candle. You'll be down here a while — it's a LONG digestion."` },
      { who: "VERITY", text: `"Everyone reads the story wrong. The dungeon isn't a predator. It's a MONARCH, sick — swallowing a city block the way a fever shivers, and every floor is it trying to make a room of itself it can rest in. Our beast in the boss hall isn't a captive. He's a nurse. The chains are HIS, forged by the cult that was here before ours, and he lets you see them because he wants somebody to choose between cutting them and apologising."` },
      heard
        ? { who: "VERITY", text: `"You listened. Twice, even, which is twice more than the Association's paperwork does." She holds out a ring of keys — old, heat-blued, useless for anything except the one lock she points to on the far wall of the hall. "Cut him loose and tell him we kept the faith we could carry. Or leave him and we'll keep the faith either way. This is what mercy looks like when the patient is a floor: mostly it looks like an appointment."` }
        : { who: "VERITY", text: `"Here is the whole religion, free, because the sick deserve straight talk: the top floor keeps a door that leads to a place the System can't file. The unregistered floor. Every candidate it ever chose hears about it eventually. The forty-one before you heard about it when it was too late to choose it for themselves. Do it out of order, hero. It's not rebellion. It's bedpans."` },
    ];
  },
  "ember.caverns": (c) => {
    return [
      { who: "EMBER", text: `The cinder bat in the stal room is not a monster. It is a pocket-sized monster, which is different — the same wingspan-to-attitude ratio, filed wrong. It has decided you are its radiator. It is currently asleep inside your hood, which the System declines to comment on, loudly.` },
      c.f.emberBond
        ? { who: "SYSTEM", text: "[COMPANION REGISTERED: EMBER. NO BONUSES GRANTED. YOU WILL NOTICE THE ALARM AT 5 AM GOES QUIETER. THAT IS NOT A BUG. THAT IS THE ENTRY.]" }
        : { text: `It wakes, looks at you with the entire judgment capacity of a burnt match, and offers one of the survey team's glow-cap mushrooms, hoarded. It is feeding you, as equals do, or as people do when they've been waiting in a warm cave for a hand that isn't coming for the next sixty years.` },
      c.f.emberBond
        ? { who: "KANG", text: `(From across the hall: "A bat that chooses a person. In fifty-one years I have seen that happen exactly twice. The first one was wrong about the person. Be the second one right.")` }
        : { who: "KANG", text: `(From across the hall, without looking: "Take the mushroom. It's currency down here and it's not a trick — it's been watching you three days and it has had nine chances to bite, which is nine more chances than the dungeon's been given to eat its own tenants. Don't encourage it. Encourage it.")` },
    ];
  },
  "herald.citadel": (c) => {
    return [
      { who: "THE HERALD", text: `It stands on the red carpet where an announcement would go: a neck with a collar on it, a clipboard the size of a cathedral door, and a voice that is the room's own reverb given a budget. "CANDIDATE. FORTY-SECOND IN CURRENT SERIES. THE WARDEN WILL SEE YOU IN THE THRONE, THE WARDEN WILL SEE YOU—" a page turn, "—WHEN YOU HAVE STOPPED BEING INTRODUCED. ANNOUNCE YOURSELF. NAME THE FLOOR THAT MADE YOU."` },
      { text: `The ritual is one sentence long, and then it steps aside with the terrible politeness of a thing whose entire job is the doorway. "Floor: the one I trained on. Alarm: five. The rest of me is receipts." It folds its clipboard into the wall like it never had one. "The Warden has been alone up there for sixty-one years. It will offer you the fight its whole schedule allows for. Be kind about the timing bar. It practices."` },
      c.f.kangBond
        ? { who: "THE HERALD", text: `"ADDENDUM: one KANG IL-DO, E-RANK, UNDEFEATED BY THIS ROOM, filed an objection to this office fifty-one years ago. The objection is still pending. He is welcome to add a second to the pile. It is the only pile in this building that grows kinder."` }
        : { text: `It is a clipboard, and the wall, and the doorway, and nothing about it is lying, except the part where it makes all of that sound like it's on your side. It isn't. It is on the SIDE of procedure, which is the only side a thing like this can afford.` },
    ];
  },
  "ivy.citadel": (c) => {
    const saved = c.f.savedPair || c.f.bossDown["warden"];
    return [
      { who: "IVY", text: `She's camped between two braziers in the south hall with borrowed armour arranged around her like a sentry rotation — the hollow knights, she notices you noticing, keep their distance and their distance is respectful. "Forty-one of us got the summons before you," she says, before you ask, because she's been rehearsing. "I'm the forty-second that came from INSIDE. Association didn't file me. I'm the floor's own."` },
      { who: "IVY", text: `"The armor on the empty ones — check the linings. Names. Drawings. The dungeon didn't eat them, it MISFILED them; the Wardens say it's been trying to get its paperwork right since before your Association could spell 'Guild.' Every hollow knight down here is a filing error that learned to walk. You don't fix that with a timing bar, in case that's your plan, because it probably is."` },
      saved
        ? { who: "IVY", text: `She's standing in the middle of the hall when you come back down, and she's laughing the half-second private laugh, the way someone laughs when a thing they bet their life on comes up correct. "They're WAKING. One of them just asked me what year it was and I said the right one and she cried like it was a joke." She jerks a thumb north, at the throne's silence. "Your answer up there? Whatever it was? That's what did it. Not the sword. The ANSWER."` }
        : { who: "IVY", text: `"I don't want the class," she says, too fast, the way you say the thing you've been holding for forty-one floors of other people getting chosen. "I want it to NOTICE it's using us. There's a difference and the whole citadel's built so nobody can tell it." She hands over one of the empty helms — the lining taped, a crooked chimney drawn inside, three generations of pencil. "Take that to the Warden. Say a name to the thing that files people. It'll come to the table. It always comes to the table."` },
    ];
  },
};

// ---------- regional sign text ----------
const SIGN_EX: Record<string, (f: WorldFlags) => Line[]> = {
  "sign.v.gate": (f) => [f.introDone
    ? { text: "POLICE TAPE, FRESH, AND ONE FLAG: ASSOCIATION SURVEY. Someone wrote, under the official text, in pen: 'it built a room around the shrine. bring the neighbours gifts.'" }
    : { text: "BLOCK 9 — STRUCTURAL LOSS. NO CASUALTIES FILED. (TAPED UNDER THE TAPE, IN A CHILD'S HANDWRITING: 'the sun moved. we kept the alarm on.')" }],
  "sign.v.pond": (f) => pondLine(f),
  "sign.v.shrine": () => [{ text: "The north shrine: moss raked into a neat pile, steps swept, and a bowl by the door. Someone has been keeping the tenancy. The System marks the bowl: FOOD. LEFT BY RESIDENT." }],
  "sign.v.road": () => [{ text: "Asphalt, cracked, and green. The road remembers where it goes even though the whole block forgot it exists. Directions are carved in the kerb, in the style of a very old survey: VERDANT — MARSH — CAVERNS — CITADEL, and beneath, freshly chipped: 'the snow, if it's still there.'" }],
  "sign.v.camp": () => [{ text: "Survey camp: four cots, one table, a whetstone worn to a comma. The log's last entry: 'Day 41. No contact with the surface. The pond is lower today. We are counting this as hope. — H.'" }],
  "sign.m.arrive": () => [{ text: "A drowned signpost on the boardwalk head, its arms sawn off except one, pointing down. Under the water line, still legible because marshes are archivists: TO THE VILLAGE — 100 YEARS — 'we stayed'." }],
  "sign.m.village": () => [{ text: "STILT MARKET. NO ASSOCIATION. NO NAMES. Cash, candour, or cadence — the last one buys more than you'd think. (Written under, in a second hand: 'the statue counts candles. bring singing.')" }],
  "sign.m.posters": (f) => f.savedPair
    ? [{ text: "The missing-poster board holds one sheet: the survey team, four faces, and a child's crayon house taped over the helmet lining of the fourth. Under it, fresh marker: 'FOUND. MISFILED. WALKED HOME. SEE H. — the dungeon apologises in its own time, in its own handwriting, and the handwriting IS the apology.'" }]
    : [{ text: "Missing: survey crew of four. Last seen entering the stair. Association status: pending. The villagers have their own filing system — a reed tied to each name. Three of the four reeds have gone soft in the rain. The fourth was tied the day the Gate opened, and the family keeps it dry." }],
  "sign.m.stairs": () => [{ text: "The rune light climbs the stair in the rhythm of a tide chart, painted here, by hand, by the last person to map it: ONE IN — ONE OUT — WATCH THE IDOL. IT BLINKS ON THE HALF HOUR. (It does not blink. It counts. Same thing to a thing that was carved to keep vigil.)" }],
  "sign.c.rails": () => [{ text: "Mine rails, Association issue, six years old. The manifest box, prised open: 'EXTRACTOR, LIME, CANDLES, MUSIC.' The last entry is underlined. The cults took the candles. The beast kept the music." }],
  "sign.c.lava": (f) => [{ text: f.killsTotal >= 20
    ? "The lava hall's glow has a new colour in it. Everyone knows a floor is angry. Nobody tells you it only glows like that when it's sad, and nobody's left standing to be told."
    : "The great pool turns slow as thought. A surveyor's last sketch is nailed to the basalt, ink gone to iron gall: 'the lake is a tongue.' Below it, in a second hand, shakier: 'not a trap. A MOUTH. the whole floor is a body trying to lie down.'" }],
  "sign.c.tusk": () => [{ text: "BOSS HALL. Do not engage as filed: 'beast, contained.' The old crew scratched the word 'contained' through until the stone under it is smooth. Someone else has since written, small, respectful: 'the chains are his. ask him.'" }],
  "sign.c.cult": () => [{ text: "The altar is melted survey equipment, which is either desecration or the most sincere monument available: compasses, clasps, and four Association insignia, pooled into one shape that no longer issues orders." }],
  "sign.t.enter": () => [{ text: "The carpet's only sign is a bronze plate at the stairfoot: 'THIS FLOOR IS NOT AN EXHIBIT.' Under it, forty-one years of tiny scratched tally-marks, and beside the forty-second, a different cut — fresher, deeper, done by a hand that was not counting days but making a promise." }],
  "sign.t.crack": (f) => crackLine(f),
  "sign.t.throne": () => [{ text: "No sign at the dais. The Warden filed one, once: it reads as a dent in the marble, which is the closest this architecture comes to a sentence: 'the monarch is a chair with a job. sit and take the whole floor's weight, or don't and leave with only your own. both answers are floors.'" }],
  "sign.t.door": (f) => f.unregistered
    ? [{ text: "The west door, where yesterday was wall. The marble still has the ghost of its own grout lines, and pinned into them — Association tape, and under the tape, a key tag for a building that doesn't exist: BLOCK 9. RESIDENT: WHOEVER GETS HERE." }]
    : [{ text: "West wall, marble, unremarkable, and cold. The floor's acoustics, when you press an ear to it, are wrong: it echoes like a corridor that continues, and corridors that continue inside walls are what this whole campaign has been about." }],
};

export function getNpc(key: string, c: ScriptCtx): Line[] | null {
  const a = NPC[key];
  if (a) return a(c);
  const b = NPC_EX[key];
  return b ? b(c) : null;
}

export function signAll(key: string, f: WorldFlags): Line[] {
  const ex = SIGN_EX[key];
  if (ex) return ex(f);
  return sign(key, f);
}

// ---------- bestiary voices for the four new floors (mobs) ----------
const EX_LINES: Record<string, { intro: Line[]; idle: string[]; low: string[]; acts: Record<string, string[]>; spareReady: string[]; spared: string[]; death: string[] }> = {
  crawler: {
    intro: [{ who: "MOSS CRAWLER", text: "A velvet caterpillar with a leaf mane rises from the survey line and considers your boots the way a librarian considers noise." }],
    idle: ["*The Crawler rears, showing the pale soft belly it has never once needed to use on anyone.", "*Moss sheds off it in a small green weather event."],
    low: ["*It curls into a ring — a wheel of moss, defensive as a closing book.", "*The leaf mane flattens. It is thinking about its garden, and the size of it."],
    acts: {
      Check: ["MOSS CRAWLER — ATK 6 DEF 9. It eats deadwood and grief, mostly in that order. The Association's file calls it 'vermin.' The file is wrong and the garden knows it."],
      Coil: ["You sit down in front of it. The Crawler stops rearing. Both of you are now just two creatures not attacking. This is, it turns out, a negotiation.", "It uncoils one segment. It is checking whether you flinched. You don't. Something in the leaf mane unclenches like a fist made of fern."],
      Sun: ["You tilt it toward the skylight-holes in the ruin roof. It goes rigid — not alarm, RITUAL. The fight becomes, briefly, a photo of a good day.", "A patch of broken roof lights the corridor. You guide the light toward it, the way you'd carry a bowl to a stray."],
      Sing: ["You hum the cadence of a 5 AM that has never once been skipped. The Crawler's segments keep time. It knows this song's genre: 'the stubborn.'", "You sing, badly. The Crawler conducts. The fight is now a duet, which is not in the bestiary and not in your control."],
    },
    spareReady: ["*The Crawler has stopped being a wall and started being a neighbour. Its window is open like a gate that was always a gate.", "*It waits, velvet and leafy, to see if you mean it."],
    spared: ["You step over the Crawler the way you'd step over a garden hose, and the whole wall of moss exhales.", "You back out of the corridor with your hands up, apologising to a caterpillar, and it lets you go like that was the plan."],
    death: ["The moss settles over its own ending like it's been tending soil long enough to know what it's for. You step around it, and the garden does not forget the stepping."],
  },
  rhound: {
    intro: [{ who: "RUINED HOUND", text: "It assembles itself out of the rubble pile beside the road — gravel, a jaw, a tail, and the particular offence of a dog that was a good dog somewhere upstream." }],
    idle: ["*The Hound circles with rubble clacking off its ribs like bad wind-chimes.", "*It stops circling to sit. It has been trained, poorly, some of the way through."],
    low: ["*Half its muzzle is loose. It keeps trying to smile with it and losing a tooth of stone.", "*The tail, still attached, wags at the wrong time."],
    acts: {
      Check: ["RUINED HOUND — a survey dog, kenneled by the Gate, kept by the floor. Obeys 'heel' and something older. Its file has never seen it check the ground for a whistle.", "RUINED HOUND — ATK 8 DEF 6. It hunts to fill a schedule, not a stomach. Feed it a different schedule and see what the schedule does."],
      Call: ["You say its name — the one on the Association tag on the collar of the pile. The pile stops. It has not been addressed since the floor was a block.", "Calling it out here is stupid, and it comes when called anyway. Every dog is a filing error that learned to love the paperwork."],
      Heel: ["You snap it into a heel. It falls in at your left like it's on a walk. The walk is currently a combat log and it is not the only one being deceived.", "Heel. It sits. It will sit for anything if the voice is a person, which is the one thing the Association never budgeted for."],
      Throw: ["You throw a piece of the ruin itself. It brings it back. You throw it again. This is the whole economy here and someone forgot to write it down."],
    },
    spareReady: ["The Hound is at heel by choice now, rubble stacked at its feet, eyes on you, waiting for the human half of the command.", "*Its spare-window is the tail: going, uncertain, hopeful."],
    spared: ["You end the fight by praising it, which is the only command nobody gave it authority to disobey.", "You sit down on the survey line and the whole pile of rubble comes to you, and sits, and is a good dog in a place where being a good dog has a file number."],
    death: ["The Hound comes apart like a wall coming down — no drama, just things that were held together letting go. The tail gives one thump on the ground, checked twice for permission."],
  },
  stalker: {
    intro: [{ who: "THORN STALKER", text: "The brambles in the east garden stand up. They were brambles. They stand up, and they have your height, adjusted for manners." }],
    idle: ["*It sways the way brambles sway, which is the problem: you can't tell whether the wind is lying anymore.", "*A thorn drops from it, politely, to check if you'll pick it up."],
    low: ["*It drops a limb, thins itself, keeps standing, which is the thorn's most human trick.", "*Sap runs down the wound like it's late for something."],
    acts: {
      Check: ["THORN STALKER — ATK 9 DEF 7. It grows toward anyone the floor is afraid of. Right now, by its posture, that's you, and it is confused about whose side it is on.", "THORN STALKER — the garden's immune system, filed as monster. Killing it does nothing to the infection; the floor keeps its own health records."],
      Freeze: ["You go still. It goes still. Two things in a garden deciding what a plant IS. You win the philosophy round and it visibly hates the tie.", "Stillness is the one act its entire body is built to respect. Hold it long enough and the fight becomes compost."],
      Taunt: ["You taunt. It reaches, and misses, and reaches again like a rose trying to strangle a season.", "You rattle the fence at it and it flinches like a person caught at a window."],
      "Sit Down": ["You sit down in the middle of the garden. It comes over, thorn-first, and stops at the exact distance a plant would keep from a sitting human.", "You sit. It sits. In the garden, sitting is a peace with no lawyers."],
    },
    spareReady: ["It has grown itself flat to the trellis, showing its whole unarmed underside — the way a plant surrenders by becoming furniture.", "The stalker bends to your shoulder height and stops being taller than you in every tense."],
    spared: ["You walk the garden path out of the fight, and the garden closes behind you like it's decided you-not-here is its favourite arrangement.", "It takes you to the east gate as a thorn does — opening, not escorting, which is the politest thing anything has done for you all floor."],
    death: ["The bramble folds down into its old shape, a hedge again, with one gap where a stalker was. The garden keeps growing over the gap at its own pace, which is the pace of the floor deciding what to remember."],
  },
  lurker: {
    intro: [{ who: "BOG LURKER", text: "The mud in front of you has an opinion, and the opinion surfaces with eyes set wide like a thing that has learned the sky by heart." }],
    idle: ["*The Lurker sinks a little, so your eye calls it ground, and then it doesn't.", "*Bubbles. The bog is laughing at the fight, which is the only local language."],
    low: ["*One eye slips out of alignment and it fixes it back with a hand like a slow apology.", "*Its mud goes thin and grey, which on a Lurker is a bruise."],
    acts: {
      Check: ["BOG LURKER — ATK 7 DEF 10. The marsh's janitor: it eats the drowned, gently, with ceremony. The Association file calls this 'feeding.' The reed monks call it a funeral.", "BOG LURKER — nobody has ever killed one and gotten a clean report. It holds the drowned, and the drowned hold names, and names hold grudges at you specifically."],
      Surface: ["You stand your ground and the Lurker rises to meet you, a slow hello with a mouth somewhere in it. It is not your mouth that is the problem.", "Surfacing, it is two metres of mud with a face on the inside of it. You keep looking at the face. The face notices and stops being an accident."],
      "Blow Bubbles": ["You blow bubbles across the water. It answers with bubbles. The exchange rate for this is zero and the whole floor is enriched.", "You blow a line of bubbles toward the drowning stair and the Lurker follows the line, stops at the bottom step, looks at the stairs, looks at you, like you just spoke its address."],
      Clap: ["You clap once, hard. The marsh goes flat as a held breath — every reed listening. You have introduced yourself as a thing that makes weather. It files you under 'loud, harmless, keep an eye on.'"],
    },
    spareReady: ["The Lurker has laid itself flat as a crossing, a plank of mud offered at the right bank. The boardwalk, it is saying. We fixed it. You may go.", "*Spare-window: the mud is warm where the drowned were held. This is not a trick, and the mud is bad at tricks."],
    spared: ["You thank the bog for its dead, out loud, and the whole south edge goes bubble-flat, which in the marsh is the sound of being heard.", "The Lurker lets you cross on it, one step at a time, and it is the only floor so far that has apologised with its own body."],
    death: ["The Lurker lets go of its shape all at once, and the marsh keeps what it was carrying: the drowned stay held, now by mud with no manners in it at all. You have made the funerals worse. The System logs the kill; the System does not log the rest."],
  },
  dsentry: {
    intro: [{ who: "DROWNED SENTRY", text: "A drowned Association sentry stands at attention in four feet of black water, and the salute it gives you is exactly regulation, and it has been dead long enough that the regulation is all that's left." }],
    idle: ["*Water runs off it in the pattern of someone who keeps checking the dress code.", "*Its rifle-arm raises on a schedule that ended six years ago."],
    low: ["*A seam splits along its ribs — no blood, just marsh. It repairs the seam by standing straighter.", "*Its head tilts with the floaty delay of a buoy. The eyes stay on the perimeter."],
    acts: {
      Check: ["DROWNED SENTRY — the post died and the sentries did not get the memo, which is a joke only the dead can find the timing on. ATK 11 DEF 8.", "DROWNED SENTRY — it is guarding the survey stair for the people who went DOWN it, which it did not know was the wrong direction. It has all the time in the world to find out."],
      "At Ease": ["'At ease,' you say, in a voice borrowed from every bad officer you ever briefed with. Its shoulders come down two inches and the whole stair exhales.", "The command lands. Dead or not, that word is a door inside it. It stands at ease in the water and waits, for six seconds or six years, for the rest of the order. Give it one that ends well."],
      Salute: ["You salute it. It salutes back, sharper than living men manage, and the exchange is a fact neither of your organisations will ever be able to file.", "You salute and it misses a beat, and that miss is the most human sound in the marsh."],
      Countermand: ["You countermand its standing order: the stair is relieved. It tries, with its whole drowned body, to understand a new thing, which is the definition of a soldier in peace.", "You revoke the post. It looks at the empty stair, and the empty stair looks back, and you have just performed the only mercy that fits in a pocket: a relieved guard."],
    },
    spareReady: ["Its rifle-arm is down. It is standing the way people stand when they have been told they can stop, which is a shape the dead are supposed to have forgotten.", "*Spare-window: it is waiting on you for the order to stop fighting. Give the order."],
    spared: ["'Dismissed.' The word crosses the water like weather with manners, and the drowned sentry comes to attention one final time and sits down IN it, and stays, and the marsh lets it.", "You relieve the post and it folds the order into its lining, where the drawing is, and the stair is unguarded, which turns out to be the same thing as free."],
    death: ["The Drowned Sentry does not fall; it stops being a shape mid-attention, and the water takes back what the Association had borrowed. The stair it held is, now, only stairs. You have won and the victory is not worth the number."],
  },
  reed: {
    intro: [{ who: "REED STALKER", text: "The reed bed in front of you decides to be a person. It keeps a stolen lantern, lit, at its chest like a heart it is still learning the use of." }],
    idle: ["*It sways with the wind and against the wind, and the disagreement is the whole fight.", "*A reed bends from its head and re-stands, correcting a hat."],
    low: ["*It thins, the lantern swinging loose in its ribs like an alarm nobody set.", "*Half of it goes flat to the water, pretending the other half is a full person. It is not a great liar."],
    acts: {
      Check: ["REED STALKER — a windbreak woven by the monk crews, animated by whatever the marsh hoards of grief. ATK 6 DEF 4, and the lantern is Association issue, six years old, issued to the crew that never checked out.", "REED STALKER — its heart is a light someone else carried. Ask the light."],
      Sway: ["You sway with it. The fight becomes a tide chart with two hands. It has no moves that aren't rhythm, so you have no reason not to learn them.", "You match its sway until neither of you is dancing at the other. The reed bed is a place where two things can stand."],
      Braid: ["You grab a handful of its arm and braid it, the way the monks braid the toll-reeds. It goes rigid — not alarm. Attention. No one has groomed it. Ever.", "The braid holds. Something in the whole east bed turns to watch the two of you, and the watching is friendly, which is new for the east."],
      Weave: ["You weave a strand of it back into itself. It looks down at the repair like it has been told about knots. Marsh math: you have given the wound a pattern.", "You weave as it strikes, and the striking becomes weaving, and the lantern at its chest lifts up, aimed at the stair, and stays aimed there. It has remembered what its light is for."],
    },
    spareReady: ["The reed stands braided, lantern steady, and every one of its kin at the shoreline is doing the same thing: lights up, aimed at the stair. It is offering to guide you. The offer includes itself.", "*The fight has become a procession. You are allowed to join it instead of ending it."],
    spared: ["You follow the reed light to the monk's toll-line and back, and it walks you out past the safe reeds like a lantern on a string.", "The whole east bed lights at once at the stair's foot, where the drowned come up to be counted. The reeds take your lantern from your hands and put it in the line. You have been enrolled without paperwork, which is how the good registries work."],
    death: ["The lantern falls into the water, and the marsh puts it out, and somewhere a monk tolls one soft bell that the System does not record. The reed bed closes where the stalk was like a fist unlearning a word."],
  },
  bat: {
    intro: [{ who: "CINDER BAT", text: "A palm-sized bat made of ember and audacity drops out of the stal room ceiling and lands on your shoulder like it has been waiting for that exact coat." }],
    idle: ["*It hangs upside-down from a rock spur, radiating, filing your face under 'radiator-adjacent.'", "*Small wings, big business. It screams at a pebble."],
    low: ["*Its ember dims to the end of a struck match and it tries, bravely, to look large.", "*One wing droops and it keeps the other one up, which is the whole of courage at that scale."],
    acts: {
      Check: ["CINDER BAT — the caverns' only unpaid courier. It carries glow-cap spores to the dark farms. Threat classification by the Association: 'bat.' By every farmer bat: 'the mail.'", "CINDER BAT — ATK 3 DEF 2, morale 40. Killing it would be a paperwork event with a smell."],
      Pet: ["You let it have your hood. The fight is now a commute and the commute is content.", "You scratch between burnt ears and its whole body turns into an accordion of consent. The System suggests you are being compromised. You are. By affection. In a lava dungeon. Good."],
      Feed: ["You hold out a ration crumb. It holds out a glow-cap. You trade. Both economies improve.", "The bat caches half of what you give it, immediately, for a winter that cannot happen down here. You watch it plan for a season that has never visited, and something in your chest files a complaint about the floor."],
      Warm: ["You cup it against the brazier-light with your hands, like warming a pigeon on a bus. It allows the bus.", "You build it a tiny windbreak out of rubble. It supervises, critically, and moves your last stone one claw-width. The lesson: even the small things here want the dark built right."],
    },
    spareReady: ["*It is asleep in your hood. It has registered the whole combat log as 'loud roommate' and the board does not count sleeping tenants.", "Spare window: open, obviously, permanently, catastrophically. You could win this fight by letting it. It would consider letting it a draw."],
    spared: ["You end the encounter by sitting down near a brazier with a small heated thief in your collar, and the caverns note that you are now, technically, part of the dark farm.", "You give it a name out loud — EMBER, since the cave already calls it that — and the System, which tracks everything, does not log the transaction, because it was not the one who made it."],
    death: ["The bat falls with the particular silence of a thing that weighed nothing even when it was lit. Along the whole corridor wall the glow-caps go dim one by one, like a block realising the mail stopped. (It is also the last courier between nine blind farms and the only hand that ever fed them. You will meet this cost again, wearing a bigger number, in a report you are not allowed to read.)"],
  },
  golem: {
    intro: [{ who: "SLAG GOLEM", text: "The furnace door of the old mine lifts itself off its hinges and assembles, in two steps, into something with arms. It has your height and a shift's patience." }],
    idle: ["*It stamps once, flattening a rail-tie, and resumes its route. It is doing the job while also fighting you, out of professionalism.", "*Scoria cracks off a shoulder and the wound glows to reseal it, on the clock, no hurry."],
    low: ["*Its left side has stopped being slag and started being glass. It keeps the arm. The floor is on a schedule.", "*The furnace in its chest drops to banked. It is running out of fuel mid-shift, like everyone you have ever admired."],
    acts: {
      Check: ["SLAG GOLEM — the mine's last crew, fused with their furnace by the floor's digestion. It is still employed. The Association would like the distinction made clear in any report: it is a WORKER.", "SLAG GOLEM — ATK 12 DEF 14. It cannot be outlasted. It can be clocked out."],
      Outmaneuver: ["You work the pillar behind it. It turns, whole body, furnace roaring at the effort of following. The fight becomes a rotation nobody wins and both parties begin to respect the physics.", "You dance its own schedule against it: left at the gate, right at the skip. It tries to file you as 'obstacle, reroute.' The floor's own filing cabinet, which is its chest, goes quiet, thinking."],
      Polish: ["You rub the scorch marks out of a forearm plate, the way you'd clean a headstone. The Golem stops mid-swing. You have polished the wound. It is holding the fight open around your hand like a door.", "The shine it cannot ignore; it looks at its own arm with a crew's pride. The next swing it takes at the air is an accident of joy."],
      Challenge: ["You square up and challenge it to a fair one, which for a furnace is a joke, and it accepts anyway, because the joke is its name.", "You roar at the furnace and it roars back, and the exchange ends as all labor disputes end here: with someone, briefly, agreeing to be heard."],
    },
    spareReady: ["*Its furnace is banked low, its shift done by a standard nobody can name. It stands at the gate, open. It is asking to be put out of its schedule.", "Spare window: it is holding its own hammer out, head-first, in both hands, waiting to be thanked instead of paid."],
    spared: ["You take the hammer's head from its hands and set it on the rail, and you say 'shift's over,' and the furnace goes down to a pilot light, and the mine is one worker lighter and one haunt kinder.", "It walks you to the lift shaft and loads your gear like freight, and at the gate it tips the whole frame — the slag bow of a crew seeing out the only person who ever clocked them out on time."],
    death: ["The Golem comes apart like a furnace pulled at the seams, the mine's lights gutter down the whole gallery, and the survey crew's tools, laid out on their last bench, go cold all at once. The System logs the clearance. The shaft logs nothing; the shaft keeps its own minutes."],
  },
  revenant: {
    intro: [{ who: "ASH REVENANT", text: "The ash in the corridor stands up in the shape of the last crew, which is not haunting — this floor has no imagination yet, it is still using the forms it swallowed." }],
    idle: ["*It mouths the cadence call through a face of drift, keeping the roll of a crew six years dead.", "*Its lantern burns ash instead of oil, which is how you know it is working the shift. Again."],
    low: ["*It scatters to a hand's width of grey and re-packs itself, tighter, the way grief does when watched.", "*The ash-crew's faces thin to the ones the others remembered best."],
    acts: {
      Check: ["ASH REVENANT — not the dead. The DEAD'S JOB, still running. It cannot be fought; the shift has to be ended.", "ASH REVENANT — ATK 10 DEF 5. It is looking for the fourth hand on the crew. You are one short of eligible and one over being safe."],
      Listen: ["You stop to the cadence and answer the roll on the name you'd answer on if it were your crew. The revenant stops mid-call. You have just been, briefly, the missing fourth.", "Listening is in its schedule. It tells you the whole survey in ash-signs and cadence: the pond went low, the stair went cold, the lift kept running with no crew on it. The sixth year was the floor finishing the first two sentences of a sentence it is still saying."],
      "Kang's Name": ["You say KANG out loud. The revenant goes still, and when it moves again, its posture is a man who has decided to wait for a friend at a bar for forty years.", "Kang's name in its mouth of ash changes the cadence to something with a punchline in it. It laughs the way a furnace laughs: on the inside, with the whole structure."],
      Pity: ["You tell the ash it can rest. It cannot, and it knows you know, and the politeness of both sentences is the most tender thing in the caverns.", "Pity makes it straighter, not weaker. It files the kindness where it keeps the crew's pay: in the place nothing here can spend or burn."],
    },
    spareReady: ["*The roll call has your voice in it now. The revenant stands down from the shift, and its lantern is offered: crew-issue, unreturned, yours if you'll carry the fourth name.", "Spare window: the whole corridor is listening to see if you'll take the job instead of the kill."],
    spared: ["You take the lantern and the fourth name, and you walk the shift with it to the boss hall door, and the revenant clocks out into the warm dark with the sound of a crew going home early because the weather's bad.", "The ash settles back into a corridor. On the wall, in the sweep of the lantern, one cadence-mark remains, and the mark is: THANK THE NEXT ONE."],
    death: ["The revenant comes apart into the drift and the drift keeps its shape for a long moment, watching the ceiling fall, before it lets go. The lantern goes out in the middle of the roll call, and the corridor's schedule is, finally, off."],
  },
  gsent: {
    intro: [{ who: "GATE SENTINEL", text: "The marble guardian at the hall column lights its eyes to your rank: unranked, in a hall of ranked dead, which is the only good seat in the room." }],
    idle: ["*It tracks you the way a camera tracks a trespasser, minus the part where cameras can look away.", "*One stone gauntlet closes, slowly, for the exercise."],
    low: ["*A crack opens down its breastplate with a sound like the hall clearing its throat.", "*It keeps facing you after losing an arm. The arm is the problem, not the posture."],
    acts: {
      Check: ["GATE SENTINEL — Association design, Association failure. The citadel uses them as furniture with a curfew. ATK 12 DEF 16.", "GATE SENTINEL — its standing order is 'deny.' It has been denied the right to a shift's end since before your Association existed. There is only one password that matters and you are holding it wrong."],
      Salute: ["You salute the guard. It returns it by the book, and the book is its whole personality, and for the length of one exchange the fight is a ceremony.", "You salute, and it misses the drill so badly, and tries again. It has been alone long enough to have learned its own forms. Teach it the human one."],
      Report: ["You give it the floor report: hobgoblin settled, stair idol clocked out, your numbers, your training, your alarm. It listens like a guard listens to the relief arriving.", "'Report,' you say, and it stands easier, because the report is the only thing it is allowed to accept. Give it a good one."],
      Dismiss: ["You dismiss the post. It resists — a guard is its guard — and then the hall's light moves off it like a cloud, and it stands down with the exact dignity of a monument being allowed to become a chair."],
    },
    spareReady: ["Its halberd-arm offers the blade butt-first: the guard's way of asking to be relieved of the duty rather than the body.", "*Spare window: it is asking you, in stone, to end the shift. The question is whether you'll be the one who says the order, or just the one who breaks the guard."],
    spared: ["You stand it down and it folds, slowly, into the base of a column, and the hall keeps a little less of its cold, because one of its guards is finally furniture in the good sense.", "'At ease, forever,' you tell it, and it takes the order so hard that moss grows in the seams of where it sat down. The citadel learns, from your mouth, a new thing to file."],
    death: ["The Gate Sentinel comes down in slabs, and the hall files each one as 'infrastructure,' and the braziers dim one row at a time like a corridor remembering a guard who never got a name but stood the same post for sixty-one years as you are going to walk it in ten."],
  },
  hknife: {
    intro: [{ who: "HOLLOW KNIGHT", text: "Empty armour walks out of the column shadows with a broken sword and no reason for either, and the visor slit holds a light that is not fire and does not answer to 'monster.'" }],
    idle: ["*It shifts its weight to the guard foot, the old foot, from a squad that stood a hall before the hall was a stomach.", "*The light inside it moves toward the wall with the crack. Every Hollow faces it eventually. It is the only door nobody gave them keys to."],
    low: ["*The plates hang by one hand and the stance still holds, which is the whole difference between a soldier and a haunting.", "*Inside the visor, for a second, there is a drawing: a house, a sun, a chimney, crooked."],
    acts: {
      Check: ["HOLLOW KNIGHT — misfiled living. The floor borrowed the crew and forgot to return the armour. Association status: 'pending.' It has been pending so long it learned to stand.", "HOLLOW KNIGHT — the linings are taped. That is not flavor text; that is the file. Read the file out loud and it will stop calling itself a monster for a few seconds."],
      Names: ["You read the name taped inside the helmet, out loud, to the thing the Association filed as 'pending.' The whole squad in the shadows turns, together, the way a class turns when the teacher says the correct name.", "Names. You give it its own back and the broken sword drops point-first, which is the sound a person makes when they put something down."],
      "Remove Helm": ["You take the helm off. There is nothing under it. There is the drawing, and the light. You put the helm back on it, gently, like tucking in a kid who missed roll call.", "You remove the helm and the light comes out to see you and keeps coming out, and the armour sits down without you having to end anything, and the hall's cold goes somewhere else for a while."],
      "Call The Crew": ["You call the survey crew's roll — HANA, JINO, the ones the posters remember — and the knight's whole posture becomes a squad hearing their family's names in a foreign war.", "The roll call is a bridge, and half the misfiled dead are on the wrong side of a six-year file, and the bridge holds, briefly, beautifully, on nothing but cadence."],
    },
    spareReady: ["The armour stands easy, sword planted at its foot, the light in the visor steady on you like it has decided the answer to the only question it has left. The linings are open. Read the last name.", "*The hall is holding its shift for your next sentence. You are allowed to end it kindly."],
    spared: ["You call the roll. Every name, every lining, the little crooked chimney drawing included, and at the last name the light comes up out of the visor and walks — toward the crack in the east wall, up, out, misfiled no longer, four floors of filing error corrected by a person who read the paperwork aloud.", "You tell the Hollow Knights they are relieved. The sound of sixty years of standing down at once is the closest this citadel comes to applause."],
    death: ["The armour empties. The light goes out at the moment the plates touch, and the drawing — the little house with the crooked chimney — flutters free and lands at your boots, which you will keep, which the System will log, which the System will not understand. (The other Hollows in the shadow turn away from you, all together, the way a class does when the teacher says the name of someone who did not make it. The fight you just won is now permanent. Good.)"],
  },
  acolyte: {
    intro: [{ who: "CRIMSON ACOLYTE", text: "The cult's junior ranks line the nave with candles they will never get to blow out, and the closest one turns its hood toward you like a question with a curfew." }],
    idle: ["*It holds the candle steady for the procession and holds the procession steady for the floor.", "*The hood tilts: 'is this part of the liturgy?' It is. In here everything is, if you let it."],
    low: ["*The candle's wax runs over its glove. It does not adjust. The shift is more important than the hand.", "*It keeps its line, bent, the spine of the whole procession going soft at one vertebra."],
    acts: {
      Check: ["CRIMSON ACOLYTE — ex-hunters who found the only honest theology on the floors: the dungeon is sick, and the sick deserve tending. ATK 7 DEF 6, resolve: geological.", "ACOLYTE — it was E-rank once, a surveyor, a person with a morning. The candle is the whole of its equipment list and it is not missing anything."],
      Snuff: ["You reach over and pinch the candle out, the way you'd do it in a dorm at lights-out. It flinches, and then, and then: nothing. The world continues, ungoverned by the liturgy, and the acolyte finds it has shoulders.", "The nearest candle out and the whole nave stops pretending the dark is a doctrine. It's just the dark. Someone should have told the cult the dark is load-bearing in every building, and that you can rest your eyes."],
      Confess: ["You tell the hood the true thing about the last floor. It listens with its whole body, because it has been assigned to listening for six years, and because the acolyte's vow is one honest sentence a day and no one has brought one in a while.", "Confession goes both ways in a line of people who were hunters; the hood tilts, and it tells you its name, which is not a name the Association would have filed, and that is what a name is for."],
      Extinguish: ["You walk the line, candle by candle, out, and with each one the procession becomes a wake becomes a crew standing in the dark agreeing to go home, and the last one looks at you the way the last person at a job site looks at the gate that finally opens.", "The last candle stays lit and the acolyte hands it to you, guttering, official: a transfer of the only post that never quit."],
    },
    spareReady: ["*The whole nave is spare-window now: kneeling, candles offered, waiting for you to either take the vigil or end it, and the two are the same gesture if you do it gently.", "*It is asking, in hood language, whether the floor can be put to bed."],
    spared: ["You accept the vigil for one hour — one, you say, and mean it, and the candles you blew out stay out — and the cult learns from the hour that tending the sick and lighting four hundred candles are two different jobs, and the smaller one is the honest one.", "You end the service. It ends like a drill in a parking lot after the world has changed: a few people cry in formation, then out of it, then they go get breakfast somewhere you will never be able to follow."],
    death: ["The candle goes out in the hand, and the nave goes out in the hand, and the next acolyte lights its candle from the next, all the way down the line, and the hall keeps its vigil the way a body keeps a fever. You have killed a symptom. The floor is still sick, and now the floor has seen your face at liturgy."],
  },
};
for (const k of Object.keys(EX_LINES)) (ENEMY_LINES as Record<string, unknown>)[k] = EX_LINES[k];

// ---------- boss bestiary voices for the four new floors ----------
const BOSS_EX: Record<string, { intro: Line[]; idle: string[]; low: string[]; acts: Record<string, string[]>; spareReady: string[]; spared: string[]; death: string[] }> = {
  hobgoblin: {
    intro: [
      { who: "HOBGOBLIN", text: "It does not roar. That is what the tape says happens, and the tape is propaganda: it looks at your dented pot-lid, then at your hands, then it sets BOTH cleavers on the altar step, parallel, like a man laying down tools at a job he is about to do honestly. It cracks its neck. It picks up one." },
      { who: "SYSTEM", text: "[BLOOD-RED HOBGOBLIN. FILE: 'EAT THE SURVEY TEAMS.' THE FILE IS A TRANSLATION ERROR FROM 'EATS THE DEAD AND KEEPS THE METAL.' YOU ARE ABOUT TO MEET A FUNERAL DIRECTOR WITH A WEAPON LICENCE. HE CHOSE THIS FLOOR, WHICH IS THE ONLY REAL CLASSIFICATION ANY OF YOU HAVE.]" },
    ],
    idle: ["*It waits. The entire fight is happening in the two metres between, and it is measuring both of you like a man checking a wall for plumb.", "*It stamps its heel once, on the flagstones, and listens to the sound the ruin makes, and files the floor's health under 'not good.' It is worried about the block. It will never admit that the monster is worried about the building."],
    low: ["*It spits blood and wipes its chin with the back of a bare forearm, and decides it did not need the guard anyway. This is what its whole species is: people who did not need the thing.", "*One cleaver is in the ground, leaning, held upright by its own weight and a hand on the pommel. It is taking a break mid-combat, in front of you, and it hates that you can see that it is tired."],
    acts: {
      Check: ["HOBGOBLIN — 'blood-red' is the colour of the apron. GRIK, of the second shrine cohort: a rank his people gave the ones who stay to keep the graveyard tidy. ATK 14 DEF 11. Fight it and you will win, eventually, and the altar will be a mound, and nobody will rake the moss.", "HOBGOBLIN — it has eaten, in the strict sense, three survey teams. It has buried, in the strict sense, twelve. The Association's file on 'who ate whom' is going to need a new preposition before this day is done."],
      Name: ["You say: GRIK. You got it off the altar shelf where he keeps the tally-stones, every one a dead man's buckle, and the one at the bottom has no buckle, no tag, no name — because he is not a thing that gets filed, and you said it anyway, out loud, in the only language the floor has left.", "The name lands on him like weather on a roof: total, impersonal, fine. He goes back to fighting with it under the whole thing, like a coat with the collar turned up, and something in the block settles by a millimeter. The ruin heard its resident's name. That is what the ruin was holding its breath for."],
      "Cross Armor": ["You bring your guard up, exactly the way he taught the ground by the way he stands, and the fight becomes a lesson you did not enroll in but are passing.", "You cross your arms and he crosses his — the gesture the second shrine cohort used at the end of a service: weapons down, both parties full of what they mean. The cleaver hand trembles with how badly he wants the order to be 'dismiss.'"],
      Roar: ["You roar at the top of the ruin. He roars back, lower, longer, a thing the whole block felt, and the two roars end at almost exactly the same second, which is the only truce anyone has offered him in nine years.", "Your roar cracks on the last of it, because you are one person, and his does not, because he is a floor's way of grieving with its teeth. It stops him, the way shouting at the sea stops you both eventually."],
    },
    spareReady: ["*He has put the second cleaver down, and it is not for your benefit. He is asking, in the whole grammar of the apron and the altar and the tidy raked moss, whether you are the kind of thing that will put the FIRST one down too.", "Spare window: the fight is done inside him. The rest of it is whether you can make the file say what actually happened here."],
    spared: ["You stand in the sun-patch at the shrine with your hands open, and the whole ruin goes quiet the way a room goes quiet when somebody says the true thing first. He picks up his cleaver, looks at it, and puts it in the altar with the tally-stones. The red knight sits down in the moss and the moss holds. It is the first time the moss has held.", "You will meet Grik on the top floor. He will stand at the back of the throne room with his arms crossed and nowhere to be, and when your shadow leans toward you, his will not, because he has had nine years of his own shadow, and he has kept it tidy. That is the entire reward. It is enough. It has to be."],
    death: ["He looks at the place the cleaver went in more surprised than hurt, like he is checking whether the block finally got a builder it can trust, and the moss at the shrine steps holds one red hand's print for a hundred years, and the System logs: 'FLOOR RESIDENT: REMOVED.' The block, which has no System, logs: 'FLOOR RESIDENT: LOST.' Both entries are true. One of them is a person.", "(The pond, east, goes down another inch. Whatever the floor was doing with its grief before, it has to do it alone now. The System said: 'defeat the guardian, prove you can hold a weapon.' You proved it. Now the block has a mound where it had a man. File that. See what comes back.)"],
  },
  sentinel: {
    intro: [
      { who: "STONE SENTINEL", text: "The four-hundred-year statue takes the last step down into the shallows with the whole stair's rune-light going to nightlights on its way, and it has no face, and the water comes up its shins like a tide being allowed to come home." },
      { who: "SYSTEM", text: "[STONE SENTINEL. OBJECTIVE: DESTROY. OBJECTIVE AUTHORITY: ASSOCIATION. OBJECTIVE MERIT: NONE. THE SENTINEL HOLDS THE WATCH YOU ARE HERE TO RELIEVE. FIGHT IT AND TAKE THE POST. THAT IS NOT A THREAT. THAT IS THE OFFER, WHOLESALE, INCLUDING THE PART NONE OF YOUR EMPLOYERS READ ALOUD.]" },
    ],
    idle: ["*It advances at the speed of a thing that knows exactly how long it has. Which it does not know. It has been alone long enough to be wrong about that.", "*The candles on the drowned stair gutter all at once, every one, toward you — a hall holding its breath because you walked in with muddy boots."],
    low: ["*The crack down its breastplate opens the way a church roof opens in a bad century: structural, patient, full of light leaking out that should have been rain.", "*One knee goes down into the shallows and the whole vigil shifts onto it, like it is starting a long kneel and calling it a rest."],
    acts: {
      Check: ["STONE SENTINEL — carved by the crew that came before the Guild, set here over a graveyard that was young then. ATK 16 DEF 22. It does not hit you, exactly; it enforces the perimeter on the idea of you.", "STONE SENTINEL — the cadence call is in it, four hundred years of the drowning's own roll-call, and the only weapon in this hall that is not a weapon is knowing the next line."],
      Polish: ["You set your cloth to the moss on its shoulders and the rune-light brightens to a porch lamp, and the whole marsh goes easy around you two like the tide just got a name.", "This one has not been touched since the water rose. Monuments stop being guard posts when someone touches them kindly."],
      Lullaby: ["You sing the cadence call — wrong words, right century — and the sentinel's head comes down toward the water like a helmet onto a bunk, and for four seconds nothing in this place is a monster or a hunter, and the four seconds are load-bearing.", "The lullaby takes it all the way to its knees in the shallows, and its stone eyes close to the level of a person deciding, in real time, that sleep is a job it is allowed."],
      Order: ["'Sentinel, the village made it,' you say, which is what it has been standing to find out, and the four centuries shift their weight into the question.", "'Relieved,' you tell it. 'Post stands down.' It tries to stand down around the word, and the word is holding, and the fight becomes two people moving furniture around a fact."],
    },
    spareReady: ["Its head is down, the vigil posture softening to a rest position, the rune-light steady on you like a hand held out with the file number face-up: read me and let me off the clock.", "*Spare window: it is asking you to give it the one thing the Association never issued — an end to the shift."],
    spared: ["You sing the last line and the sentinel sits down in the marsh and the marsh holds it, and the stair's candles go out one by one — not extinguished, EXTINGUISHED, the way a crew puts out a lamp when watch is over and the relief has come.", "It hands you the rune-light as you leave the shallows, and you don't take it, and it keeps burning anyway, at the head of every stair in the marsh, for as long as anyone walks them with a song in their mouth."],
    death: ["The Stone Sentinel comes apart into the shallows with a sound like a whole year of candles going out at the same time, and the marsh, which was a graveyard, is now a graveyard with no gravedigger, and the water begins, slowly, its own bad idea of what to do with the dead. The stair's runes go dark. The stair does not need runes anymore. The stair is only stairs.", "The System files: FLOOR CLEARED. You wade out with four hundred years of someone else's watch standing on your shoulders, and the heaviest object on the block is now, in the only way that is measurable, you."],
  },
  irontusk: {
    intro: [
      { who: "IRON TUSK", text: "The boar lifts its head from the chains and the lava lights the whole hall like an auditorium finding out a play is happening. The knight's sword in its shoulder is rust-welded through the bristle, ten years in, a thing that happened to it on purpose and became a thing it carries on purpose." },
      { who: "SYSTEM", text: "[IRON TUSK. ASSOCIATION FILE: 'BEAST, CONTAINED.' THE FILE IS FOUR SENTENCES OLD AND THE CHAINS ARE SIX YEARS OLD AND THE BOAR HAS BEEN LETTING EVERY CREW SEE WHICH WAY THEY STRAIN. OBJECTIVE: DESTROY. OBJECTIVE REFINED: DECIDE WHAT THE CHAINS WERE FOR, WHICH IS THE ONLY THING YOUR EMPLOYERS HAVE EVER ASKED OF YOU THAT MATTERS.]" },
    ],
    idle: ["*It circles on the length of one chain, and every time the slack comes out the wall takes the strain and the whole hall takes it with it, and you notice, and it notices you noticing.", "*It stamps a rhythm. The hall answers. The floor, as a rule, does not answer, which means the rule in this room is that the boar IS the rule."],
    low: ["*One chain link parts and it leans on the broken strand like an old man leaning on a cane and keeps circling, because the shift is not finished and everyone in the hall has started to understand what the shift is.", "*It looks at the wound in its own shoulder, the sword, then at your hands, and you are absolutely certain it is checking whether you can be trusted."],
    acts: {
      Check: ["IRON TUSK — the floor's nurse. The cult's whole religion is one fact in a hide: it is chained here to keep the lava down, and it LETS them keep it chained because the alternative is the block above digesting like a held breath. ATK 18 DEF 24. Fight it like you read the file and you will be the last person who ever mistakes a patient for a prisoner.", "IRON TUSK — the surveyor's old note, scratched into the base of its far chain-anchor: IT STEADIES THE ROOM. Check the chains before you check its eyes. The eyes are fair. The chains are the fight."],
      Unchain: ["You go up the link-line with your hands on the ring the way you'd put a hand on a horse's neck, and the cult's choir goes silent mid-hymn, and you work the old key off the pin, and the chain falls, and the hall settles a half-inch, and nobody moves.", "The last link comes off and the chains go to the floor like a held argument ending, and the boar stands loose in the middle of the room in its broken sword and decides, with every one of its six years of patience, what to do now."],
      Taunt: ["You taunt it and the whole hall roars with the chains in resonance, and the boar looks down at you like a man at a dog that has learned a card trick.", "Your taunt is the only wrong noise in the room and it stops mid-circle and listens you out, which is more than the Association ever managed."],
      Chain: ["You take up the loose chain, end over end, and it lets you, and you put it back over the hook, and neither of you is pretending the chain is for the lava now.", "You show it the link it wore: both of you holding one heavy, tired, load-bearing fact, and the hall learns what its new filing system is."],
    },
    spareReady: ["It has stopped circling and the chains lie slack on the lava side, and the whole hall is holding one breath through one big scarred face watching your hands to see if you have the key, the will, the wit.", "*Spare window: the nurse wants to be relieved, by you, in the right order — cut it loose, then thank it, and then, if you can carry the fact, walk."],
    spared: ["The chain falls and the hall settles and the boar walks past you, slow as a season, up through the cult's broken altar and out past the shafts, and the lava stays where it belongs: kept down now not by a chain but by the six-year precedent of somebody having asked it nicely. The cult dissolves into a union, and the floors after that run on the credit of a debt nobody will ever read.", "You stand at the hall gate with the key ring still hot in your palm and the whole floor holding the door for the biggest, most tired thing in it, and the boar looks back once, into the room that was a cell and is now a room, and goes."],
    death: ["The chains go taut one last time — the hall's own muscles taking its weight, without its keeper — and the lava finds the crack in the boss hall floor where the fire was taught to sleep, and the citadel above, for one second, digests a half-inch, and the crack in the throne room's east wall glows to a slow red.", "The System files the kill under 'containment achieved.' The cult files it under 'nurse deceased.' The block above files it under 'structural loss,' which is the same phrase as the day the whole thing started. The floor did not eat the nurse. The floor, now, is going to need one. The chains are lying slack, and the room is going to be looking for hands. It has your face. Floors have your face now."],
  },
  warden: {
    intro: [
      { who: "GATE WARDEN", text: "Every brazier in the throne room lights at once, which is how you know the room considers this the last sentence in the book: the Warden roots its halberd in the marble and offers you, plainly, with sixty-one years of the hall's muscle-memory behind its shoulders, the only fight it still knows how to have." },
      { who: "SYSTEM", text: "[THE GATE WARDEN HAS HELD THIS ROOM SINCE BEFORE YOUR ASSOCIATION HAD A NAME FOR WHAT A GATE IS. EVERYTHING YOU HAVE FOUGHT WAS A LESSER VERSION OF THIS. THAT IS NOT A THREAT. THAT IS AN ATLAS. THE ONLY PART OF THE FIGHT THAT MATTERS HAPPENS IN THE TURN YOU DO NOT TAKE.]" },
    ],
    idle: ["*It advances at the exact speed of a guard changing post, and the precision is the cruelty, and the cruelty is the politeness: it has never once, in sixty-one years, made a kill personal.", "*The halberd's butt strikes marble twice: 'stand fast,' in the drill of a hall whose crew are all dead and whose discipline is the only thing the floor cannot digest. You are being fought by a building's memory of its best people."],
    low: ["*A crack walks up its greave with the sound of a gate finally being forced, and it adjusts to the crack like a man who has made his whole life out of adjusting to the weather he was given.", "*One pauldron comes loose on a strap and it keeps it in rotation anyway, because the post is the armor, and the armor is the post, and the Warden has always understood which was load-bearing."],
    acts: {
      Check: ["GATE WARDEN — ATK 21 DEF 26. It holds the door behind it, which is the only reason it holds the fight: the door is a thing it is guarding, and you are a thing it is guarding, and it has had no one to guard it since the last crew of the marsh stair went up and did not come down.", "WARDEN — filed: 'monarch's instrument.' Actual: the last tenant of the block that agreed, before your System, before the tape, to be the thing that kept the door shut from the inside. The dent in the marble beside the dais is its one filed sentence: 'the monarch is a chair with a job.' The chair is the fight. The job is spareable."],
      Yield: ["You put your weapon flat on the marble of the dais step, and the whole hall's discipline comes down to the one question it has held for sixty-one years: is there a version where the guard gets relieved without the door being lost. The answer is your hands, coming up empty.", "'Yield,' you say, to the guard, in the throne room, in the block: and the Warden's arms shake, which the brazier light will never let the file show."],
      Ask: ["You ask it what it is guarding the door FROM, and it answers in the only form it has, a change of stance — a half-step toward the gate, not you. The answer is: FROM THE SIDE THAT WILL OFFER YOU A CLASS. You are standing six inches from the first honest sentence of the whole campaign.", "You ask its name. It gives the one it filed itself under: it strikes the halberd butt once more, and the sound is 'here,' and that is the name, and that has always been the name."],
      Refuse: ["You refuse the whole thing: the post, the fight, the throne's logic of one person and one door forever, and the refusal lands in the room like a window thrown open after sixty-one years of a held breath.", "'No,' you tell the Warden, which is a word the Warden has not been spoken TO, only by, in the whole of its tenure, and it comes off the line like a man stepping off a ledge it never told anyone he'd been standing on."],
    },
    spareReady: ["The halberd goes into the marble, hilt-down, and the hilt hand comes off it, and the Warden stands on the dais step with nothing in its hands and the door behind it held by sixty-one years of your conduct on this floor alone. It is offering its last and only post: the one where it gets to be relieved.", "*Spare window: it is open because you have made it open, which is the first time in the history of that door, and the room knows, and the room is going to keep knowing, about you."],
    spared: ["You take the Warden's hands in yours — gauntlets off, the scarred and cold hands of the last person who held a door for a reason they could say out loud — and it comes down the dais steps behind you, out past the throne's floor line, and the hall lets it, which the whole architecture is going to spend the rest of the war pretending it did not.", "The Warden sits on the first step of the throne it never was for, and Seo puts a canteen down beside it without stopping, and you will remember this floor for the sound of a helmet, six inches up from a marble knee, hitting the step like a man putting down something the file never let him put down."],
    death: ["The Warden comes down around its own halberd like the door collapsing from inside, and the throne room's lights gutter once in the wrong direction, toward the Gate on the far wall, and the Gate is not a Gate anymore: it is an open west door, unregistered, snow-light under it, and the room is handing you the whole floor the only way it ever knew how, by being broken by the right thing.", "You won the door. Every brazier in the hall relights at the exact height of a guard at attention, and you walk between them, and the Warden's dent in the marble is gone, and every single thing in this building knows which side of the door you came through and which one you are going through, and the difference is going to be the rest of your life."],
  },
  alpha: {
    intro: [
      { who: "BLACK FANG ALPHA", text: "The den's last exhibit introduces itself by unfolding out of the dark with the pack's arithmetic written all along its mane in bone: every tally of every crew that walked the galleries without raking the moss." },
      { who: "SYSTEM", text: "[BLACK FANG ALPHA. IT HAS BEEN EATING CANDIDATES FOR A MONTH AND THE ASSOCIATION HAS FILED NONE OF THEM AS DEATH, ONLY AS 'WITHDRAWN.' THE ALPHA IS THE FLOOR'S WAY OF MAKING THE FILES TRUE. THE ONLY WINNING HERE IS NOT THE KILL. IT IS MAKING IT STOP.]" },
    ],
    idle: ["*It circles without hurrying and the whole gallery circles with it, shadows between columns, which is not reinforcements, it is AUDIENCE.", "*It pauses at a scored column, its own height marked on the stone, and looks at your height, and the arithmetic runs behind its eyes like a man counting change."],
    low: ["*The mane-bones rattle, half of them loose now, and it carries the missing tallies with its whole body straighter.", "*It favors one side, and the pack in the shadow favors it with, all of them adjusting their limp to match their king's, which is the most frightening thing you have seen in four floors and also the most tender."],
    acts: {
      Check: ["BLACK FANG ALPHA — ATK 17 DEF 13, grief: load-bearing. The pack eats where the floor feeds it. The floor eats where the Association sent the crews. You are not the hunter in this system; you are the meal that learned to file.", "ALPHA — it has not eaten in a month. It has been collecting the drawn helmets and sorting the bone by SIZE: the ones that ran, the ones that stayed, the ones that came back for someone. It is a quartermaster of the dead with a grudge against paperwork. It would rather be fought than audited."],
      Howl: ["You howl — awful, human, the alarm at 5 AM given teeth and a lung — and the den goes flat, and its answer is a sentence in a language the System cannot parse and the pack all parses at once: 'enough.'", "Your howl is the call to the roll the crews never got, and it takes the whole den's silence to finish, and then the alpha's hackles come down like a flag at the end of a service, and the fight is a wake with a schedule to keep."],
      Bow: ["You bow in the den's doorway, the shrine way, raked-moss way, and the alpha goes down to its belly with its muzzle flat on the sorted bones, which is how its people write a request for mercy when the other party is a person and not a System.", "You bow and the whole pack bows, in the shadow, the exact same angle, a thing the floor learned from the people it swallowed, and it is looking at you, all forty pairs of eyes, to see what you will do with a floor's first good manners."],
      Challenge: ["You challenge it fair, the old way, one body to one body, no filing, and it accepts the way an officer accepts a duel after the war: everything paid, nothing won, the form is all that's left and the form is the point.", "The challenge takes you both to the museum floor's center, and for the length of one breath the dead are an audience instead of an exhibit, and you can feel which side they picked, which is the only side you needed."],
    },
    spareReady: ["The alpha lies down at its own column marks, mane-bones scattered loose, the whole museum's arithmetic ended by two tired leaders choosing the same verb at the same time, and the pack, in the dark, begins, very quietly, to carry the bones OUT of the exhibit and into the ground.", "*Spare window: it has set its neck down on the sorted bones like a man setting his tools down at the end of a long shift in a bad mine. It is asking to clock out and asking to be trusted. The one is in the other."],
    spared: ["You put a hand on the mane — the last thing anyone did to any of it while it could feel a hand — and the den ends: not cleared, not filed, ENDED, like a month of held breath, and the pack takes the alpha out past the shafts in a line, and the museum becomes a cemetery with a schedule, which is the correct amount of mercy for the ones you are late for.", "Walking the last floor you will feel that something in the dark of the galleries has been following you with a pack's whole loyalty turned down to a respectful quarter-mile — a debt the System cannot log, because it was incurred in a building it does not consider a bank."],
    death: ["The pack dissolves into the shaft dark without a grudge passed around, which is worse: the grudge stays where it is, in the sorted bones, and every column in the den re-scores itself by a hand nobody sees, and the new exhibit is a hunter with their file number in it, height marked, head height.", "(The floor kept its arithmetic honest to the last. The System logs you as 'FLOOR SECURED.' The den logs you as one of its own, and the difference between those files is the entire point of this dungeon, and you found it out, as usual, by winning.)"],
  },
};
for (const k of Object.keys(BOSS_EX)) (ENEMY_LINES as Record<string, unknown>)[k] = BOSS_EX[k];

// ---------- the campaign epilogue: every debt the ending remembers ----------
/** Appended after the three Ashenveil endings. Each entry pays off a promise
 *  the four lower floors made, if and only if the player kept or broke it. */
export function epilogue(f: WorldFlags): Line[] {
  const out: Line[] = [
    { text: "EPILOGUE — THE FLOORS, ONE MONTH LATER." },
    { text: "{PLAYER} keeps walking. That is the whole epilogue and the entire point: the floors are public now, and whoever {PRON_SUBJ} is out there clearing, the block's tenants call it {PRON_POSS} morning walk." },
  ];
  if (f.sparedStory["hobgoblin"]) out.push(
    { text: "The Verdant shrine has a second rake now, and no one living knows who bought it. The Association's aerial survey of Block 9 lists the north structure as 'abandoned.' The report adds, against every style rule the department has, a lowercase sentence: 'occupied.' Grik's bowl is filled weekly by a courier who resigns from leaving names." },
  );
  else out.push(
    { text: "The Verdant shrine rakes itself now, the reports say — wind, probably. The moss pile grows on schedule. The bowl by the door stays empty on schedule. The Association stopped sending survey teams to that floor and started sending only drones, and the drones come back with photographs of nothing, dated wrong, and the photo archive has one folder labelled 'RESIDENT,' and the only file in it is a print of an empty altar step, taken from the inside." },
  );
  if (f.bossDown["sentinel"] || f.sparedStory["sentinel"]) out.push((f.sparedStory["sentinel"])
    ? { text: "The marsh stairs run lit at the top and bottom, no middle, which the villagers call 'the relieved section.' The reed monks have added a fifth candle to the roll call, unexplained, and when the flood-wardens asked who it's for, the senior monk said 'the relief,' and the flood-wardens, who are practical men, wrote it down without laughing, because in four hundred years the statue had never once been wrong about the water." }
    : { text: "The marsh water keeps rising an inch a year, and the Association's new classification for the floor is 'graveyard, unattended.' On the stair there are four hundred candles and no hand to light them, and the flood logs, which were kept by the statue for sixteen generations, have begun, very slowly, to keep themselves — which the junior analysts find romantic and the senior ones refuse to discuss at all." },
  );
  if (f.chainedTusk && f.sparedStory["irontusk"]) out.push(
    { text: "The caverns' lava hall has a new rule, painted over the cult's old altar in the cult's own crimson: ASK HIM. The boar walks the east gallery like a landlord, and the mine-lift runs again because it likes the sound, and the four acolytes who stayed turned the candle-vigil into a night-shift for the farms, which is how a prayer becomes a union. Verity's report to no one reads: 'the patient is resting. the nurse is home. the floor, at last, is not digesting. it is SLEEPING, and a sleeping monarch can be woken kindly, and we intend to be the ones.'" },
  );
  else if (f.bossDown["irontusk"] || f.sparedStory["irontusk"]) out.push(
    { text: "The boss hall's chains lie slack and the lava sits higher than the surveys allow by a finger's width, and the citadel's east wall crack glows on the nights the weather turns. The Association has re-classified the caverns as 'containment: degraded' and has not sent anyone to degrade it further, which everyone in the deep floors understands to mean the floor is holding itself together out of habit, and habit is a thin chain, and thin chains make good monuments and bad promises." },
  );
  if (f.kangBond) out.push(
    { text: "Master Kang teaches again, in the back room over the bakery, at 5 AM, E-rank rates, because he has never been anything else and the rate is the point. There are nine students. The System's records show no instructor of that name in any country. The attendance sheet, which is paper, which the System cannot read, is the only archive that matters, and at the top of it, in his handwriting, it says: THE ALARM IS THE STARTING LINE, NOT THE LEASH." },
  );
  if (f.emberBond) out.push(
    { text: "A cinder bat lives in the hood of a coat hung on the back of the classroom door. It carries glow-cap spores to the dark farms on Tuesdays, for free, and the farms have started leaving a ninth mushroom out for the courier, and the System, which audits everything, has filed the whole economy as 'clerical error,' which is the kindest thing it has ever said about anything." },
  );
  if (f.savedPair) out.push(
    { text: "Hana and Jino walked out of a Citadel filing error on their own legs, and the Association has them listed as RESOLVED, which is paperwork for 'we are sorry and we will not say it.' They run the block's new office now — not a guild, an office: names in, names out, misfilings chased, the four hundred candle-rolls transferred to living hands. The fourth reed on the marsh boardwalk was untied in a ceremony with nine people attending and was re-tied the same day, dry, because, as Hana put it, 'we don't un-keep promises, we just keep them in daylight.'" },
  );
  else out.push(
    { text: "The missing-poster board in the marsh still holds four names and three soft reeds, and the family of the fourth keeps its reed dry, and sends a letter to the Association every quarter asking if any floors have been 're-classified,' and the Association writes back, every quarter, with the same form, that the search continues. Somebody, somewhere in this story, was supposed to bring them back. The form is patient. The form has all the time the stair's candles burn." },
  );
  if (f.ceremonyAnswer === "yes") out.push(
    { text: "The shadows of Block 9 are, per the aerial survey, 'denser than the architecture explains,' and the new monarch keeps the morning training and the evening rounds, because a class you accept is a shift you work. The bakery over the unregistered door employs a retired Handler and an armored monument with no name and a bat on the payroll. The System logs the monarch's daily quest streak at the top of every report, unedited, which is its version of a crown, which is to say: a receipt, renewed daily, in public." },
  );
  else if (f.ceremonyAnswer === "no") out.push(
    { text: "There is no class, no crown, no shadow-host, and the System's file on you reads, in its own handwriting, which it has never used for anything else: 'DECLINED. THE ONLY ONE. KEEP THE STREAK, THOUGH — THE STREAK WAS ALWAYS YOURS.' On the mornings you run it, four floors under a city block, a Hobgoblin rakes moss, a statue sleeps, a boar patrols, and an old E-rank counts push-ups in a back room like a man balancing a ledger against the world. You are not in anything's story. You are in all of theirs. The alarm goes at five. It goes gentler now." },
  );
  else out.push(
    { text: "The throne was left answered-but-unanswered, the west door left open, the class left on the table like a bill at a table nobody's left yet. The System files it as 'PENDING,' a status it has, since that afternoon, discovered it enjoys: forty-one candidate files reopened with one word appended — RETURNED. The morning runs keep going. The answer keeps being yours, which is the only way an answer is ever real." },
  );
  return out;
}
