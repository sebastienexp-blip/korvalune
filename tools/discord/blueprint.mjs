// Plan du serveur Discord Korvalune : rôles, catégories, salons, permissions et messages d'accueil.
// Modifier ici puis relancer l'outil : ce qui existe déjà (même nom) n'est jamais recréé ni supprimé.
const INVITE = process.env.DISCORD_INVITE || 'https://discord.gg/dQCTQuUtM9';
const SITE = process.env.SITE_URL || 'https://legends-of-aetheria-mxaq.onrender.com';

export const ROLES = [
  { name: '👑 Créateur', color: 0xf2d98b, hoist: true, mentionable: false, perms: ['ADMINISTRATOR'] },
  { name: '🛡️ Modérateur', color: 0x5aa9ff, hoist: true, mentionable: true, perms: ['KICK', 'BAN', 'MANAGE_MESSAGES', 'MODERATE_MEMBERS', 'VIEW_AUDIT_LOG', 'MUTE_MEMBERS', 'MOVE_MEMBERS', 'MANAGE_NICKNAMES', 'MENTION_EVERYONE'] },
  { name: '🤝 Guide', color: 0x62d39c, hoist: true, mentionable: true, perms: ['MANAGE_MESSAGES', 'MUTE_MEMBERS'] },
  { name: '🧪 Testeur', color: 0xc084fc, hoist: true, mentionable: true, perms: [] },
  { name: '💛 Mécène', color: 0xffb347, hoist: true, mentionable: false, perms: [] },
  { name: '⚔️ Guerrier', color: 0x9aa3ad, perms: [] },
  { name: '✨ Paladin', color: 0xe6d98a, perms: [] },
  { name: '🔮 Mage', color: 0x7a5fd0, perms: [] },
  { name: '🏹 Archer', color: 0x6b8a5a, perms: [] },
  { name: '🗡️ Assassin', color: 0x55556a, perms: [] },
  { name: '🌙 Joueur', color: 0x4f46a5, perms: [] }
];
const STAFF = ['👑 Créateur', '🛡️ Modérateur'];

// access : public | staff | testeurs | mecenes. readonly : seuls les rôles « écriture » peuvent poster.
export const CATEGORIES = [
  { name: '📌 INFORMATIONS', access: 'public', channels: [
    { name: '👋・bienvenue', topic: 'Commence ici : présentation du serveur et du jeu.', readonly: true, post: ['welcome'] },
    { name: '📜・règlement', topic: 'Les règles de la communauté. Les lire, c’est déjà les respecter.', readonly: true, post: ['rules'] },
    { name: '📢・annonces', topic: 'Les annonces officielles du créateur.', readonly: true, post: ['firstAnnounce'] },
    { name: '🆕・nouveautés-du-jeu', topic: 'Notes de mise à jour, nouvelles fonctions, corrections.', readonly: true },
    { name: '🎉・événements', topic: 'Invasions, bonus d’XP, fêtes de saison, concours.', readonly: true },
    { name: '🔗・liens-utiles', topic: 'Jouer, télécharger, FAQ, mentions légales.', readonly: true, post: ['links'] }
  ] },
  { name: '💬 COMMUNAUTÉ', access: 'public', channels: [
    { name: '💬・général', topic: 'Discussion libre entre joueurs.' },
    { name: '🙋・présentations', topic: 'Présente-toi : pseudo en jeu, classe, depuis quand tu joues.' },
    { name: '📸・captures', topic: 'Tes plus belles captures d’écran.', slow: 10 },
    { name: '🎬・clips-et-vidéos', topic: 'Clips, vidéos, streams. Pas de pub pour d’autres jeux.', slow: 30 },
    { name: '🤣・hors-sujet', topic: 'Tout ce qui n’a pas de rapport avec le jeu (restons cordiaux).' }
  ] },
  { name: '🎮 LE JEU', access: 'public', channels: [
    { name: '🧭・aide-débutants', topic: 'Pas de question bête : on t’aide à démarrer.', post: ['beginners'] },
    { name: '⚔️・classes-et-builds', topic: 'Guerrier, paladin, mage, archer, assassin : voies, talents, équipement.' },
    { name: '💎・butin-et-trouvailles', topic: 'Tes drops, objets rares, ensembles complétés.', slow: 5 },
    { name: '📖・quêtes-et-histoire', topic: 'Histoire et quêtes. ⚠️ Spoilers : utilise ||le texte caché||.' },
    { name: '👥・recherche-de-groupe', topic: 'Trouve des partenaires pour les donjons, boss et invasions.' },
    { name: '🤝・échanges', topic: 'Échanges entre joueurs. Prudence : on ne te demandera jamais ton mot de passe.' },
    { name: '🏆・exploits', topic: 'Niveaux atteints, boss vaincus, succès débloqués.' }
  ] },
  { name: '💡 AVIS ET SUPPORT', access: 'public', channels: [
    { name: '💡・suggestions', topic: 'Une idée pour le jeu ? Une idée par message, avec 👍 / 👎 pour voter.', slow: 60, post: ['suggest'] },
    { name: '🐞・bugs', topic: 'Signale un bug : appareil, navigateur ou appli, ce que tu faisais, capture si possible.', slow: 30, post: ['bugs'] },
    { name: '🛟・aide-technique', topic: 'Connexion, compte, affichage, performances sur mobile ou PC.', post: ['support'] }
  ] },
  { name: '🔊 VOCAL', access: 'public', channels: [
    { name: '🔊 Salon général', voice: true },
    { name: '⚔️ Groupe 1', voice: true, limit: 5 },
    { name: '⚔️ Groupe 2', voice: true, limit: 5 },
    { name: '⚔️ Groupe 3', voice: true, limit: 5 },
    { name: '🌙 Détente', voice: true }
  ] },
  { name: '🧪 TESTEURS', access: 'testeurs', channels: [
    { name: '🧪・annonces-testeurs', topic: 'Versions en test et ce qu’il faut essayer.', readonly: true },
    { name: '📝・retours-testeurs', topic: 'Tes retours de test : précis, avec capture. Merci !' }
  ] },
  { name: '💛 MÉCÈNES', access: 'mecenes', channels: [
    { name: '💛・salon-mécènes', topic: 'Merci de soutenir Korvalune. Discussions et avant-premières.' }
  ] },
  { name: '🛡️ ÉQUIPE', access: 'staff', channels: [
    { name: '🛡️・modération', topic: 'Discussions de l’équipe de modération.' },
    { name: '📋・journal-sanctions', topic: 'Qui a été sanctionné, pourquoi, par qui.' },
    { name: '🧰・outils-et-idées', topic: 'Idées, tâches, liens d’administration (jamais de mots de passe ici).' }
  ] }
];

export const MESSAGES = {
  welcome: [
    `# Bienvenue sur Korvalune ! 🌙\nKorvalune est un jeu d’aventure fantasy en 3D, **gratuit**, jouable dans ton navigateur, sur Android et sur Windows. Crée ton héros, explore, combats et progresse avec tes amis.\n\n**Pour commencer**\n1️⃣ Lis le règlement dans <#RULES>\n2️⃣ Crée ton compte et joue : ${SITE}/bienvenue/\n3️⃣ Présente-toi dans <#INTRO>\n4️⃣ Besoin d’aide ? <#BEGINNERS>\n\nBon voyage, aventurier !`
  ],
  rules: [
    `# Règlement 📜\n**1. Respect.** Pas d’insultes, de harcèlement, de discrimination ni de propos haineux.\n**2. Pas de spam.** Pas de pub, de liens vers d’autres serveurs, ni de messages répétés.\n**3. Pas de triche.** Exploiter un bug ou tricher dans le jeu est interdit. Signale les bugs dans <#BUGS>, ne les cache pas.\n**4. Sécurité des comptes.** Ne partage jamais ton mot de passe. L’équipe ne te le demandera **jamais**. Pas de vente ni d’échange de comptes contre de l’argent réel.\n**5. Spoilers.** Utilise ||le texte caché|| pour l’histoire du jeu.\n**6. Contenu adapté.** Pas de contenu choquant, sexuel ou illégal.\n**7. Langue.** Ici, on parle français (sauf salons précisés).\n**8. Bon sens.** Les modérateurs ont le dernier mot. Contestation : message privé à un modérateur, avec calme.\n\n**Sanctions** : avertissement → mise en sourdine → exclusion → bannissement (immédiat en cas de faute grave).\nTu dois aussi respecter les conditions d’utilisation de Discord.`
  ],
  firstAnnounce: [
    `📢 **Ouverture du serveur Discord de Korvalune !**\nIci, retrouve les annonces, les événements, les nouveautés du jeu et la communauté. Passe un bon moment et n’hésite pas à inviter tes amis.`
  ],
  links: [
    `# Liens utiles 🔗\n🎮 **Jouer maintenant** : ${SITE}/\n🌐 **Site officiel (compte, téléchargements, nouveautés)** : ${SITE}/bienvenue/\n📱 **Android (APK)** : ${SITE}/telechargements/Korvalune.apk\n🖥️ **Windows** : ${SITE}/telechargements/Korvalune-Installation.exe\n🔐 **Confidentialité** : ${SITE}/legal/confidentialite.html\n📄 **Mentions légales** : ${SITE}/legal/mentions.html\n🗑️ **Supprimer mon compte** : ${SITE}/legal/suppression-compte.html\n\n🔁 **Inviter un ami sur ce Discord** : ${INVITE}\n\n💬 Dans le jeu : *Compte → Contacter l’administrateur* pour écrire directement au créateur.`
  ],
  beginners: [
    `# Bien démarrer 🧭\n• **Contrôles** : ZQSD/WASD ou le joystick sur mobile, clic ou toucher pour attaquer, compétences sur la barre du bas.\n• **Classes** : guerrier, paladin, mage, archer, assassin. Tu pourras affiner ton style avec les voies et les talents.\n• **Quêtes** : suis le journal de quêtes en haut à gauche, il te guide pas à pas.\n• **Lunes 🌙** : la monnaie de la boutique. Gagne-les avec la récompense du jour et en montant de niveau. La boutique ne vend que de l’apparence et du confort, jamais de puissance.\n• **Compte** : configure ta question secrète dans *Compte* pour pouvoir récupérer ton accès.\nPose tes questions ici, la communauté répond !`
  ],
  suggest: [
    `💡 **Comment proposer une idée ?** Un message = une idée. Explique le problème, puis ta solution. Les idées les plus votées (👍) passent en priorité.`
  ],
  bugs: [
    `🐞 **Modèle de rapport**\n• Appareil et navigateur/appli :\n• Ce que tu faisais :\n• Ce qui s’est passé / ce que tu attendais :\n• Capture ou vidéo si possible :\nPour un souci de compte, utilise plutôt <#SUPPORT>.`
  ],
  support: [
    `🛟 **Aide technique** : connexion, mot de passe oublié (*écran de connexion → Mot de passe oublié*), affichage lent. Précise ton appareil. Ne donne **jamais** ton mot de passe ici.`
  ]
};
export { STAFF, SITE };
