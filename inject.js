
function tokenToState(
  tokenId,
  token,
  pcData = null
) {
  const hpInfo =
    token.options?.hitPointInfo || {};

  const walkingSpeed =
    pcData?.speeds?.find(
      speed =>
        speed.name === "Walking"
    )?.distance;

  const abilities =
    Array.isArray(pcData?.abilities)
      ? pcData.abilities
      : [];

  const pcEffects =
    token.options?.avttPcEffects &&
    typeof token.options.avttPcEffects ===
      "object"
      ? token.options.avttPcEffects
      : {};

  function applyEffects(
    baseValue,
    effects
  ) {
    let value =
      Number(baseValue);

    if (!Number.isFinite(value)) {
      value = 0;
    }

    const entries =
      Array.isArray(effects)
        ? effects
        : [];

    // Apply the newest SET effect first.
    const setEffects =
      entries.filter(effect =>
        effect?.operation === "set"
      );

    if (setEffects.length) {
      const newestSet =
        [...setEffects].sort(
          (a, b) =>
            Number(a?.updatedAt || 0) -
            Number(b?.updatedAt || 0)
        ).at(-1);

      const setValue =
        Number(newestSet?.value);

      if (Number.isFinite(setValue)) {
        value = setValue;
      }
    }

    // Apply all remaining effects in stored order.
    entries
      .filter(effect =>
        effect?.operation !== "set"
      )
      .forEach(effect => {
        const amount =
          Number(effect?.value);

        if (!Number.isFinite(amount)) {
          return;
        }

        switch (effect?.operation) {
          case "add":
            value += amount;
            break;

          case "subtract":
            value -= amount;
            break;

          case "multiply":
            value *= amount;
            break;

          case "divide":
            if (amount !== 0) {
              value /= amount;
            }
            break;
        }
      });

    return value;
  }

  function findAbility(
    name,
    abbreviation
  ) {
    const ability =
      abilities.find(entry => {
        const entryName =
          String(entry?.name || "")
            .toLowerCase();

        const entryAbbreviation =
          String(
            entry?.abbreviation ||
            entry?.shortName ||
            ""
          ).toLowerCase();

        return (
          entryName ===
            name.toLowerCase() ||
          entryName ===
            abbreviation.toLowerCase() ||
          entryAbbreviation ===
            abbreviation.toLowerCase()
        );
      });

    const score =
      Number(
        ability?.score ??
        ability?.value ??
        ability?.totalScore ??
        10
      );

    const calculatedModifier =
      Math.floor(
        (score - 10) / 2
      );

    const modifier =
      Number(
        ability?.modifier ??
        ability?.mod ??
        calculatedModifier
      );

    return {
      score:
        Number.isFinite(score)
          ? score
          : 10,

      modifier:
        Number.isFinite(modifier)
          ? modifier
          : calculatedModifier,

      raw:
        ability || null
    };
  }

  function highestNumericValue(entries) {
    const values =
      (
        Array.isArray(entries)
          ? entries
          : []
      )
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

  const baseAbilities = {
    STR:
      findAbility(
        "Strength",
        "STR"
      ),

    DEX:
      findAbility(
        "Dexterity",
        "DEX"
      ),

    CON:
      findAbility(
        "Constitution",
        "CON"
      ),

    INT:
      findAbility(
        "Intelligence",
        "INT"
      ),

    WIS:
      findAbility(
        "Wisdom",
        "WIS"
      ),

    CHA:
      findAbility(
        "Charisma",
        "CHA"
      )
  };

  const baseAbilitySaves = {};

  const abilityDefinitions = {
    STR: ["str", "strength"],
    DEX: ["dex", "dexterity"],
    CON: ["con", "constitution"],
    INT: ["int", "intelligence"],
    WIS: ["wis", "wisdom"],
    CHA: ["cha", "charisma"]
  };

  Object.entries(
    abilityDefinitions
  ).forEach(
    ([shortName, names]) => {
      const [code, fullName] =
        names;

      const ability =
        baseAbilities[shortName];

      const savingThrow =
        Array.isArray(
          pcData?.savingThrows
        )
          ? pcData.savingThrows.find(
              entry => {
                const entryName =
                  String(
                    entry?.name ||
                    entry?.ability ||
                    entry?.stat ||
                    ""
                  ).toLowerCase();

                return (
                  entryName === code ||
                  entryName === fullName
                );
              }
            )
          : null;

      const directValue =
        pcData?.[`${code}Save`] ??
        pcData?.[`${fullName}Save`] ??
        ability.raw?.save ??
        ability.raw?.saveModifier ??
        ability.raw?.savingThrow ??
        savingThrow?.modifier ??
        savingThrow?.value ??
        savingThrow?.bonus;

      const numeric =
        Number(
          directValue ??
          ability.modifier
        );

      baseAbilitySaves[shortName] =
        Number.isFinite(numeric)
          ? numeric
          : ability.modifier;
    }
  );

  const overriddenAbilities = {};

  Object.entries(
    baseAbilities
  ).forEach(
    ([abilityName, ability]) => {
      const score =
        Math.max(
          1,
          Math.round(
            applyEffects(
              ability.score,
              pcEffects[abilityName]
            )
          )
        );

      overriddenAbilities[
        abilityName
      ] = {
        score,

        modifier:
          Math.floor(
            (score - 10) / 2
          )
      };
    }
  );

  const overriddenAbilitySaves = {};

  Object.entries(
    baseAbilitySaves
  ).forEach(
    ([abilityName, baseSave]) => {
      const oldModifier =
        baseAbilities[abilityName]
          ?.modifier ?? 0;

      const newModifier =
        overriddenAbilities[abilityName]
          ?.modifier ?? oldModifier;

      overriddenAbilitySaves[
        abilityName
      ] =
        Number(baseSave || 0) +
        (
          newModifier -
          oldModifier
        );
    }
  );

  const baseArmorClass =
    Number(
      token.options?.armorClass ??
      pcData?.armorClass ??
      0
    );

  const baseSpeed =
    Number(
      walkingSpeed ??
      token.options?.speed ??
      token.options?.speeds?.walk ??
      token.options?.speeds?.walking ??
      0
    );

  const baseMaxHp =
    Number(
      hpInfo.maximum ??
      token.options?.max_hp ??
      0
    );

  const armorClass =
    Math.round(
      applyEffects(
        baseArmorClass,
        pcEffects.armorClass
      )
    );

  const speed =
    Math.max(
      0,
      Math.round(
        applyEffects(
          baseSpeed,
          pcEffects.speed
        )
      )
    );

  const maxHp =
    Math.max(
      1,
      Math.round(
        applyEffects(
          baseMaxHp,
          pcEffects.maxHp
        )
      )
    );

  const spellSaveDc =
    highestNumericValue(
      pcData?.castingInfo?.saveDcs
    );

  const spellAttackBonus =
    highestNumericValue(
      pcData?.castingInfo
        ?.spellAttacks
    );

  const proficiency =
    Number(
      pcData?.proficiencyBonus ?? 0
    );

  return {
    id:
      tokenId,

    name:
      token.options?.name ||
      "Token",

    itemType:
      token.options?.itemType ||
      "",

    hp:
      hpInfo.current ??
      token.options?.hp ??
      null,

    maxHp,

    tempHp:
      hpInfo.temp ??
      token.options?.temp_hp ??
      0,

    armorClass,

    speed,

    conditions:
      token.options?.conditions ||
      [],

    customConditions:
      token.options
        ?.custom_conditions ||
      [],

    deathSaveInfo: {
      successCount:
        Number(
          pcData?.deathSaveInfo
            ?.successCount ?? 0
        ),

      failCount:
        Number(
          pcData?.deathSaveInfo
            ?.failCount ?? 0
        )
    },

    spellSaveDc,
    spellAttackBonus,
    proficiencyBonus:
      proficiency,

    grappleDc:
      8 +
      overriddenAbilities.STR
        .modifier +
      proficiency,

    passivePerception:
      pcData?.passivePerception ??
      null,

    passiveInsight:
      pcData?.passiveInsight ??
      null,

    darkvision:
      Number(
        token.options?.vision
          ?.feet || 0
      ),

    abilities:
      overriddenAbilities,

    abilitySaves:
      overriddenAbilitySaves,

    pcEffects:
      structuredClone(
        pcEffects
      ),

    cardImage:
      null,

    cardImages:
      null
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

async function renderPlayerCard(
  pc,
  page = "combat"
) {
  const canvas =
    document.createElement("canvas");

  canvas.width = 144;
  canvas.height = 144;

  const ctx =
    canvas.getContext("2d");

  const hp =
    Number(pc.hp || 0);

  const maxHp =
    Number(pc.maxHp || 0);

  const tempHp =
    Number(pc.tempHp || 0);

  const ac =
    pc.armorClass ?? "?";

  const speed =
    pc.speed ?? "?";

  const background =
    "#EEE6D9";

  const darkText =
    "#2C2926";

  const mutedText =
    "#625C56";

  ctx.fillStyle =
    background;

  ctx.fillRect(
    0,
    0,
    144,
    144
  );

  function signedModifier(value) {
    const number =
      Number(value || 0);

    return number >= 0
      ? `+${number}`
      : String(number);
  }

  function drawPcName() {
    ctx.fillStyle =
      darkText;

    ctx.textAlign =
      "center";

    ctx.font =
      "bold 16px Arial";

    const name =
      String(
        pc.name || "PC"
      );

    const shortName =
      name.length > 18
        ? `${name.slice(0, 17)}…`
        : name;

    ctx.fillText(
      shortName,
      72,
      16
    );
  }

  function drawFooter() {
    ctx.fillStyle =
      "#292624";

    ctx.beginPath();

    ctx.roundRect(
      6,
      101,
      63,
      31,
      8
    );

    ctx.fill();

    ctx.beginPath();

    ctx.roundRect(
      75,
      101,
      63,
      31,
      8
    );

    ctx.fill();

    ctx.fillStyle =
      "#EEE6D9";

    ctx.font =
      "bold 15px Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      `🛡️ ${ac}`,
      38,
      122
    );

    ctx.fillText(
      `🏃 ${speed}`,
      106,
      122
    );
  }

  function drawDeathCircle(
    x,
    y,
    filled,
    color
  ) {
    ctx.beginPath();

    ctx.arc(
      x,
      y,
      8,
      0,
      Math.PI * 2
    );

    if (filled) {
      ctx.fillStyle =
        color;

      ctx.fill();
    } else {
      ctx.strokeStyle =
        "#77716B";

      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawReferencePage(rows) {
    const rowY = [
      31,
      72,
      113
    ];

    rows.forEach(
      ([label, value], index) => {
        const y =
          rowY[index];

        ctx.textAlign =
          "left";

        ctx.fillStyle =
          mutedText;

        ctx.font =
          "bold 15px Arial";

        ctx.fillText(
          String(label),
          11,
          y
        );

        ctx.textAlign =
          "right";

        ctx.fillStyle =
          darkText;

        ctx.font =
          "bold 27px Arial";

        ctx.fillText(
          String(value),
          133,
          y + 5
        );

        if (index < 2) {
          ctx.strokeStyle =
            "rgba(44, 41, 38, 0.18)";

          ctx.lineWidth = 1;

          ctx.beginPath();

          ctx.moveTo(
            11,
            y + 13
          );

          ctx.lineTo(
            133,
            y + 13
          );

          ctx.stroke();
        }
      }
    );

    ctx.textAlign =
      "center";
  }

  function drawAbilityTable(
    abilityNames,
    showSaves
  ) {
    const physicalPage =
      abilityNames[0] === "STR";

    const abilityBackground =
      physicalPage
        ? "#EEE6D9"
        : "#D8D9D1";

    const resultBackground =
      physicalPage
        ? "#DED3CD"
        : "#D8D9D1";

    const abilityText =
      "#292624";

    const resultText =
      "#292624";

    // Main rounded table background.
    ctx.fillStyle =
      abilityBackground;

    ctx.beginPath();

    ctx.roundRect(
      5,
      5,
      134,
      134,
      10
    );

    ctx.fill();

    // MOD/SAVE column background.
    ctx.save();

    ctx.beginPath();

    ctx.roundRect(
      5,
      5,
      134,
      134,
      10
    );

    ctx.clip();

    ctx.fillStyle =
      resultBackground;

    ctx.fillRect(
      94,
      5,
      45,
      134
    );

    ctx.restore();

    // Table dividers.
    ctx.strokeStyle =
      "rgba(41, 38, 36, 0.22)";

    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(10, 35);
    ctx.lineTo(134, 35);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(53, 35);
    ctx.lineTo(53, 134);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(94, 5);
    ctx.lineTo(94, 134);
    ctx.stroke();

    // MOD/SAVE centered across the entire table.
    ctx.fillStyle =
      resultText;

    ctx.textAlign =
      "center";

    ctx.font =
      "bold 14px Arial";

    ctx.fillText(
      showSaves
        ? "SAVE"
        : "MOD",
      72,
      24
    );

    const rowY = [
      61,
      96,
      131
    ];

    abilityNames.forEach(
      (abilityName, index) => {
        const ability =
          pc.abilities?.[abilityName] || {
            score: 10,
            modifier: 0
          };

        const save =
          pc.abilitySaves?.[abilityName] ??
          ability.save ??
          ability.modifier ??
          0;

        // Ability name.
        ctx.fillStyle =
          abilityText;

        ctx.textAlign =
          "left";

        ctx.font =
          "bold 18px Arial";

        ctx.fillText(
          abilityName,
          12,
          rowY[index]
        );

        // Ability score.
        ctx.fillStyle =
          abilityText;

        ctx.textAlign =
          "center";

        ctx.font =
          "bold 22px Arial";

        ctx.fillText(
          String(
            ability.score ?? 10
          ),
          74,
          rowY[index]
        );

        // Modifier or saving throw.
        ctx.fillStyle =
          resultText;

        ctx.textAlign =
          "center";

        ctx.font =
          "bold 22px Arial";

        ctx.fillText(
          signedModifier(
            showSaves
              ? save
              : ability.modifier
          ),
          116,
          rowY[index]
        );

        if (index < 2) {
          ctx.strokeStyle =
            "rgba(41, 38, 36, 0.16)";

          ctx.lineWidth = 1;

          ctx.beginPath();

          ctx.moveTo(
            10,
            rowY[index] + 10
          );

          ctx.lineTo(
            134,
            rowY[index] + 10
          );

          ctx.stroke();
        }
      }
    );

    ctx.textAlign =
      "center";
  }

  if (page === "reference1") {
    drawReferencePage([
      [
        "SPELL DC",
        pc.spellSaveDc || "—"
      ],
      [
        "PB",
        pc.proficiencyBonus != null
          ? signedModifier(
              pc.proficiencyBonus
            )
          : "—"
      ],
      [
        "GRAB. DC",
        pc.grappleDc ?? "—"
      ]
    ]);
  } else if (page === "reference2") {
    drawReferencePage([
      [
        "DARK VIS.",
        pc.darkvision ?? "—"
      ],
      [
        "PERCEP.",
        pc.passivePerception ?? "—"
      ],
      [
        "INSIGHT",
        pc.passiveInsight ?? "—"
      ]
    ]);
  } else if (
    page === "abilities1" ||
    page === "abilities1Save"
  ) {
    drawAbilityTable(
      [
        "STR",
        "DEX",
        "CON"
      ],
      page === "abilities1Save"
    );
  } else if (
    page === "abilities2" ||
    page === "abilities2Save"
  ) {
    drawAbilityTable(
      [
        "INT",
        "WIS",
        "CHA"
      ],
      page === "abilities2Save"
    );
  } else if (
    hp <= 0 &&
    maxHp > 0
  ) {
    drawPcName();

    const successes =
      Math.max(
        0,
        Math.min(
          3,
          Number(
            pc.deathSaveInfo
              ?.successCount || 0
          )
        )
      );

    const failures =
      Math.max(
        0,
        Math.min(
          3,
          Number(
            pc.deathSaveInfo
              ?.failCount || 0
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
        ? "#A43030"
        : successes >= 3
          ? "#356E96"
          : "#8A621E";

    ctx.textAlign =
      "center";

    ctx.font =
      "bold 18px Arial";

    ctx.fillText(
      status,
      72,
      37
    );

    ctx.font =
      "bold 20px Arial";

    ctx.fillStyle =
      "#327A45";

    ctx.fillText(
      "✓",
      28,
      62
    );

    ctx.fillStyle =
      "#A43030";

    ctx.fillText(
      "✕",
      28,
      89
    );

    [0, 1, 2].forEach(index => {
      const x =
        56 + index * 27;

      drawDeathCircle(
        x,
        56,
        index < successes,
        "#327A45"
      );

      drawDeathCircle(
        x,
        83,
        index < failures,
        "#A43030"
      );
    });

    drawFooter();
  } else {
    drawPcName();

    const pct =
      maxHp > 0
        ? Math.max(
            0,
            Math.min(
              1,
              hp / maxHp
            )
          )
        : 0;

    let hpColor =
      "#3F8A52";

    if (pct < 0.25) {
      hpColor =
        "#A43030";
    } else if (pct < 0.5) {
      hpColor =
        "#B6622C";
    } else if (pct < 0.75) {
      hpColor =
        "#9B751E";
    }

    ctx.fillStyle =
      "#CFC6B9";

    ctx.beginPath();

    ctx.roundRect(
      8,
      24,
      128,
      23,
      11
    );

    ctx.fill();

    ctx.fillStyle =
      hpColor;

    ctx.beginPath();

    ctx.roundRect(
      8,
      24,
      Math.max(
        6,
        Math.round(
          128 * pct
        )
      ),
      23,
      11
    );

    ctx.fill();

    if (tempHp > 0) {
      ctx.strokeStyle =
        "#357D98";

      ctx.lineWidth = 3;

      ctx.beginPath();

      ctx.roundRect(
        6,
        22,
        132,
        27,
        13
      );

      ctx.stroke();
    }

    ctx.fillStyle =
      darkText;

    ctx.textAlign =
      "center";

    ctx.font =
      "bold 30px Arial";

    ctx.fillText(
      `${hp}/${maxHp}`,
      72,
      82
    );

    if (tempHp > 0) {
      ctx.fillStyle =
        "#286B83";

      ctx.font =
        "bold 12px Arial";

      ctx.fillText(
        `+${tempHp} TEMP`,
        72,
        97
      );
    }

    drawFooter();
  }

  const pagePixel = {
    combat: 0,
    reference1: 1,
    reference2: 2,
    abilities1: 3,
    abilities2: 4,
    abilities1Save: 5,
    abilities2Save: 6
  };

  ctx.fillStyle =
    `rgba(${hp % 255}, ` +
    `${maxHp % 255}, ` +
    `${tempHp % 255}, 0.01)`;

  ctx.fillRect(
    pagePixel[page] ?? 0,
    0,
    1,
    1
  );

  return canvas.toDataURL(
    "image/png"
  );
}
function getInitiativeTrackerState() {
  const rows = [
    ...document.querySelectorAll(
      "#combat_area tr.CTToken"
    )
  ];

  const participants =
    rows.map((row, index) => {
      const initiativeInput =
        row.querySelector("input.init");

      const initiative =
        initiativeInput?.value !== ""
          ? Number(initiativeInput?.value)
          : null;

      return {
        index,

        name:
          row.getAttribute("data-name") ||
          "Unknown",

        tokenId:
          row.getAttribute("data-target") ||
          null,

        initiative:
          Number.isFinite(initiative)
            ? initiative
            : null,

        active:
          row.getAttribute(
            "data-current"
          ) === "1",

        type:
          row.hasAttribute("data-monster")
            ? "npc"
            : "pc"
      };
    });

  const activeIndex =
    participants.findIndex(
      participant =>
        participant.active
    );

  const roundInput =
    document.querySelector(
      "#round_number"
    );

  const round =
    Number(roundInput?.value);

  return {
    active:
      rows.length > 0,

    round:
      Number.isFinite(round)
        ? round
        : null,

    activeIndex,

    current:
      activeIndex >= 0
        ? participants[activeIndex]
        : null,

    participants
  };
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

      reference1:
        await renderPlayerCard(
          pc,
          "reference1"
        ),

      reference2:
        await renderPlayerCard(
          pc,
          "reference2"
        ),

      abilities1:
        await renderPlayerCard(
          pc,
          "abilities1"
        ),

      abilities2:
        await renderPlayerCard(
          pc,
          "abilities2"
        ),

      abilities1Save:
        await renderPlayerCard(
          pc,
          "abilities1Save"
        ),

      abilities2Save:
        await renderPlayerCard(
          pc,
          "abilities2Save"
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

      reference1:
        await renderPlayerCard(
          selectedTokenState,
          "reference1"
        ),

      reference2:
        await renderPlayerCard(
          selectedTokenState,
          "reference2"
        ),

      abilities1:
        await renderPlayerCard(
          selectedTokenState,
          "abilities1"
        ),

      abilities2:
        await renderPlayerCard(
          selectedTokenState,
          "abilities2"
        ),

      abilities1Save:
        await renderPlayerCard(
          selectedTokenState,
          "abilities1Save"
        ),

      abilities2Save:
        await renderPlayerCard(
          selectedTokenState,
          "abilities2Save"
        )
    };

    selectedTokenState.cardImage =
      selectedTokenState.cardImages.combat;
  }

  return {
    selected: Boolean(selectedToken),
    selectedToken: selectedTokenState,
    pcs,

    initiativeTracker:
      getInitiativeTrackerState(),

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

    const myTokens = (
      window.tokenListItems || []
    )
      .filter(item =>
        item?.type === "myToken"
      )
      .map(item => ({
        id: String(item.id || ""),
        name: String(item.name || ""),
        type: String(item.type || "myToken"),
        folderPath: String(item.folderPath || ""),
        path:
          typeof item.fullPath === "function"
            ? String(item.fullPath() || "")
            : [
                String(item.folderPath || "")
                  .replace(/\/$/, ""),
                String(item.name || "")
              ]
                .filter(Boolean)
                .join("/"),
        image: String(item.image || "")
      }))
      .filter(item =>
        item.name &&
        item.path
      )
      .sort((a, b) =>
        a.path.localeCompare(b.path)
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
      }),

      fetch("http://localhost:3000/my-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tokens: myTokens
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



const AVTT_ROLL_POPUP_STYLE_ID =
  "avtt-roll-popup-style";

const AVTT_ROLL_POPUP_CONTAINER_ID =
  "avtt-roll-popup-container";

const AVTT_ROLL_POPUP_DURATION_MS = 6000;
const AVTT_ROLL_POPUP_MAX_CARDS = 4;

const avttRecentRollPopupSignatures =
  new Map();

const avttRollPopupEntrySignatures =
  new WeakMap();

const avttRollPopupEntryTimers =
  new WeakMap();

function avttIsVisibleElement(element) {
  if (!element) return false;

  const style =
    window.getComputedStyle(element);

  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number(style.opacity || 1) === 0
  ) {
    return false;
  }

  const rect =
    element.getBoundingClientRect();

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function avttIsGameLogOpen() {
  const tab =
    document.querySelector("#switch_gamelog");

  if (
    !tab?.classList.contains("selected-tab")
  ) {
    return false;
  }

  const gameLogPanel =
    document.querySelector(
      "[class*='GameLogContainer']"
    );

  return avttIsVisibleElement(
    gameLogPanel
  );
}

function avttEnsureRollPopupStyles() {
  if (
    document.getElementById(
      AVTT_ROLL_POPUP_STYLE_ID
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    AVTT_ROLL_POPUP_STYLE_ID;

  style.textContent = `
    #${AVTT_ROLL_POPUP_CONTAINER_ID} {
      position: fixed;
      z-index: 999999;
      display: flex;
      flex-direction: column-reverse;
      align-items: flex-end;
      gap: 10px;
      width: min(320px, calc(100vw - 32px));
      pointer-events: none;
      transition:
        right 160ms ease,
        bottom 160ms ease;
    }

    .avtt-roll-popup-card {
      box-sizing: border-box;
      width: 100%;
      max-width: 320px;
      padding: 12px 14px;
      overflow: hidden;
      color: #ffffff;
      background:
        linear-gradient(
          135deg,
          rgba(28, 31, 38, 0.97),
          rgba(12, 14, 18, 0.97)
        );
      border:
        1px solid rgba(255, 255, 255, 0.18);
      border-left:
        5px solid #7799cc;
      border-radius: 9px;
      box-shadow:
        0 8px 26px rgba(0, 0, 0, 0.55);
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      cursor: pointer;
      pointer-events: auto;
      animation:
        avtt-roll-popup-enter 180ms ease-out;
    }

    .avtt-roll-popup-card[data-kind="damage"] {
      border-left-color: #e28a3b;
    }

    .avtt-roll-popup-card[data-kind="heal"] {
      border-left-color: #55b877;
    }

    .avtt-roll-popup-card[data-kind="critical"] {
      border-left-color: #e45151;
    }

    .avtt-roll-popup-card[data-kind="save"],
    .avtt-roll-popup-card[data-kind="check"] {
      border-left-color: #5d9ee8;
    }

    .avtt-roll-popup-card.avtt-roll-popup-leaving {
      opacity: 0;
      transform: translateX(24px);
      transition:
        opacity 180ms ease,
        transform 180ms ease;
    }

    .avtt-roll-popup-name {
      overflow: hidden;
      color: #d7dce5;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .avtt-roll-popup-label {
      margin-top: 4px;
      overflow: hidden;
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .avtt-roll-popup-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      margin-top: 6px;
    }

    .avtt-roll-popup-type {
      color: #aeb7c5;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .avtt-roll-popup-total {
      color: #ffffff;
      font-size: 32px;
      font-weight: 800;
      line-height: 0.95;
    }

    @keyframes avtt-roll-popup-enter {
      from {
        opacity: 0;
        transform: translateX(28px);
      }

      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `;

  document.head.appendChild(style);
}

function avttGetRollPopupContainer() {
  avttEnsureRollPopupStyles();

  let container =
    document.getElementById(
      AVTT_ROLL_POPUP_CONTAINER_ID
    );

  if (container) {
    return container;
  }

  container =
    document.createElement("div");

  container.id =
    AVTT_ROLL_POPUP_CONTAINER_ID;

  document.body.appendChild(container);

  avttPositionRollPopupContainer();

  return container;
}

function avttPositionRollPopupContainer() {
  const container =
    document.getElementById(
      AVTT_ROLL_POPUP_CONTAINER_ID
    );

  if (!container) return;

  let rightOffset = 22;
  let bottomOffset = 22;

  const visibleSidePanels = [
    ...document.querySelectorAll(
      [
        ".sidepanel-content",
        "[class*='sidepanel-content']"
      ].join(",")
    )
  ].filter(avttIsVisibleElement);

  visibleSidePanels.forEach(panel => {
    const rect =
      panel.getBoundingClientRect();

    const touchesRightEdge =
      rect.right >= window.innerWidth - 10;

    if (
      touchesRightEdge &&
      rect.width > 160
    ) {
      rightOffset = Math.max(
        rightOffset,
        window.innerWidth -
          rect.left +
          16
      );
    }
  });

  const popupLeft =
    window.innerWidth -
    rightOffset -
    320;

  const popupRight =
    window.innerWidth -
    rightOffset;

  const diceElements = [
    ...document.querySelectorAll(
      [
        ".dice-rolling-panel",
        ".dice-roller",
        "[class*='dice-rolling-panel']"
      ].join(",")
    )
  ].filter(avttIsVisibleElement);

  diceElements.forEach(element => {
    const rect =
      element.getBoundingClientRect();

    const horizontallyOverlaps =
      rect.right > popupLeft &&
      rect.left < popupRight;

    const isNearBottom =
      rect.bottom >
      window.innerHeight * 0.55;

    if (
      horizontallyOverlaps &&
      isNearBottom
    ) {
      bottomOffset = Math.max(
        bottomOffset,
        window.innerHeight -
          rect.top +
          18
      );
    }
  });

  container.style.right =
    `${Math.round(rightOffset)}px`;

  container.style.bottom =
    `${Math.round(bottomOffset)}px`;
}

function avttNormalizeRollPopupLines(entry) {
  return String(entry?.innerText || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
}

function avttParseRollPopupEntry(entry) {
  const lines =
    avttNormalizeRollPopupLines(entry);

  if (lines.length < 3) {
    return null;
  }

  const totalIndex =
    lines.findIndex(line =>
      /^-?\d+$/.test(line)
    );

  if (totalIndex < 0) {
    return null;
  }

  const total =
    lines[totalIndex];

  const beforeTotal =
    lines.slice(0, totalIndex);

  const rollWords = new Set([
    "ROLL",
    "CHECK",
    "SAVE",
    "TO HIT",
    "DAMAGE",
    "HEAL",
    "INITIATIVE",
    "RECHARGE"
  ]);

  const typeIndex =
    beforeTotal.findIndex(line =>
      rollWords.has(
        line.toUpperCase()
      )
    );

  if (typeIndex < 0) {
    return null;
  }

  const name =
    beforeTotal[0] ||
    "Roll";

  const type =
    beforeTotal[typeIndex] ||
    "ROLL";

  const ignoredLabels =
    new Set([
      "TO: SELF",
      "TO: EVERYONE",
      "CUSTOM"
    ]);

  const possibleLabels =
    beforeTotal
      .slice(1, typeIndex)
      .filter(line =>
        !ignoredLabels.has(
          line.toUpperCase()
        )
      );

  const label =
    possibleLabels.join(" ") ||
    type;

  const upperText =
    lines.join(" ").toUpperCase();

  let kind =
    type.toLowerCase()
      .replace(/\s+/g, "-");

  if (
    upperText.includes("CRITICAL")
  ) {
    kind = "critical";
  } else if (
    upperText.includes("DAMAGE")
  ) {
    kind = "damage";
  } else if (
    upperText.includes("HEAL")
  ) {
    kind = "heal";
  } else if (
    upperText.includes("SAVE")
  ) {
    kind = "save";
  } else if (
    upperText.includes("CHECK")
  ) {
    kind = "check";
  }

  return {
    name,
    label,
    type,
    total,
    kind,
    signature:
      `${name}|${label}|${type}|${total}`
  };
}

function avttRemoveRollPopupCard(card) {
  if (!card?.isConnected) return;

  card.classList.add(
    "avtt-roll-popup-leaving"
  );

  window.setTimeout(() => {
    card.remove();
  }, 190);
}

function avttShowRollPopup(data) {
  if (
    !data ||
    avttIsGameLogOpen()
  ) {
    return;
  }

  const now =
    Date.now();

  for (
    const [signature, timestamp]
    of avttRecentRollPopupSignatures
  ) {
    if (now - timestamp > 2500) {
      avttRecentRollPopupSignatures.delete(
        signature
      );
    }
  }

  const recentTimestamp =
    avttRecentRollPopupSignatures.get(
      data.signature
    );

  if (
    recentTimestamp &&
    now - recentTimestamp < 1200
  ) {
    return;
  }

  avttRecentRollPopupSignatures.set(
    data.signature,
    now
  );

  const container =
    avttGetRollPopupContainer();

  avttPositionRollPopupContainer();

  const card =
    document.createElement("div");

  card.className =
    "avtt-roll-popup-card";

  card.dataset.kind =
    data.kind;

  const name =
    document.createElement("div");

  name.className =
    "avtt-roll-popup-name";

  name.textContent =
    data.name;

  const label =
    document.createElement("div");

  label.className =
    "avtt-roll-popup-label";

  label.textContent =
    data.label;

  const row =
    document.createElement("div");

  row.className =
    "avtt-roll-popup-row";

  const type =
    document.createElement("div");

  type.className =
    "avtt-roll-popup-type";

  type.textContent =
    data.type;

  const total =
    document.createElement("div");

  total.className =
    "avtt-roll-popup-total";

  total.textContent =
    data.total;

  row.append(type, total);
  card.append(name, label, row);

  card.addEventListener(
    "click",
    () => {
      window.$?.(
        "#switch_gamelog"
      )?.trigger("click");

      avttRemoveRollPopupCard(card);
    }
  );

  container.appendChild(card);

  while (
    container.children.length >
    AVTT_ROLL_POPUP_MAX_CARDS
  ) {
    container.firstElementChild?.remove();
  }

  window.setTimeout(() => {
    avttRemoveRollPopupCard(card);
  }, AVTT_ROLL_POPUP_DURATION_MS);
}

function avttHandlePossibleRollEntry(
  entry,
  initializeOnly = false
) {
  if (
    !(entry instanceof HTMLElement)
  ) {
    return;
  }

  const existingTimer =
    avttRollPopupEntryTimers.get(entry);

  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(() => {
    avttRollPopupEntryTimers.delete(entry);

    const data =
      avttParseRollPopupEntry(entry);

    if (!data) {
      return;
    }

    const previousSignature =
      avttRollPopupEntrySignatures.get(entry);

    avttRollPopupEntrySignatures.set(
      entry,
      data.signature
    );

    if (initializeOnly) {
      return;
    }

    if (
      previousSignature === data.signature
    ) {
      return;
    }

    avttShowRollPopup(data);
  }, 500);

  avttRollPopupEntryTimers.set(
    entry,
    timer
  );
}

function avttGetGameLogEntryFromNode(node) {
  if (node instanceof Text) {
    return node.parentElement?.closest?.(
      "ol[class*='GameLogEntries'] > li"
    ) || null;
  }

  if (!(node instanceof HTMLElement)) {
    return null;
  }

  if (
    node.matches(
      "ol[class*='GameLogEntries'] > li"
    )
  ) {
    return node;
  }

  return node.closest?.(
    "ol[class*='GameLogEntries'] > li"
  ) || null;
}

function avttScanExistingRollEntries() {
  document
    .querySelectorAll(
      "ol[class*='GameLogEntries'] > li"
    )
    .forEach(entry => {
      avttHandlePossibleRollEntry(
        entry,
        true
      );
    });
}

function avttInitializeRollPopups() {
  avttEnsureRollPopupStyles();
  avttGetRollPopupContainer();
  avttScanExistingRollEntries();

  const observer =
    new MutationObserver(mutations => {
      const changedEntries =
        new Set();

      mutations.forEach(mutation => {
        const targetEntry =
          avttGetGameLogEntryFromNode(
            mutation.target
          );

        if (targetEntry) {
          changedEntries.add(targetEntry);
        }

        mutation.addedNodes.forEach(node => {
          const addedEntry =
            avttGetGameLogEntryFromNode(node);

          if (addedEntry) {
            changedEntries.add(addedEntry);
          }

          if (
            node instanceof HTMLElement
          ) {
            node
              .querySelectorAll?.(
                "ol[class*='GameLogEntries'] > li"
              )
              .forEach(entry => {
                changedEntries.add(entry);
              });
          }
        });
      });

      changedEntries.forEach(entry => {
        avttHandlePossibleRollEntry(
          entry,
          false
        );
      });
    });

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    }
  );

  window.addEventListener(
    "resize",
    avttPositionRollPopupContainer
  );

  window.setInterval(
    avttPositionRollPopupContainer,
    1000
  );

  console.log(
    "AVTT roll popup observer initialized"
  );
}

window.setTimeout(
  avttInitializeRollPopups,
  2500
);

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

const AVTT_PC_ROLL_SETTING_RULES = {
  versatile: {
    values: new Set([
      "both",
      "1",
      "2"
    ])
  },

  crit: {
    values: new Set([
      "0",
      "1",
      "2",
      "3"
    ])
  },

  critRange: {
    validate(value) {
      const number =
        Number(value);

      return (
        Number.isInteger(number) &&
        number >= 1 &&
        number <= 20
      );
    }
  },

  hitRoll: {},
  damageRoll: {},
  checkRoll: {},
  saveRoll: {}
};

function avttGetSelectedPcRollSettingsContext() {
  const pcContext =
    avttGetSelectedPcContext();

  const characterId =
    String(
      pcContext.characterId
    );

  const storageKey =
    "CHARACTER_AVTT_SETTINGS" +
    characterId;

  let settings =
    {};

  try {
    const storedSettings =
      window.localStorage.getItem(
        storageKey
      );

    if (storedSettings) {
      const parsedSettings =
        JSON.parse(
          storedSettings
        );

      if (
        parsedSettings &&
        typeof parsedSettings ===
          "object"
      ) {
        settings =
          parsedSettings;
      }
    }
  } catch (error) {
    console.warn(
      "Unable to read PC roll settings:",
      error
    );
  }

  const sheetFrames =
    [
      ...document.querySelectorAll(
        "#sheet iframe"
      )
    ];

  const characterFrame =
    sheetFrames.find(frame => {
      const sheetUrl =
        String(
          frame.getAttribute(
            "data-sheet_url"
          ) ||
          frame.getAttribute(
            "src"
          ) ||
          frame.src ||
          ""
        );

      return sheetUrl.includes(
        `/characters/${characterId}`
      );
    }) ||
    null;

  const characterWindow =
    characterFrame?.contentWindow ||
    null;

  if (
    characterWindow
      ?.CHARACTER_AVTT_SETTINGS &&
    typeof characterWindow
      .CHARACTER_AVTT_SETTINGS ===
      "object"
  ) {
    settings = {
      ...settings,
      ...characterWindow
        .CHARACTER_AVTT_SETTINGS
    };
  }

  return {
    ...pcContext,
    characterId,
    storageKey,
    settings,
    characterFrame,
    characterWindow
  };
}

function avttApplyPcRollSetting(
  cmd
) {
  const setting =
    String(
      cmd.setting ||
      ""
    ).trim();

  const rule =
    AVTT_PC_ROLL_SETTING_RULES[
      setting
    ];

  if (!rule) {
    throw new Error(
      `Unsupported PC roll setting: ${setting}`
    );
  }

  const value =
    String(
      cmd.value ??
      ""
    );

  if (
    rule.values &&
    !rule.values.has(value)
  ) {
    throw new Error(
      `Invalid value for ${setting}: ${value}`
    );
  }

  if (
    rule.validate &&
    !rule.validate(value)
  ) {
    throw new Error(
      `Invalid value for ${setting}: ${value}`
    );
  }

  const {
    characterId,
    storageKey,
    settings,
    characterWindow
  } =
    avttGetSelectedPcRollSettingsContext();

  settings[setting] =
    value;

  window.localStorage.setItem(
    storageKey,
    JSON.stringify(settings)
  );

  let control =
    null;

  if (characterWindow) {
    if (
      characterWindow
        .CHARACTER_AVTT_SETTINGS &&
      typeof characterWindow
        .CHARACTER_AVTT_SETTINGS ===
        "object"
    ) {
      characterWindow
        .CHARACTER_AVTT_SETTINGS[
          setting
        ] =
        value;
    }

    try {
      characterWindow.localStorage.setItem(
        storageKey,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.warn(
        "Unable to synchronize character-frame roll settings:",
        error
      );
    }

    control =
      characterWindow.document
        ?.querySelector(
          `[data-option-name="${setting}"] select, ` +
          `[data-option-name="${setting}"] input`
        ) ||
      null;

    if (control) {
      const jq =
        characterWindow.jQuery ||
        characterWindow.$;

      if (typeof jq === "function") {
        jq(control)
          .val(value)
          .trigger("change");
      } else {
        control.value =
          value;

        control.dispatchEvent(
          new Event(
            "change",
            {
              bubbles: true
            }
          )
        );
      }
    }
  }

  console.log(
    "applyPcRollSetting:",
    {
      characterId,
      setting,
      value,
      sheetOpen:
        Boolean(characterWindow),
      popupSynchronized:
        Boolean(control)
    }
  );

  return {
    characterId,
    setting,
    value
  };
}


function avttGetPcRollBuffCatalog() {
  const iframeCandidates = [
    document.querySelector(
      "#sheet iframe"
    ),
    ...document.querySelectorAll(
      "iframe"
    )
  ].filter(
    (frame, index, frames) =>
      frame &&
      frames.indexOf(frame) === index
  );

  const sheetFrame =
    iframeCandidates.find(frame => {
      try {
        const frameDocument =
          frame.contentDocument;

        const frameWindow =
          frame.contentWindow;

        return Boolean(
          frameDocument &&
          (
            typeof frameWindow
              ?.rebuild_buffs ===
              "function" ||
            frameDocument.querySelector(
              "[data-buff]"
            ) ||
            frameDocument.querySelector(
              "#avtt-buff-options"
            )
          )
        );
      } catch {
        return false;
      }
    });

  if (!sheetFrame) {
    throw new Error(
      "Could not find the open player character sheet or its Roll Buff controls."
    );
  }

  const sheetDocument =
    sheetFrame.contentDocument;

  const sheetWindow =
    sheetFrame.contentWindow;

  if (
    !sheetDocument ||
    !sheetWindow
  ) {
    throw new Error(
      "The player character sheet is not ready yet."
    );
  }

  if (
    typeof sheetWindow
      .rebuild_buffs ===
      "function"
  ) {
    const existingMenus =
      [
        ...sheetDocument.querySelectorAll(
          "#avtt-buff-options"
        )
      ];

    existingMenus
      .slice(1)
      .forEach(menu =>
        menu.remove()
      );

    sheetWindow.rebuild_buffs(
      existingMenus.length ===
        0
    );
  }

  const categories =
    [
      ...sheetDocument.querySelectorAll(
        "ul"
      )
    ]
      .filter(list =>
        list.querySelector(
          "[data-buff]"
        )
      )
      .map(list => {
        const children =
          [...list.children];

        const category =
          String(
            children[0]?.innerText ||
            list.id ||
            "Other"
          )
            .replace(/\s+/g, " ")
            .trim();

        const buffs =
          children
            .slice(1)
            .map(item => {
              const control =
                item.querySelector(
                  "[data-buff]"
                );

              if (!control) {
                return null;
              }

              const name =
                String(
                  control.dataset
                    .buff ||
                  ""
                ).trim();

              if (!name) {
                return null;
              }

              const label =
                String(
                  item.querySelector(
                    `label[for="${CSS.escape(
                      control.id
                    )}"]`
                  )?.textContent ||
                  name
                )
                  .replace(/\s+/g, " ")
                  .trim();

              if (
                control.tagName ===
                "SELECT"
              ) {
                return {
                  name,
                  label,
                  type:
                    "select",

                  options:
                    [
                      ...control.options
                    ]
                      .filter(option =>
                        option.value !==
                        "0"
                      )
                      .map(option => ({
                        value:
                          String(
                            option.value
                          ),

                        label:
                          String(
                            option.textContent ||
                            option.value
                          )
                            .replace(/\s+/g, " ")
                            .trim()
                      }))
                };
              }

              return {
                name,
                label,
                type:
                  "checkbox",
                options: []
              };
            })
            .filter(Boolean);

        return {
          id:
            String(
              list.id ||
              ""
            ),

          category,
          buffs
        };
      })
      .filter(category =>
        category.buffs.length >
          0 &&
        !new Set([
          "Favorite",
          "Class",
          "Species"
        ]).has(
          category.category
        )
      );

  return {
    generatedAt:
      Date.now(),

    categoryCount:
      categories.length,

    buffCount:
      categories.reduce(
        (total, category) =>
          total +
          category.buffs.length,
        0
      ),

    categories
  };
}

function avttApplyPcRollBuff(
  cmd
) {
  const {
    characterId
  } =
    avttGetSelectedPcContext();

  const buff =
    String(
      cmd.buff ||
      ""
    ).trim();

  if (!buff) {
    throw new Error(
      "A roll buff name is required."
    );
  }

  const value =
    cmd.value === undefined ||
    cmd.value === null
      ? null
      : String(cmd.value);

  const enabled =
    cmd.enabled !== false &&
    value !== "0";

  const storageKey =
    "rollBuffs" +
    characterId;

  let currentBuffs = [];

  try {
    const stored =
      JSON.parse(
        localStorage.getItem(
          storageKey
        ) ||
        "[]"
      );

    if (Array.isArray(stored)) {
      currentBuffs =
        stored;
    }
  } catch {
    currentBuffs = [];
  }

  const nextBuffs =
    currentBuffs.filter(entry => {
      if (Array.isArray(entry)) {
        return (
          String(entry[0]) !==
          buff
        );
      }

      return (
        String(entry) !==
        buff
      );
    });

  if (enabled) {
    if (
      value !== null &&
      value !== "" &&
      value !== "on"
    ) {
      nextBuffs.push([
        buff,
        value
      ]);
    } else {
      nextBuffs.push(
        buff
      );
    }
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify(
      nextBuffs
    )
  );

  const characterFrame =
    [
      ...document.querySelectorAll(
        "#sheet iframe"
      )
    ].find(frame => {
      const sheetUrl =
        String(
          frame.getAttribute(
            "data-sheet_url"
          ) ||
          frame.getAttribute(
            "src"
          ) ||
          frame.src ||
          ""
        );

      return sheetUrl.includes(
        `/characters/${characterId}`
      );
    }) ||
    null;

  let uiSynchronized =
    false;

  if (
    characterFrame?.contentWindow
  ) {
    const characterWindow =
      characterFrame.contentWindow;

    characterWindow.rollBuffs =
      [...nextBuffs];

    const control =
      characterWindow.document
        .getElementById(
          `buff_${buff}`
        );

    const jq =
      characterWindow.jQuery ||
      characterWindow.$;

    if (control) {
      if (
        control.tagName ===
        "SELECT"
      ) {
        const controlValue =
          enabled
            ? value || "0"
            : "0";

        if (
          typeof jq ===
          "function"
        ) {
          jq(control)
            .val(controlValue);
        } else {
          control.value =
            controlValue;
        }
      } else if (
        control.type ===
        "checkbox"
      ) {
        if (
          typeof jq ===
          "function"
        ) {
          jq(control)
            .prop(
              "checked",
              enabled
            );
        } else {
          control.checked =
            enabled;
        }
      }

      uiSynchronized =
        true;
    }
  }

  console.log(
    "applyPcRollBuff:",
    {
      characterId:
        String(characterId),
      buff,
      enabled,
      value,
      uiSynchronized,
      rollBuffs:
        nextBuffs
    }
  );

  return {
    characterId:
      String(characterId),
    buff,
    enabled,
    value,
    rollBuffs:
      nextBuffs
  };
}


function avttApplyPcRollBuff(
  cmd
) {
  const {
    characterId
  } =
    avttGetSelectedPcContext();

  const buff =
    String(
      cmd.buff ||
      ""
    ).trim();

  if (!buff) {
    throw new Error(
      "A roll buff name is required."
    );
  }

  const value =
    cmd.value === undefined ||
    cmd.value === null
      ? null
      : String(cmd.value);

  const enabled =
    cmd.enabled !== false &&
    value !== "0";

  const storageKey =
    "rollBuffs" +
    characterId;

  let currentBuffs = [];

  try {
    const stored =
      JSON.parse(
        localStorage.getItem(
          storageKey
        ) ||
        "[]"
      );

    if (Array.isArray(stored)) {
      currentBuffs =
        stored;
    }
  } catch {
    currentBuffs = [];
  }

  const nextBuffs =
    currentBuffs.filter(entry => {
      if (Array.isArray(entry)) {
        return (
          String(entry[0]) !==
          buff
        );
      }

      return (
        String(entry) !==
        buff
      );
    });

  if (enabled) {
    if (
      value !== null &&
      value !== "" &&
      value !== "on"
    ) {
      nextBuffs.push([
        buff,
        value
      ]);
    } else {
      nextBuffs.push(
        buff
      );
    }
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify(
      nextBuffs
    )
  );

  const characterFrame =
    [
      ...document.querySelectorAll(
        "#sheet iframe"
      )
    ].find(frame => {
      const sheetUrl =
        String(
          frame.getAttribute(
            "data-sheet_url"
          ) ||
          frame.getAttribute(
            "src"
          ) ||
          frame.src ||
          ""
        );

      return sheetUrl.includes(
        `/characters/${characterId}`
      );
    }) ||
    null;

  let uiSynchronized =
    false;

  if (
    characterFrame?.contentWindow
  ) {
    const characterWindow =
      characterFrame.contentWindow;

    characterWindow.rollBuffs =
      [...nextBuffs];

    const control =
      characterWindow.document
        .getElementById(
          `buff_${buff}`
        );

    const jq =
      characterWindow.jQuery ||
      characterWindow.$;

    if (control) {
      if (
        control.tagName ===
        "SELECT"
      ) {
        const controlValue =
          enabled
            ? value || "0"
            : "0";

        if (
          typeof jq ===
          "function"
        ) {
          jq(control)
            .val(controlValue);
        } else {
          control.value =
            controlValue;
        }
      } else if (
        control.type ===
        "checkbox"
      ) {
        if (
          typeof jq ===
          "function"
        ) {
          jq(control)
            .prop(
              "checked",
              enabled
            );
        } else {
          control.checked =
            enabled;
        }
      }

      uiSynchronized =
        true;
    }
  }

  console.log(
    "applyPcRollBuff:",
    {
      characterId:
        String(characterId),
      buff,
      enabled,
      value,
      uiSynchronized,
      rollBuffs:
        nextBuffs
    }
  );

  return {
    characterId:
      String(characterId),
    buff,
    enabled,
    value,
    rollBuffs:
      nextBuffs
  };
}


function avttApplyPcRollBuff(
  cmd
) {
  const {
    characterId
  } =
    avttGetSelectedPcContext();

  const buff =
    String(
      cmd.buff ||
      ""
    ).trim();

  if (!buff) {
    throw new Error(
      "A roll buff name is required."
    );
  }

  const value =
    cmd.value === undefined ||
    cmd.value === null
      ? null
      : String(cmd.value);

  const enabled =
    cmd.enabled !== false &&
    value !== "0";

  const storageKey =
    "rollBuffs" +
    characterId;

  let currentBuffs = [];

  try {
    const stored =
      JSON.parse(
        localStorage.getItem(
          storageKey
        ) ||
        "[]"
      );

    if (Array.isArray(stored)) {
      currentBuffs =
        stored;
    }
  } catch {
    currentBuffs = [];
  }

  const nextBuffs =
    currentBuffs.filter(entry => {
      if (Array.isArray(entry)) {
        return (
          String(entry[0]) !==
          buff
        );
      }

      return (
        String(entry) !==
        buff
      );
    });

  if (enabled) {
    if (
      value !== null &&
      value !== "" &&
      value !== "on"
    ) {
      nextBuffs.push([
        buff,
        value
      ]);
    } else {
      nextBuffs.push(
        buff
      );
    }
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify(
      nextBuffs
    )
  );

  const characterFrame =
    [
      ...document.querySelectorAll(
        "#sheet iframe"
      )
    ].find(frame => {
      const sheetUrl =
        String(
          frame.getAttribute(
            "data-sheet_url"
          ) ||
          frame.getAttribute(
            "src"
          ) ||
          frame.src ||
          ""
        );

      return sheetUrl.includes(
        `/characters/${characterId}`
      );
    }) ||
    null;

  let uiSynchronized =
    false;

  if (
    characterFrame?.contentWindow
  ) {
    const characterWindow =
      characterFrame.contentWindow;

    characterWindow.rollBuffs =
      [...nextBuffs];

    const control =
      characterWindow.document
        .getElementById(
          `buff_${buff}`
        );

    const jq =
      characterWindow.jQuery ||
      characterWindow.$;

    if (control) {
      if (
        control.tagName ===
        "SELECT"
      ) {
        const controlValue =
          enabled
            ? value || "0"
            : "0";

        if (
          typeof jq ===
          "function"
        ) {
          jq(control)
            .val(controlValue);
        } else {
          control.value =
            controlValue;
        }
      } else if (
        control.type ===
        "checkbox"
      ) {
        if (
          typeof jq ===
          "function"
        ) {
          jq(control)
            .prop(
              "checked",
              enabled
            );
        } else {
          control.checked =
            enabled;
        }
      }

      uiSynchronized =
        true;
    }
  }

  console.log(
    "applyPcRollBuff:",
    {
      characterId:
        String(characterId),
      buff,
      enabled,
      value,
      uiSynchronized,
      rollBuffs:
        nextBuffs
    }
  );

  return {
    characterId:
      String(characterId),
    buff,
    enabled,
    value,
    rollBuffs:
      nextBuffs
  };
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

function avttFindCharacterSheetFrame() {
  return [
    ...document.querySelectorAll("iframe")
  ].find(frame =>
    String(frame.src || "")
      .includes("/characters/")
  ) || null;
}

function avttSetReactInputValue(
  input,
  newValue
) {
  if (!input) {
    throw new Error(
      "D&D Beyond input was not found"
    );
  }

  const frameWindow =
    input.ownerDocument.defaultView;

  const oldValue =
    input.value;

  const prototype =
    Object.getPrototypeOf(input);

  const valueSetter =
    Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    )?.set;

  if (!valueSetter) {
    throw new Error(
      "D&D Beyond input value setter was not found"
    );
  }

  input.focus();

  valueSetter.call(
    input,
    String(newValue)
  );

  const tracker =
    input._valueTracker;

  if (tracker) {
    tracker.setValue(oldValue);
  }

  input.dispatchEvent(
    new frameWindow.InputEvent(
      "input",
      {
        bubbles: true,
        inputType: "insertText",
        data: String(newValue)
      }
    )
  );

  input.dispatchEvent(
    new frameWindow.Event(
      "change",
      {
        bubbles: true
      }
    )
  );

  input.dispatchEvent(
    new frameWindow.KeyboardEvent(
      "keydown",
      {
        key: "Enter",
        code: "Enter",
        bubbles: true
      }
    )
  );

  input.dispatchEvent(
    new frameWindow.KeyboardEvent(
      "keyup",
      {
        key: "Enter",
        code: "Enter",
        bubbles: true
      }
    )
  );

  input.blur();

  return input.value;
}

function avttFindDdbCustomizeRow(
  documentObject,
  label
) {
  return [
    ...documentObject.querySelectorAll(
      ".ct-value-editor__property"
    )
  ].find(row =>
    String(
      row.querySelector(
        ".ct-value-editor__property-label"
      )?.textContent || ""
    ).trim() === label
  ) || null;
}

function avttApplyNumberOperation(
  currentValue,
  operation,
  amount
) {
  const current =
    Number(currentValue || 0);

  switch (operation) {
    case "add":
      return current + amount;

    case "subtract":
      return current - amount;

    case "multiply":
      return current * amount;

    case "divide":
      if (amount === 0) {
        throw new Error(
          "Cannot divide by zero"
        );
      }

      return current / amount;

    case "set":
    default:
      return amount;
  }
}

function avttEditOpenDdbAcField({
  fieldLabel,
  operation,
  value,
  sourceNote
}) {
  const frame =
    avttFindCharacterSheetFrame();

  const documentObject =
    frame?.contentDocument;

  if (!frame || !documentObject) {
    throw new Error(
      "Open the selected PC character sheet first"
    );
  }

  const row =
    avttFindDdbCustomizeRow(
      documentObject,
      fieldLabel
    );

  if (!row) {
    throw new Error(
      `Open Armor Class and expand Customize. Field not found: ${fieldLabel}`
    );
  }

  const valueInput =
    row.querySelector(
      ".ct-value-editor__property-value input"
    );

  const sourceInput =
    row.querySelector(
      ".ct-value-editor__property-source input"
    );

  if (!valueInput) {
    throw new Error(
      `Value input not found for: ${fieldLabel}`
    );
  }

  const nextValue =
    avttApplyNumberOperation(
      valueInput.value,
      operation,
      Number(value)
    );

  avttSetReactInputValue(
    valueInput,
    nextValue
  );

  if (sourceInput) {
    avttSetReactInputValue(
      sourceInput,
      sourceNote || ""
    );
  }

  return {
    fieldLabel,
    operation,
    previousValue:
      valueInput.dataset
        ?.avttPreviousValue ?? null,
    value:
      valueInput.value,
    sourceNote:
      sourceInput?.value || ""
  };
}

function avttGetFreshCobaltToken() {
  return new Promise(
    (resolve, reject) => {
      if (
        typeof window.get_cobalt_token !==
        "function"
      ) {
        reject(
          new Error(
            "AboveVTT get_cobalt_token() was not found"
          )
        );
        return;
      }

      let finished = false;

      const timeout =
        window.setTimeout(() => {
          if (finished) return;

          finished = true;

          reject(
            new Error(
              "Timed out requesting D&D Beyond authentication"
            )
          );
        }, 15000);

      try {
        window.get_cobalt_token(
          token => {
            if (finished) return;

            finished = true;

            window.clearTimeout(
              timeout
            );

            if (
              typeof token !== "string" ||
              token.length < 100
            ) {
              reject(
                new Error(
                  "AboveVTT returned an invalid cobalt token"
                )
              );
              return;
            }

            resolve(token);
          }
        );
      } catch (error) {
        if (finished) return;

        finished = true;

        window.clearTimeout(
          timeout
        );

        reject(error);
      }
    }
  );
}


function avttGetSelectedPcContext() {
  const selectedTokenId =
    Array.isArray(
      CURRENTLY_SELECTED_TOKENS
    )
      ? CURRENTLY_SELECTED_TOKENS[0]
      : null;

  const selectedToken =
    selectedTokenId
      ? window.TOKEN_OBJECTS?.[
          selectedTokenId
        ]
      : null;

  if (!selectedToken) {
    throw new Error(
      "Select a PC token first"
    );
  }

  if (
    selectedToken.options?.itemType !==
      "pc"
  ) {
    throw new Error(
      "The selected token is not a PC"
    );
  }

  const characterId =
    Number(
      selectedToken.options
        ?.characterId
    );

  if (
    !Number.isFinite(characterId) ||
    characterId <= 0
  ) {
    throw new Error(
      "The selected PC has no valid character ID"
    );
  }

  const pcData =
    (window.pcs || []).find(entry =>
      String(entry.characterId) ===
        String(characterId) ||
      entry.name ===
        selectedToken.options?.name
    ) || null;

  return {
    selectedTokenId,
    selectedToken,
    characterId,
    pcData
  };
}

function avttApplyNumericOperation({
  currentValue,
  operation,
  requestedValue,
  label
}) {
  const current =
    Number(currentValue);

  const requested =
    Number(requestedValue);

  if (!Number.isFinite(requested)) {
    throw new Error(
      `Invalid ${label} value: ${requestedValue}`
    );
  }

  if (
    operation !== "set" &&
    !Number.isFinite(current)
  ) {
    throw new Error(
      `The selected PC has no valid current ${label}`
    );
  }

  switch (operation) {
    case "add":
      return current + requested;

    case "subtract":
      return current - requested;

    case "multiply":
      return current * requested;

    case "divide":
      if (requested === 0) {
        throw new Error(
          `Cannot divide ${label} by zero`
        );
      }

      return current / requested;

    case "set":
    default:
      return requested;
  }
}

async function avttDdbCharacterRequest({
  url,
  method = "PUT",
  payload
}) {
  const cobaltToken =
    await avttGetFreshCobaltToken();

  const response =
    await fetch(
      url,
      {
        method,

        credentials:
          "include",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Authorization":
            `Bearer ${cobaltToken}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `D&D Beyond returned ${response.status}: ` +
      responseText.slice(
        0,
        500
      )
    );
  }

  return {
    status:
      response.status,

    responseText
  };
}

function avttRefreshDdbCharacter(
  characterId
) {
  window.setTimeout(
    () => {
      window.update_pc_with_api_call?.(
        String(characterId)
      );
    },
    750
  );

  window.setTimeout(
    () => {
      window.update_pc_with_api_call?.(
        String(characterId)
      );
    },
    2500
  );
}

async function avttApplyArmorClassEffect(
  cmd
) {
  const {
    selectedToken,
    characterId
  } =
    avttGetSelectedPcContext();

  const fieldTypeIds = {
    "Override AC": 1,
    "Additional Magic Bonus": 2,
    "Additional Misc Bonus": 3,
    "Override Base Armor + DEX": 4
  };

  const fieldLabel =
    Object.hasOwn(
      fieldTypeIds,
      cmd.acField
    )
      ? cmd.acField
      : "Override AC";

  const typeId =
    fieldTypeIds[fieldLabel];

  const requestedValue =
    Number(cmd.value);

  const operation =
    String(
      cmd.operation || "set"
    );

  let apiValue =
    requestedValue;

  /*
   * Mathematical operations on Override AC use the
   * currently synchronized total AC.
   *
   * Bonus fields are direct values, because AboveVTT
   * currently does not expose each individual custom
   * bonus field separately.
   */
  if (
    fieldLabel === "Override AC"
  ) {
    apiValue =
      avttApplyNumericOperation({
        currentValue:
          selectedToken.options
            ?.armorClass,

        operation,

        requestedValue,

        label:
          "Armor Class"
      });
  } else if (
    !Number.isFinite(
      requestedValue
    )
  ) {
    throw new Error(
      `Invalid AC value: ${cmd.value}`
    );
  }

  apiValue =
    Math.round(apiValue);

  const payload = {
    characterId,
    typeId,
    value:
      apiValue,
    notes:
      String(
        cmd.effectName || ""
      ),
    valueId:
      null,
    valueTypeId:
      null,
    contextId:
      null,
    contextTypeId:
      null,
    partyId:
      null
  };

  const result =
    await avttDdbCharacterRequest({
      url:
        "https://character-service.dndbeyond.com/character/v5/custom/value",

      method:
        "PUT",

      payload
    });

  console.log(
    "applyPcStatEffect: direct D&D Beyond AC update succeeded",
    {
      character:
        selectedToken.options?.name,

      characterId,
      fieldLabel,
      typeId,
      operation,
      requestedValue,
      apiValue,

      notes:
        payload.notes,

      status:
        result.status,

      response:
        result.responseText.slice(
          0,
          500
        )
    }
  );

  avttRefreshDdbCharacter(
    characterId
  );
}

async function avttApplyMovementEffect(
  cmd
) {
  const {
    selectedToken,
    characterId,
    pcData
  } =
    avttGetSelectedPcContext();

  const movementTypes = {
    walking: {
      id: 1,
      name: "Walking"
    },

    burrowing: {
      id: 2,
      name: "Burrowing"
    },

    climbing: {
      id: 3,
      name: "Climbing"
    },

    flying: {
      id: 4,
      name: "Flying"
    },

    swimming: {
      id: 5,
      name: "Swimming"
    }
  };

  const movementTypeKey =
    Object.hasOwn(
      movementTypes,
      String(
        cmd.movementType || ""
      )
    )
      ? String(cmd.movementType)
      : "walking";

  const movementType =
    movementTypes[
      movementTypeKey
    ];

  const currentMovementSpeed =
    Number(
      pcData?.speeds?.find(
        speed =>
          String(
            speed?.name || ""
          ).toLowerCase() ===
          movementTypeKey
      )?.distance ??
      (
        movementTypeKey ===
          "walking"
          ? (
              selectedToken.options
                ?.speed ??
              selectedToken.options
                ?.speeds?.walk ??
              selectedToken.options
                ?.speeds?.walking
            )
          : selectedToken.options
              ?.speeds?.[
                movementTypeKey
              ]
      ) ??
      0
    );

  const operation =
    String(
      cmd.operation || "set"
    );

  let distance =
    avttApplyNumericOperation({
      currentValue:
        currentMovementSpeed,

      operation,

      requestedValue:
        cmd.value,

      label:
        `${movementType.name} Speed`
    });

  distance =
    Math.max(
      0,
      Math.round(distance)
    );

  const payload = {
    characterId,

    movementId:
      movementType.id,

    distance,

    source:
      String(
        cmd.effectName || ""
      ) || null
  };

  const result =
    await avttDdbCharacterRequest({
      url:
        "https://character-service.dndbeyond.com/character/v5/custom/movement",

      method:
        "PUT",

      payload
    });

  console.log(
    "applyPcStatEffect: direct D&D Beyond Movement Speed update succeeded",
    {
      character:
        selectedToken.options?.name,

      characterId,

      movementType:
        movementType.name,

      movementId:
        movementType.id,

      operation,

      currentMovementSpeed,

      requestedValue:
        Number(cmd.value),

      distance,

      source:
        payload.source,

      status:
        result.status,

      response:
        result.responseText.slice(
          0,
          500
        )
    }
  );

  avttRefreshDdbCharacter(
    characterId
  );
}

async function avttApplyMaxHpEffect(
  cmd
) {
  const {
    selectedToken,
    characterId,
    pcData
  } =
    avttGetSelectedPcContext();

  const currentMaxHp =
    Number(
      pcData?.hitPointInfo
        ?.maximum ??
      selectedToken.options
        ?.hitPointInfo?.maximum ??
      selectedToken.options
        ?.max_hp ??
      0
    );

  const operation =
    String(
      cmd.operation || "set"
    );

  let overrideHitPoints =
    avttApplyNumericOperation({
      currentValue:
        currentMaxHp,

      operation,

      requestedValue:
        cmd.value,

      label:
        "Max HP"
    });

  overrideHitPoints =
    Math.max(
      1,
      Math.round(
        overrideHitPoints
      )
    );

  const payload = {
    characterId,

    overrideHitPoints
  };

  const result =
    await avttDdbCharacterRequest({
      url:
        "https://character-service.dndbeyond.com/character/v5/life/hp/override",

      method:
        "PUT",

      payload
    });

  console.log(
    "applyPcStatEffect: direct D&D Beyond Max HP update succeeded",
    {
      character:
        selectedToken.options?.name,

      characterId,

      operation,

      currentMaxHp,

      requestedValue:
        Number(cmd.value),

      overrideHitPoints,

      status:
        result.status,

      response:
        result.responseText.slice(
          0,
          500
        )
    }
  );

  avttRefreshDdbCharacter(
    characterId
  );
}

async function avttApplyAbilityScoreEffect(
  cmd
) {
  const {
    selectedToken,
    characterId,
    pcData
  } =
    avttGetSelectedPcContext();

  const abilityDefinitions = {
    STR: {
      statId: 1,
      name: "Strength"
    },

    DEX: {
      statId: 2,
      name: "Dexterity"
    },

    CON: {
      statId: 3,
      name: "Constitution"
    },

    INT: {
      statId: 4,
      name: "Intelligence"
    },

    WIS: {
      statId: 5,
      name: "Wisdom"
    },

    CHA: {
      statId: 6,
      name: "Charisma"
    }
  };

  const stat =
    String(cmd.stat || "")
      .toUpperCase();

  const ability =
    abilityDefinitions[stat];

  if (!ability) {
    throw new Error(
      `Unsupported ability: ${cmd.stat}`
    );
  }

  const currentAbility =
    (pcData?.abilities || [])
      .find(entry => {
        const name =
          String(
            entry?.name || ""
          ).toLowerCase();

        const abbreviation =
          String(
            entry?.abbreviation ||
            entry?.shortName ||
            ""
          ).toUpperCase();

        return (
          name ===
            ability.name.toLowerCase() ||
          name ===
            stat.toLowerCase() ||
          abbreviation === stat
        );
      });

  const currentScore =
    Number(
      currentAbility?.score ??
      currentAbility?.value ??
      currentAbility?.totalScore ??
      10
    );

  const operation =
    String(
      cmd.operation || "set"
    );

  let overrideScore =
    avttApplyNumericOperation({
      currentValue:
        currentScore,

      operation,

      requestedValue:
        cmd.value,

      label:
        `${ability.name} Score`
    });

  overrideScore =
    Math.max(
      1,
      Math.round(
        overrideScore
      )
    );

  const payload = {
    characterId,

    statId:
      ability.statId,

    // D&D Beyond type 3 is Override Score.
    type:
      3,

    value:
      overrideScore
  };

  const result =
    await avttDdbCharacterRequest({
      url:
        "https://character-service.dndbeyond.com/character/v5/character/ability-score",

      method:
        "PUT",

      payload
    });

  console.log(
    "applyPcStatEffect: direct D&D Beyond Ability Score update succeeded",
    {
      character:
        selectedToken.options?.name,

      characterId,

      ability:
        ability.name,

      stat,

      statId:
        ability.statId,

      operation,

      currentScore,

      requestedValue:
        Number(cmd.value),

      overrideScore,

      status:
        result.status,

      response:
        result.responseText.slice(
          0,
          500
        )
    }
  );

  avttRefreshDdbCharacter(
    characterId
  );
}

async function avttClearArmorClassEffects(
  characterId
) {
  const acTypeIds = [
    1, // Override AC
    2, // Additional Magic Bonus
    3, // Additional Misc Bonus
    4  // Override Base Armor + DEX
  ];

  for (const typeId of acTypeIds) {
    await avttDdbCharacterRequest({
      url:
        "https://character-service.dndbeyond.com/character/v5/custom/value",

      method:
        "PUT",

      payload: {
        characterId,
        typeId,
        value:
          null,
        notes:
          "",
        valueId:
          null,
        valueTypeId:
          null,
        contextId:
          null,
        contextTypeId:
          null,
        partyId:
          null
      }
    });
  }
}

async function avttClearMovementEffects(
  characterId
) {
  const movementIds = [
    1, // Walking
    2, // Burrowing
    3, // Climbing
    4, // Flying
    5  // Swimming
  ];

  for (
    const movementId
    of movementIds
  ) {
    await avttDdbCharacterRequest({
      url:
        "https://character-service.dndbeyond.com/character/v5/custom/movement",

      method:
        "PUT",

      payload: {
        characterId,
        movementId,
        distance:
          null,
        source:
          ""
      }
    });
  }
}

async function avttClearMaxHpEffect(
  characterId
) {
  await avttDdbCharacterRequest({
    url:
      "https://character-service.dndbeyond.com/character/v5/life/hp/override",

    method:
      "PUT",

    payload: {
      characterId,
      overrideHitPoints:
        null
    }
  });
}

async function avttClearAbilityEffects(
  characterId,
  stat
) {
  const statIds = {
    STR: 1,
    DEX: 2,
    CON: 3,
    INT: 4,
    WIS: 5,
    CHA: 6
  };

  const statId =
    statIds[
      String(stat || "")
        .toUpperCase()
    ];

  if (!statId) {
    throw new Error(
      `Unsupported ability: ${stat}`
    );
  }

  await avttDdbCharacterRequest({
    url:
      "https://character-service.dndbeyond.com/character/v5/character/ability-score",

    method:
      "PUT",

    payload: {
      characterId,
      statId,

      // D&D Beyond type 3 is Override Score.
      type:
        3,

      value:
        null
    }
  });
}

const AVTT_PC_STAT_CLEAR_HANDLERS = {
  armorClass:
    avttClearArmorClassEffects,

  speed:
    avttClearMovementEffects,

  maxHp:
    avttClearMaxHpEffect,

  STR:
    avttClearAbilityEffects,

  DEX:
    avttClearAbilityEffects,

  CON:
    avttClearAbilityEffects,

  INT:
    avttClearAbilityEffects,

  WIS:
    avttClearAbilityEffects,

  CHA:
    avttClearAbilityEffects
};

async function avttClearPcStatEffects(
  cmd
) {
  const {
    selectedToken,
    characterId
  } =
    avttGetSelectedPcContext();

  const aliases = {
    ac:
      "armorClass",

    armorclass:
      "armorClass",

    speed:
      "speed",

    movement:
      "speed",

    maxhp:
      "maxHp",

    maximumhp:
      "maxHp",

    str:
      "STR",

    strength:
      "STR",

    dex:
      "DEX",

    dexterity:
      "DEX",

    con:
      "CON",

    constitution:
      "CON",

    int:
      "INT",

    intelligence:
      "INT",

    wis:
      "WIS",

    wisdom:
      "WIS",

    cha:
      "CHA",

    charisma:
      "CHA"
  };

  const rawStat =
    String(cmd.stat || "")
      .trim();

  const stat =
    aliases[
      rawStat.toLowerCase()
    ] || rawStat;

  const scope =
    cmd.scope === "all"
      ? "all"
      : "stat";

  const clearedStats = [];

  if (scope === "all") {
    const statOrder = [
      "armorClass",
      "speed",
      "maxHp",
      "STR",
      "DEX",
      "CON",
      "INT",
      "WIS",
      "CHA"
    ];

    for (
      const statName
      of statOrder
    ) {
      const handler =
        AVTT_PC_STAT_CLEAR_HANDLERS[
          statName
        ];

      await handler(
        characterId,
        statName
      );

      clearedStats.push(
        statName
      );
    }
  } else {
    const handler =
      AVTT_PC_STAT_CLEAR_HANDLERS[
        stat
      ];

    if (!handler) {
      throw new Error(
        `Unsupported stat for clearing: ${stat}`
      );
    }

    await handler(
      characterId,
      stat
    );

    clearedStats.push(
      stat
    );
  }

  /*
   * Remove any legacy token-local effects left over from
   * the earlier implementation.
   */
  delete selectedToken
    .options
    .avttPcEffects;

  selectedToken
    .place_sync_persist();

  console.log(
    "clearPcStatEffects: direct D&D Beyond clear succeeded",
    {
      character:
        selectedToken.options?.name,

      characterId,
      scope,
      requestedStat:
        scope === "all"
          ? null
          : stat,

      clearedStats
    }
  );

  avttRefreshDdbCharacter(
    characterId
  );
}

const AVTT_PC_STAT_EFFECT_HANDLERS = {
  armorClass:
    avttApplyArmorClassEffect,

  speed:
    avttApplyMovementEffect,

  maxHp:
    avttApplyMaxHpEffect,

  STR:
    avttApplyAbilityScoreEffect,

  DEX:
    avttApplyAbilityScoreEffect,

  CON:
    avttApplyAbilityScoreEffect,

  INT:
    avttApplyAbilityScoreEffect,

  WIS:
    avttApplyAbilityScoreEffect,

  CHA:
    avttApplyAbilityScoreEffect
};

async function avttDispatchPcStatEffect(
  cmd
) {
  const stat =
    String(cmd.stat || "");

  const handler =
    AVTT_PC_STAT_EFFECT_HANDLERS[
      stat
    ];

  if (!handler) {
    return false;
  }

  await handler(cmd);

  return true;
}

async function avttPrompt(options = {}) {
  console.log("avttPrompt()", options);

  return null;
}

window.addEventListener("message", (event) => {
  if (event.data?.type !== "AVTT_BRIDGE_COMMAND") return;

  const cmd = event.data.command;
  console.log("AVTT injected command:", cmd);

  if (
    cmd.command ===
      "applyPcStatEffect"
  ) {
    window.__lastPcStatCommand =
      cmd;

    console.log(
      "PC STAT COMMAND SETTINGS",
      {
        stat:
          cmd.stat,

        abilityField:
          cmd.abilityField,

        operation:
          cmd.operation,

        value:
          cmd.value
      }
    );
  }

  if (cmd.command === "spawnTokenFromPath") {
    void (async () => {

      const tokenPath = String(
        cmd.tokenPath || ""
      ).trim();

      const count = Math.max(
        1,
        Math.min(
          50,
          Math.floor(
            Number(cmd.count || 1)
          )
        )
      );

      const requestedSize =
        Number(cmd.sizeOverride);

      const hasSizeOverride =
        Number.isFinite(requestedSize) &&
        requestedSize > 0;

      if (!tokenPath) {
        console.warn(
          "spawnTokenFromPath: missing token path"
        );
        return;
      }

      const listItem =
        window.find_sidebar_list_item_from_path?.(
          tokenPath
        );

      if (!listItem) {
        console.warn(
          "spawnTokenFromPath: token not found",
          tokenPath
        );
        return;
      }

      const center =
        window.center_of_view?.();

      if (!center) {
        console.warn(
          "spawnTokenFromPath: could not determine view center"
        );
        return;
      }

      const spacing = Math.max(
        70,
        Number(
          window.CURRENT_SCENE_DATA?.hppS ||
          window.CURRENT_SCENE_DATA?.hpps ||
          70
        )
      );

      const spawnedIds = [];

      for (let index = 0; index < count; index += 1) {
        const beforeIds = new Set(
          Object.keys(
            window.TOKEN_OBJECTS || {}
          )
        );

        let offsetX = 0;
        let offsetY = 0;

        if (count > 1) {
          const columnCount =
            Math.ceil(Math.sqrt(count));

          const rowCount =
            Math.ceil(count / columnCount);

          const column =
            index % columnCount;

          const row =
            Math.floor(index / columnCount);

          offsetX =
            (
              column -
              (columnCount - 1) / 2
            ) * spacing;

          offsetY =
            (
              row -
              (rowCount - 1) / 2
            ) * spacing;
        }

        const extraOptions = {};

        if (hasSizeOverride) {
          extraOptions.tokenSize =
            requestedSize;
        }

        await window.create_and_place_token?.(
          listItem,
          undefined,
          undefined,
          center.x + offsetX,
          center.y + offsetY,
          false,
          "",
          false,
          extraOptions
        );

        const newIds = Object.keys(
          window.TOKEN_OBJECTS || {}
        ).filter(
          id => !beforeIds.has(id)
        );

        spawnedIds.push(...newIds);
      }

      console.log(
        "spawnTokenFromPath:",
        {
          tokenPath,
          count,
          sizeOverride:
            hasSizeOverride
              ? requestedSize
              : null,
          spawnedIds
        }
      );
    })().catch(error => {
      console.error(
        "spawnTokenFromPath failed:",
        error
      );
    });

    return;
  }

  if (cmd.command === "modifySelectedTokenHp") {
    const mode = String(cmd.mode || "");
    const amount = Math.max(
      0,
      Number(cmd.amount || 0)
    );

    const allowedModes = new Set([
      "damage",
      "heal",
      "tempHp"
    ]);

    if (!allowedModes.has(mode)) {
      console.warn(
        "modifySelectedTokenHp: invalid mode",
        mode
      );
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      console.warn(
        "modifySelectedTokenHp: invalid amount",
        cmd.amount
      );
      return;
    }

    const selectedIds = [
      ...(CURRENTLY_SELECTED_TOKENS || [])
    ];

    if (!selectedIds.length) {
      console.warn(
        "modifySelectedTokenHp: no selected tokens"
      );
      return;
    }

    selectedIds.forEach(id => {
      const token =
        window.TOKEN_OBJECTS?.[id];

      if (!token) return;

      const before = {
        hp: Number(token.hp || 0),
        tempHp: Number(token.tempHp || 0),
        maxHp: Number(token.maxHp || 0)
      };

      if (mode === "damage") {
        let remainingDamage = amount;

        if (before.tempHp > 0) {
          const absorbed = Math.min(
            before.tempHp,
            remainingDamage
          );

          token.tempHp =
            before.tempHp - absorbed;

          remainingDamage -= absorbed;
        }

        if (remainingDamage > 0) {
          token.hp = Math.max(
            0,
            before.hp - remainingDamage
          );
        }
      }

      if (mode === "heal") {
        token.hp = Math.min(
          before.maxHp,
          before.hp + amount
        );
      }

      if (mode === "tempHp") {
        token.tempHp = Math.max(
          before.tempHp,
          amount
        );
      }

      token.place_sync_persist();

      console.log(
        "modifySelectedTokenHp:",
        {
          token: token.options?.name,
          mode,
          amount,
          before,
          after: {
            hp: Number(token.hp || 0),
            tempHp: Number(token.tempHp || 0),
            maxHp: Number(token.maxHp || 0)
          }
        }
      );
    });

    return;
  }

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

  if (
    cmd.command ===
      "applyPcRollBuff"
  ) {
    try {
      avttApplyPcRollBuff(
        cmd
      );
    } catch (error) {
      console.error(
        "applyPcRollBuff: update failed",
        {
          buff:
            cmd.buff,

          value:
            cmd.value,

          enabled:
            cmd.enabled,

          error
        }
      );
    }

    return;
  }

  if (
    cmd.command ===
      "refreshPcRollBuffCatalog"
  ) {
    try {
      const catalog =
        avttGetPcRollBuffCatalog();

      window.postMessage(
        {
          type:
            "AVTT_ROLL_BUFF_CATALOG",

          catalog
        },
        "*"
      );

      console.log(
        "Published Roll Buff catalog",
        {
          categoryCount:
            catalog.categoryCount,

          buffCount:
            catalog.buffCount
        }
      );
    } catch (error) {
      console.error(
        "refreshPcRollBuffCatalog failed",
        error
      );
    }

    return;
  }

  if (
    cmd.command ===
      "applyPcRollSetting"
  ) {
    try {
      avttApplyPcRollSetting(
        cmd
      );
    } catch (error) {
      console.error(
        "applyPcRollSetting: update failed",
        {
          setting:
            cmd.setting,

          value:
            cmd.value,

          error
        }
      );
    }

    return;
  }

  if (
    cmd.command ===
      "applyPcStatEffect" &&
    Object.hasOwn(
      AVTT_PC_STAT_EFFECT_HANDLERS,
      String(cmd.stat || "")
    )
  ) {
    void (async () => {
      try {
        await avttDispatchPcStatEffect(
          cmd
        );
      } catch (error) {
        console.error(
          "applyPcStatEffect: direct D&D Beyond update failed",
          {
            stat:
              cmd.stat,

            error
          }
        );
      }
    })();

    return;
  }

  if (cmd.command === "applyPcStatEffect") {
    const aliases = {
      ac: "armorClass",
      armorclass: "armorClass",
      speed: "speed",
      movement: "speed",
      maxhp: "maxHp",
      maximumhp: "maxHp",
      str: "STR",
      strength: "STR",
      dex: "DEX",
      dexterity: "DEX",
      con: "CON",
      constitution: "CON",
      int: "INT",
      intelligence: "INT",
      wis: "WIS",
      wisdom: "WIS",
      cha: "CHA",
      charisma: "CHA"
    };

    const rawStat =
      String(cmd.stat || "")
        .trim();

    const stat =
      aliases[rawStat.toLowerCase()] ||
      rawStat;

    const validStats =
      new Set([
        "armorClass",
        "speed",
        "maxHp",
        "STR",
        "DEX",
        "CON",
        "INT",
        "WIS",
        "CHA"
      ]);

    if (!validStats.has(stat)) {
      console.warn(
        "applyPcStatEffect: invalid stat",
        stat
      );
      return;
    }

    const operation =
      String(cmd.operation || "add");

    const validOperations =
      new Set([
        "add",
        "subtract",
        "multiply",
        "divide",
        "set"
      ]);

    if (!validOperations.has(operation)) {
      console.warn(
        "applyPcStatEffect: invalid operation",
        operation
      );
      return;
    }

    const value =
      Number(cmd.value);

    if (!Number.isFinite(value)) {
      console.warn(
        "applyPcStatEffect: invalid value",
        cmd.value
      );
      return;
    }

    if (
      operation === "divide" &&
      value === 0
    ) {
      console.warn(
        "applyPcStatEffect: cannot divide by zero"
      );
      return;
    }

    const effectName =
      String(
        cmd.effectName ||
        "Stream Deck Effect"
      ).trim() ||
      "Stream Deck Effect";

    const effectId =
      String(
        cmd.effectId ||
        `${stat}:${effectName}`
      );

    const selectedIds =
      typeof CURRENTLY_SELECTED_TOKENS !==
        "undefined" &&
      Array.isArray(CURRENTLY_SELECTED_TOKENS)
        ? CURRENTLY_SELECTED_TOKENS
        : [];

    console.log(
      "applyPcStatEffect: selected IDs",
      selectedIds
    );

    let changed = 0;

    selectedIds.forEach(tokenId => {
      const token =
        window.TOKEN_OBJECTS?.[tokenId];

      if (!token) {
        console.warn(
          "applyPcStatEffect: token not found",
          tokenId
        );
        return;
      }

      if (
        token.options?.itemType !== "pc"
      ) {
        console.warn(
          "applyPcStatEffect: selected token is not a PC",
          {
            tokenId,
            name: token.options?.name,
            itemType:
              token.options?.itemType
          }
        );
        return;
      }

      const allEffects =
        token.options.avttPcEffects &&
        typeof token.options.avttPcEffects ===
          "object"
          ? {
              ...token.options.avttPcEffects
            }
          : {};

      const statEffects =
        Array.isArray(allEffects[stat])
          ? [
              ...allEffects[stat]
            ]
          : [];

      const nextEffect = {
        id: effectId,
        name: effectName,
        operation,
        value,
        updatedAt: Date.now()
      };

      const existingIndex =
        statEffects.findIndex(effect =>
          String(effect?.id || "") ===
          effectId
        );

      if (existingIndex >= 0) {
        statEffects[existingIndex] =
          nextEffect;
      } else {
        statEffects.push(
          nextEffect
        );
      }

      allEffects[stat] =
        statEffects;

      token.options.avttPcEffects =
        allEffects;

      token.place_sync_persist();

      changed += 1;
    });

    console.log(
      "applyPcStatEffect:",
      {
        stat,
        operation,
        value,
        effectName,
        effectId,
        changed
      }
    );

    return;
  }

  if (
    cmd.command ===
      "clearPcStatEffects"
  ) {
    void (async () => {
      try {
        await avttClearPcStatEffects(
          cmd
        );
      } catch (error) {
        console.error(
          "clearPcStatEffects: direct D&D Beyond clear failed",
          {
            scope:
              cmd.scope,

            stat:
              cmd.stat,

            error
          }
        );
      }
    })();

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

      const isPc =
        token.options?.itemType === "pc" &&
        token.options?.characterId;

      if (isPc) {
        const characterId =
          String(token.options.characterId);

        const ddbConditions = new Set([
          "blinded",
          "charmed",
          "deafened",
          "exhaustion",
          "frightened",
          "grappled",
          "incapacitated",
          "invisible",
          "paralyzed",
          "petrified",
          "poisoned",
          "prone",
          "restrained",
          "stunned",
          "unconscious"
        ]);

        const conditionKey =
          condition.trim().toLowerCase();

        const currentConditions = (
          token.options.conditions || []
        ).map(entry => {
          if (typeof entry === "string") {
            return {
              name: entry,
              level: null
            };
          }

          return {
            ...entry,
            name: String(entry?.name || ""),
            level: entry?.level ?? null
          };
        }).filter(entry => entry.name);

        const nextConditions =
          hasNativeCondition
            ? currentConditions.filter(entry =>
                String(entry.name || "")
                  .toLowerCase() !==
                conditionKey
              )
            : [
                ...currentConditions,
                {
                  name: condition,
                  level: null
                }
              ];

        token.options.conditions =
          nextConditions.map(entry => ({
            ...entry
          }));

        if (ddbConditions.has(conditionKey)) {
          const pcConditions =
            nextConditions.filter(entry =>
              ddbConditions.has(
                String(entry.name || "")
                  .toLowerCase()
              )
            );

          const pc =
            (window.pcs || []).find(entry =>
              String(entry.characterId) ===
                characterId ||
              entry.name === token.options?.name
            );

          if (pc) {
            pc.conditions =
              pcConditions.map(entry => ({
                ...entry
              }));
          }

          window.update_pc_with_data?.(
            characterId,
            {
              conditions:
                pcConditions.map(entry => ({
                  ...entry
                }))
            }
          );

          console.log(
            "toggleCondition: updated PC sheet condition",
            {
              characterId,
              token: token.options?.name,
              condition,
              active: !hasNativeCondition,
              conditions: pcConditions
            }
          );
        } else {
          const currentCustomConditions = [
            ...(token.options.custom_conditions || [])
          ];

          const nextCustomConditions =
            hasCustomCondition
              ? currentCustomConditions.filter(entry => {
                  const name =
                    typeof entry === "string"
                      ? entry
                      : entry?.name || entry?.text;

                  return String(name || "")
                    .toLowerCase() !==
                    conditionKey;
                })
              : [
                  ...currentCustomConditions,
                  {
                    name: condition,
                    text: ""
                  }
                ];

          token.options.custom_conditions =
            nextCustomConditions.map(entry =>
              typeof entry === "string"
                ? {
                    name: entry,
                    text: ""
                  }
                : {
                    ...entry
                  }
            );

          console.log(
            "toggleCondition: updated AVTT token condition",
            {
              characterId,
              token: token.options?.name,
              condition,
              active: !hasCustomCondition,
              customConditions:
                token.options.custom_conditions
            }
          );
        }

        token.place_sync_persist();
        return;
      }

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

      const isPc =
        token.options?.itemType === "pc" &&
        token.options?.characterId;

      if (isPc) {
        const characterId =
          String(token.options.characterId);

        token.options.conditions = [];
        token.options.custom_conditions = [];

        const pc =
          (window.pcs || []).find(entry =>
            String(entry.characterId) === characterId ||
            entry.name === token.options?.name
          );

        if (pc) {
          pc.conditions = [];
        }

        window.update_pc_with_data?.(
          characterId,
          {
            conditions: []
          }
        );

        token.place_sync_persist();

        console.log(
          "clearMarkers: directly cleared PC conditions",
          {
            characterId,
            token: token.options?.name
          }
        );

        return;
      }

      const customConditions = [
        ...(token.options.custom_conditions || [])
      ];

      customConditions.forEach(condition => {
        token.removeCondition(condition.name);
      });

      const nativeConditions = [
        ...(token.options.conditions || [])
      ];

      nativeConditions.forEach(condition => {
        const name =
          typeof condition === "string"
            ? condition
            : condition.name;

        if (name) {
          token.removeCondition(name);
        }
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
        }, "*");      } catch (err) {
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