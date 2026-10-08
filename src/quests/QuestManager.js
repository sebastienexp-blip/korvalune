// Journal de quêtes minimal mais extensible : chaque quête déclare ses objectifs
// et progresse via des événements du bus (kill:<id>, talk:<id>, reach:<zone>...).
const DEFS = [
  {
    id: 'commencement', name: 'Le commencement', level: 1,
    steps: [
      { id: 'move', text: 'Se déplacer dans Korvalune', type: 'auto' },
      { id: 'talk_guard', text: 'Parler au garde Halvar', type: 'talk', target: 'guard' },
      { id: 'kill_wolf', text: 'Tuer un loup', type: 'kill', target: 'wolf', need: 1 },
      { id: 'loot', text: 'Récupérer le butin', type: 'auto' },
      { id: 'return_guard', text: 'Retourner voir le garde', type: 'talk', target: 'guard' }
    ],
    reward: { xp: 80, coins: 30 }
  }
];

export class QuestManager {
  constructor(bus, save, extraDefs = []) {
    this.bus = bus;
    this.defs = [...DEFS, ...extraDefs];
    this.active = new Map();
    this.completed = new Set(save?.completed || []);
    this.progress = new Map(Object.entries(save?.progress || {}));
    this.savedCounts = save?.counts || {};
    bus.on('enemyKilled', (e) => this._onEvent('kill', e.def.id));
    bus.on('bossKilled', (bossId) => this._onEvent('killBoss', bossId));
    bus.on('talk', (npcId) => this._onEvent('talk', npcId));
    bus.on('tut', (name) => this._onEvent('event', name)); // V4.0 : étapes de tutoriel (ouvrir l'inventaire, équiper…)
    // V4.0 : une nouvelle partie commence par la chaîne de tutoriel ; « Le commencement » suit à la fin.
    bus.on('questCompleted', (def) => { if (def.next) this.start(def.next); });
    if (!this.completed.size && !this.progress.size) this.start('tuto_1');
    else if (save?.active) for (const id of save.active) this.start(id, true);
  }

  start(id, silent = false) {
    if (this.completed.has(id) || this.active.has(id)) return;
    const def = this.defs.find((d) => d.id === id);
    if (!def) return;
    this.active.set(id, { def, stepIndex: this.progress.get(id) || 0, counts: { ...(this.savedCounts[id] || {}) } });
    if (!silent) this.bus.emit('questStarted', def);
    this._skipAutoSteps(id);
    this.bus.emit('questUpdated', this);
  }

  currentStep(q) { return q.def.steps[q.stepIndex]; }

  // --- utilitaires pour le Tableau des contrats (quêtes secondaires) ---
  status(id) {
    if (this.completed.has(id)) return 'done';
    if (this.active.has(id)) return 'active';
    return 'available';
  }
  secondaryQuestsForTier(tierId) { return this.defs.filter((d) => d.secondary && d.tierId === tierId); }
  activeSecondaryCount() { return [...this.active.values()].filter((q) => q.def.secondary).length; }

  // Les étapes de type "auto" (ex: "Se déplacer", "Récupérer le butin") sont
  // des jalons narratifs sans condition propre : elles se valident aussitôt
  // atteintes pour ne jamais bloquer le joueur.
  _skipAutoSteps(id) {
    const q = this.active.get(id);
    if (!q) return;
    while (q.def.steps[q.stepIndex] && q.def.steps[q.stepIndex].type === 'auto') {
      q.stepIndex++;
      this.progress.set(id, q.stepIndex);
      if (q.stepIndex >= q.def.steps.length) { this.complete(id); return; }
    }
  }

  advance(id) {
    const q = this.active.get(id);
    if (!q) return;
    const done = q.def.steps[q.stepIndex];
    q.stepIndex++;
    this.progress.set(id, q.stepIndex);
    if (done && done.give) this.bus.emit('questGive', done.give);
    if (q.stepIndex >= q.def.steps.length) this.complete(id);
    else { this._skipAutoSteps(id); this.bus.emit('questUpdated', this); }
  }

  complete(id) {
    const q = this.active.get(id);
    if (!q) return;
    this.active.delete(id);
    this.completed.add(id);
    this.bus.emit('questCompleted', q.def);
    this.bus.emit('questUpdated', this);
  }

  // V4.3 : relance une chaîne de quêtes (ex. « Revoir le tutoriel »)
  restart(ids) {
    for (const id of ids) { this.completed.delete(id); this.progress.delete(id); this.active.delete(id); delete this.savedCounts[id]; }
    this.start(ids[0]);
  }

  // étape en cours de la quête de tutoriel active (ou null)
  tutorialStep() {
    for (const q of this.active.values()) if (q.def.tutorial) return this.currentStep(q);
    return null;
  }

  _onEvent(type, targetId) {
    for (const [id, q] of this.active) {
      const step = this.currentStep(q);
      if (!step || step.type !== type || step.target !== targetId) continue;
      if (step.need) {
        q.counts[step.id] = (q.counts[step.id] || 0) + 1;
        if (q.counts[step.id] >= step.need) this.advance(id);
        else this.bus.emit('questUpdated', this);
      } else this.advance(id);
    }
  }

  serialize() {
    const counts = {};
    for (const [id, q] of this.active) if (Object.keys(q.counts).length) counts[id] = q.counts;
    return { active: [...this.active.keys()], completed: [...this.completed], progress: Object.fromEntries(this.progress), counts };
  }
}
