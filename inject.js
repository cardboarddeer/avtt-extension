

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

    if (this.token.options?.itemType === "pc") {
      const characterId = this.token.options.characterId;
      this.pc = window.pcs?.find(p => p.characterId === characterId) || null;
      if (this.pc) return true;
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

  if (cmd.command === "toggleCondition") {
    const condition = String(cmd.condition || "prone").toLowerCase();

    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS[id];
      if (!token) return;

      const nativeConditions = token.options.conditions || [];

      const hasCondition = nativeConditions.some(c => {
        const name = typeof c === "string" ? c : c.name;
        return String(name || "").toLowerCase() === condition;
      });

      if (hasCondition) {
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

        if (!(await window.AVTTBridge.refresh())) {
          console.warn("rollSelectedFormula: no selected monster/token");
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