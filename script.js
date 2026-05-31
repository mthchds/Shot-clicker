/* ═══════════════════════════════════════════════════════════
   SHOT CLICKER — script.js — v0.2
   Nouveautés : Fatigue de Drop · Plumes de Platine (PP)
                Crafting 20→1 + 1 PP · Weapon sprites réactifs
   Stack : Vanilla JS ES6+, LocalStorage, requestAnimationFrame
   ═══════════════════════════════════════════════════════════ */
'use strict';

// ─────────────────────────────────────────────────────────
// DEV_MODE — mettre false avant déploiement
// ─────────────────────────────────────────────────────────
const DEV_MODE = true;
const DEV_DIV  = 60;   // Divise les fenêtres de drop par 60
const DEV_FATIGUE_DIV = 48; // Divise le seuil de fatigue (4h → 5 min)

// ─────────────────────────────────────────────────────────
// A. DONNÉES STATIQUES
// ─────────────────────────────────────────────────────────

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','extraordinary'];

const RARITY = {
  common:        { label:'Commun',         color:'#b0c3d9', window:1800,   chance:.70, cooldown:1500,   basePx:.12  },
  uncommon:      { label:'Peu Commun',     color:'#5e98d9', window:3600,   chance:.50, cooldown:3000,   basePx:.55  },
  rare:          { label:'Rare',           color:'#4b69ff', window:10800,  chance:.25, cooldown:9000,   basePx:2.50 },
  epic:          { label:'Épique',         color:'#8847ff', window:21600,  chance:.10, cooldown:18000,  basePx:9.00 },
  legendary:     { label:'Légendaire',     color:'#d32ce6', window:43200,  chance:.03, cooldown:36000,  basePx:42.0 },
  extraordinary: { label:'Extraordinaire', color:'#eb4b4b', window:180000, chance:.005,cooldown:162000, basePx:180.0},
};
// Prix de base revus à la hausse pour refléter la formule 20→1
// (il faut 20 Commons pour crafter un Uncommon, etc.)

// Helpers : fenêtre/cooldown avec facteur DEV
const dW = r => DEV_MODE ? RARITY[r].window   / DEV_DIV : RARITY[r].window;
const dC = r => DEV_MODE ? RARITY[r].cooldown / DEV_DIV : RARITY[r].cooldown;

// ── FATIGUE DE DROP ───────────────────────────────────────
// Après FATIGUE_THRESHOLD secondes de session continue :
//   → cooldowns ×2 et chances de drop ×0.5
// Se réinitialise après FATIGUE_REST_MS ms de déconnexion
const FATIGUE_THRESHOLD_REAL = 4 * 3600;          // 4h en secondes
const FATIGUE_REST_MS_REAL   = 4 * 3600 * 1000;   // 4h en ms
const FATIGUE_THRESHOLD = DEV_MODE ? FATIGUE_THRESHOLD_REAL / DEV_FATIGUE_DIV : FATIGUE_THRESHOLD_REAL;
const FATIGUE_REST_MS   = DEV_MODE ? FATIGUE_REST_MS_REAL   / DEV_FATIGUE_DIV : FATIGUE_REST_MS_REAL;

// ── CRAFTING ──────────────────────────────────────────────
const CRAFT_COST_ITEMS = 20;   // items de rareté N requis
const CRAFT_COST_PP    = 1;    // Plumes de Platine requises
// TODO: PROD → 1 Plume de Platine = 0,10 € via Steamworks Microtransaction API

// ── PACKAGES DE PLUMES DE PLATINE ────────────────────────
// Simulated : le bouton "Acheter" ajoute directement les PP sans paiement réel
// TODO: PROD → Steamworks Microtransaction API / Stripe Payment Intent
const PP_PACKAGES = [
  { name:'Pack Starter',       pp:10,  price:'1,00 €', perUnit:'0,10 €/PP', icon:'💎'    },
  { name:'Pack Confort',       pp:50,  price:'4,00 €', perUnit:'0,08 €/PP', icon:'💎💎'   },
  { name:'Pack Collection',    pp:100, price:'7,50 €', perUnit:'0,075 €/PP',icon:'💎💎💎'  },
  { name:'Pack Professionnel', pp:250, price:'17,50 €',perUnit:'0,07 €/PP', icon:'💎💎💎💎'},
];

// ── SEUIL PRESTIGE ────────────────────────────────────────
const PRESTIGE_THRESHOLD = 1e6;

// ── MUNITIONS ─────────────────────────────────────────────
const AMMO_TIERS = [
  { id:0, name:'Munitions en Plomb',      cost:0,     baseDpc:1,     icon:'🔘' },
  { id:1, name:'Munitions Blindées',      cost:500,   baseDpc:3,     icon:'⚪' },
  { id:2, name:'Munitions Expansives',    cost:5e3,   baseDpc:8,     icon:'🔵' },
  { id:3, name:'Munitions Explosives',    cost:5e4,   baseDpc:25,    icon:'🟠' },
  { id:4, name:'Munitions Perforantes',   cost:5e5,   baseDpc:80,    icon:'🔷' },
  { id:5, name:'Munitions Incendiaires',  cost:5e6,   baseDpc:300,   icon:'🔥' },
  { id:6, name:'Munitions Plasma',        cost:1e8,   baseDpc:2000,  icon:'🟣' },
  { id:7, name:'Munitions Antimatière',   cost:1e10,  baseDpc:50000, icon:'⚫' },
];
const DMG_BASE_COST  = 10;
const DMG_GROWTH     = 1.15;
const DMG_RANK_MAX   = 200;

// ── ARMES ─────────────────────────────────────────────────
// cssClass : classe CSS appliquée à #weapon-emoji pour le style visuel
const WEAPONS = [
  { id:'glock',   name:'Glock 17 "Pigeolo"',              reqTotal:0,    cost:0,    dpcB:0,     dpsB:0,    maxRar:'common',        collOK:false, emoji:'🔫', cssClass:'w0' },
  { id:'shotgun', name:'Fusil à Pompe "Le Claqueur"',     reqTotal:1e4,  cost:8e3,  dpcB:10,    dpsB:5,    maxRar:'uncommon',      collOK:false, emoji:'🔫', cssClass:'w1' },
  { id:'famas',   name:'FAMAS "Le Français"',             reqTotal:1e5,  cost:7.5e4,dpcB:50,    dpsB:30,   maxRar:'uncommon',      collOK:true,  emoji:'🔫', cssClass:'w2' },
  { id:'ak47',    name:'AK-47 "Kalachnikove"',            reqTotal:1e6,  cost:8e5,  dpcB:200,   dpsB:120,  maxRar:'rare',          collOK:true,  emoji:'🔫', cssClass:'w3' },
  { id:'minigun', name:'Minigun "La Tempête de Plumes"',  reqTotal:5e7,  cost:4e7,  dpcB:1000,  dpsB:800,  maxRar:'epic',          collOK:true,  emoji:'🔫', cssClass:'w4' },
  { id:'laser',   name:'Arme Laser "Le Regard du Pigeon"',reqTotal:5e9,  cost:4e9,  dpcB:10000, dpsB:8000, maxRar:'extraordinary',  collOK:true,  emoji:'⚡', cssClass:'w5' },
];

// ── UNITÉS IDLE ───────────────────────────────────────────
const UNITS = [
  { id:'pigeonneau',name:'Pigeonneau Stagiaire', baseCost:10,    baseDps:.1,   rate:1.15, icon:'🐣', desc:'Tire avec son bec.' },
  { id:'sniper',    name:'Pigeon Sniper',         baseCost:200,   baseDps:1,    rate:1.15, icon:'🎯', desc:'Lunette télescopique.' },
  { id:'tourelle',  name:'Tourelle Automatique',  baseCost:3000,  baseDps:8,    rate:1.15, icon:'🔧', desc:'Mini-gatling sur trépied.' },
  { id:'drone',     name:'Drone Kamikaze',         baseCost:5e4,   baseDps:47,   rate:1.15, icon:'🚁', desc:'Plonge en boucle.' },
  { id:'tank',      name:'Tank Pigeon',            baseCost:7.5e5, baseDps:260,  rate:1.15, icon:'🛡️', desc:'Blindage et pattes puissantes.' },
  { id:'satellite', name:'Satellite Orbital',      baseCost:1e8,   baseDps:1400, rate:1.15, icon:'🛸', desc:'Tire depuis l\'espace.' },
  { id:'quantique', name:'Dimension Quantique',    baseCost:1.4e10,baseDps:7800, rate:1.15, icon:'🌀', desc:'Portail violet crache des plumes.' },
];

// ── DÉCORS ────────────────────────────────────────────────
const DECORS = [
  { level:0, name:'Cave Humide',               cost:0,     mult:1,   icon:'🏚️', bg:'#0d0d12' },
  { level:1, name:'Garage de Banlieue',         cost:2.5e4, mult:1.5, icon:'🚗', bg:'#0f1218' },
  { level:2, name:'Stand de Tir Amateur',       cost:2.5e5, mult:3,   icon:'🎯', bg:'#0f1825' },
  { level:3, name:'Base Militaire Abandonnée',  cost:5e6,   mult:8,   icon:'💣', bg:'#101a10' },
  { level:4, name:'Arène Futuriste',            cost:2e8,   mult:25,  icon:'🌐', bg:'#050215' },
  { level:5, name:'Station Orbitale',           cost:2e10,  mult:100, icon:'🚀', bg:'#010108' },
];

// ── COMPÉTENCES PLUMES D'OR ───────────────────────────────
const GF_SKILLS = [
  { id:'serres1', name:'Serres Acérées I',       cost:1,  req:null,      desc:'×1.5 dégâts/clic' },
  { id:'serres2', name:'Serres Acérées II',      cost:3,  req:'serres1', desc:'×2.0 dégâts/clic' },
  { id:'serres3', name:'Serres Acérées III',     cost:10, req:'serres2', desc:'×5.0 dégâts/clic' },
  { id:'migr1',   name:'Migration Accélérée I',  cost:2,  req:null,      desc:'×1.5 douilles/sec' },
  { id:'migr2',   name:'Migration Accélérée II', cost:6,  req:'migr1',   desc:'×3.0 douilles/sec' },
  { id:'memoire', name:'Mémoire Musculaire',     cost:5,  req:null,      desc:'Auto-clic idle ×2' },
  { id:'vestige', name:'Vestige des Plumes',     cost:8,  req:null,      desc:'Conserve 5% douilles au Prestige' },
  { id:'trafic',  name:'Trafiquant',             cost:15, req:null,      desc:'-20% tous les coûts' },
  { id:'recup',   name:'Récupération de Skins',  cost:20, req:null,      desc:'+10% chance de drop' },
];

// ── CATALOGUE DES 18 SKINS ────────────────────────────────
// Rareté globale + Rareté interne (Classique / Collector)
// dropW  = poids de sélection lors d'un drop natif
// craftW = poids lors d'un crafting (Collector favorisés)
// basePx = prix de base en € (marché simulé)
const SKINS = [
  // ─── COMMUN ─────────────────────────────────────────────────────────────────
  { id:'glock_paindemie',  name:'Glock "Pain de Mie"',
    weapon:'glock', rarity:'common', sub:'classic',
    desc:'Peinte avec de la mie de pain séchée et de la moutarde. Aucun armureur ne sait comment c\'est arrivé.',
    basePx:.12, dropW:50, craftW:44 },

  { id:'glock_camo',       name:'Glock "Camouflage Parking"',
    weapon:'glock', rarity:'common', sub:'classic',
    desc:'Reproduit fidèlement la texture d\'un sol de parking Carrefour. Totalement inutile comme camouflage.',
    basePx:.10, dropW:50, craftW:44 },

  // ─── PEU COMMUN — Classique ─────────────────────────────────────────────────
  { id:'shotgun_fleurs',   name:'Fusil à Pompe "Fleurs du Balcon"',
    weapon:'shotgun', rarity:'uncommon', sub:'classic',
    desc:'Décorée de petites fleurs imprimées par la grand-mère du pigeon. Redoutablement mignonne.',
    basePx:.55, dropW:35, craftW:28 },

  { id:'shotgun_holo',     name:'Fusil à Pompe "Hologramme Supermarché"',
    weapon:'shotgun', rarity:'uncommon', sub:'classic',
    desc:'Revêtement holographique récupéré sur un sachet de chips. La prise en main colle légèrement.',
    basePx:.50, dropW:30, craftW:22 },

  // ─── PEU COMMUN — Collector ─────────────────────────────────────────────────
  { id:'famas_bleu',       name:'FAMAS "Bleu Roi de la Brocante"',
    weapon:'famas', rarity:'uncommon', sub:'collector',
    desc:'Peinte en bleu électrique avec un rouleau à peinture. Des poils de pinceau sont encore visibles.',
    basePx:1.80, dropW:20, craftW:30 },

  { id:'famas_monet',      name:'FAMAS "L\'Hommage à Monet"',
    weapon:'famas', rarity:'uncommon', sub:'collector',
    desc:'Le pigeon était censé faire un nénuphar. C\'est raté mais ça vaut cher quand même.',
    basePx:2.20, dropW:15, craftW:20 },

  // ─── RARE — Classique ───────────────────────────────────────────────────────
  { id:'ak47_crimson',     name:'AK-47 "Plumage Crimson"',
    weapon:'ak47', rarity:'rare', sub:'classic',
    desc:'Incrustée de vraies plumes rouges. Le pigeon affirme qu\'il ne connaît pas la victime.',
    basePx:2.50, dropW:30, craftW:22 },

  { id:'ak47_paintball',   name:'AK-47 "Paintball Massacre"',
    weapon:'ak47', rarity:'rare', sub:'classic',
    desc:'Tâches de peinture multicolores. Survécu à 47 parties de paintball et un divorce.',
    basePx:2.20, dropW:25, craftW:18 },

  // ─── RARE — Collector ───────────────────────────────────────────────────────
  { id:'ak47_spectre',     name:'AK-47 "Spectre Ultraviolet"',
    weapon:'ak47', rarity:'rare', sub:'collector',
    desc:'Ne devient visible qu\'en lumière noire. Utilisée exclusivement dans des soirées étudiantes.',
    basePx:9.00, dropW:15, craftW:28 },

  { id:'ak47_rouille',     name:'AK-47 "Vieux Rouille Glorieux"',
    weapon:'ak47', rarity:'rare', sub:'collector',
    desc:'Couverte de rouille authentique. Étrangement plus précise que les modèles neufs.',
    basePx:11.50,dropW:10, craftW:22 },

  // ─── ÉPIQUE — Classique ─────────────────────────────────────────────────────
  { id:'minigun_disco',    name:'Minigun "La Disco Ball"',
    weapon:'minigun', rarity:'epic', sub:'classic',
    desc:'Chaque canon reflète la lumière différemment. Garantit l\'ambiance lors des fêtes de bureau.',
    basePx:9.00, dropW:40, craftW:28 },

  { id:'minigun_coeur',    name:'Minigun "Coeur de Pigeon"',
    weapon:'minigun', rarity:'epic', sub:'classic',
    desc:'Design romantique avec cœurs roses. Recommandée par 9/10 pigeons lors de la Saint-Valentin.',
    basePx:8.00, dropW:30, craftW:22 },

  // ─── ÉPIQUE — Collector ─────────────────────────────────────────────────────
  { id:'minigun_abyssal',  name:'Minigun "Abyssal"',
    weapon:'minigun', rarity:'epic', sub:'collector',
    desc:'Noire comme l\'âme d\'un lead dev à 3h du mat. Des reflets bleus apparaissent selon l\'angle.',
    basePx:28.00,dropW:30, craftW:50 },

  // ─── LÉGENDAIRE — Classique ─────────────────────────────────────────────────
  { id:'laser_soleil',     name:'Laser "Le Soleil Intérieur"',
    weapon:'laser', rarity:'legendary', sub:'classic',
    desc:'Dorée à l\'extrême. Le designer graphique a démissionné après avoir rendu ce fichier.',
    basePx:42.00,dropW:50, craftW:32 },

  // ─── LÉGENDAIRE — Collector ─────────────────────────────────────────────────
  { id:'laser_nebuleuse',  name:'Laser "Nébuleuse de Pigeostars"',
    weapon:'laser', rarity:'legendary', sub:'collector',
    desc:'Reproduit une vraie photo de nébuleuse. La NASA n\'a pas été consultée.',
    basePx:105.00,dropW:30, craftW:38 },

  { id:'laser_fragments',  name:'Laser "Fragments d\'Éternité"',
    weapon:'laser', rarity:'legendary', sub:'collector',
    desc:'Composée de milliers de petits cristaux animés. Personne ne sait comment elle tire.',
    basePx:145.00,dropW:20, craftW:30 },

  // ─── EXTRAORDINAIRE — Collector ─────────────────────────────────────────────
  { id:'laser_oiseaufeu',  name:'Laser "L\'Oiseau de Feu"',
    weapon:'laser', rarity:'extraordinary', sub:'collector',
    desc:'Animée avec des particules de flamme en temps réel. Certains joueurs entendent des battements d\'ailes.',
    basePx:180.00,dropW:60, craftW:42 },

  { id:'laser_kairos',     name:'Laser "Kairos — L\'Instant Unique"',
    weapon:'laser', rarity:'extraordinary', sub:'collector',
    desc:'Texturée d\'une horloge qui tourne à l\'envers. Impossible de la recréer exactement, même pour le développeur.',
    basePx:290.00,dropW:40, craftW:58 },
];

// ─────────────────────────────────────────────────────────
// B. ÉTAT DU JEU
// ─────────────────────────────────────────────────────────

const NEVER = -(Number.MAX_SAFE_INTEGER); // sentinelle JSON-safe pour "jamais droppé"

function defaultState() {
  const uc = {};
  UNITS.forEach(u => { uc[u.id] = 0; });
  const dt = {};
  const dc = {};
  RARITY_ORDER.forEach(r => { dt[r] = 0; dc[r] = NEVER; });
  return {
    shells:               0,
    totalShells:          0,
    playtime:             0,
    sessionAccumulated:   0,    // ← NOUVEAU : secondes de session continue
    ammoTier:             0,
    damageRank:           0,
    weaponIdx:            0,
    decorLevel:           0,
    unitCounts:           uc,
    goldenFeathers:       0,
    totalGoldenFeathers:  0,
    platinumFeathers:     0,    // ← NOUVEAU : Plumes de Platine (monnaie premium)
    prestigeCount:        0,
    skills:               {},
    dropTimers:           dt,
    dropCooldowns:        dc,
    consecutiveCommonDrops: 0,
    inventory:            [],
    equippedSkin:         null,
    marketPrices:         {},
    lastSave:             Date.now(),
  };
}

let G = defaultState();

// État UI (non sauvegardé)
let craftRarity     = 'common';
let craftSelected   = [];
let marketFilter    = 'all';
let lastTs          = 0;
let renderTick      = 0;
let autoSaveTick    = 0;
let shopRefreshTick = 0;

// HP cible (visuel, non sauvegardé)
let targetHp    = 100;
let targetMaxHp = 100;

// ─────────────────────────────────────────────────────────
// C. VALEURS CALCULÉES
// ─────────────────────────────────────────────────────────

function getCostMult()  { return G.skills.trafic ? 0.80 : 1.0; }
function getDropBonus() { return G.skills.recup  ? 1.10 : 1.0; }

// Multiplicateurs de fatigue selon l'état de la session
function getFatigueMultipliers() {
  const fatigued = G.sessionAccumulated >= FATIGUE_THRESHOLD;
  return {
    fatigued,
    chanceMult:  fatigued ? 0.5 : 1.0,
    cooldownMult:fatigued ? 2.0 : 1.0,
  };
}

function calcDpc() {
  const ammoBase = AMMO_TIERS[G.ammoTier].baseDpc;
  const wpnBonus = WEAPONS[G.weaponIdx].dpcB;
  const rankMult = Math.pow(DMG_GROWTH, G.damageRank);
  const decMult  = DECORS[G.decorLevel].mult;
  let skillMult  = 1;
  if (G.skills.serres1) skillMult *= 1.5;
  if (G.skills.serres2) skillMult *= 2.0;
  if (G.skills.serres3) skillMult *= 5.0;
  return (ammoBase + wpnBonus) * rankMult * decMult * skillMult;
}

function calcDps() {
  let base = 0;
  UNITS.forEach(u => { base += (G.unitCounts[u.id] || 0) * u.baseDps; });
  const wpnBonus = WEAPONS[G.weaponIdx].dpsB;
  const decMult  = DECORS[G.decorLevel].mult;
  let skillMult  = 1;
  if (G.skills.migr1) skillMult *= 1.5;
  if (G.skills.migr2) skillMult *= 3.0;
  return (base + wpnBonus) * decMult * skillMult;
}

function getUnitCost(uid) {
  const u = UNITS.find(u => u.id === uid);
  const n = G.unitCounts[uid] || 0;
  return Math.ceil(u.baseCost * Math.pow(u.rate, n) * getCostMult());
}

function getDmgRankCost() {
  return Math.ceil(DMG_BASE_COST * Math.pow(DMG_GROWTH, G.damageRank) * getCostMult());
}

// ─────────────────────────────────────────────────────────
// D. UTILITAIRES
// ─────────────────────────────────────────────────────────

function fmt(n) {
  if (!n || isNaN(n)) return '0';
  if (n < 1e3)  return Math.floor(n).toString();
  if (n < 1e6)  return (n/1e3).toFixed(1)  + 'K';
  if (n < 1e9)  return (n/1e6).toFixed(2)  + 'M';
  if (n < 1e12) return (n/1e9).toFixed(2)  + 'G';
  if (n < 1e15) return (n/1e12).toFixed(2) + 'T';
  return n.toExponential(2);
}

function fmtTime(s) {
  s = Math.floor(s);
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtSessionTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2,'0')}m`;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function weightedRandom(pool, key) {
  if (!pool || pool.length === 0) return null;
  const total = pool.reduce((s, it) => s + (it[key] || 1), 0);
  let r = Math.random() * total;
  for (const item of pool) { r -= (item[key] || 1); if (r <= 0) return item; }
  return pool[pool.length - 1];
}

function addShells(n)    { G.shells += n; G.totalShells += n; }
function spendShells(n)  { if (G.shells < n) return false; G.shells -= n; return true; }
function $(id)           { return document.getElementById(id); }

function setText(id, val) {
  const el = $(id);
  if (el && el.textContent !== String(val)) el.textContent = val;
}

function isTabActive(id) {
  const el = $('tab-' + id);
  return el && el.classList.contains('active');
}

// ─────────────────────────────────────────────────────────
// E. BOUCLE DE JEU
// ─────────────────────────────────────────────────────────

function gameLoop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, .5);
  lastTs = ts;

  G.playtime           += dt;
  G.sessionAccumulated += dt;   // ← incrémente la session en cours
  addShells(calcDps() * dt);

  renderTick++;
  if (renderTick % 2 === 0) { renderHeader(); renderFatigueIndicator(); }

  requestAnimationFrame(gameLoop);
}

// Tick lent (chaque seconde)
function slowTick() {
  checkDrops();
  checkPrestigeBtn();

  autoSaveTick++;
  if (autoSaveTick >= 30) { autoSaveTick = 0; saveGame(true); }

  shopRefreshTick++;
  if (shopRefreshTick % 5 === 0) {
    if (isTabActive('shop'))     renderShop();
    if (isTabActive('crafting')) renderCrafting();
    renderBgUnits();
  }
}

// ─────────────────────────────────────────────────────────
// F. SYSTÈME DE CLIC
// ─────────────────────────────────────────────────────────

function handleClick(e) {
  const dpc  = calcDpc();
  const roll = Math.random();
  let val    = dpc;
  let type   = 'normal';

  if (roll < .005)      { val = dpc * 10; type = 'supercrit'; }
  else if (roll < .05)  { val = dpc * 3;  type = 'crit'; }

  addShells(val);
  damageTarget(1);
  triggerKickback();
  triggerMuzzleFlash();
  spawnCasing();

  const rect = $('range-area').getBoundingClientRect();
  spawnFloat(val, type, e.clientX - rect.left, e.clientY - rect.top);

  // Audio hooks (Howler.js)
  // playSound('shot_' + WEAPONS[G.weaponIdx].id);
  // if (type === 'crit')      playSound('sfx_crit');
  // if (type === 'supercrit') playSound('sfx_supercrit');
}

function triggerKickback() {
  const pb = $('pigeon-body');
  if (!pb) return;
  pb.classList.remove('kickback');
  void pb.offsetWidth;
  pb.classList.add('kickback');
  setTimeout(() => pb.classList.remove('kickback'), 150);
}

function triggerMuzzleFlash() {
  const mf = $('muzzle-flash');
  if (!mf) return;
  mf.classList.add('active');
  setTimeout(() => mf.classList.remove('active'), 80);
}

function spawnCasing() {
  const zone = $('pigeon-zone');
  if (!zone) return;
  const c = document.createElement('div');
  c.className = 'casing';
  c.style.cssText = 'position:absolute;left:95px;top:28px;';
  zone.appendChild(c);
  setTimeout(() => c.remove(), 760);
}

function spawnFloat(val, type, x, y) {
  const layer = $('float-layer');
  if (!layer) return;
  const el = document.createElement('div');
  el.className   = `ft ${type}`;
  el.textContent = (type === 'normal' ? '+' : '⚡ +') + fmt(val);
  el.style.left  = Math.max(5, x - 25) + 'px';
  el.style.top   = Math.max(5, y - 10) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function damageTarget(dmg) {
  targetHp = Math.max(0, targetHp - dmg);
  const fill = $('target-hp-fill');
  if (fill) fill.style.width = (targetHp / targetMaxHp * 100) + '%';
  const tgt = $('target');
  if (tgt) { tgt.classList.remove('hit'); void tgt.offsetWidth; tgt.classList.add('hit'); }

  const holes = $('bullet-holes');
  if (holes && holes.children.length < 25) {
    const h = document.createElement('div');
    h.className = 'bullet-hole';
    h.style.left = (10 + Math.random() * 80) + '%';
    h.style.top  = (10 + Math.random() * 80) + '%';
    holes.appendChild(h);
  }
  if (targetHp <= 0) respawnTarget();
}

function respawnTarget() {
  targetHp = targetMaxHp;
  const fill = $('target-hp-fill');
  if (fill) fill.style.width = '100%';
  const holes = $('bullet-holes');
  if (holes) holes.innerHTML = '';
}

// ─────────────────────────────────────────────────────────
// G. BOUTIQUE — ACHATS
// ─────────────────────────────────────────────────────────

function buyAmmo(tierIdx) {
  if (tierIdx !== G.ammoTier + 1) return;
  const cost = Math.ceil(AMMO_TIERS[tierIdx].cost * getCostMult());
  if (!spendShells(cost)) return;
  G.ammoTier = tierIdx;
  targetMaxHp = Math.max(100, Math.ceil(calcDpc() * 8));
  targetHp    = targetMaxHp;
  const fill = $('target-hp-fill');
  if (fill) fill.style.width = '100%';
  renderShop();
}

function buyDmgRank() {
  if (G.damageRank >= DMG_RANK_MAX) return;
  if (!spendShells(getDmgRankCost())) return;
  G.damageRank++;
  renderShop();
}

function buyUnit(unitId) {
  const cost = getUnitCost(unitId);
  if (!spendShells(cost)) return;
  G.unitCounts[unitId] = (G.unitCounts[unitId] || 0) + 1;
  renderShop();
  renderBgUnits();
}

function buyWeapon(idx) {
  if (G.weaponIdx >= idx) return;
  const wpn  = WEAPONS[idx];
  const cost = Math.ceil(wpn.cost * getCostMult());
  if (G.totalShells < wpn.reqTotal || !spendShells(cost)) return;
  G.weaponIdx = idx;
  updateWeaponDisplay();
  renderShop();
}

function buyDecor(level) {
  if (level !== G.decorLevel + 1) return;
  const cost = Math.ceil(DECORS[level].cost * getCostMult());
  if (!spendShells(cost)) return;
  G.decorLevel = level;
  updateDecorDisplay();
  renderShop();
}

function buySkill(skillId) {
  if (G.skills[skillId]) return;
  const sk = GF_SKILLS.find(s => s.id === skillId);
  if (!sk || (sk.req && !G.skills[sk.req]) || G.goldenFeathers < sk.cost) return;
  G.goldenFeathers -= sk.cost;
  G.skills[skillId] = true;
  renderShop();
  renderHeader();
}

// ← NOUVEAU : Achat simulé de Plumes de Platine
function buyPPPackage(idx) {
  const pkg = PP_PACKAGES[idx];
  if (!pkg) return;
  // TODO: PROD → Steamworks Microtransaction API / Stripe
  // En prototype : ajout direct sans paiement réel
  G.platinumFeathers += pkg.pp;
  renderShop();
  renderHeader();
  updateCraftBtn();
  // Feedback visuel
  const btn = document.querySelector(`#s-pp .si:nth-child(${idx+1}) .shop-btn`);
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Ajouté !';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }
}

// ─────────────────────────────────────────────────────────
// H. SYSTÈME DE DROPS (avec Fatigue de Drop)
// ─────────────────────────────────────────────────────────

function checkDrops() {
  const wpn       = WEAPONS[G.weaponIdx];
  const maxRarIdx = RARITY_ORDER.indexOf(wpn.maxRar);
  const pity      = G.consecutiveCommonDrops >= 20;
  const { chanceMult, cooldownMult } = getFatigueMultipliers();

  for (let ri = 0; ri <= maxRarIdx; ri++) {
    const rar  = RARITY_ORDER[ri];
    const meta = RARITY[rar];
    const win  = dW(rar);
    const cool = dC(rar) * cooldownMult;  // ← cooldown doublé si fatigué

    if (G.playtime - G.dropTimers[rar] < win) continue;
    G.dropTimers[rar] = G.playtime;

    if (G.playtime - G.dropCooldowns[rar] < cool) continue;

    // Pity timer : ignorer le common si 20+ commons consécutifs,
    // et tenter de forcer un Rare+ à la place
    if (pity && rar === 'common') {
      if (maxRarIdx >= RARITY_ORDER.indexOf('rare')) {
        const rWin = dW('rare');
        const rCool = dC('rare') * cooldownMult;
        if (G.playtime - G.dropTimers['rare'] >= rWin &&
            G.playtime - G.dropCooldowns['rare'] >= rCool) {
          G.dropTimers['rare'] = G.playtime;
          awardDrop('rare', true);
          return;
        }
      }
      continue;
    }

    // Roll avec multiplicateur de fatigue
    const chance = meta.chance * getDropBonus() * chanceMult;
    if (Math.random() < chance) {
      awardDrop(rar, false);
      return;
    }
  }
}

function awardDrop(rarity, forced) {
  const skin = selectSkinDrop(rarity);
  if (!skin) return;

  G.inventory.push({ iid: genId(), skinId: skin.id });
  G.dropCooldowns[rarity] = G.playtime;

  if (rarity === 'common') G.consecutiveCommonDrops++;
  else                     G.consecutiveCommonDrops = 0;

  showDropNotif(skin, forced);
  updateInvBadge();
}

function selectSkinDrop(rarity) {
  const wpn  = WEAPONS[G.weaponIdx];
  let pool   = SKINS.filter(s => s.rarity === rarity);
  if (!wpn.collOK) pool = pool.filter(s => s.sub === 'classic');
  return weightedRandom(pool, 'dropW');
}

function selectSkinCraft(fromRarity) {
  const toIdx    = RARITY_ORDER.indexOf(fromRarity) + 1;
  const toRarity = RARITY_ORDER[toIdx];
  if (!toRarity) return null;
  let pool = SKINS.filter(s => s.rarity === toRarity);
  if (G.weaponIdx < 2) pool = pool.filter(s => s.sub === 'classic');
  return weightedRandom(pool, 'craftW');
}

function showDropNotif(skin, forced) {
  const meta = RARITY[skin.rarity];
  const px   = (G.marketPrices[skin.id] || skin.basePx).toFixed(2);
  const wpnEmoji = WEAPONS.find(w => w.id === skin.weapon)?.emoji || '🎁';

  $('drop-rarity-tag').textContent = (forced ? '🎰 PITY — ' : '') +
    meta.label + (skin.sub === 'collector' ? ' ⭐ Collector' : '');
  $('drop-rarity-tag').style.color = meta.color;
  $('drop-skin-icon').textContent   = wpnEmoji;
  $('drop-skin-name').textContent   = skin.name;
  $('drop-skin-desc').textContent   = skin.desc;
  $('drop-price-est').textContent   = `Valeur estimée marché : ~${px} €`;
  $('drop-notif').classList.remove('hidden');
}

function closeDrop() {
  $('drop-notif').classList.add('hidden');
  if (isTabActive('inventory')) renderInventory();
}

// ─────────────────────────────────────────────────────────
// I. PRESTIGE
// ─────────────────────────────────────────────────────────

function calcPrestigeGain() {
  return Math.floor(Math.sqrt(G.totalShells / PRESTIGE_THRESHOLD) * 10);
}

function checkPrestigeBtn() {
  const btn = $('prestige-btn');
  if (btn) btn.disabled = G.totalShells < PRESTIGE_THRESHOLD;
}

function openPrestigeModal() {
  if (G.totalShells < PRESTIGE_THRESHOLD) return;
  const gain = calcPrestigeGain();
  $('pi-earn').textContent  = gain + ' 🪶';
  $('pi-after').textContent = (G.goldenFeathers + gain) + ' 🪶';
  $('pi-count').textContent = G.prestigeCount + 1;
  $('pi-pp').textContent    = G.platinumFeathers + ' 💎';
  $('prestige-modal').classList.remove('hidden');
}

function closePrestigeModal() {
  $('prestige-modal').classList.add('hidden');
}

function doPrestige() {
  const gain       = calcPrestigeGain();
  const keepShells = G.skills.vestige ? Math.floor(G.shells * .05) : 0;

  const keep = {
    skills:              {...G.skills},
    goldenFeathers:      G.goldenFeathers + gain,
    totalGoldenFeathers: G.totalGoldenFeathers + gain,
    platinumFeathers:    G.platinumFeathers,   // PP toujours conservées
    inventory:           [...G.inventory],
    marketPrices:        {...G.marketPrices},
    prestigeCount:       G.prestigeCount + 1,
    shells:              keepShells,
  };

  G = defaultState();
  Object.assign(G, keep);

  targetHp = targetMaxHp = 100;
  closePrestigeModal();
  renderAll();
  saveGame(true);
}

// ─────────────────────────────────────────────────────────
// J. CRAFTING — 20 items + 1 PP → 1 item rareté supérieure
// ─────────────────────────────────────────────────────────

function setCraftRarity(r) {
  craftRarity   = r;
  craftSelected = [];
  renderCrafting();
}

function toggleCraftItem(iid) {
  const idx = craftSelected.indexOf(iid);
  if (idx >= 0) {
    craftSelected.splice(idx, 1);
  } else if (craftSelected.length < CRAFT_COST_ITEMS) {
    craftSelected.push(iid);
  }
  renderCraftSlots();
  renderCraftPool();
  updateCraftBtn();
}

function updateCraftBtn() {
  const btn  = $('craft-btn');
  const info = $('craft-info');
  const ppEl = $('pp-craft-balance');
  const n    = craftSelected.length;
  if (info) info.textContent = `${n} / ${CRAFT_COST_ITEMS} sélectionnés · ${G.platinumFeathers} 💎 disponibles`;
  if (ppEl) ppEl.innerHTML = `💎 Plumes de Platine disponibles : <b>${G.platinumFeathers}</b>`;
  if (btn)  btn.disabled = n < CRAFT_COST_ITEMS || G.platinumFeathers < CRAFT_COST_PP;
}

function executeCraft() {
  if (craftSelected.length < CRAFT_COST_ITEMS) return;
  if (G.platinumFeathers < CRAFT_COST_PP) {
    alert('Pas assez de Plumes de Platine ! Achetez-en dans la Boutique.');
    return;
  }

  // Validation : tous les items sélectionnés de la bonne rareté
  const valid = craftSelected.every(iid => {
    const inv  = G.inventory.find(i => i.iid === iid);
    const skin = inv ? SKINS.find(s => s.id === inv.skinId) : null;
    return skin && skin.rarity === craftRarity;
  });
  if (!valid) { alert('Sélection invalide.'); return; }

  // Dépenser 1 PP
  G.platinumFeathers -= CRAFT_COST_PP;

  // Retirer les 20 items de l'inventaire
  craftSelected.forEach(iid => {
    const idx = G.inventory.findIndex(i => i.iid === iid);
    if (idx >= 0) G.inventory.splice(idx, 1);
  });
  craftSelected = [];

  // Sélectionner le résultat (rareté N+1, poids craftW)
  const result = selectSkinCraft(craftRarity);
  if (!result) {
    alert('Aucun skin disponible dans la rareté supérieure.');
    return;
  }

  G.inventory.push({ iid: genId(), skinId: result.id });

  // Log
  const log = $('craft-log');
  if (log) {
    const meta  = RARITY[result.rarity];
    const entry = document.createElement('div');
    entry.className = 'cl-entry';
    entry.innerHTML = `→ <span style="color:${meta.color};font-weight:600">${result.name}</span>` +
      `<span class="${result.sub === 'collector' ? 'col-tag' : 'cls-tag'}">` +
      (result.sub === 'collector' ? ' ⭐ Collector' : ' Classique') + '</span>';
    log.prepend(entry);
    if (log.children.length > 25) log.lastElementChild.remove();
  }

  renderCrafting();
  renderInventory();
  updateInvBadge();
  renderHeader();
}

// ─────────────────────────────────────────────────────────
// K. MARCHÉ SIMULÉ
// ─────────────────────────────────────────────────────────

function initMarketPrices() {
  SKINS.forEach(s => {
    if (!G.marketPrices[s.id]) {
      G.marketPrices[s.id] = s.basePx * (.88 + Math.random() * .24);
    }
  });
}

function updateMarketPrices() {
  SKINS.forEach(s => {
    let px    = G.marketPrices[s.id] || s.basePx;
    const noise = 1 + (Math.random() * .06 - .03);

    if (s.sub === 'collector') {
      px *= (1 + .005 + Math.random() * .01) * noise;
      px  = Math.min(px, s.basePx * 7);
    } else {
      px *= (1 - .003 - Math.random() * .005) * noise;
      px  = Math.max(px, s.basePx * .35);
    }
    G.marketPrices[s.id] = Math.max(.01, px);
  });
  if (isTabActive('market')) renderMarket();
}

// ─────────────────────────────────────────────────────────
// L. SAUVEGARDE
// ─────────────────────────────────────────────────────────

const SAVE_KEY     = 'shotclicker_v02';
const EXIT_TIME_KEY = 'sc_exit_time';

function saveGame(silent = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    G.lastSave = Date.now();
    if (!silent) showToast();
  } catch(e) { console.error('[SC] Save failed:', e); }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    G = Object.assign(defaultState(), saved);

    // Sanity checks
    UNITS.forEach(u => { if (G.unitCounts[u.id] == null) G.unitCounts[u.id] = 0; });
    RARITY_ORDER.forEach(r => {
      if (G.dropTimers[r]    == null) G.dropTimers[r]    = 0;
      if (G.dropCooldowns[r] == null || G.dropCooldowns[r] === -Infinity)
                                       G.dropCooldowns[r] = NEVER;
    });
    if (!Array.isArray(G.inventory))        G.inventory         = [];
    if (typeof G.marketPrices !== 'object') G.marketPrices      = {};
    if (typeof G.skills !== 'object')       G.skills            = {};
    if (typeof G.unitCounts !== 'object')   G.unitCounts        = {};
    if (typeof G.platinumFeathers !== 'number') G.platinumFeathers = 0;
    if (typeof G.sessionAccumulated !== 'number') G.sessionAccumulated = 0;

    // ← FATIGUE : vérifier si la pause était assez longue pour réinitialiser la session
    const lastExit = parseInt(localStorage.getItem(EXIT_TIME_KEY) || '0');
    if (lastExit > 0 && (Date.now() - lastExit) >= FATIGUE_REST_MS) {
      G.sessionAccumulated = 0;
      console.log('[SC] Pause suffisante — fatigue de drop réinitialisée.');
    }

    targetMaxHp = Math.max(100, Math.ceil(calcDpc() * 8));
    targetHp    = targetMaxHp;

  } catch(e) {
    console.error('[SC] Load failed — reset:', e);
    G = defaultState();
  }
}

function showToast() {
  const t = $('save-toast');
  if (!t) return;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2200);
}

// ─────────────────────────────────────────────────────────
// M. RENDU UI
// ─────────────────────────────────────────────────────────

function renderAll() {
  renderHeader();
  renderFatigueIndicator();
  renderShop();
  renderInventory();
  renderCrafting();
  renderMarket();
  renderBgUnits();
  updateWeaponDisplay();
  updateDecorDisplay();
  updateInvBadge();
  checkPrestigeBtn();
}

// Header (~30 fps)
function renderHeader() {
  setText('h-shells', fmt(G.shells));
  setText('h-dpc',    fmt(calcDpc()));
  setText('h-dps',    fmt(calcDps()));
  setText('h-po',     G.goldenFeathers);
  setText('h-pp',     G.platinumFeathers);
  setText('h-time',   fmtTime(G.playtime));
}

// Indicateur de fatigue
function renderFatigueIndicator() {
  const wrap  = $('fatigue-wrap');
  const fill  = $('fatigue-bar-fill');
  const label = $('fatigue-label');
  if (!wrap || !fill || !label) return;

  const pct     = Math.min(100, (G.sessionAccumulated / FATIGUE_THRESHOLD) * 100);
  const fatigued = G.sessionAccumulated >= FATIGUE_THRESHOLD;

  fill.style.width = pct + '%';
  wrap.classList.toggle('fatigued', fatigued);

  if (fatigued) {
    label.innerHTML = '😴 Fatigue active — drops ×0.5 — fermez 4h pour réinitialiser';
    // Supprimer l'ancien message si présent, en ajouter un
    if (!wrap.querySelector('.fatigue-active-msg')) {
      const msg = document.createElement('div');
      msg.className = 'fatigue-active-msg';
      msg.textContent = '⚠️ Cooldowns ×2 · Chances ×0.5';
      wrap.appendChild(msg);
    }
  } else {
    label.textContent = `Session : ${fmtSessionTime(G.sessionAccumulated)} / ${fmtSessionTime(FATIGUE_THRESHOLD)}`;
    const msg = wrap.querySelector('.fatigue-active-msg');
    if (msg) msg.remove();
  }
}

// ── BOUTIQUE ──────────────────────────────────────────────

function renderShop() {
  renderWeaponsShop();
  renderAmmoShop();
  renderUnitsShop();
  renderDecorShop();
  renderPPShop();
  renderSkillsShop();
}

function si(name, desc, btnLabel, btnClass, onclick, disabled) {
  const affordable = !disabled && btnClass !== 's-owned' && btnClass !== 's-equipped' && btnClass !== 's-pp';
  return `<div class="si${affordable ? ' can-afford' : ''}${btnClass==='s-owned'||btnClass==='s-equipped' ? ' is-owned' : ''}">
    <div class="si-info">
      <div class="si-name">${name}</div>
      <div class="si-desc">${desc}</div>
    </div>
    <button class="shop-btn ${btnClass||''}" onclick="${onclick}" ${disabled?'disabled':''}>
      ${btnLabel}
    </button>
  </div>`;
}

function renderWeaponsShop() {
  const el = $('s-weapons');
  if (!el) return;
  el.innerHTML = WEAPONS.map((wpn, idx) => {
    const owned    = G.weaponIdx >= idx;
    const equipped = G.weaponIdx === idx;
    const meetsReq = G.totalShells >= wpn.reqTotal;
    const cost     = idx === 0 ? 'Départ' : fmt(Math.ceil(wpn.cost * getCostMult())) + ' 🔶';
    const btn      = equipped ? '✓ Équipée' : owned ? '✓ Possédée' :
                     !meetsReq ? `🔒 ${fmt(wpn.reqTotal)} total` : cost;
    const cls      = equipped ? 's-equipped' : owned ? 's-owned' : '';
    const dis      = owned || !meetsReq || G.shells < Math.ceil(wpn.cost * getCostMult());
    const desc     = `+${fmt(wpn.dpcB)}/clic · +${fmt(wpn.dpsB)}/s · Max drop : ${RARITY[wpn.maxRar].label}${wpn.collOK?' + Collector':''}`;
    return si(`${wpn.emoji} ${wpn.name}`, desc, btn, cls, `buyWeapon(${idx})`, dis);
  }).join('');
}

function renderAmmoShop() {
  const el = $('s-ammo');
  if (!el) return;
  el.innerHTML = AMMO_TIERS.map((tier, idx) => {
    const owned  = G.ammoTier >= idx;
    const isNext = G.ammoTier === idx - 1;
    const cost   = idx === 0 ? 'Départ' : fmt(Math.ceil(tier.cost * getCostMult())) + ' 🔶';
    const dis    = owned || !isNext || G.shells < Math.ceil(tier.cost * getCostMult());
    return si(`${tier.icon} ${tier.name}`, `Base : ${fmt(tier.baseDpc)} dégâts/clic`,
      owned ? '✓ Actives' : isNext ? cost : '🔒', owned ? 's-owned' : '', `buyAmmo(${idx})`, dis);
  }).join('');

  const dr = $('s-dmgrank');
  if (!dr) return;
  const rankCost = getDmgRankCost();
  const maxed = G.damageRank >= DMG_RANK_MAX;
  dr.innerHTML = si(
    `📈 Rang de Dégâts <span class="unit-cnt">${G.damageRank}/${DMG_RANK_MAX}</span>`,
    `+15% dégâts/clic par rang (cumulatif). C(n) = ${DMG_BASE_COST} × 1.15ⁿ`,
    maxed ? '✓ Maximum' : fmt(rankCost) + ' 🔶',
    maxed ? 's-owned' : '',
    'buyDmgRank()',
    maxed || G.shells < rankCost
  );
}

function renderUnitsShop() {
  const el = $('s-units');
  if (!el) return;
  el.innerHTML = UNITS.map(u => {
    const cost  = getUnitCost(u.id);
    const count = G.unitCounts[u.id] || 0;
    return si(
      `${u.icon} ${u.name} <span class="unit-cnt">×${count}</span>`,
      `${u.desc} · ${u.baseDps} douilles/s par unité`,
      fmt(cost) + ' 🔶', '',
      `buyUnit('${u.id}')`,
      G.shells < cost
    );
  }).join('');
}

function renderDecorShop() {
  const el = $('s-decor');
  if (!el) return;
  el.innerHTML = DECORS.map((d, idx) => {
    const owned  = G.decorLevel >= idx;
    const isNext = G.decorLevel === idx - 1;
    const cost   = idx === 0 ? 'Départ' : fmt(Math.ceil(d.cost * getCostMult())) + ' 🔶';
    const dis    = owned || !isNext || G.shells < Math.ceil(d.cost * getCostMult());
    return si(`${d.icon} ${d.name}`, `Multiplicateur global ×${d.mult}`,
      owned ? '✓ Actif' : isNext ? cost : '🔒', owned ? 's-owned' : '', `buyDecor(${idx})`, dis);
  }).join('');
}

function renderPPShop() {
  const el = $('s-pp');
  if (!el) return;
  el.innerHTML = PP_PACKAGES.map((pkg, idx) => {
    return `<div class="si pp-pkg">
      <div class="si-info">
        <div class="si-name">${pkg.icon} ${pkg.name} — ${pkg.pp} Plumes de Platine</div>
        <div class="si-desc">${pkg.price} (${pkg.perUnit}) · Valeur fixe, aucune aléatoire</div>
      </div>
      <button class="shop-btn s-pp" onclick="buyPPPackage(${idx})">
        Acheter (simulé)
      </button>
    </div>`;
  }).join('');
}

function renderSkillsShop() {
  const el = $('s-skills');
  if (!el) return;
  el.innerHTML = GF_SKILLS.map(sk => {
    const owned  = !!G.skills[sk.id];
    const reqMet = !sk.req || !!G.skills[sk.req];
    const reqName = sk.req ? GF_SKILLS.find(s=>s.id===sk.req)?.name : '';
    const canBuy  = !owned && reqMet && G.goldenFeathers >= sk.cost;
    const btn     = owned ? '✓ Acquise' : !reqMet ? `🔒 ${reqName}` : sk.cost + ' 🪶';
    return si(`🪶 ${sk.name}`, sk.desc, btn, owned ? 's-owned' : '', `buySkill('${sk.id}')`, !canBuy);
  }).join('');
}

// ── INVENTAIRE ────────────────────────────────────────────

function renderInventory() {
  const grid = $('inv-grid');
  const cnt  = $('inv-count');
  if (!grid) return;
  if (cnt) cnt.textContent = G.inventory.length;

  if (G.inventory.length === 0) {
    grid.innerHTML = '<p style="color:var(--dim);padding:16px">Aucun skin. Jouez pour générer des drops !</p>';
    return;
  }

  const sorted = [...G.inventory].sort((a, b) => {
    const sa = SKINS.find(s => s.id === a.skinId);
    const sb = SKINS.find(s => s.id === b.skinId);
    if (!sa || !sb) return 0;
    const ri = RARITY_ORDER.indexOf(sb.rarity) - RARITY_ORDER.indexOf(sa.rarity);
    return ri !== 0 ? ri : (sb.sub === 'collector' ? 1 : -1);
  });

  grid.innerHTML = sorted.map(inv => {
    const skin = SKINS.find(s => s.id === inv.skinId);
    if (!skin) return '';
    const meta   = RARITY[skin.rarity];
    const eqp    = G.equippedSkin === inv.iid;
    const px     = (G.marketPrices[skin.id] || skin.basePx).toFixed(2);
    const wpnName = WEAPONS.find(w => w.id === skin.weapon)?.name || skin.weapon;
    return `<div class="inv-card${eqp?' equipped':''}"
         style="border-color:${eqp?'var(--c-epic)':meta.color+'55'}"
         onclick="equipSkin('${inv.iid}')" title="${skin.desc}">
      <div class="inv-rar rar-${skin.rarity}">${meta.label}</div>
      <div class="inv-sub ${skin.sub==='collector'?'col-tag':'cls-tag'}">${skin.sub==='collector'?'⭐':'○'}</div>
      <div class="inv-name">${skin.name}</div>
      <div class="inv-wpn">${wpnName}</div>
      <div class="inv-px">~${px} €</div>
      ${eqp?'<div class="eqp-tag">✓ Équipé</div>':''}
    </div>`;
  }).join('');
}

function equipSkin(iid) {
  G.equippedSkin = G.equippedSkin === iid ? null : iid;
  updateWeaponDisplay();
  renderInventory();
}

// ← Mise à jour visuelle de l'arme du pigeon selon le skin équipé
function updateWeaponDisplay() {
  const we  = $('weapon-emoji');
  const lbl = $('equipped-label');
  if (!we) return;

  // Effacer toutes les classes de weapon
  ['w0','w1','w2','w3','w4','w5'].forEach(c => we.classList.remove(c));

  if (G.equippedSkin) {
    const inv  = G.inventory.find(i => i.iid === G.equippedSkin);
    const skin = inv ? SKINS.find(s => s.id === inv.skinId) : null;
    if (skin) {
      const meta   = RARITY[skin.rarity];
      const wpn    = WEAPONS.find(w => w.id === skin.weapon);
      // Emoji et style de l'arme correspondant au skin
      we.textContent = wpn?.emoji || '🔫';
      we.classList.add(wpn?.cssClass || 'w0');
      // Glow coloré selon la rareté du skin → weapon sprite réactif
      we.style.filter = `drop-shadow(0 0 10px ${meta.color}) drop-shadow(0 0 20px ${meta.color}55)`;
      if (lbl) { lbl.textContent = skin.name; lbl.style.color = meta.color; }
      return;
    }
  }

  // Aucun skin équipé → afficher l'arme courante sans effet
  const wpn = WEAPONS[G.weaponIdx];
  we.textContent = wpn.emoji;
  we.classList.add(wpn.cssClass);
  we.style.filter = '';
  if (lbl) { lbl.textContent = ''; lbl.style.color = ''; }
}

function updateDecorDisplay() {
  const d   = DECORS[G.decorLevel];
  const bdg = $('decor-badge');
  const gw  = $('game-wrap');
  if (bdg) bdg.textContent    = `${d.icon} ${d.name} — ×${d.mult}`;
  if (gw)  gw.style.background = d.bg;
}

function renderBgUnits() {
  const el = $('bg-units');
  if (!el) return;
  let html = '';
  UNITS.forEach(u => {
    const cnt = G.unitCounts[u.id] || 0;
    if (cnt === 0) return;
    html += `<span title="${u.name} ×${cnt}">${u.icon.repeat(Math.min(cnt,5))}</span>`;
    if (cnt > 5) html += `<small style="color:var(--dim);font-size:.72em"> ×${cnt}</small>`;
  });
  el.innerHTML = html;
}

function updateInvBadge() {
  const b = $('inv-badge');
  if (b) b.textContent = G.inventory.length;
}

// ── CRAFTING UI ───────────────────────────────────────────

function renderCrafting() {
  renderCraftRarityNav();
  renderCraftPool();
  renderCraftSlots();
  updateCraftBtn();
}

function renderCraftRarityNav() {
  const nav = $('craft-rarity-nav');
  if (!nav) return;
  nav.innerHTML = RARITY_ORDER.slice(0,-1).map(r => {
    const meta   = RARITY[r];
    const toMeta = RARITY[RARITY_ORDER[RARITY_ORDER.indexOf(r)+1]];
    return `<button class="crb${craftRarity===r?' active':''}"
      style="${craftRarity===r?`color:${meta.color}`:''}"
      onclick="setCraftRarity('${r}')">
      <span style="color:${meta.color}">${meta.label}</span> → <span style="color:${toMeta.color}">${toMeta.label}</span>
    </button>`;
  }).join('');
}

function renderCraftPool() {
  const pool = $('craft-pool');
  if (!pool) return;
  const items = G.inventory.filter(inv => {
    const s = SKINS.find(x => x.id === inv.skinId);
    return s && s.rarity === craftRarity;
  });
  if (items.length === 0) {
    pool.innerHTML = `<p style="color:var(--dim);font-size:.79em">Aucun item <b>${RARITY[craftRarity].label}</b> disponible.</p>`;
    return;
  }
  pool.innerHTML = items.map(inv => {
    const skin = SKINS.find(s => s.id === inv.skinId);
    if (!skin) return '';
    const meta = RARITY[skin.rarity];
    const sel  = craftSelected.includes(inv.iid);
    const lbl  = skin.name.length > 22 ? skin.name.slice(0,20)+'…' : skin.name;
    return `<div class="cpill${sel?' sel':''}"
      style="${sel?'':` color:${meta.color}`}"
      title="${skin.name}${skin.sub==='collector'?' ⭐':''}"
      onclick="toggleCraftItem('${inv.iid}')">${lbl}</div>`;
  }).join('');
}

function renderCraftSlots() {
  const grid = $('craft-slots-grid');
  if (!grid) return;
  let html = '';
  for (let i = 0; i < CRAFT_COST_ITEMS; i++) {
    const iid  = craftSelected[i];
    const inv  = iid ? G.inventory.find(x => x.iid === iid) : null;
    const skin = inv ? SKINS.find(s => s.id === inv.skinId) : null;
    const wpn  = skin ? WEAPONS.find(w => w.id === skin.weapon) : null;
    html += `<div class="cslot${iid?' filled':''}" title="${skin?.name||''}">${wpn?.emoji||''}</div>`;
  }
  grid.innerHTML = html;
}

// ── MARCHÉ ────────────────────────────────────────────────

function renderMarket() {
  const tbody = $('market-body');
  if (!tbody) return;

  let filtered = marketFilter === 'all' ? [...SKINS] : SKINS.filter(s => s.rarity === marketFilter);
  filtered.sort((a,b) => {
    const ri = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
    if (ri !== 0) return ri;
    return (b.sub==='collector'?1:0)-(a.sub==='collector'?1:0);
  });

  tbody.innerHTML = filtered.map(skin => {
    const meta   = RARITY[skin.rarity];
    const px     = G.marketPrices[skin.id] || skin.basePx;
    const delta  = px - skin.basePx;
    const pct    = ((delta / skin.basePx) * 100).toFixed(1);
    const tc     = delta > .001 ? 'tu' : delta < -.001 ? 'td' : 'tn2';
    const ti     = delta > .001 ? '↗' : delta < -.001 ? '↘' : '→';
    const ownCnt = G.inventory.filter(i => i.skinId === skin.id).length;
    return `<tr>
      <td><span style="color:${meta.color}">${skin.name}</span></td>
      <td><span class="rar-${skin.rarity}">${meta.label}</span></td>
      <td><span class="${skin.sub==='collector'?'col-marker':'cls-marker'}">${skin.sub==='collector'?'⭐ Collector':'○ Classique'}</span></td>
      <td><b>${px.toFixed(2)} €</b></td>
      <td class="${tc}">${ti} ${Math.abs(pct)}%</td>
      <td>${ownCnt>0?`<b>${ownCnt}</b>`:'—'}</td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// N. NAVIGATION
// ─────────────────────────────────────────────────────────

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tn').forEach(b => b.classList.remove('active'));
  const pane = $('tab-' + tabId);
  const btn  = document.querySelector(`.tn[data-tab="${tabId}"]`);
  if (pane) pane.classList.add('active');
  if (btn)  btn.classList.add('active');
  if (tabId === 'shop')      renderShop();
  if (tabId === 'inventory') renderInventory();
  if (tabId === 'crafting')  renderCrafting();
  if (tabId === 'market')    renderMarket();
}

// ─────────────────────────────────────────────────────────
// O. INITIALISATION
// ─────────────────────────────────────────────────────────

function setupEvents() {
  document.querySelectorAll('.tn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('.mf').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mf').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      marketFilter = btn.dataset.f;
      renderMarket();
    });
  });

  // ← Sauvegarder l'heure de fermeture pour le calcul de fatigue
  window.addEventListener('beforeunload', () => {
    localStorage.setItem(EXIT_TIME_KEY, String(Date.now()));
    saveGame(true);
  });
}

function init() {
  loadGame();
  initMarketPrices();
  setupEvents();
  renderAll();

  // Boucle rAF principale
  requestAnimationFrame(ts => { lastTs = ts; requestAnimationFrame(gameLoop); });
  // Tick lent : logique de jeu
  setInterval(slowTick,          1000);
  // Tick marché : fluctuations de prix
  setInterval(updateMarketPrices,60000);

  if (DEV_MODE) {
    console.log(`%c[ShotClicker v0.2] DEV_MODE actif`, 'color:#ffd700;font-weight:bold');
    console.log(`  Drops ÷${DEV_DIV} | Fatigue ${(FATIGUE_THRESHOLD/60).toFixed(1)} min | Rest ${(FATIGUE_REST_MS/60000).toFixed(1)} min`);
  }
}

window.addEventListener('DOMContentLoaded', init);
