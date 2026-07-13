
function tokenToState(tokenId, token, pcData = null) {
  const hpInfo = token.options?.hitPointInfo || {};

  const walkingSpeed =
    pcData?.speeds?.find(
      speed => speed.name === "Walking"
    )?.distance;

  const abilities = Array.isArray(pcData?.abilities)
    ? pcData.abilities
    : [];

  function findAbility(name, abbreviation) {
    const ability = abilities.find(entry => {
      const entryName = String(entry?.name || "").toLowerCase();
      const entryAbbreviation = String(
        entry?.abbreviation ||
        entry?.shortName ||
        ""
      ).toLowerCase();

      return (
        entryName === name.toLowerCase() ||
        entryName === abbreviation.toLowerCase() ||
        entryAbbreviation === abbreviation.toLowerCase()
      );
    });

    const score = Number(
      ability?.score ??
      ability?.value ??
      ability?.totalScore ??
      10
    );

    const calculatedModifier =
      Math.floor((score - 10) / 2);

    const modifier = Number(
      ability?.modifier ??
      ability?.mod ??
      calculatedModifier
    );

    return {
      score: Number.isFinite(score) ? score : 10,
      modifier: Number.isFinite(modifier)
        ? modifier
        : calculatedModifier
    };
  }

  function highestNumericValue(entries) {
    const values = (Array.isArray(entries) ? entries : [])
      .map(entry =>
        Number(
          entry?.value ??
          entry?.total ??
          entry?.modifier ??
          entry?.dc
        )
      )
      .filter(Number.isFinite);

    return values.length
      ? Math.max(...values)
      : 0;
  }

  const strength = findAbility("Strength", "STR");
  const dexterity = findAbility("Dexterity", "DEX");
  const constitution = findAbility("Constitution", "CON");
  const intelligence = findAbility("Intelligence", "INT");
  const wisdom = findAbility("Wisdom", "WIS");
  const charisma = findAbility("Charisma", "CHA");

  const spellSaveDc = highestNumericValue(
    pcData?.castingInfo?.saveDcs
  );

  const spellAttackBonus = highestNumericValue(
    pcData?.castingInfo?.spellAttacks
  );

  const proficiency = Number(
    pcData?.proficiencyBonus ?? 0
  );

  return {
    id: tokenId,
    name: token.options?.name || "Token",
    itemType: token.options?.itemType || "",

    hp:
      hpInfo.current ??
      token.options?.hp ??
      null,

    maxHp:
      hpInfo.maximum ??
      token.options?.max_hp ??
      null,

    tempHp:
      hpInfo.temp ??
      token.options?.temp_hp ??
      0,

    armorClass:
      token.options?.armorClass ??
      pcData?.armorClass ??
      null,

    speed:
      walkingSpeed ??
      token.options?.speed ??
      token.options?.speeds?.walk ??
      token.options?.speeds?.walking ??
      null,

    conditions:
      token.options?.conditions || [],

    customConditions:
      token.options?.custom_conditions || [],

    deathSaveInfo: {
      successCount: Number(
        pcData?.deathSaveInfo?.successCount ?? 0
      ),
      failCount: Number(
        pcData?.deathSaveInfo?.failCount ?? 0
      )
    },

    spellSaveDc,
    spellAttackBonus,

    grappleDc:
      8 +
      strength.modifier +
      proficiency,

    passivePerception:
      pcData?.passivePerception ?? null,

    passiveInsight:
      pcData?.passiveInsight ?? null,

    darkvision:
      Number(token.options?.vision?.feet || 0),

    abilities: {
      STR: strength,
      DEX: dexterity,
      CON: constitution,
      INT: intelligence,
      WIS: wisdom,
      CHA: charisma
    },

    cardImage: null,
    cardImages: null
  };
}

function loadImageForCanvas(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderPlayerCard(pc, page = "combat") {
  const canvas = document.createElement("canvas");
  canvas.width = 144;
  canvas.height = 144;

  const ctx = canvas.getContext("2d");

  const hp = Number(pc.hp || 0);
  const maxHp = Number(pc.maxHp || 0);
  const tempHp = Number(pc.tempHp || 0);
  const ac = pc.armorClass ?? "?";
  const speed = pc.speed ?? "?";

  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, 144, 144);

  const name = String(pc.name || "PC");
  const shortName =
    name.length > 15
      ? name.slice(0, 14) + "…"
      : name;

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(shortName, 72, 18);

  function drawFooter() {
    ctx.fillStyle = "#1c1c1c";

    ctx.beginPath();
    ctx.roundRect(6, 108, 63, 33, 8);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(75, 108, 63, 33, 8);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font =
      'bold 23px Arial, "Apple Color Emoji"';

    ctx.fillText(`🛡${ac}`, 38, 134);
    ctx.fillText(`👣${speed}`, 106, 134);
  }

  function drawDeathCircle(x, y, filled, color) {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);

    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = "#777777";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function signedModifier(value) {
    const number = Number(value || 0);
    return number >= 0
      ? `+${number}`
      : String(number);
  }

  if (page === "reference") {
    const values = [
      ["🔮", pc.spellSaveDc || "—"],
      ["✨", pc.spellAttackBonus
        ? signedModifier(pc.spellAttackBonus)
        : "—"],
      ["🤼", pc.grappleDc ?? "—"],
      ["👁", pc.darkvision ?? "—"],
      ["👂", pc.passivePerception ?? "—"],
      ["💭", pc.passiveInsight ?? "—"]
    ];

    const positions = [
      [8, 51], [76, 51],
      [8, 88], [76, 88],
      [8, 125], [76, 125]
    ];

    values.forEach(([symbol, value], index) => {
      const [x, y] = positions[index];

      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";

      ctx.font =
        '21px "Apple Color Emoji", Arial';

      ctx.fillText(symbol, x, y);

      ctx.font = "bold 23px Arial";

      ctx.fillText(
        String(value),
        x + 31,
        y
      );
    });

    ctx.textAlign = "center";
  } else if (page === "abilities") {
    const abilityRows = [
      ["STR", "DEX"],
      ["CON", "INT"],
      ["WIS", "CHA"]
    ];

    const rowY = [51, 88, 125];

    abilityRows.forEach((pair, rowIndex) => {
      pair.forEach((abilityName, columnIndex) => {
        const ability =
          pc.abilities?.[abilityName] || {
            score: 10,
            modifier: 0
          };

        const x =
          columnIndex === 0
            ? 5
            : 75;

        ctx.textAlign = "left";

        ctx.fillStyle = "#bdbdbd";
        ctx.font = "bold 16px Arial";

        ctx.fillText(
          abilityName,
          x,
          rowY[rowIndex]
        );

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Arial";

        ctx.fillText(
          signedModifier(ability.modifier),
          x + 35,
          rowY[rowIndex]
        );
      });
    });

    ctx.textAlign = "center";
  } else if (hp <= 0 && maxHp > 0) {
    const successes = Math.max(
      0,
      Math.min(
        3,
        Number(
          pc.deathSaveInfo?.successCount || 0
        )
      )
    );

    const failures = Math.max(
      0,
      Math.min(
        3,
        Number(
          pc.deathSaveInfo?.failCount || 0
        )
      )
    );

    const status =
      failures >= 3
        ? "DEAD"
        : successes >= 3
          ? "STABLE"
          : "DOWNED";

    ctx.fillStyle =
      failures >= 3
        ? "#f85149"
        : successes >= 3
          ? "#58a6ff"
          : "#f0b429";

    ctx.font = "bold 18px Arial";
    ctx.fillText(status, 72, 42);

    ctx.font =
      'bold 21px Arial, "Apple Color Emoji"';

    ctx.fillStyle = "#3fb950";
    ctx.fillText("✓", 28, 70);

    ctx.fillStyle = "#f85149";
    ctx.fillText("✕", 28, 97);

    [0, 1, 2].forEach(index => {
      const x = 56 + index * 27;

      drawDeathCircle(
        x,
        64,
        index < successes,
        "#3fb950"
      );

      drawDeathCircle(
        x,
        91,
        index < failures,
        "#f85149"
      );
    });

    drawFooter();
  } else {
    const pct =
      maxHp > 0
        ? Math.max(
            0,
            Math.min(1, hp / maxHp)
          )
        : 0;

    let hpColor = "#3fb950";

    if (pct < 0.25) {
      hpColor = "#f85149";
    } else if (pct < 0.5) {
      hpColor = "#f0883e";
    } else if (pct < 0.75) {
      hpColor = "#d29922";
    }

    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.roundRect(8, 27, 128, 24, 12);
    ctx.fill();

    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(
      8,
      27,
      Math.max(6, Math.round(128 * pct)),
      24,
      12
    );
    ctx.fill();

    if (tempHp > 0) {
      ctx.strokeStyle = "#58c7f3";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(6, 25, 132, 28, 14);
      ctx.stroke();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px Arial";
    ctx.fillText(
      `${hp}/${maxHp}`,
      72,
      86
    );

    if (tempHp > 0) {
      ctx.fillStyle = "#58c7f3";
      ctx.font = "bold 13px Arial";
      ctx.fillText(
        `+${tempHp} TEMP`,
        72,
        102
      );
    }

    drawFooter();
  }

  ctx.fillStyle =
    `rgba(${hp % 255}, ` +
    `${maxHp % 255}, ` +
    `${tempHp % 255}, 0.01)`;

  ctx.fillRect(
    page === "reference"
      ? 1
      : page === "abilities"
        ? 2
        : 0,
    0,
    1,
    1
  );

  return canvas.toDataURL("image/png");
}
async function getCombatState() {
  const selectedTokenId =
    CURRENTLY_SELECTED_TOKENS?.[0];

  const selectedToken =
    TOKEN_OBJECTS?.[selectedTokenId];

  const pcByName = new Map(
    (window.pcs || []).map(pc => [
      pc.name,
      pc
    ])
  );

  const pcByCharacterId = new Map(
    (window.pcs || []).map(pc => [
      pc.characterId,
      pc
    ])
  );

  const pcs = Object.entries(
    TOKEN_OBJECTS || {}
  )
    .map(([tokenId, token]) => {
      const match =
        pcByCharacterId.get(
          token.options?.characterId
        ) ||
        pcByName.get(
          token.options?.name
        ) ||
        null;

      return tokenToState(
        tokenId,
        token,
        match
      );
    })
    .filter(token =>
      token.itemType === "pc" ||
      (
        token.itemType === "myToken" &&
        token.hp != null &&
        token.maxHp != null &&
        token.maxHp > 0
      )
    );

  for (const pc of pcs) {
    pc.cardImages = {
      combat:
        await renderPlayerCard(
          pc,
          "combat"
        ),

      reference:
        await renderPlayerCard(
          pc,
          "reference"
        ),

      abilities:
        await renderPlayerCard(
          pc,
          "abilities"
        )
    };

    pc.cardImage =
      pc.cardImages.combat;
  }

  const selectedMatch = selectedToken
    ? (
        pcByCharacterId.get(
          selectedToken.options?.characterId
        ) ||
        pcByName.get(
          selectedToken.options?.name
        ) ||
        null
      )
    : null;

  const selectedTokenState =
    selectedToken
      ? tokenToState(
          selectedTokenId,
          selectedToken,
          selectedMatch
        )
      : null;

  if (selectedTokenState) {
    selectedTokenState.cardImages = {
      combat:
        await renderPlayerCard(
          selectedTokenState,
          "combat"
        ),

      reference:
        await renderPlayerCard(
          selectedTokenState,
          "reference"
        ),

      abilities:
        await renderPlayerCard(
          selectedTokenState,
          "abilities"
        )
    };

    selectedTokenState.cardImage =
      selectedTokenState.cardImages.combat;
  }

  return {
    selected: Boolean(selectedToken),
    selectedToken: selectedTokenState,
    pcs,
    time: Date.now()
  };
}

setInterval(async () => {
  try {
    const auraPresets = JSON.parse(
      localStorage.getItem("AURA_PRESETS") || "[]"
    );

    const lightPresets = JSON.parse(
      localStorage.getItem("LOS_PRESETS") || "[]"
    );

    const animationPresets = JSON.parse(
      localStorage.getItem("ANIMATION_PRESETS") || "[]"
    );

    await Promise.all([
      fetch("http://localhost:3000/aura-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          presets: auraPresets
        })
      }),

      fetch("http://localhost:3000/light-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          presets: lightPresets
        })
      }),

      fetch("http://localhost:3000/animation-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          presets: animationPresets
        })
      })
    ]);
  } catch (err) {
    // Bridge may be offline; ignore.
  }
}, 2000);

setInterval(async () => {
  try {
    window.postMessage({
      type: "AVTT_COMBAT_STATE",
      combatState: await getCombatState()
    }, "*");
  } catch (err) {
    console.warn("Combat state error:", err);
  }
}, 1000);


const AVTT_BUILT_IN_CONDITIONS = new Set([
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
  "Concentration(Reminder)",
  "Reaction Used",
  "Flying",
  "Burning",
  "Rage",
  "Blessed",
  "Baned",
  "Bloodied",
  "Advantage",
  "Disadvantage",
  "Bardic Inspiration",
  "Hasted"
]);

function avttCustomConditionToFilename(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") + ".png";
}

function applyCustomConditionIcons() {
  const extensionId = document.documentElement.getAttribute("data-avtt-extension-id");
  if (!extensionId) return;

  document.querySelectorAll("img.condition-img.custom-condition").forEach(img => {
    const title = img.getAttribute("title");
    if (!title) return;

    // Built-in AboveVTT conditions/statuses should keep AboveVTT's own icons.
    if (AVTT_BUILT_IN_CONDITIONS.has(title)) return;

    const filename = avttCustomConditionToFilename(title);
    const customUrl = `chrome-extension://${extensionId}/assets/conditons/${filename}`;

    if (img.src !== customUrl) {
      img.src = customUrl;
    }
  });
}

setInterval(applyCustomConditionIcons, 500);

new MutationObserver(applyCustomConditionIcons).observe(document.documentElement, {
  childList: true,
  subtree: true
});



window.AVTTBridge = {
  token: null,
  monster: null,
  pc: null,
  actionRolls: [],
  actionNames: [],

  async refresh() {
    const tokenId = CURRENTLY_SELECTED_TOKENS?.[0];
    this.token = TOKEN_OBJECTS?.[tokenId] || null;

    this.monster = null;
    this.pc = null;
    this.actionRolls = [];
    this.actionNames = [];

    if (!this.token) return false;

    if (["pc", "myToken"].includes(this.token.options?.itemType)) {
      const characterId = this.token.options.characterId;

      this.pc =
        window.pcs?.find(p => p.characterId === characterId) ||
        this.token.options;

      return true;
    }

    const monsterId =
      this.token.options.monster ||
      this.token.options.stat ||
      this.token.options.itemId;

    let monster = cached_monster_items?.[monsterId]?.monsterData;

    if (!monster) {
      open_selected_token_stat?.();
      await new Promise(resolve => setTimeout(resolve, 2500));
      monster = cached_monster_items?.[monsterId]?.monsterData;
    }

    if (!monster) return false;

    this.monster = monster;

    this.actionRolls = [...new DOMParser()
      .parseFromString(monster.actionsDescription || "", "text/html")
      .querySelectorAll("[data-dicenotation]")]
      .map(el => ({
        name: el.getAttribute("data-rollaction"),
        expression: el.getAttribute("data-dicenotation"),
        rollType: el.getAttribute("data-rolltype"),
        damageType: el.getAttribute("data-rolldamagetype")
      }));

    this.actionNames = [...new Set(this.actionRolls.map(r => r.name).filter(Boolean))];

    return true;
  },

  getDisplayName() {
    return this.pc?.name ||
      this.monster?.name ||
      this.token?.options?.name ||
      "Selected Token";
  },

  getAbilityModifier(ability) {
    if (this.pc) {
      return this.pc.abilities?.find(a => a.name === ability)?.modifier ?? 0;
    }

    const statMap = { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 };
    const score = this.monster?.stats?.find(s => s.statId === statMap[ability])?.value;

    if (typeof score !== "number") return 0;
    return Math.floor((score - 10) / 2);
  },

  getAbilityScore(ability) {
    if (this.pc) {
      return this.pc.abilities?.find(a => a.name === ability)?.score ?? null;
    }

    const statMap = { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 };
    return this.monster?.stats?.find(s => s.statId === statMap[ability])?.value ?? null;
  },

  getProficiencyBonus() {
    if (this.pc && typeof this.pc.proficiencyBonus === "number") {
      return this.pc.proficiencyBonus;
    }

    if (typeof this.monster?.proficiencyBonus === "number") {
      return this.monster.proficiencyBonus;
    }

    return 2;
  },

  getSavingThrowBonus(ability) {
    if (this.pc) {
      return this.pc.abilities?.find(a => a.name === ability)?.save
        ?? this.getAbilityModifier(ability);
    }

    return this.getAbilityModifier(ability);
  },

  getInitiativeBonus() {
    const candidates = [
      this.pc?.initiative,
      this.pc?.initiativeBonus,
      this.pc?.stats?.initiative,
      this.monster?.initiative,
      this.monster?.initiativeBonus,
      this.monster?.stats?.initiative,
      this.token?.options?.initiative,
      this.token?.options?.initiativeBonus
    ];

    for (const value of candidates) {
      if (typeof value === "number") return value;

      if (typeof value === "string") {
        const match = value.match(/[+-]?\d+/);
        if (match) return Number(match[0]);
      }
    }

    return this.getAbilityModifier("dex");
  },

  getSkillBonus(skill) {
    const clean = String(skill).toLowerCase().replace(/[^a-z]/g, "");

    if (this.pc) {
      const entry = this.pc.skills?.find(s =>
        String(s.name || "").toLowerCase().replace(/[^a-z]/g, "") === clean
      );

      if (entry && typeof entry.modifier === "number") return entry.modifier;
    }

    const skillAbilityMap = {
      acrobatics: "dex",
      animalhandling: "wis",
      arcana: "int",
      athletics: "str",
      deception: "cha",
      history: "int",
      insight: "wis",
      intimidation: "cha",
      investigation: "int",
      medicine: "wis",
      nature: "int",
      perception: "wis",
      performance: "cha",
      persuasion: "cha",
      religion: "int",
      sleightofhand: "dex",
      stealth: "dex",
      survival: "wis"
    };

    if (this.monster?.skillsHtml) {
      const htmlText = new DOMParser()
        .parseFromString(this.monster.skillsHtml, "text/html")
        .body
        .textContent || "";

      const skillDisplayMap = {
        acrobatics: "Acrobatics",
        animalhandling: "Animal Handling",
        arcana: "Arcana",
        athletics: "Athletics",
        deception: "Deception",
        history: "History",
        insight: "Insight",
        intimidation: "Intimidation",
        investigation: "Investigation",
        medicine: "Medicine",
        nature: "Nature",
        perception: "Perception",
        performance: "Performance",
        persuasion: "Persuasion",
        religion: "Religion",
        sleightofhand: "Sleight of Hand",
        stealth: "Stealth",
        survival: "Survival"
      };

      const displayName = skillDisplayMap[clean];

      if (displayName) {
        const escaped = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = htmlText.match(new RegExp(`${escaped}\\s*([+-]\\d+)`, "i"));
        if (match) return Number(match[1]);
      }
    }

    return this.getAbilityModifier(skillAbilityMap[clean] || "dex");
  },

  resolveFormula(formula) {
    const values = {
      str: this.getAbilityModifier("str"),
      dex: this.getAbilityModifier("dex"),
      con: this.getAbilityModifier("con"),
      int: this.getAbilityModifier("int"),
      wis: this.getAbilityModifier("wis"),
      cha: this.getAbilityModifier("cha"),

      strScore: this.getAbilityScore("str"),
      dexScore: this.getAbilityScore("dex"),
      conScore: this.getAbilityScore("con"),
      intScore: this.getAbilityScore("int"),
      wisScore: this.getAbilityScore("wis"),
      chaScore: this.getAbilityScore("cha"),

      pb: this.getProficiencyBonus(),
      initiative: this.getInitiativeBonus(),
      init: this.getInitiativeBonus(),

      strSave: this.getSavingThrowBonus("str"),
      dexSave: this.getSavingThrowBonus("dex"),
      conSave: this.getSavingThrowBonus("con"),
      intSave: this.getSavingThrowBonus("int"),
      wisSave: this.getSavingThrowBonus("wis"),
      chaSave: this.getSavingThrowBonus("cha"),

      acrobatics: this.getSkillBonus("acrobatics"),
      animalHandling: this.getSkillBonus("animalhandling"),
      arcana: this.getSkillBonus("arcana"),
      athletics: this.getSkillBonus("athletics"),
      deception: this.getSkillBonus("deception"),
      history: this.getSkillBonus("history"),
      insight: this.getSkillBonus("insight"),
      intimidation: this.getSkillBonus("intimidation"),
      investigation: this.getSkillBonus("investigation"),
      medicine: this.getSkillBonus("medicine"),
      nature: this.getSkillBonus("nature"),
      perception: this.getSkillBonus("perception"),
      performance: this.getSkillBonus("performance"),
      persuasion: this.getSkillBonus("persuasion"),
      religion: this.getSkillBonus("religion"),
      sleightOfHand: this.getSkillBonus("sleightofhand"),
      stealth: this.getSkillBonus("stealth"),
      survival: this.getSkillBonus("survival"),

      ac: this.token?.options?.armorClass ?? this.pc?.armorClass ?? this.monster?.armorClass ?? 0,
      hp: this.token?.options?.hitPointInfo?.current ?? this.pc?.hitPointInfo?.current ?? 0,
      maxHp: this.token?.options?.hitPointInfo?.maximum ?? this.pc?.hitPointInfo?.maximum ?? 0
    };

    let expression = String(formula || "1d20");

    Object.entries(values).forEach(([key, value]) => {
      const normalized = typeof value === "number" && value >= 0 ? `+${value}` : `${value}`;
      expression = expression.replaceAll(`{${key}}`, normalized);
    });

    return expression
      .replace(/\s+/g, "")
      .replace(/\+\+/g, "+")
      .replace(/\+-/g, "-");
  },

  resolveLabel(label) {
    return String(label || "Selected Token Roll")
      .replaceAll("{name}", this.getDisplayName());
  }
};




const AVTT_TOKEN_STYLES = new Set([
  "circle",
  "square",
  "virtualMiniCircle",
  "virtualMiniSquare",
  "noConstraint",
  "definitelyNotAToken",
  "labelToken",
  "inPersonMini"
]);

const AVTT_HEALTH_VISUALS = {
  aura: {
    healthauratype: "aura",
    enablepercenthpbar: false,
    disableaura: false,
    hidehpbar: false
  },
  auraBloodied50: {
    healthauratype: "aura-bloodied-50",
    enablepercenthpbar: false,
    disableaura: false,
    hidehpbar: false
  },
  conditionBloodied50: {
    healthauratype: "condition-bloodied-50",
    enablepercenthpbar: false,
    disableaura: true,
    hidehpbar: false
  },
  hpMeter: {
    healthauratype: "bar",
    enablepercenthpbar: true,
    disableaura: true,
    hidehpbar: false
  },
  none: {
    healthauratype: "none",
    enablepercenthpbar: false,
    disableaura: true,
    hidehpbar: false
  }
};

function normalizeTokenImageUrl(value) {
  return String(value || "").trim();
}

function applySelectedTokenImage(imageUrl) {
  const url = normalizeTokenImageUrl(imageUrl);

  if (!url) {
    console.warn("applySelectedTokenImage: missing image URL");
    return false;
  }

  const tokenIds = [...(CURRENTLY_SELECTED_TOKENS || [])];

  if (!tokenIds.length) {
    console.warn("No selected tokens to update.");
    return false;
  }

  tokenIds.forEach(id => {
    const token = window.TOKEN_OBJECTS?.[id];
    if (!token) return;

    const existingImages = Array.isArray(token.options.alternativeImages)
      ? [...token.options.alternativeImages]
      : [];

    if (!existingImages.includes(url)) {
      if (
        existingImages.length > 0 &&
        existingImages[existingImages.length - 1] !== ""
      ) {
        existingImages.push("");
      }

      existingImages.push(url);
    }

    token.options.alternativeImages = existingImages;
    token.options.imgsrc = url;

    token.place_sync_persist();

    console.log("applySelectedTokenImage:", {
      token: token.options?.name,
      imgsrc: token.options.imgsrc,
      alternativeImages: token.options.alternativeImages
    });
  });

  return true;
}

function resetSelectedTokenImage() {
  const tokenIds = [...(CURRENTLY_SELECTED_TOKENS || [])];

  if (!tokenIds.length) {
    console.warn("No selected tokens to reset.");
    return false;
  }

  let resetCount = 0;

  tokenIds.forEach(id => {
    const token = window.TOKEN_OBJECTS?.[id];
    if (!token) return;

    let defaultImage = null;

    if (
      token.options?.itemType === "pc" &&
      token.options?.characterId !== undefined
    ) {
      const characterId = String(token.options.characterId);

      const pc = window.pcs?.find(candidate =>
        String(candidate?.characterId) === characterId
      );

      defaultImage = String(pc?.image || "").trim() || null;
    }

    if (!defaultImage && Array.isArray(token.options.alternativeImages)) {
      defaultImage = token.options.alternativeImages.find(image =>
        typeof image === "string" && image.trim()
      ) || null;
    }

    if (!defaultImage) {
      console.warn("resetSelectedTokenImage: no default image found", {
        token: token.options?.name,
        itemType: token.options?.itemType,
        characterId: token.options?.characterId
      });
      return;
    }

    token.options.imgsrc = defaultImage;
    token.place_sync_persist();
    resetCount += 1;

    console.log("resetSelectedTokenImage:", {
      token: token.options?.name,
      imgsrc: token.options.imgsrc
    });
  });

  return resetCount > 0;
}


function setSelectedTokenHealthVisual(visual) {
  const settings = AVTT_HEALTH_VISUALS[visual];

  if (!settings) {
    console.warn("Invalid token health visual:", visual);
    return false;
  }

  const tokenIds = [...(CURRENTLY_SELECTED_TOKENS || [])];

  if (!tokenIds.length) {
    console.warn("No selected tokens to update.");
    return false;
  }

  tokenIds.forEach(id => {
    const token = window.TOKEN_OBJECTS?.[id];
    if (!token) return;

    token.options.healthauratype = settings.healthauratype;
    token.options.enablepercenthpbar = settings.enablepercenthpbar;
    token.options.disableaura = settings.disableaura;
    token.options.hidehpbar = settings.hidehpbar;

    token.place_sync_persist();

    console.log("setSelectedTokenHealthVisual:", {
      token: token.options?.name,
      visual,
      healthauratype: token.options.healthauratype,
      enablepercenthpbar: token.options.enablepercenthpbar,
      disableaura: token.options.disableaura,
      hidehpbar: token.options.hidehpbar
    });
  });

  return true;
}


function setSelectedTokenStyle(style) {
  const tokenStyle = String(style || "");

  if (!AVTT_TOKEN_STYLES.has(tokenStyle)) {
    console.warn("Invalid token style:", style);
    return false;
  }

  const tokenIds = [...(CURRENTLY_SELECTED_TOKENS || [])];

  if (!tokenIds.length) {
    console.warn("No selected tokens to restyle.");
    return false;
  }

  tokenIds.forEach(id => {
    const token = window.TOKEN_OBJECTS?.[id];
    if (!token) return;

    token.options.tokenStyleSelect = tokenStyle;

    // AboveVTT also uses this legacy boolean for square tokens.
    token.options.square = tokenStyle === "square";

    token.place_sync_persist();

    console.log("setSelectedTokenStyle:", {
      token: token.options?.name,
      tokenStyleSelect: token.options.tokenStyleSelect
    });
  });

  return true;
}


function setSelectedTokenSize(sizeSquares) {
  const newSize = Number(sizeSquares);

  if (![0.5, 1, 2, 3, 4].includes(newSize)) {
    console.warn("Invalid token size:", sizeSquares);
    return false;
  }

  const tokenIds = [...(CURRENTLY_SELECTED_TOKENS || [])];

  if (!tokenIds.length) {
    console.warn("No selected tokens to resize.");
    return false;
  }

  for (const tokenId of tokenIds) {
    const token = TOKEN_OBJECTS?.[tokenId];
    if (!token) continue;

    token.options.gridSquares = newSize;
    token.options.tokenSize = newSize;
    token.options.imageSize = 1;
    token.options.size = CURRENT_SCENE_DATA.hpps * newSize;

    token.throttlePlace?.();
    token.debounceSyncMessage?.();

    console.log("Resized token:", token.options?.name, newSize);
  }

  do_draw_selected_token_bounding_box?.();
  draw_selected_token_bounding_box?.();

  return true;
}

function selectTokenByName(tokenName) {
  const wanted = String(tokenName || "").trim().toLowerCase();
  if (!wanted) return false;

  const entry = Object.entries(TOKEN_OBJECTS || {}).find(([id, token]) =>
    String(token.options?.name || "").trim().toLowerCase() === wanted
  );

  if (!entry) {
    console.warn("selectTokenByName: token not found", tokenName);
    return false;
  }

  const [tokenId, token] = entry;

  try {
    deselect_all_tokens?.();

    CURRENTLY_SELECTED_TOKENS.splice(0, CURRENTLY_SELECTED_TOKENS.length, tokenId);
    token.selected = true;

    do_draw_selected_token_bounding_box?.();
    draw_selected_token_bounding_box?.();

    const tokenLeft = parseFloat(token.options?.left || "0");
    const tokenTop = parseFloat(token.options?.top || "0");
    const tokenSize = Number(token.options?.size || 100);

    const mapX = tokenLeft + tokenSize / 2;
    const mapY = tokenTop + tokenSize / 2;
    const viewPoint = convert_point_from_map_to_view(mapX, mapY);
    const center = center_of_view();

    const centerOffsetX = center.x - window.scrollX;
    const centerOffsetY = center.y - window.scrollY;

    window.scrollTo({
      left: Math.max(0, viewPoint.x - centerOffsetX),
      top: Math.max(0, viewPoint.y - centerOffsetY),
      behavior: "smooth"
    });

    console.log("Selected and centered token:", token.options?.name, tokenId);
    return true;
  } catch (err) {
    console.error("selectTokenByName error:", err);
    return false;
  }
}
window.addEventListener("message", (event) => {
  if (event.data?.type !== "AVTT_BRIDGE_ROLL") return;

  const roll = event.data.roll;
  console.log("AVTT injected roll:", roll);

  // Use AboveVTT's native DiceRoll path so 3D dice and pending/fulfilled messages work.
  const diceRoll = new DiceRoll(
    roll.expression,
    roll.action || "Stream Deck",
    roll.rollType === "custom" ? "roll" : (roll.rollType || "roll"),
    roll.displayName || window.PLAYER_NAME || "Stream Deck",
    roll.imgUrl || window.PLAYER_IMG || undefined,
    roll.entityType || undefined,
    roll.entityId || undefined
  );

  if (roll.damageType) {
    window.diceRoller.roll(
      diceRoll,
      undefined,
      undefined,
      undefined,
      undefined,
      roll.damageType
    );
  } else {
    window.diceRoller.roll(diceRoll);
  }
});

window.addEventListener("message", (event) => {
  if (event.data?.type !== "AVTT_BRIDGE_COMMAND") return;

  const cmd = event.data.command;
  console.log("AVTT injected command:", cmd);

  if (cmd.command === "selectToken") {
    selectTokenByName(cmd.tokenName);
    return;
  }

  if (cmd.command === "applyTokenImage") {
    applySelectedTokenImage(cmd.imageUrl);
    return;
  }

  if (cmd.command === "resetTokenImage") {
    resetSelectedTokenImage();
    return;
  }

  if (cmd.command === "setTokenHealthVisual") {
    setSelectedTokenHealthVisual(cmd.visual);
    return;
  }

  if (cmd.command === "setTokenStyle") {
    setSelectedTokenStyle(cmd.style);
    return;
  }

  if (cmd.command === "setSelectedTokenSize") {
    setSelectedTokenSize(cmd.size);
    return;
  }

  if (cmd.command === "sendTextToGamelog") {
    try {
      const title = cmd.title || "";
      const text = cmd.text || "";
      const headerStyle = cmd.headerStyle || "simple";

      const escapeHtml = (value) => String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

      const safeTitle = escapeHtml(title);
      const safeText = escapeHtml(text).replace(/\n/g, "<br>");

      const wrapStyle = "display:block;width:100%;text-align:left !important;";
      const titleStyle = "display:block;width:100%;text-align:left !important;font-weight:bold;font-size:16px;margin:0 0 6px 0;padding:0;";
      const bodyStyle = "display:block;width:100%;text-align:left !important;font-size:13px;line-height:1.35;margin:0;padding:0;";

      let html = "";

      if (headerStyle === "none" || !safeTitle) {
        html = `
          <div style="${wrapStyle}">
            <div style="${bodyStyle}">${safeText}</div>
          </div>
        `;
      } else if (headerStyle === "bar") {
        html = `
          <div style="${wrapStyle}">
            <div style="${titleStyle}background:#8b1e1e;color:white;padding:6px 8px;border-radius:6px 6px 0 0;">
              ${safeTitle}
            </div>
            <div style="${bodyStyle};padding-top:8px;">${safeText}</div>
          </div>
        `;
      } else if (headerStyle === "warning") {
        html = `
          <div style="${wrapStyle}">
            <div style="${titleStyle}background:#3b0f0f;color:#ffd0d0;padding:6px 8px;border-left:4px solid #d22;">
              ${safeTitle}
            </div>
            <div style="${bodyStyle};padding-top:8px;">${safeText}</div>
          </div>
        `;
      } else if (headerStyle === "readaloud") {
        html = `
          <div style="${wrapStyle}background:#f3ead6;color:#2a1a10;border:1px solid #b59b6a;border-radius:6px;padding:10px;">
            <div style="${titleStyle}border-bottom:1px solid #b59b6a;padding-bottom:4px;margin-bottom:8px;">
              ${safeTitle}
            </div>
            <div style="${bodyStyle}">${safeText}</div>
          </div>
        `;
      } else {
        html = `
          <div style="${wrapStyle}">
            <div style="${titleStyle}border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:8px;">
              ${safeTitle}
            </div>
            <div style="${bodyStyle}">${safeText}</div>
          </div>
        `;
      }

      send_html_to_gamelog(html);

      console.log("sendTextToGamelog:", { title, text, headerStyle });
    } catch (err) {
      console.error("sendTextToGamelog error:", err);
    }

    return;
  }

  if (cmd.command === "openGameLogTab") {
    $("#switch_gamelog").trigger("click");
    return;
  }

  if (cmd.command === "openTokensTab") {
    $("#switch_tokens").trigger("click");
    return;
  }

  if (cmd.command === "openScenesTab") {
    $("#switch_scenes").trigger("click");
    return;
  }

  if (cmd.command === "openSoundsTab") {
    $("#switch_sounds").trigger("click");
    return;
  }

  if (cmd.command === "openJournalTab") {
    $("#switch_journal").trigger("click");
    return;
  }

  if (cmd.command === "openSettingsTab") {
    $("#switch_settings").trigger("click");
    return;
  }

  if (cmd.command === "zoomIn") {
    change_zoom(ZOOM * 1.1);
    return;
  }

  if (cmd.command === "zoomOut") {
    change_zoom(ZOOM / 1.1);
    return;
  }

  if (cmd.command === "toggleDaylight") {
    const sceneKey = Object.keys(window.ScenesHandler.scenes)
      .find(k => window.ScenesHandler.scenes[k]?.id === CURRENT_SCENE_DATA.id);

    edit_scene_vision_settings(sceneKey);

    setTimeout(() => {
      const newValue =
        CURRENT_SCENE_DATA.daylight === "transparent"
          ? "rgba(255, 255, 255, 1)"
          : "transparent";

      document.querySelector('input[name="daylight"]').value = newValue;
      CURRENT_SCENE_DATA.daylight = newValue;

      [...document.querySelectorAll("button")]
        .find(b => b.innerText === "Save")
        ?.click();
    }, 500);

    return;
  }

  if (cmd.command === "toggleLight") {
    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS?.[id];
      if (!token) return;

      const light1 = token.options.light1 || {};
      const light2 = token.options.light2 || {};

      const isOn =
        Number(light1.feet || 0) > 0 ||
        Number(light2.feet || 0) > 0;

      token.options.animation = {
        ...(typeof token.options.animation === "object"
          ? token.options.animation
          : {})
      };

      if (isOn) {
        token.options.animation.previousLight1 = {
          ...light1
        };

        token.options.animation.previousLight2 = {
          ...light2
        };

        token.options.light1 = {
          ...light1,
          feet: "0"
        };

        token.options.light2 = {
          ...light2,
          feet: "0"
        };
      } else {
        const previousLight1 =
          token.options.animation.previousLight1;

        const previousLight2 =
          token.options.animation.previousLight2;

        token.options.light1 = previousLight1
          ? { ...previousLight1 }
          : {
              feet: "20",
              color: "rgba(255, 255, 255, 1)"
            };

        token.options.light2 = previousLight2
          ? { ...previousLight2 }
          : {
              feet: "20",
              color: "rgba(142, 142, 142, 1)"
            };
      }

      token.place_sync_persist();

      console.log("toggleLight:", {
        token: token.options?.name,
        light1: token.options.light1,
        light2: token.options.light2
      });
    });

    return;
  }

  if (cmd.command === "toggleLightPreset") {
    const preset = cmd.preset;

    if (!preset) {
      console.warn("toggleLightPreset: missing preset");
      return;
    }

    const normalize = value => ({
      feet: String(value?.feet ?? "0"),
      color: String(
        value?.color ??
        "rgba(142, 142, 142, 1)"
      )
    });

    const presetLight1 = normalize(preset.light1);
    const presetLight2 = normalize(preset.light2);

    const animationPreset = cmd.animationPreset || null;

    const customMask = String(
      cmd.customLightMask ||
      animationPreset?.mask ||
      ""
    ).trim();

    const customRotate =
      cmd.customLightRotate === true ||
      animationPreset?.rotate === true;

    const customRpmValue =
      cmd.customLightRpm ??
      animationPreset?.rpm;

    const customRpm =
      customRpmValue !== undefined &&
      customRpmValue !== null &&
      String(customRpmValue).trim() !== ""
        ? String(customRpmValue)
        : "";

    const animationName = customMask
      ? (
          animationPreset?.name ||
          cmd.animationName ||
          "Custom Light"
        )
      : "";

    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS?.[id];
      if (!token) return;

      const currentLight1 = normalize(token.options.light1);
      const currentLight2 = normalize(token.options.light2);
      const currentAnimation =
        typeof token.options.animation === "object"
          ? token.options.animation
          : {};

      const animationMatches = customMask
        ? (
            String(currentAnimation.light || "") ===
              String(animationName) &&
            String(currentAnimation.customLightMask || "") ===
              customMask &&
            currentAnimation.customLightRotate === customRotate &&
            String(currentAnimation.customLightRpm || "") ===
              customRpm
          )
        : (
            !currentAnimation.customLightMask &&
            !currentAnimation.light
          );

      const alreadyApplied =
        currentLight1.feet === presetLight1.feet &&
        currentLight1.color === presetLight1.color &&
        currentLight2.feet === presetLight2.feet &&
        currentLight2.color === presetLight2.color &&
        animationMatches;

      if (alreadyApplied) {
        token.options.animation = {
          ...(typeof token.options.animation === "object"
            ? token.options.animation
            : {}),
          previousLight1: { ...presetLight1 },
          previousLight2: { ...presetLight2 }
        };

        token.options.light1 = {
          ...presetLight1,
          feet: "0"
        };

        token.options.light2 = {
          ...presetLight2,
          feet: "0"
        };
      } else {
        token.options.light1 = { ...presetLight1 };
        token.options.light2 = { ...presetLight2 };

        token.options.animation = {
          ...(typeof token.options.animation === "object"
            ? token.options.animation
            : {}),
          previousLight1: { ...presetLight1 },
          previousLight2: { ...presetLight2 }
        };

        if (customMask) {
          token.options.animation.light = animationName;

          token.options.animation.customLightMask =
            customMask;

          token.options.animation.customLightRotate =
            customRotate;

          if (customRpm) {
            token.options.animation.customLightRpm =
              customRpm;
          } else {
            delete token.options.animation.customLightRpm;
          }
        } else {
          delete token.options.animation.light;
          delete token.options.animation.customLightMask;
          delete token.options.animation.customLightRotate;
          delete token.options.animation.customLightRpm;
          delete token.options.animation.customLightDarkvision;
        }
      }

      token.place_sync_persist();

      console.log("toggleLightPreset:", {
        token: token.options?.name,
        preset: preset.name,
        alreadyApplied,
        light1: token.options.light1,
        light2: token.options.light2,
        animation: token.options.animation
      });
    });

    return;
  }

  if (cmd.command === "toggleVisionType") {
    const allowedSenses = new Set([
      "vision",
      "truesight",
      "devilsight"
    ]);

    const sense = String(cmd.sense || "");

    if (!allowedSenses.has(sense)) {
      console.warn("toggleVisionType: invalid sense", sense);
      return;
    }

    const feet = String(cmd.feet ?? "0");
    const color = String(
      cmd.color || "rgba(142, 142, 142, 1)"
    );

    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS?.[id];
      if (!token) return;

      const current = token.options[sense] || {
        feet: "0",
        color
      };

      const alreadyApplied =
        Number(current.feet || 0) > 0 &&
        String(current.feet) === feet &&
        String(current.color || "") === color;

      token.options[sense] = alreadyApplied
        ? {
            ...current,
            feet: "0"
          }
        : {
            feet,
            color
          };

      token.place_sync_persist();

      console.log("toggleVisionType:", {
        token: token.options?.name,
        sense,
        alreadyApplied,
        value: token.options[sense]
      });
    });

    return;
  }

  if (cmd.command === "toggleAura") {
    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS[id];
      if (!token) return;

      token.options.auraVisible = !token.options.auraVisible;
      token.place_sync_persist();

      console.log("toggleAura:", {
        token: token.options?.name,
        auraVisible: token.options.auraVisible
      });
    });

    return;
  }

  if (cmd.command === "toggleAuraPreset") {
    const preset = cmd.preset;

    if (!preset) {
      console.warn("toggleAuraPreset: missing preset");
      return;
    }

    const normalizeAura = aura => ({
      feet: String(aura?.feet ?? "0"),
      color: String(aura?.color ?? "rgba(0, 0, 0, 0)")
    });

    const presetAura1 = normalizeAura(preset.aura1);
    const presetAura2 = normalizeAura(preset.aura2);
    const presetAnimation = preset.animation || "";

    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS[id];
      if (!token) return;

      const tokenAura1 = normalizeAura(token.options.aura1);
      const tokenAura2 = normalizeAura(token.options.aura2);
      const tokenAnimation =
        token.options.animation?.aura ||
        token.options.animation ||
        "";

      const alreadyApplied =
        token.options.auraVisible === true &&
        tokenAura1.feet === presetAura1.feet &&
        tokenAura1.color === presetAura1.color &&
        tokenAura2.feet === presetAura2.feet &&
        tokenAura2.color === presetAura2.color &&
        String(tokenAnimation || "") === String(presetAnimation || "");

      if (alreadyApplied) {
        token.options.auraVisible = false;
      } else {
        token.options.aura1 = { ...presetAura1 };
        token.options.aura2 = { ...presetAura2 };
        token.options.auraVisible = true;

        const customAuraMask = String(cmd.customAuraMask || "").trim();

        token.options.animation = {
          ...(typeof token.options.animation === "object" ? token.options.animation : {}),
          aura: presetAnimation || token.options.animation?.aura || "none"
        };

        if (customAuraMask) {
          token.options.animation.customAuraMask = customAuraMask;
          token.options.animation.customAuraRotate = cmd.customAuraRotate === true;
        } else {
          delete token.options.animation.customAuraMask;
          delete token.options.animation.customAuraRotate;
        }
      }

      token.place_sync_persist();

      console.log("toggleAuraPreset:", {
        token: token.options?.name,
        preset: preset.name,
        alreadyApplied,
        auraVisible: token.options.auraVisible
      });
    });

    return;
  }

  if (cmd.command === "toggleCondition") {
    const mode = cmd.mode || "condition";
    const condition = String(cmd.condition || "Prone");

    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS[id];
      if (!token) return;

      if (mode === "customMarker") {
        const color = String(cmd.markerColor || "#ff0000");
        const text = String(cmd.markerText || condition || "").trim();

        const customConditions = token.options.custom_conditions || [];
        const existing = customConditions.find(c =>
          String(c.name || "").toLowerCase() === color.toLowerCase()
        );

        if (!existing) {
          token.addCondition(color, text);
        } else if (String(existing.text || "") === text) {
          token.removeCondition(color);
        } else {
          token.removeCondition(color);
          token.addCondition(color, text);
        }

        token.place_sync_persist();

        console.log("toggleCustomMarker:", {
          color,
          text
        });

        return;
      }

      const nativeConditions = token.options.conditions || [];
      const customConditions = token.options.custom_conditions || [];

      const hasNativeCondition = nativeConditions.some(c => {
        const name = typeof c === "string" ? c : c.name;
        return String(name || "").toLowerCase() === condition.toLowerCase();
      });

      const hasCustomCondition = customConditions.some(c => {
        const name = typeof c === "string" ? c : c.name || c.text;
        return String(name || "").toLowerCase() === condition.toLowerCase();
      });

      if (hasNativeCondition || hasCustomCondition) {
        token.removeCondition(condition);
      } else {
        token.addCondition(condition);
      }

      token.place_sync_persist();
    });

    console.log("toggleCondition:", condition);
    return;
  }

  if (cmd.command === "toggleMarker") {
    const color = cmd.color || "#ff0000";
    const text = cmd.text || "Marked";

    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS[id];
      if (!token) return;

      const customConditions = token.options.custom_conditions || [];

      const exactMatch = customConditions.find(c =>
        c.name === color && c.text === text
      );

      if (exactMatch) {
        token.removeCondition(color);
      } else {
        token.addCondition(color, text);
      }

      token.place_sync_persist();
    });

    return;
  }

  if (cmd.command === "clearMarkers") {
    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS[id];
      if (!token) return;

      const customConditions = [...(token.options.custom_conditions || [])];
      customConditions.forEach(condition => {
        token.removeCondition(condition.name);
      });

      const nativeConditions = [...(token.options.conditions || [])];
      nativeConditions.forEach(condition => {
        const name = typeof condition === "string" ? condition : condition.name;
        if (name) token.removeCondition(name);
      });

      token.place_sync_persist();
    });

    return;
  }

  if (cmd.command === "nextInitiative") {
    const rows = [...document.querySelectorAll("#combat_area tr.CTToken")];
    if (!rows.length) return;

    const currentIndex = rows.findIndex(r => r.getAttribute("data-current") === "1");
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % rows.length;

    rows.forEach(r => r.removeAttribute("data-current"));
    rows[nextIndex].setAttribute("data-current", "1");

    update_carousel_combat_tracker?.();
    update_peer_communication_with_combat_tracker_data?.();

    console.log("AVTT next initiative:", rows[nextIndex].getAttribute("data-name"));
    return;
  }

  if (cmd.command === "previousInitiative") {
    const rows = [...document.querySelectorAll("#combat_area tr.CTToken")];
    if (!rows.length) return;

    const currentIndex = rows.findIndex(r => r.getAttribute("data-current") === "1");
    const prevIndex = currentIndex === -1
      ? rows.length - 1
      : (currentIndex - 1 + rows.length) % rows.length;

    rows.forEach(r => r.removeAttribute("data-current"));
    rows[prevIndex].setAttribute("data-current", "1");

    update_carousel_combat_tracker?.();
    update_peer_communication_with_combat_tracker_data?.();

    console.log("AVTT previous initiative:", rows[prevIndex].getAttribute("data-name"));
    return;
  }

  if (cmd.command === "rollSelectedAbility") {
    (async () => {
      try {
        const ability = (cmd.ability || "str").toLowerCase();
        const label = cmd.label || `{name} ${ability.toUpperCase()} Check`;

        window.postMessage({
          type: "AVTT_BRIDGE_COMMAND",
          command: {
            command: "rollSelectedFormula",
            formula: `1d20 + {${ability}}`,
            label,
            rollType: "check"
          }
        }, "*");
      } catch (err) {
        console.error("rollSelectedAbility error:", err);
      }
    })();

    return;
  }

  if (cmd.command === "rollSelectedFormula") {
    (async () => {
      try {
        const formula = cmd.formula || "1d20";
        const label = cmd.label || "Selected Token Roll";

        const needsSelectedToken = /\{[^}]+\}/.test(formula) || /\{[^}]+\}/.test(label);

        if (needsSelectedToken && !(await window.AVTTBridge.refresh())) {
          console.warn("rollSelectedFormula: no selected monster/token");
          return;
        }

        const expression = needsSelectedToken
          ? window.AVTTBridge.resolveFormula(formula)
          : formula.replace(/\s+/g, "");

        const action = needsSelectedToken
          ? window.AVTTBridge.resolveLabel(label)
          : label;

        const roll = {
          expression,
          rollType: cmd.rollType || "check",
          action
        };

        console.log("rollSelectedFormula sending roll:", {
          formula,
          expression,
          label: action
        });

        window.postMessage({
          type: "AVTT_BRIDGE_ROLL",
          roll
        }, "*");
      } catch (err) {
        console.error("rollSelectedFormula error:", err);
      }
    })();

    return;
  }

  if (cmd.command === "rollSelectedAction") {
    (async () => {
      try {
        const part = cmd.part || "all";
        const slot = cmd.slot ? Number(cmd.slot) : null;
        const actionName = cmd.action;

        const tokenId = CURRENTLY_SELECTED_TOKENS?.[0];
        const token = TOKEN_OBJECTS?.[tokenId];

        if (!token) {
          console.warn("rollSelectedAction: no selected token");
          return;
        }

        const monsterId = token.options.monster || token.options.stat || token.options.itemId;
        let monster = cached_monster_items?.[monsterId]?.monsterData;

        if (!monster) {
          open_selected_token_stat?.();
          await new Promise(resolve => setTimeout(resolve, 2500));
          monster = cached_monster_items?.[monsterId]?.monsterData;
        }

        if (!monster) {
          console.warn("rollSelectedAction: no monster data found", monsterId);
          return;
        }

        const allRolls = actionRolls;

        const actionNames = [...new Set(allRolls.map(r => r.name).filter(Boolean))];

        const selectedAction = slot
          ? actionNames[slot - 1]
          : actionName;

        const rolls = allRolls
          .filter(r => !selectedAction || r.name === selectedAction)
          .filter(r => {
            if (part === "all") return true;
            if (part === "attack") return r.rollType === "to hit";
            if (part === "damage") return r.rollType === "damage";
            return true;
          });

        if (!rolls.length) {
          console.warn("rollSelectedAction: no matching rolls", {
            slot,
            selectedAction,
            part,
            available: actionNames
          });
          return;
        }

        rolls.forEach((r, i) => {
          setTimeout(() => {
            window.postMessage({
              type: "AVTT_BRIDGE_ROLL",
              roll: {
                expression: r.expression,
                rollType: r.rollType,
                action: `${monster.name} ${r.name}`,
                damageType: r.damageType || undefined
              }
            }, "*");
          }, i * 500);
        });

        console.log("rollSelectedAction:", {
          token: monster.name,
          slot,
          selectedAction,
          part,
          rolls
        });
      } catch (err) {
        console.error("rollSelectedAction error:", err);
      }
    })();

    return;
  }

  if (cmd.command === "getSelectedTokenInfo") {
    (async () => {
      try {
        const tokenId = CURRENTLY_SELECTED_TOKENS?.[0];
        const token = TOKEN_OBJECTS?.[tokenId];

        if (!token) {
          window.postMessage({
            type: "AVTT_SELECTED_TOKEN_INFO",
            tokenInfo: null
          }, "*");
          return;
        }

        const monsterId = token.options.monster || token.options.stat || token.options.itemId;
        let monster = cached_monster_items?.[monsterId]?.monsterData;

        if (!monster) {
          open_selected_token_stat?.();
          await new Promise(resolve => setTimeout(resolve, 2500));
          monster = cached_monster_items?.[monsterId]?.monsterData;
        }

        const actionRolls = monster
          ? [...new DOMParser()
              .parseFromString(monster.actionsDescription || "", "text/html")
              .querySelectorAll("[data-dicenotation]")]
              .map(el => ({
                name: el.getAttribute("data-rollaction"),
                expression: el.getAttribute("data-dicenotation"),
                rollType: el.getAttribute("data-rolltype"),
                damageType: el.getAttribute("data-rolldamagetype")
              }))
          : [];

        const actionNames = [...new Set(actionRolls.map(r => r.name).filter(Boolean))];

        const tokenInfo = {
          tokenId,
          name: token.options.name || monster?.name || "Selected Token",
          hp: token.options.hitPointInfo?.current ?? token.options.hp ?? null,
          maxHp: token.options.hitPointInfo?.maximum ?? token.options.max_hp ?? null,
          ac: token.options.armorClass ?? monster?.armorClass ?? null,
          actions: actionNames.map((name, index) => ({
            slot: index + 1,
            name
          }))
        };

        window.postMessage({
          type: "AVTT_SELECTED_TOKEN_INFO",
          tokenInfo
        }, "*");

        console.log("getSelectedTokenInfo:", tokenInfo);
      } catch (err) {
        console.error("getSelectedTokenInfo error:", err);
      }
    })();

    return;
  }

if (cmd.command === "getSelectedActions") {
  (async () => {

    if (!(await window.AVTTBridge.refresh())) {
      window.postMessage({
        type: "AVTT_SELECTED_ACTIONS",
        actions: []
      }, "*");
      return;
    }

    window.postMessage({
      type: "AVTT_SELECTED_ACTIONS",
      actions: window.AVTTBridge.actionNames.map((name, i) => ({
        slot: i + 1,
        name
      }))
    }, "*");

    console.log(
      "getSelectedActions:",
      window.AVTTBridge.actionNames
    );

  })();

  return;
}

});