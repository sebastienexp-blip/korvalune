export class EventBus {
  constructor() {
    this.map = new Map();
  }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, []);
    this.map.get(evt).push(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    const list = this.map.get(evt);
    if (list) this.map.set(evt, list.filter((f) => f !== fn));
  }
  emit(evt, ...args) {
    const list = this.map.get(evt);
    if (list) for (const fn of list) fn(...args);
  }
}
