# Dons PayPal (V10.54)

1. Sur paypal.com : créez un bouton « Faire un don » (Outils → Boutons PayPal → Donner) ou activez votre lien PayPal.me.
2. Copiez l'adresse du bouton/lien (https://www.paypal.com/donate/?hosted_button_id=… ou https://paypal.me/votrenom).
3. Dans Render : Environment → ajoutez `PAYPAL_DONATE_URL` = cette adresse, puis redéployez.
4. Le bloc « Soutenir Korvalune » apparaît dans la Boutique des Lunes. Sans variable, rien ne s'affiche.

Le jeu n'accède jamais à PayPal et ne reçoit aucune confirmation : un don ne donne pas de Lunes automatiquement.
Seules les adresses https paypal.com / paypal.me sont acceptées. Le code Stripe reste en place mais inactif (aucune clé = aucun achat).
