// ===== À MODIFIER : réglages du site =====
window.GUILD_CONFIG = {
  // Adresse de l'application web Apps Script (se termine par /exec). Voir LISEZMOI.md, étape 6.
  API_URL: 'https://script.google.com/macros/s/AKfycbyXREULFF3ynnORjGLfK-qmrEGitIBzlIVaomMy9b3ByYVsPvu66GVdi-SZt6NZw9VEfw/exec',

  // Nom affiché en haut du site
  NAME: 'SIGMA',

  // Soirées de raid (day : 0 = dimanche, 1 = lundi, ... 3 = mercredi, 6 = samedi)
  SCHEDULE: [
    { day: 3, label: 'Mercredi', time: '20:30', end: '23:30', name: 'Raid du mercredi' },
    { day: 6, label: 'Samedi',   time: '21:00', end: '00:00', name: 'Raid du samedi' },
  ],
};
