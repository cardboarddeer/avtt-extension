console.log("AVTT inject loaded");

window.AVTTBridge = {
  token: null,
  monster: null,
  actionRolls: [],
  actionNames: [],

  async refresh() {
    const tokenId = CURRENTLY_SELECTED_TOKENS?.[0];
    this.token = TOKEN_OBJECTS?.[tokenId] || null;

    this.monster = null;
    this.actionRolls = [];
    this.actionNames = [];

    if (!this.token) return false;

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

    this.actionNames = [...new Set(
      this.actionRolls.map(r => r.name).filter(Boolean)
    )];

    return true;
  },

  getAbilityModifier(ability) {
    const statMap = {
      str: 1,
      dex: 2,
      con: 3,
      int: 4,
      wis: 5,
      cha: 6
    };

    const score = this.monster?.stats?.find(
      s => s.statId === statMap[ability]
    )?.value;

    if (typeof score !== "number") return 0;

    return Math.floor((score - 10) / 2);
  },

  getAbilityScore(ability) {
    const statMap = { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 };
    return this.monster?.stats?.find(s => s.statId === statMap[ability])?.value ?? null;
  },

  getProficiencyBonus() {
    if (typeof this.monster?.proficiencyBonus === "number") {
      return this.monster.proficiencyBonus;
    }

    const crId = this.monster?.challengeRatingId;

    if (typeof crId !== "number") return 2;

    let cr = 0;
    if (crId <= 4) cr = 0;
    else cr = crId - 4;

    return Math.max(2, 2 + Math.floor((cr - 1) / 4));
  },

  getSavingThrowBonus(ability) {
    const statMap = { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 };
    const statId = statMap[ability];

    const save = this.monster?.savingThrows?.find(s =>
      s.statId === statId ||
      s.stat?.id === statId ||
      String(s.name || "").toLowerCase().includes(ability)
    );

    if (save) {
      const candidates = [
        save.modifier,
        save.value,
        save.bonus,
        save.total,
        save.statModifier,
        save.saveModifier
      ];

      const found = candidates.find(v => typeof v === "number");
      if (typeof found === "number") return found;
    }

    return this.getAbilityModifier(ability);
  },

  getSkillBonus(skill) {
    const clean = String(skill).toLowerCase().replace(/[^a-z]/g, "");

    const skillIdMap = {
      acrobatics: 1,
      animalhandling: 2,
      arcana: 3,
      athletics: 4,
      deception: 5,
      history: 6,
      insight: 7,
      intimidation: 8,
      investigation: 9,
      medicine: 10,
      nature: 11,
      perception: 12,
      performance: 13,
      persuasion: 14,
      religion: 15,
      sleightofhand: 16,
      stealth: 17,
      survival: 18
    };

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

    const skillId = skillIdMap[clean];

    const entry = this.monster?.skills?.find(s => {
      const name = String(s.name || s.skill?.name || "").toLowerCase().replace(/[^a-z]/g, "");
      return name === clean || s.skillId === skillId || s.id === skillId;
    });

    if (entry) {
      const candidates = [
        entry.modifier,
        entry.value,
        entry.bonus,
        entry.total,
        entry.skillModifier
      ];

      const found = candidates.find(v => typeof v === "number");
      if (typeof found === "number") return found;
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
      prof: this.getProficiencyBonus(),

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

      initiative: this.monster?.initiativeBonus ?? this.getAbilityModifier("dex"),
      ac: this.token?.options?.armorClass ?? this.monster?.armorClass ?? 0,
      hp: this.token?.options?.hitPointInfo?.current ?? this.token?.options?.hp ?? 0,
      maxHp: this.token?.options?.hitPointInfo?.maximum ?? this.token?.options?.max_hp ?? 0
    };

    let expression = formula;

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
    return String(label || "")
      .replaceAll("{name}", this.monster?.name || this.token?.options?.name || "Selected Token");
  },

  getTokenInfo() {
    if (!this.token) return null;

    return {
      tokenId: this.token.options.id,
      name: this.token.options.name || this.monster?.name || "Selected Token",
      hp: this.token.options.hitPointInfo?.current ?? this.token.options.hp ?? null,
      maxHp: this.token.options.hitPointInfo?.maximum ?? this.token.options.max_hp ?? null,
      ac: this.token.options.armorClass ?? this.monster?.armorClass ?? null,
      actions: this.actionNames.map((name, index) => ({
        slot: index + 1,
        name
      }))
    };
  }
};

window.addEventListener("message", (event) => {
  if (event.data?.type !== "AVTT_BRIDGE_ROLL") return;

  const roll = event.data.roll;
  console.log("AVTT injected roll:", roll);

  window.EXPERIMENTAL_SETTINGS = window.EXPERIMENTAL_SETTINGS || {};
  window.EXPERIMENTAL_SETTINGS["rpgRoller"] = true;

  diceRoller.roll(
    {
      expression: roll.expression,
      rollType: roll.rollType,
      action: roll.action
    },
    false,
    20,
    2,
    undefined,
    roll.damageType || undefined
  );
});

window.addEventListener("message", (event) => {
  if (event.data?.type !== "AVTT_BRIDGE_COMMAND") return;

  const cmd = event.data.command;
  console.log("AVTT injected command:", cmd);

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
        const label = cmd.label || `${ability.toUpperCase()} Check`;

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

        if (!(await window.AVTTBridge.refresh())) {
          console.warn("rollSelectedFormula: no selected monster");
          return;
        }

        const expression = window.AVTTBridge.resolveFormula(formula);
        const action = window.AVTTBridge.resolveLabel(label);

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
        const slot = cmd.slot !== undefined ? Number(cmd.slot) : null;
        const actionName = cmd.action;

        if (!(await window.AVTTBridge.refresh())) {
          console.warn("rollSelectedAction: no selected monster");
          return;
        }

        const monster = window.AVTTBridge.monster;
        const allRolls = window.AVTTBridge.actionRolls;
        const actionNames = window.AVTTBridge.actionNames;

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
        if (!(await window.AVTTBridge.refresh())) {
          window.postMessage({
            type: "AVTT_SELECTED_TOKEN_INFO",
            tokenInfo: null
          }, "*");
          return;
        }

        const tokenInfo = window.AVTTBridge.getTokenInfo();

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
      try {
        if (!(await window.AVTTBridge.refresh())) {
          window.postMessage({
            type: "AVTT_SELECTED_ACTIONS",
            actions: []
          }, "*");
          return;
        }

        const actions = window.AVTTBridge.actionNames.map((name, i) => ({
          slot: i + 1,
          name
        }));

        window.postMessage({
          type: "AVTT_SELECTED_ACTIONS",
          actions
        }, "*");

        console.log("getSelectedActions:", actions);
      } catch (err) {
        console.error("getSelectedActions error:", err);
      }
    })();

    return;
  }
});
