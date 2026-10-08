// Limiteur de débit simple par connexion — garde-fou contre le flood
// (spam de chat, boucle de mouvement défaillante ou malveillante).
export class RateLimiter {
  constructor(maxPerWindow, windowMs) {
    this.max = maxPerWindow;
    this.windowMs = windowMs;
    this.count = 0;
    this.windowStart = Date.now();
  }
  allow() {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) { this.windowStart = now; this.count = 0; }
    this.count++;
    return this.count <= this.max;
  }
}
