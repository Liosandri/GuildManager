// ===== À MODIFIER : réglages du site =====
window.GUILD_CONFIG = {
  // Adresse de l'application web Apps Script (se termine par /exec). Voir LISEZMOI.md, étape 6.
  API_URL: 'REMPLACER_PAR_ADRESSE_APPS_SCRIPT',

  // Nom affiché en haut du site
  NAME: 'Ma guilde',

  // Soirées de raid (day : 0 = dimanche, 1 = lundi, ... 3 = mercredi, 6 = samedi)
  SCHEDULE: [
    { day: 3, label: 'Mercredi', time: '20:30', end: '23:30', name: 'Raid du mercredi' },
    { day: 6, label: 'Samedi',   time: '21:00', end: '00:00', name: 'Raid du samedi' },
  ],
};
