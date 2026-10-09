import { cleanPotions } from '../data/potions.js';
import { cleanSatchel } from '../data/satchel.js';
import { cleanZenith, zenithBonus, zenithXp, MAX_LEVEL } from '../data/zenith.js';
import { cleanRanks, effectiveSkill, setSkillTable } from '../combat/SkillRanks.js';
import { playSkillCast, playSkillImpact } from '../audio/SkillSounds.js';
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { clamp, damp, lerpAngle } from '../core/math.js';
import { createHumanoid, animateHumanoid } from '../entities/HumanoidModel.js';
import { setWeaponAura } from '../visual/WeaponAura.js';
import { applyCosmetics, disposeCosmetics } from '../visual/Cosmetics.js';
import { createMount, updateMount, disposeMount } from '../visual/MountModel.js';
import { MOUNT_BY_ID } from '../data/mounts.js';
import { normalizeLook } from '../data/looks.js';
import { CLASSES, PRIMARY_STAT, SKILLS, getClassSkillPool } from '../combat/Classes.js';
import { getItem, RARITY, resolveItem } from '../inventory/Item.js';
import { weaponFamily, canUseClassSkills, weaponHint, FAMILY_NAMES } from '../combat/WeaponRules.js';

const KEY_TO_AXIS = { KeyW: 1, KeyS: -1 };

setSkillTable(SKILLS);
export class Player {
  constructor(scene, world, audio, particles, bus, save) {
    this.scene = scene; this.world = world; this.audio = audio; this.particles = particles; this.bus = bus;

    const cls = CLASSES[save?.classId] || CLASSES.warrior;
    this.classId = save?.classId || 'warrior';
    this.name = save?.name || 'Aventurier';
    this.skin = typeof save?.skin === 'number' ? save.skin : null;
    this.hairCol = typeof save?.hairCol === 'number' ? save.hairCol : 0x2c1f16;
    this.eyeCol = typeof save?.eyeCol === 'number' ? save.eyeCol : 0x3f78b0;
    this.look = normalizeLook(save?.look); // V10.12 : sexe, taille, corpulence, visage, coiffure (ancienne sauvegarde → apparence d'origine)

    this.pos = save?.pos
      ? new THREE.Vector3(save.pos[0], save.pos[1], save.pos[2])
      : new THREE.Vector3(CONFIG.player.spawn[0], 0, CONFIG.player.spawn[1]);
    this.vel = new THREE.Vector3();
    this.yaw = save?.yaw ?? Math.PI;
    this.grounded = true;
    this.crouch = false;
    this.running = false;
    this.speed = 0;
    this.dead = false;
    this.action = null;
    this.actionT = 0;
    this.actionDur = 0;
    this.actionQueue = null;
    this.invuln = 0;
    this.busyUntil = 0;

    this.level = save?.level || 1;
    this.xp = save?.xp || 0;
    this.coins = save?.coins ?? 25;
    this.potions = cleanPotions(save?.potions); // V10.22 : potions permanentes {owned, heal, mana}
    this.zenith = cleanZenith(save?.zenith); // V10.28 : Zénith { lvl, ranks } — niveaux illimités après le niveau 200
    this.skillRanks = cleanRanks(save?.skillRanks, 200); // V10.26 : rang de chaque compétence
    this.satchel = cleanSatchel(save?.satchel); // V10.26 : besace des matériaux
    this.soldTotal = Math.max(0, Math.floor(save?.soldTotal || 0)); // V10.21 : cumul des ventes (le serveur n'accepte que la hausse)
    this.stats = { str: 5, agi: 5, int: 5, vit: 5, spi: 5, luck: 5, ...(save?.stats || {}) };
    this.statPoints = save?.statPoints || 0;
    this.applyClassBase(cls);
    this.recomputeDerived();
    this.hp = save?.hp ?? this.maxHp;
    this.mana = save?.mana ?? this.maxMana;
    this.stamina = this.maxStamina;
    this.cooldowns = {};
    this.equipEffects = [];
    this.effectCooldowns = {};
    const BAR_SIZE = 10;
    if (save?.skillBar) {
      this.skillBar = new Array(BAR_SIZE).fill(null);
      save.skillBar.forEach((id, i) => { if (i < BAR_SIZE) this.skillBar[i] = id || null; });
    } else {
      const starter = getClassSkillPool(this.classId).filter((s) => s.levelReq <= this.level).slice(0, 4).map((s) => s.id);
      this.skillBar = new Array(BAR_SIZE).fill(null);
      starter.forEach((id, i) => { this.skillBar[i] = id; });
    }

    this._cls = cls;
    this.rig = this._makeRig();
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    scene.add(this.rig.root);
    this.rig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    this.target = null; // ennemi ciblé
    // V3.8 : améliorations temporaires, bouclier, ruée
    this.buffs = []; this.shieldHp = 0; this.shieldT = 0; this.dash = null;
    this.sbDmg = 1; this.sbSpeed = 1; this.sbTaken = 1; this.sbCdr = 1; this.sbCrit = 0; this.sbRegen = 0; this.sbLifesteal = 0;
  }

  // ---------- V3.8 : améliorations temporaires (buffs) ----------
  // b = { id, name, icon, t, dmg, speed, taken, cdr, crit, regen, lifesteal } ; remplace un buff du même id.
  addBuff(b) {
    const i = this.buffs.findIndex((x) => x.id === b.id);
    const nb = { ...b, left: b.t };
    if (i >= 0) this.buffs[i] = nb; else this.buffs.push(nb);
    this._recomputeBuffs();
    this.bus.emit('buffs');
  }
  addShield(pct, sec) {
    this.shieldHp = Math.max(this.shieldHp, Math.round(this.maxHp * pct)); this.shieldMax = this.shieldHp; this.shieldT = sec;
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: `Bouclier ${this.shieldHp}`, color: '#9fe8ff' });
    this.bus.emit('buffs');
  }
  clearBuffs() { this.buffs.length = 0; this.shieldHp = 0; this.shieldT = 0; this.dash = null; this._recomputeBuffs(); this.bus.emit('buffs'); }
  _recomputeBuffs() {
    let dmg = 1, speed = 0, taken = 1, cdr = 0, crit = 0, regen = 0, ls = 0;
    for (const b of this.buffs) {
      if (b.dmg) dmg *= 1 + b.dmg;
      speed += b.speed || 0; if (b.taken) taken *= b.taken; cdr += b.cdr || 0; crit += b.crit || 0; regen += b.regen || 0; ls += b.lifesteal || 0;
    }
    this.sbDmg = dmg; this.sbSpeed = Math.max(0.4, 1 + speed); this.sbTaken = taken; this.sbCdr = Math.max(0.35, 1 - cdr); this.sbCrit = crit; this.sbRegen = regen; this.sbLifesteal = ls;
  }
  _tickBuffs(dt) {
    let changed = false;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      this.buffs[i].left -= dt;
      if (this.buffs[i].left <= 0) { this.buffs.splice(i, 1); changed = true; }
    }
    if (this.shieldHp > 0) { this.shieldT -= dt; if (this.shieldT <= 0) { this.shieldHp = 0; changed = true; } }
    if (changed) { this._recomputeBuffs(); this.bus.emit('buffs'); }
    if (this.sbRegen > 0 && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.sbRegen * dt);
  }
  // ruée (charge, bond, pas de côté) : se déplace en ~0,2 s ; dir en radians (monde)
  startDash(dist, dirX, dirZ, t = 0.2) {
    if (dist < 0.3) return;
    this.dash = { dx: dirX, dz: dirZ, v: dist / t, t };
  }
  // téléportation courte vers l'avant (s'arrête avant un obstacle)
  blink(dist) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const from = this.pos.clone();
    let best = 0;
    for (let d = 1; d <= dist; d += 1) if (this.world.isWalkable(this.pos.x + fx * d, this.pos.z + fz * d, CONFIG.player.radius)) best = d; else break;
    this.pos.x += fx * best; this.pos.z += fz * best;
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    this.bus.emit('particles', { pos: from.clone().add({ x: 0, y: 1, z: 0 }), color: 0xb888ff, count: 28, speed: 3, life: 0.6 });
    this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 1, z: 0 }), color: 0xb888ff, count: 28, speed: 3, life: 0.6 });
  }

  applyClassBase(cls) {
    this.baseHp = 90; this.baseMana = this.classId === 'archer' ? 120 : 60; this.baseStamina = 100;
    this.classDef = cls;
  }

  recomputeDerived() {
    const s = this.stats, lvl = this.level, eq = this._mergedBonus();
    const rb = this.riftBonus || {};
    this.maxHp = Math.round((this.baseHp + (s.vit + (eq.vit || 0)) * 12 + lvl * 8 + (eq.hp || 0)) * (1 + (rb.hpPct || 0)) * (1 + (eq.allPct || 0)));
    this.maxMana = Math.round(this.baseMana + (s.int + (eq.int || 0)) * 10 + lvl * 4 + (eq.mana || 0));
    this.maxStamina = Math.round(this.baseStamina + (s.agi + (eq.agi || 0)) * 4);
    const prim = PRIMARY_STAT[this.classId] || 'str';
    const offStat = (k) => (s[k] + (eq[k] || 0)) * (k === prim ? 1.6 : 0.4);
    this.atk = Math.round((6 + offStat('str') + offStat('int') + offStat('agi') + lvl * 1.1 + (eq.atk || 0)) * (1 + (rb.atkPct || 0)) * (1 + (eq.allPct || 0)));
    this.def = Math.round((2 + (s.vit + (eq.vit || 0)) * 0.8 + lvl * 0.6 + (eq.def || 0)) * (1 + (eq.allPct || 0)));
    this.critChance = clamp(0.04 + (eq.crit || 0), 0, 0.75); // V7.2 : plus de critique via les points de stats
    this.critMult = clamp(1.8 + (s.luck + (eq.luck || 0)) * 0.006 + (eq.critDmgPct || 0) + (rb.critDmg || 0), 1.5, 9);
    this.dodge = clamp((s.agi + (eq.agi || 0)) * 0.002, 0, 0.35);
    this.xpNeeded = this.level >= MAX_LEVEL ? zenithXp(this.zenith.lvl) : Math.round(60 * Math.pow(this.level, 1.5) + 40); // après le niveau 200 : l'XP fait monter le Zénith

    // Statistiques secondaires issues des affixes d'objets (voir affixPool.js)
    this.cooldownMult = clamp(1 - (eq.atkSpeedPct || 0) - (eq.cdrPct || 0) - (rb.cdr || 0), 0.3, 1); // vitesse d'attaque : réduit les temps de recharge
    this.fireRes = clamp(eq.fireResPct || 0, 0, 0.8);
    this.iceRes = clamp(eq.iceResPct || 0, 0, 0.8);
    this.lightningRes = clamp(eq.lightningResPct || 0, 0, 0.8);
    this.dmgReduction = clamp(eq.dmgReductionPct || 0, 0, 0.6);
    this.hpRegen = eq.hpRegen || 0;
    this.manaRegen = eq.manaRegen || 0;
    this.moveSpeedBonus = clamp(eq.moveSpeedPct || 0, 0, 0.3);
    this.xpBonus = clamp(eq.xpPct || 0, 0, 1);
    this.goldBonus = clamp(eq.goldPct || 0, 0, 2);
    this.staRegenBonus = clamp(eq.staRegenPct || 0, 0, 1.5);
    // V10.26 : bonus des objets de build
    this.skillRadPct = clamp(eq.skillRadPct || 0, 0, 2);
    this.skillDmgPct = clamp(eq.skillDmgPct || 0, 0, 3);
    this.bossDmgPct = clamp(eq.bossDmgPct || 0, 0, 3);
    this.lifestealPct = clamp(eq.lifestealPct || 0, 0, 0.3);
    this.costRedPct = clamp(eq.costRedPct || 0, 0, 0.6);
    this.killHealPct = clamp(eq.killHealPct || 0, 0, 0.2);
  }

  // Liste des effets spéciaux (sorts automatiques) actuellement fournis par
  // l'équipement — voir combat/ItemEffects.js pour leur déclenchement réel.
  setEquipEffects(effects) {
    this.equipEffects = effects;
    this.effectCooldowns = this.effectCooldowns || {};
    for (const id of Object.keys(this.effectCooldowns)) {
      if (!effects.some((e) => e.id === id)) delete this.effectCooldowns[id];
    }
  }

  // V3.7 : bonus permanents des cristaux de spire
  setRiftBonus(b) { this.riftBonus = b; this.recomputeDerived(); this.hp = Math.min(this.hp, this.maxHp); }

  // équipement + arbre du Zénith (V10.28)
  _mergedBonus() {
    const eq = this.equipBonus || {};
    if (!this._zb) this._zb = zenithBonus(this.zenith, PRIMARY_STAT[this.classId] || 'str');
    const out = { ...eq };
    for (const [k, v] of Object.entries(this._zb)) out[k] = (out[k] || 0) + v;
    return out;
  }
  refreshZenith() { this._zb = null; this.recomputeDerived(); this.hp = Math.min(this.hp, this.maxHp); this.bus.emit('hud'); }

  setSkillMods(m) { this.skillMods = m || {}; } // V10.27 : empreintes de compétence de l'équipement {id: {dmg, rad, cd, cost}}

  setEquipBonus(b) { this.equipBonus = b; this.recomputeDerived(); }

  // ---------- Compétences : pool de la classe, déblocage par niveau, barre configurable ----------
  getSkillPool() { return getClassSkillPool(this.classId); }
  getUnlockedSkills() { return this.getSkillPool().filter((s) => s.levelReq <= this.level); }
  isSkillUnlocked(id) { const s = SKILLS[id]; return !!s && s.levelReq <= this.level && (s.classId === null || s.classId === this.classId); }

  // Place (ou retire avec id=null) une compétence débloquée dans un emplacement de la barre (0-9).
  setBarSlot(index, id) {
    if (index < 0 || index >= this.skillBar.length) return false;
    if (id !== null && !this.isSkillUnlocked(id)) return false;
    this.skillBar[index] = id;
    this.bus.emit('skillBarChanged');
    return true;
  }

  // Teinte les pièces visibles (arme, bouclier, torse, cape) selon la rareté
  // de l'objet équipé — retour visuel simple en l'absence de vrais modèles 3D.
  // Met à jour l'apparence du personnage pour qu'elle corresponde exactement à
  // l'équipement porté : affiche la pièce correspondante (arme/bouclier/
  // casque/épaulières/plastron/cape) quand équipée, la cache sinon, et teinte
  // selon la rareté de l'objet.
  // V10.1 : cosmétiques de la boutique (aura d'arme, cercle, traînée, ailes) — identifiants du catalogue
  _makeRig() {
    const cls = this._cls;
    return createHumanoid({ ...(this.skin != null ? { skin: this.skin } : {}), cloth: cls.color, armor: cls.armor, hair: this.hairCol, eye: this.eyeCol, look: this.look, equipVisible: false, role: 'player:' + this.classId });
  }

  // V10.12 : nouvelle apparence (barbier) — reconstruit le modèle en gardant position, équipement et cosmétiques.
  setAppearance({ look, hairCol, eyeCol }) {
    this.look = normalizeLook(look);
    if (Number.isInteger(hairCol)) this.hairCol = hairCol;
    if (Number.isInteger(eyeCol)) this.eyeCol = eyeCol;
    const old = this.rig;
    this.rig = this._makeRig();
    this.rig.root.position.copy(old.root.position);
    this.rig.root.rotation.y = old.root.rotation.y;
    this.scene.add(this.rig.root);
    this.rig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    try { disposeCosmetics(old); } catch { /* ignoré */ }
    this.scene.remove(old.root);
    old.root.traverse((o) => { if (o.isMesh && !o.geometry.userData?.shared) o.geometry.dispose(); });
    this.setCosmetics(this.cos); // réapplique cosmétiques + équipement visible + aura d'arme
  }

  appearance() {
    return { look: this.look, skin: this.skin, hairCol: this.hairCol, eyeCol: this.eyeCol };
  }

  setCosmetics(cos) {
    this.cos = cos || {};
    try { applyCosmetics(this.rig, this.cos); } catch (e) { console.warn('[V10.1] cosmétiques', e); }
    if (this._equipRef) this.refreshGearVisuals(this._equipRef);
  }

  refreshGearVisuals(equipment) {
    const ev = this.rig.equipVisuals;
    if (!ev) return;
    const tint = (mat, slotItem) => {
      if (!mat) return;
      const view = slotItem && resolveItem(slotItem);
      mat.color.set((view && (view.tint || view.rarityInfo?.color)) || mat.userData.__base);
    };
    this._equipRef = equipment;
    const s = equipment.slots;

    // Arme principale : affiche le mesh correspondant au type visuel de l'objet équipé.
    const mainView = s.mainhand && resolveItem(s.mainhand);
    const visualType = mainView?.visual || null;
    for (const [type, mesh] of Object.entries(ev.weapons)) mesh.visible = type === visualType;
    if (visualType) tint(this.rig.matRefs.weapons[visualType], s.mainhand);
    try { setWeaponAura(this.rig, mainView?.rarityInfo?.id, visualType, this.cos?.aura); } catch (e) { console.warn('[V9.4] aura d\'arme indisponible', e); }

    { // V10.26 : l'objet secondaire change d'apparence selon sa famille (bouclier, orbe, carquois, dague)
      const offView = s.offhand && resolveItem(s.offhand), kind = offView ? (offView.visual || 'shield') : null;
      for (const [k, grp] of Object.entries(ev.offs || { shield: ev.shield })) grp.visible = k === kind;
      if (kind && this.rig.matRefs[kind === 'shield' ? 'shield' : kind]) tint(this.rig.matRefs[kind], s.offhand);
      this.rig._shieldHid = false;
    }

    ev.helm.visible = !!s.head;
    if (this.rig.customHair) this.rig.customHair.visible = !(s.head && this.rig.hairBulky); // V10.12 : volume de cheveux sous le casque
    tint(this.rig.matRefs.helm, s.head);

    const shouldersOn = !!s.shoulders;
    ev.shoulders[0].visible = ev.shoulders[1].visible = shouldersOn;
    tint(this.rig.matRefs.shoulders, s.shoulders);

    ev.chest.visible = !!s.chest;
    tint(this.rig.matRefs.chest, s.chest);

    ev.cape.visible = !!s.cape;
    tint(this.rig.matRefs.cape, s.cape);
  }

  gainXp(n) {
    if (this.dead) return;
    n = Math.round(n * (1 + ((this.riftBonus && this.riftBonus.xpPct) || 0) + (this.xpBonus || 0)));
    this.xp += n;
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: `+${n} XP`, color: '#8fd0ff' });
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      if (this.level >= MAX_LEVEL) { // V10.28 : niveau de Zénith (1 point par niveau, sans limite)
        this.zenith.lvl++;
        this.xpNeeded = zenithXp(this.zenith.lvl);
        this.audio.play('levelup');
        this.bus.emit('zenithUp', this.zenith.lvl);
        this.bus.emit('particles', { pos: this.pos.clone(), color: 0xb58cff, count: 70, speed: 5, life: 1.2, up: 3 });
        continue;
      }
      this.level++;
      this.statPoints += 5;
      this.recomputeDerived();
      this.hp = this.maxHp; this.mana = this.maxMana;
      this.audio.play('levelup');
      this.bus.emit('levelup', this.level);
      this.bus.emit('particles', { pos: this.pos.clone(), color: 0xffe28a, count: 60, speed: 5, life: 1.1, up: 3 });
    }
    this.bus.emit('hud');
  }

  addCoins(n) { this.coins += n; this.bus.emit('hud'); }
  // V10.22 : retourne true si la potion est nouvelle
  addPotion(id) { if (this.potions.owned.includes(id)) return false; this.potions.owned.push(id); return true; }
  addSale(n) { n = Math.max(0, Math.floor(n)); this.soldTotal += n; this.addCoins(n); } // V10.21

  spendStatPoint(statName) {
    if (this.statPoints <= 0 || !(statName in this.stats)) return false;
    this.stats[statName]++;
    this.statPoints--;
    this.recomputeDerived();
    this.bus.emit('hud');
    return true;
  }

  takeDamage(dmg, opts = {}) {
    if (this.dead || this.invuln > 0) return 0;
    if (!opts.guaranteed && Math.random() < this.dodge) {
      this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: 'ESQUIVE', color: '#9fd8ff' });
      return 0;
    }
    let adjusted = dmg;
    if (opts.dmgType === 'fire') adjusted *= (1 - this.fireRes);
    else if (opts.dmgType === 'ice') adjusted *= (1 - this.iceRes);
    else if (opts.dmgType === 'lightning') adjusted *= (1 - this.lightningRes);
    adjusted *= (1 - this.dmgReduction) * (this.takenMult || 1) * (this.sbTaken || 1);
    // V10.18 : la défense réduit les dégâts en pourcentage (rendements décroissants) au lieu de les soustraire : un équipement très défensif ne rend plus invulnérable
    const dr = Math.min(0.75, this.def / (this.def + 6 * this.level + 60)); // V10.19 : la défense compte davantage
    let final = Math.max(1, Math.round(adjusted * (1 - dr)));
    if (this.shieldHp > 0) { // le bouclier absorbe d'abord
      const ab = Math.min(this.shieldHp, final);
      this.shieldHp -= ab; final -= ab;
      this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.4, z: 0 }), text: `🛡 ${ab}`, color: '#9fe8ff' });
      if (this.shieldHp <= 0) { this.shieldT = 0; this.bus.emit('buffs'); }
    }
    this.hp = Math.max(0, this.hp - final);
    this.invuln = 0.4;
    this.rig.hurtT = 1;
    this.audio.play('hurt');
    if (final > 0) this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: `${final}`, color: '#ff5a5a' });
    this.bus.emit('shake', 0.25);
    this.bus.emit('hud');
    this.bus.emit('playerHurt');
    if (this.hp <= 0) this.die();
    return final;
  }

  heal(amount, quiet = false) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (!quiet) this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: `+${Math.round(amount)}`, color: '#6dffb0' });
    this.bus.emit('hud');
  }

  restoreMana(amount) {
    this.mana = Math.min(this.maxMana, this.mana + amount);
    this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: `+${Math.round(amount)} 🔵`, color: '#6db0ff' });
    this.bus.emit('hud');
  }

  // Applique les effets d'un consommable (potions). Retourne true si utilisé.
  useConsumable(def) {
    if (this.dead) return false;
    const s = def.stats || {};
    let used = false;
    if (s.healPct) { this.heal(this.maxHp * s.healPct); used = true; }
    if (s.manaPct) { this.restoreMana(this.maxMana * s.manaPct); used = true; }
    return used;
  }

  die() {
    this.dead = true; this.clearBuffs();
    this.action = null;
    this.actionT = 0;
    this.audio.play('death');
    this.bus.emit('playerDeath');
  }

  respawn() {
    this.dead = false;
    this.hp = this.maxHp; this.mana = this.maxMana; this.stamina = this.maxStamina;
    this.pos.copy(this.world.spots.spawn || new THREE.Vector3(0, 0, 12));
    this.vel.set(0, 0, 0);
    this.invuln = 1.2;
    this.bus.emit('hud');
  }

  // V10.10 — monture : null = à pied. Les chevaux vont au sol ; les griffons survolent eau, falaises et obstacles.
  setMount(id) {
    const def = id ? MOUNT_BY_ID[id] : null;
    if (!def) {
      if (this._mountRig) { disposeMount(this._mountRig); this._mountRig = null; }
      this.mount = null; this.flying = false; this.landing = false;
      return;
    }
    if (this.mount && this.mount.id === def.id) return;
    if (this._mountRig) disposeMount(this._mountRig);
    this.mount = def; this._mountRig = createMount(def); this.scene.add(this._mountRig.group);
    this._mountRig.group.position.copy(this.pos);
    this.flying = !!def.fly; this.landing = false; this.dash = null;
  }

  // V10.18 : mode de déplacement pour le terrain : griffon 'fly', cheval 'swim' (traverse l'eau), à pied undefined
  get moveMode() { return !this.mount ? undefined : this.flying ? 'fly' : 'swim'; }

  // Descente : cheval = immédiat ; griffon = atterrissage progressif (refusé au-dessus de l'eau / d'un obstacle). -> 'ok' | 'landing' | 'blocked'
  requestDismount() {
    if (!this.mount) return 'ok';
    if (!this.flying) { this.setMount(null); return 'ok'; }
    this.landing = true;
    return 'landing';
  }

  tryUseSkill(id, enemies) {
    if (this.mount) { // on ne combat pas depuis les airs ; au sol on descend de cheval pour attaquer
      if (this.flying) { this.bus.emit('notify', { text: 'Pose-toi (bouton 🐎) pour combattre.', kind: 'info' }); return false; }
      this.setMount(null);
    }
    if (this.dead) return false;
    const s0 = SKILLS[id];
    if (!s0 || !this.isSkillUnlocked(id)) return false;
    const s = effectiveSkill(s0, this); // V10.26 : rang + progression de niveau + objets de build
    if (this.busyUntil > performance.now() / 1000) { // V10.24 : tampon de saisie — la compétence pressée juste avant la fin de l'animation part dès que possible
      if (this.busyUntil - performance.now() / 1000 < 0.45 && (this.cooldowns[id] || 0) < 0.45) this._qSkill = { id, until: performance.now() / 1000 + 0.5 };
      return false;
    }
    const cd = this.cooldowns[id] || 0;
    if (cd > 0) return false;
    // arme attitrée : les compétences de classe exigent une arme de la famille de la classe
    const fam = weaponFamily(this._equipRef);
    if (s.classId && !canUseClassSkills(this.classId, fam)) {
      const now = performance.now();
      if (!this._wpnMsgT || now - this._wpnMsgT > 1200) {
        this._wpnMsgT = now;
        this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: `Arme requise : ${weaponHint(this.classId)}`, color: '#ff8a65' });
      }
      return false;
    }
    // frappe de base : l'arc / l'arbalète tirent beaucoup plus loin
    let sk = s;
    if (s.id === 'strike' && (fam === 'bow' || fam === 'crossbow')) sk = { ...s, range: 16 };
    const cost = s.cost || {};
    if ((cost.mana || 0) > this.mana || (cost.stamina || 0) > this.stamina) {
      this.bus.emit('floatText', { pos: this.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: 'Pas assez de ressource', color: '#ffd166' });
      return false;
    }
    if (!this.freeCost) { this.mana -= cost.mana || 0; this.stamina -= cost.stamina || 0; }
    this.cooldowns[id] = s.cooldown * this.cooldownMult * (this.cdBuff || 1) * (this.sbCdr || 1);
    if (!s.aoe && this.target && this.target.alive) {
      const to = this.target.pos.clone().sub(this.pos);
      if (to.x || to.z) this.yaw = Math.atan2(to.x, to.z);
    }
    const fxs = s.fx;
    if (fxs && (fxs.dash || fxs.blink)) this._startMoveSkill(fxs);
    this.action = s.anim;
    this.actionT = 0;
    this.actionDur = s.duration;
    this.busyUntil = performance.now() / 1000 + s.duration;
    if (s.id === 'strike') this.audio.play(fam === 'bow' || fam === 'crossbow' ? 'bow' : ['staff', 'wand', 'tome'].includes(fam) ? 'cast' : 'swing');
    else playSkillCast(this.audio, s, this.classId);
    this.pendingSkill = sk;
    this._skillFired = false;
    this.bus.emit('hud');
    return true;
  }

  // bond / charge / pas de côté / téléportation d'une compétence
  _startMoveSkill(fx) {
    if (fx.blink) { this.blink(fx.blink); return; }
    const d = fx.dash; // { to: 'target' | 'fwd' | 'back', d }
    let dx = Math.sin(this.yaw), dz = Math.cos(this.yaw), dist = d.d;
    if (d.to === 'target' && this.target && this.target.alive) {
      const to = this.target.pos.clone().sub(this.pos); to.y = 0;
      const L = to.length();
      if (L > 0.01) { dx = to.x / L; dz = to.z / L; dist = Math.min(d.d, Math.max(0, L - 1.6)); }
    } else if (d.to === 'back') {
      if (this.target && this.target.alive) {
        const to = this.pos.clone().sub(this.target.pos); to.y = 0;
        const L = to.length(); if (L > 0.01) { dx = to.x / L; dz = to.z / L; }
      } else { dx = -dx; dz = -dz; }
    }
    this.startDash(dist, dx, dz, d.t || 0.2);
  }

  update(dt, input, cameraYaw, enemiesForResolve) {
    if (this.dead && this.mount) this.setMount(null);
    if (this.dead) { this.dash = null; animateHumanoid(this.rig, { speed: 0, grounded: true, dead: true, actionT: this.actionT }, dt); this.actionT += dt; return; }
    this.invuln = Math.max(0, this.invuln - dt);
    if (this._rollDust > 0) { // poussière derrière la roulade
      this._rollDust -= dt;
      if (this.dash) this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 0.1, z: 0 }), color: 0xb8a888, count: 3, speed: 1.2, life: 0.45 });
    }
    this.stamina = Math.min(this.maxStamina, this.stamina + dt * 12 * (1 + (this.staRegenBonus || 0)));
    this.mana = Math.min(this.maxMana, this.mana + dt * (3 + this.stats.spi * 0.3) + dt * this.manaRegen + (this.classId === 'archer' ? dt * 3.5 : 0));
    if (this.freeCost) { this.mana = this.maxMana; this.stamina = this.maxStamina; }
    if (this.hpRegen > 0 && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + dt * this.hpRegen);
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this._tickBuffs(dt);
    if (this._qSkill) { const now = performance.now() / 1000; if (now > this._qSkill.until) this._qSkill = null; else if (this.busyUntil <= now) { const q = this._qSkill; this._qSkill = null; this.tryUseSkill(q.id); } }

    const mv = input.moveVector();
    this.crouch = input.down('crouch');
    this.running = input.down('run') && !this.crouch;
    const busy = this.busyUntil > performance.now() / 1000;
    // V10.19 : on peut se déplacer (marche ou course) pendant qu'une compétence est lancée ; seule la roulade immobilise.
    // Pendant le lancer, le personnage garde sa direction de visée et se déplace en « strafe » vers où pointe le joystick.
    const casting = busy && !!this.action && this.action !== 'roll' && !this.dash;
    const moving = (mv.x || mv.y) && (!busy || casting);

    if (moving) {
      const worldAngle = Math.atan2(mv.x, mv.y) + cameraYaw;
      if (!casting) {
        this.yaw = lerpAngle(this.yaw, worldAngle, Math.min(1, dt * 14));
        this.yaw = ((this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      }
      this._moveAng = casting ? worldAngle : this.yaw;
      const base = this.mount ? CONFIG.player.run * 0.8 * this.mount.speed : (this.crouch ? CONFIG.player.crouch : this.running && this.stamina > 1 ? CONFIG.player.run : CONFIG.player.walk);
      const spd = base * (this.swimming ? 0.7 : 1) * (this.speedMult || 1) * (this.sbSpeed || 1) * (1 + (this.moveSpeedBonus || 0));
      if (this.running && this.stamina > 1 && !this.crouch && !this.mount) this.stamina = Math.max(0, this.stamina - dt * 16);
      this.speed = damp(this.speed, spd, 10, dt);
    } else {
      this.speed = damp(this.speed, 0, 10, dt);
    }
    if (this.dash) { // ruée : déplacement imposé, bloqué par les obstacles
      const dd = this.dash, step = dd.v * Math.min(dt, dd.t);
      const nx = this.pos.x + dd.dx * step, nz = this.pos.z + dd.dz * step;
      if (this.world.canStep(this.pos.x, this.pos.z, nx, nz) && !this.world.blockedCircle(nx, nz, CONFIG.player.radius)) { this.pos.x = nx; this.pos.z = nz; } else dd.t = 0;
      this.speed = Math.max(this.speed, 8);
      dd.t -= dt;
      if (dd.t <= 0) this.dash = null;
    } else if (this.speed > 0.05) {
      // V8.6 : l'eau, le bord du monde et les falaises bloquent ; on glisse le long de l'obstacle (axe par axe)
      const x0 = this.pos.x, z0 = this.pos.z;
      const ma = this._moveAng ?? this.yaw;
      let nx = x0 + Math.sin(ma) * this.speed * dt, nz = z0 + Math.cos(ma) * this.speed * dt;
      const w = this.world;
      const mm = this.moveMode;
      if (!this.flying && !w.canStep(x0, z0, nx, nz, mm)) {
        if (w.canStep(x0, z0, nx, z0, mm)) nz = z0;
        else if (w.canStep(x0, z0, x0, nz, mm)) nx = x0;
        else { nx = x0; nz = z0; }
      }
      this.pos.x = nx; this.pos.z = nz;
    }

    // V4.0 : la roulade remplace le saut (Espace / bouton ⤴). Esquive courte : brève invulnérabilité, coûte un peu d'endurance.
    this.rollCd = Math.max(0, (this.rollCd || 0) - dt);
    const spaceNow = input.down('roll');
    const wantRoll = input.action('roll') || input.action('jump') || (spaceNow && !this._spaceWas);
    this._spaceWas = spaceNow;
    if (wantRoll) {
      input.actions.delete('roll'); input.actions.delete('jump');
      if (this.grounded && !this.mount && !busy && !this.dash && this.rollCd <= 0 && this.stamina >= 10) {
        if (mv.x || mv.y) this.yaw = Math.atan2(mv.x, mv.y) + cameraYaw;
        this.startDash(5.2, Math.sin(this.yaw), Math.cos(this.yaw), 0.5);
        this.action = 'roll'; this.actionT = 0; this.actionDur = 0.5;
        this.busyUntil = performance.now() / 1000 + 0.5;
        this.invuln = Math.max(this.invuln, 0.42);
        this.stamina -= 10; this.rollCd = 0.9;
        this.pendingSkill = null;
        this.audio.play('roll');
        this.bus.emit('particles', { pos: this.pos.clone().add({ x: 0, y: 0.15, z: 0 }), color: 0xcdbd9a, count: 14, speed: 2.2, life: 0.55 });
        this._rollDust = 0.28;
        this.bus.emit('tut', 'roll');
      }
    }
    const wasGrounded = this.grounded, stickable = wasGrounded && this.vel.y <= 0;
    let groundY = this.world.heightAt(this.pos.x, this.pos.z), fallV = this.vel.y;
    // V10.18 : le cheval nage : il flotte à la surface (le fond est plus bas), éclaboussures et allure réduite
    this.swimming = !!this.mount && !this.flying && groundY < this.world.waterLevel - 0.15;
    if (this.swimming) groundY = this.world.waterLevel - 0.3;
    if (this.flying) { // V10.10 : vol du griffon — altitude de croisière au-dessus du terrain (ou de l'eau), atterrissage en douceur
      const gy = Math.max(groundY, this.world.waterLevel);
      this.pos.y = damp(this.pos.y, this.landing ? groundY : gy + 4.8, this.landing ? 2.4 : 2.8, dt);
      this.vel.y = 0; this.grounded = false; fallV = 0;
      if (this.landing && this.pos.y - groundY < 0.4) {
        if (this.world.isWalkable(this.pos.x, this.pos.z, CONFIG.player.radius)) { this.pos.y = groundY; this.grounded = true; this.setMount(null); this.audio.play('land'); }
        else { this.landing = false; this.bus.emit('notify', { text: 'Impossible d\u2019atterrir ici (eau ou obstacle). Cherche un terrain dégagé.', kind: 'info' }); }
      }
    } else {
      this.vel.y -= CONFIG.player.gravity * dt;
      this.pos.y += this.vel.y * dt;
      fallV = this.vel.y;
      if (this.pos.y <= groundY) { this.pos.y = groundY; this.vel.y = 0; this.grounded = true; }
      else if (stickable && this.pos.y - groundY < 0.7) { this.pos.y = groundY; this.vel.y = 0; this.grounded = true; } // colle au sol en descente (évite les faux « sauts »)
      else this.grounded = false;
    }
    // pose « en l'air » seulement après un vrai décollage (sinon la course saccade sur les pentes)
    this.airT = this.grounded ? 0 : (this.airT || 0) + dt;
    if (this.grounded && !wasGrounded && fallV < -6) this.audio.play('land');
    // bruits de pas : cadence liée à la distance parcourue (pierre en ville, herbe ailleurs)
    if (this.grounded && !this.crouch && this.speed > 1.2) {
      const run = this.speed > CONFIG.player.walk * 1.3;
      this._stepD = (this._stepD ?? 1.5) + this.speed * dt;
      if (this._stepD > (run ? 2.5 : 1.9)) {
        this._stepD = 0;
        // (V6.1 : bruits de pas supprimés à la demande)
      }
    } else if (this.speed <= 1.2) this._stepD = 1.5;

    if (!(this.flying && this.pos.y - groundY > 1.5)) this.world.pushOut(this.pos, CONFIG.player.radius);
    if (this.pos.x < 1500) { // (l'arène des spires est hors de la carte : pas de limite)
      this.pos.x = clamp(this.pos.x, -CONFIG.world.bound, CONFIG.world.bound);
      this.pos.z = clamp(this.pos.z, -CONFIG.world.bound, CONFIG.world.bound);
    }

    if (this.pendingSkill && this.actionT >= this.pendingSkill.duration * 0.35 && !this._skillFired) {
      this._skillFired = true;
      this.bus.emit('playerSkillHit', this.pendingSkill);
      { const ps = this.pendingSkill, tp = this.target && this.target.alive ? this.target.pos : this.pos.clone().add({ x: Math.sin(this.yaw) * 3, y: 0, z: Math.cos(this.yaw) * 3 }); playSkillImpact(this.audio, ps, this.classId, tp); }
    }
    if (this.action) {
      this.actionT += dt;
      if (this.actionT >= this.actionDur) { this.action = null; this.actionT = 0; this.pendingSkill = null; this._skillFired = false; }
    }

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    if (this._mountRig) { // V10.10 : le cavalier est assis sur la monture
      const mr = this._mountRig;
      mr.group.position.copy(this.pos); mr.group.rotation.y = this.yaw;
      updateMount(mr, dt, this.speed, this.flying);
      this.rig.root.position.y += mr.seat;
    }
    animateHumanoid(this.rig, { speed: this.mount ? 0 : this.speed, grounded: this.mount ? true : this.grounded || (this.airT || 0) < 0.14, action: this.action, actionT: this.actionT, actionDur: this.actionDur, dead: false, crouch: this.crouch || !!this.mount }, dt);
  }

  serialize() {
    return {
      classId: this.classId, name: this.name, skin: this.skin, hairCol: this.hairCol, eyeCol: this.eyeCol, look: this.look, pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw,
      level: this.level, xp: this.xp, coins: this.coins, soldTotal: this.soldTotal, potions: this.potions, satchel: this.satchel, skillRanks: this.skillRanks, zenith: this.zenith, stats: this.stats, statPoints: this.statPoints, hp: this.hp, mana: this.mana,
      skillBar: this.skillBar
    };
  }
}
