# Un nom de domaine avec « Korvalune » dedans

L'adresse actuelle (`legends-of-aetheria-mxaq.onrender.com`) ne contient pas le nom du jeu : elle est fixée par Render à la création du service et ne se change pas. La solution est un vrai nom de domaine.

1. **Acheter le domaine** (≈ 8 à 15 €/an) chez un registrar (OVH, Gandi, Namecheap, Cloudflare…) : `korvalune.fr`, `korvalune.com` ou `korvalune.net` selon la disponibilité. Prendre aussi `www.` n'est pas nécessaire.
2. **Render** → ton service → Settings → *Custom Domains* → Add → saisir le domaine. Render affiche les réglages DNS à copier chez le registrar (un enregistrement CNAME pour `www`, et A/ALIAS pour le domaine nu). Le certificat HTTPS est automatique (quelques minutes à quelques heures).
3. **Render** → Environment → ajouter `PUBLIC_HOST` = ton domaine (ex. `korvalune.fr`, sans https). L'ancienne adresse du site vitrine redirigera alors vers le nouveau domaine (redirection permanente, bonne pour le référencement).
4. **Dire à Claude le domaine** (ou lancer `tools/set-domain.sh korvalune.fr`) pour mettre à jour le lien canonique, l'aperçu des réseaux et le plan du site, puis publier.
5. **Google Search Console** : ajouter le domaine et envoyer `https://ton-domaine/sitemap.xml` pour accélérer l'indexation.

⚠️ Le jeu lui-même continue de fonctionner sur l'ancienne adresse : les joueurs déjà connectés gardent leur session (la session est liée à l'adresse). Ne pas rediriger le jeu sans prévenir : ils devraient se reconnecter. Les applications Android/Windows pointent vers l'ancienne adresse ; elles ne changent qu'avec une nouvelle version.
