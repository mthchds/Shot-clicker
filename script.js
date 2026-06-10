/* ═══════════════════════════════════════════════════════════
   SHOT CLICKER — script.js — v0.4
   ─────────────────────────────────────────────────────────
   CHANGEMENTS v0.4 vs v0.3 :

   1. G.platinumFeathers (💎) réintroduit comme devise séparée
      — Craft coûte 20 items + 1 PP (plus PO)
      — PP conservées au Prestige
      — Packages TEST (10/50/100/250 PP) dans la boutique

   2. Logique PV cible corrigée
      — G.targetLevel : compteur de cibles détruites (dans state)
      — respawnTarget() : +10% HP max par niveau (1.1^level)
      — damageTarget(dpc) : damage = DPC réel (one-shot possible)
      — Affichage HP numérique + niveau cible

   3. Pity timer TOUJOURS visible en header (compteur 0/20)
      — Couleur neutre à 0, orange dès pity > 0

   4. Architecture audio (Suno / Splice)
      — let Sounds = {} : conteneur global pour les tracks
      — playSound(id) : dispatcher centralisé (console.log + hook)
      — Déclencheurs aux points clés (shot, crit, buy, prestige…)

   5. Chiffres flottants : drift latéral aléatoire
      — CSS var --drift-x injectée par JS sur chaque élément
      — Animation floatUp utilise translate(--drift-x, -95px)
      — Résultat : dispersion naturelle, plus d'empilement
   ═══════════════════════════════════════════════════════════ */
'use strict';

const DEV_MODE = true;
const DEV_DIV  = 60;

// ─────────────────────────────────────────────────────────
// A. DONNÉES STATIQUES
// ─────────────────────────────────────────────────────────

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','extraordinary'];

const RARITY = {
  common:        { label:'Commun',         color:'#b0c3d9', window:1800,   chance:.70, cooldown:1500,   basePx:.05   },
  uncommon:      { label:'Peu Commun',     color:'#5e98d9', window:3600,   chance:.50, cooldown:3000,   basePx:.15   },
  rare:          { label:'Rare',           color:'#4b69ff', window:10800,  chance:.25, cooldown:9000,   basePx:.80   },
  epic:          { label:'Épique',         color:'#8847ff', window:21600,  chance:.10, cooldown:18000,  basePx:3.00  },
  legendary:     { label:'Légendaire',     color:'#d32ce6', window:43200,  chance:.03, cooldown:36000,  basePx:15.00 },
  extraordinary: { label:'Extraordinaire', color:'#eb4b4b', window:180000, chance:.005,cooldown:162000, basePx:80.00 },
};
const dW = r => DEV_MODE ? RARITY[r].window   / DEV_DIV : RARITY[r].window;
const dC = r => DEV_MODE ? RARITY[r].cooldown / DEV_DIV : RARITY[r].cooldown;

const AMMO_TIERS = [
  { id:0, name:'Munitions en Plomb',      cost:0,    baseDpc:1,     icon:'🔘' },
  { id:1, name:'Munitions Blindées',      cost:500,  baseDpc:3,     icon:'⚪' },
  { id:2, name:'Munitions Expansives',    cost:5e3,  baseDpc:8,     icon:'🔵' },
  { id:3, name:'Munitions Explosives',    cost:5e4,  baseDpc:25,    icon:'🟠' },
  { id:4, name:'Munitions Perforantes',   cost:5e5,  baseDpc:80,    icon:'🔷' },
  { id:5, name:'Munitions Incendiaires',  cost:5e6,  baseDpc:300,   icon:'🔥' },
  { id:6, name:'Munitions Plasma',        cost:1e8,  baseDpc:2000,  icon:'🟣' },
  { id:7, name:'Munitions Antimatière',   cost:1e10, baseDpc:50000, icon:'⚫' },
];
const DMG_BASE_COST           = 10;
const DMG_GROWTH              = 1.15;
const DMG_RANK_MAX            = 200;
const DMG_RANK_BONUS_PER_LEVEL= 0.15; // LINÉAIRE v0.3+

const WEAPONS = [
  { id:'glock',   name:'Glock 17 "Pigeolo"',              reqTotal:0,    cost:0,    dpcB:0,     dpsB:0,    maxRar:'common',        collOK:false, emoji:'🔫' },
  { id:'shotgun', name:'Fusil à Pompe "Le Claqueur"',     reqTotal:1e4,  cost:8e3,  dpcB:10,    dpsB:5,    maxRar:'uncommon',      collOK:false, emoji:'🔫' },
  { id:'famas',   name:'FAMAS "Le Français"',             reqTotal:1e5,  cost:7.5e4,dpcB:50,    dpsB:30,   maxRar:'uncommon',      collOK:true,  emoji:'🔫' },
  { id:'ak47',    name:'AK-47 "Kalachnikove"',            reqTotal:1e6,  cost:8e5,  dpcB:200,   dpsB:120,  maxRar:'rare',          collOK:true,  emoji:'🔫' },
  { id:'minigun', name:'Minigun "La Tempête de Plumes"',  reqTotal:5e7,  cost:4e7,  dpcB:1000,  dpsB:800,  maxRar:'epic',          collOK:true,  emoji:'🔫' },
  { id:'laser',   name:'Arme Laser "Le Regard du Pigeon"',reqTotal:5e9,  cost:4e9,  dpcB:10000, dpsB:8000, maxRar:'extraordinary',  collOK:true,  emoji:'⚡' },
];

const UNITS = [
  { id:'pigeonneau',name:'Pigeonneau Stagiaire', baseCost:10,    baseDps:.1,   rate:1.15, icon:'🐣', desc:'Tire avec son bec.' },
  { id:'sniper',    name:'Pigeon Sniper',         baseCost:200,   baseDps:1,    rate:1.15, icon:'🎯', desc:'Lunette télescopique.' },
  { id:'tourelle',  name:'Tourelle Automatique',  baseCost:3000,  baseDps:8,    rate:1.15, icon:'🔧', desc:'Mini-gatling sur trépied.' },
  { id:'drone',     name:'Drone Kamikaze',         baseCost:5e4,   baseDps:47,   rate:1.15, icon:'🚁', desc:'Plonge en boucle.' },
  { id:'tank',      name:'Tank Pigeon',            baseCost:7.5e5, baseDps:260,  rate:1.15, icon:'🛡️', desc:'Blindé, implacable.' },
  { id:'satellite', name:'Satellite Orbital',      baseCost:1e8,   baseDps:1400, rate:1.15, icon:'🛸', desc:'Tire depuis l\'espace.' },
  { id:'quantique', name:'Dimension Quantique',    baseCost:1.4e10,baseDps:7800, rate:1.15, icon:'🌀', desc:'Portail de plumes.' },
];

const DECORS = [
  { level:0, name:'Cave Humide',               cost:0,     mult:1,   icon:'🏚️', bg:'#0d0d12' },
  { level:1, name:'Garage de Banlieue',         cost:2.5e4, mult:1.5, icon:'🚗', bg:'#0f1218' },
  { level:2, name:'Stand de Tir Amateur',       cost:2.5e5, mult:3,   icon:'🎯', bg:'#0f1825' },
  { level:3, name:'Base Militaire Abandonnée',  cost:5e6,   mult:8,   icon:'💣', bg:'#101a10' },
  { level:4, name:'Arène Futuriste',            cost:2e8,   mult:25,  icon:'🌐', bg:'#050215' },
  { level:5, name:'Station Orbitale',           cost:2e10,  mult:100, icon:'🚀', bg:'#010108' },
];

const PROG_COSTS = [2, 5, 12, 25, 50, 100, 200, 400, 800, 1600];
const PROG_BONUS = 0.20;

const GF_SKILLS = [
  { id:'serres', type:'progressive', name:'Serres Acérées',      costs:PROG_COSTS, effect:'dpcMult', desc:'+20% dégâts/clic par niveau (max niv.10 = ×3.0)' },
  { id:'migr',   type:'progressive', name:'Migration Accélérée', costs:PROG_COSTS, effect:'dpsMult', desc:'+20% douilles/sec par niveau (max niv.10 = ×3.0)' },
  { id:'memoire',type:'bool', name:'Mémoire Musculaire',    cost:8,  req:null, desc:'Vitesse auto-clic idle ×2' },
  { id:'vestige',type:'bool', name:'Vestige des Plumes',    cost:15, req:null, desc:'Conserve 5% des douilles au Prestige' },
  { id:'trafic', type:'bool', name:'Trafiquant',            cost:30, req:null, desc:'-20% sur tous les coûts boutique' },
  { id:'recup',  type:'bool', name:'Récupération de Skins', cost:40, req:null, desc:'+10% chance de drop natif' },
];

// ── Plumes de Platine : packages de test ────────────────────
// TODO PROD : remplacer par vraie transaction Steamworks
const PP_PACKAGES = [
  { amount:10,  label:'Starter',  price:'1,00 €',  bonus:'' },
  { amount:50,  label:'Joueur',   price:'4,50 €',  bonus:'= 50 fusions' },
  { amount:100, label:'Pro',      price:'8,50 €',  bonus:'= 100 fusions' },
  { amount:250, label:'Collector',price:'19,90 €', bonus:'Meilleure valeur' },
];

const CRAFT_ITEMS   = 20;   // items requis par fusion
const CRAFT_PP_COST = 1;    // 1 PP par fusion (pas de PO)

const PRESTIGE_THRESHOLD = 1e6;
const NEVER = -(Number.MAX_SAFE_INTEGER);

const SKINS = [
  { id:'glock_paindemie',   name:'Glock "Pain de Mie"',                weapon:'glock',   rarity:'common',       sub:'classic',  desc:'Peinte avec de la mie de pain séchée et de la moutarde.',                                                                    basePx:.05,  dropW:50, craftW:45 },
  { id:'glock_camo',        name:'Glock "Camouflage Parking"',         weapon:'glock',   rarity:'common',       sub:'classic',  desc:'Reproduit la texture d\'un sol de parking Carrefour. Totalement inutile comme camouflage.',                                    basePx:.04,  dropW:50, craftW:45 },
  { id:'shotgun_fleurs',    name:'Fusil à Pompe "Fleurs du Balcon"',   weapon:'shotgun', rarity:'uncommon',     sub:'classic',  desc:'Décorée de petites fleurs imprimées par la grand-mère du pigeon.',                                                             basePx:.12,  dropW:35, craftW:28 },
  { id:'shotgun_holo',      name:'Fusil à Pompe "Hologramme Supermarché"',weapon:'shotgun',rarity:'uncommon',   sub:'classic',  desc:'Revêtement holographique récupéré sur un sachet de chips.',                                                                    basePx:.10,  dropW:30, craftW:22 },
  { id:'famas_bleu',        name:'FAMAS "Bleu Roi de la Brocante"',    weapon:'famas',   rarity:'uncommon',     sub:'collector',desc:'Peinte en bleu électrique avec un rouleau à peinture. Des poils de pinceau sont encore visibles.',                              basePx:.45,  dropW:20, craftW:30 },
  { id:'famas_monet',       name:'FAMAS "L\'Hommage à Monet"',         weapon:'famas',   rarity:'uncommon',     sub:'collector',desc:'Le pigeon était censé faire un nénuphar. C\'est raté mais ça vaut cher quand même.',                                            basePx:.60,  dropW:15, craftW:20 },
  { id:'ak47_crimson',      name:'AK-47 "Plumage Crimson"',            weapon:'ak47',    rarity:'rare',         sub:'classic',  desc:'Incrustée de vraies plumes rouges. Le pigeon affirme qu\'il ne connaît pas la victime.',                                        basePx:.75,  dropW:30, craftW:22 },
  { id:'ak47_paintball',    name:'AK-47 "Paintball Massacre"',         weapon:'ak47',    rarity:'rare',         sub:'classic',  desc:'Tâches de peinture multicolores. Survécu à 47 parties de paintball et un divorce.',                                             basePx:.65,  dropW:25, craftW:18 },
  { id:'ak47_spectre',      name:'AK-47 "Spectre Ultraviolet"',        weapon:'ak47',    rarity:'rare',         sub:'collector',desc:'Ne devient visible qu\'en lumière noire. Utilisée exclusivement dans des soirées étudiantes.',                                  basePx:2.80, dropW:15, craftW:28 },
  { id:'ak47_rouille',      name:'AK-47 "Vieux Rouille Glorieux"',     weapon:'ak47',    rarity:'rare',         sub:'collector',desc:'Couverte de rouille authentique. Étrangement plus précise que les modèles neufs.',                                               basePx:3.50, dropW:10, craftW:22 },
  { id:'minigun_disco',     name:'Minigun "La Disco Ball"',            weapon:'minigun', rarity:'epic',         sub:'classic',  desc:'Chaque canon reflète la lumière différemment. Garantit l\'ambiance lors des fêtes de bureau.',                                  basePx:2.80, dropW:40, craftW:28 },
  { id:'minigun_coeur',     name:'Minigun "Coeur de Pigeon"',          weapon:'minigun', rarity:'epic',         sub:'classic',  desc:'Design romantique avec cœurs roses. Recommandée par 9/10 pigeons.',                                                             basePx:2.50, dropW:30, craftW:22 },
  { id:'minigun_abyssal',   name:'Minigun "Abyssal"',                  weapon:'minigun', rarity:'epic',         sub:'collector',desc:'Noire comme l\'âme d\'un lead dev à 3h du mat. Des reflets bleus apparaissent selon l\'angle.',                                  basePx:8.50, dropW:30, craftW:50 },
  { id:'laser_soleil',      name:'Laser "Le Soleil Intérieur"',        weapon:'laser',   rarity:'legendary',    sub:'classic',  desc:'Dorée à l\'extrême. Le designer graphique a démissionné après avoir rendu ce fichier.',                                          basePx:14.00,dropW:50, craftW:32 },
  { id:'laser_nebuleuse',   name:'Laser "Nébuleuse de Pigeostars"',    weapon:'laser',   rarity:'legendary',    sub:'collector',desc:'Reproduit une vraie photo de nébuleuse. La NASA n\'a pas été consultée.',                                                        basePx:35.00,dropW:30, craftW:38 },
  { id:'laser_fragments',   name:'Laser "Fragments d\'Éternité"',      weapon:'laser',   rarity:'legendary',    sub:'collector',desc:'Composée de milliers de petits cristaux animés.',                                                                               basePx:50.00,dropW:20, craftW:30 },
  { id:'laser_oiseaufeu',   name:'Laser "L\'Oiseau de Feu"',           weapon:'laser',   rarity:'extraordinary',sub:'collector',desc:'Animée avec des particules de flamme. Certains joueurs entendent des battements d\'ailes.',                                      basePx:75.00,dropW:60, craftW:42 },
  { id:'laser_kairos',      name:'Laser "Kairos — L\'Instant Unique"', weapon:'laser',   rarity:'extraordinary',sub:'collector',desc:'Texturée d\'une horloge qui tourne à l\'envers. Impossible de la recréer exactement.',                                           basePx:120.00,dropW:40,craftW:58 },
];

// ─────────────────────────────────────────────────────────
// B. ARCHITECTURE AUDIO (v0.4 — Préparation Suno / Splice)
// ─────────────────────────────────────────────────────────

/**
 * Sounds : conteneur global pour les tracks audio.
 * À remplir lors de l'intégration Howler.js :
 *   Sounds['SFX_SHOT_GLOCK']  = new Howl({ src: ['sounds/shot_glock.mp3'] });
 *   Sounds['BGM_CAVE']        = new Howl({ src: ['music/ambiance_cave.mp3'], loop: true });
 */
let Sounds = {};

/**
 * playSound(soundId) — Dispatcher audio centralisé
 *
 * Actuellement : console.log pour validation en dev.
 * En production, décommenter le bloc Howler.
 *
 * @param {string} soundId — identifiant du son (ex: 'SFX_SHOT_AK47')
 */
function playSound(soundId) {
  console.log('[Audio] Triggered:', soundId);

  // TODO PROD : décommenter après intégration Howler.js + assets Suno/Splice
  // if (Sounds[soundId]) {
  //   Sounds[soundId].play();
  // } else if (DEV_MODE) {
  //   console.warn('[Audio] Son non chargé:', soundId);
  // }
}

/*
 * Catalogue des identifiants audio utilisés dans le jeu :
 *
 * TIRS          SFX_SHOT_GLOCK / SFX_SHOT_SHOTGUN / SFX_SHOT_FAMAS
 *               SFX_SHOT_AK47 / SFX_SHOT_MINIGUN / SFX_SHOT_LASER
 * CRITIQUES     SFX_CRIT / SFX_SUPERCRIT
 * BOUTIQUE      SFX_BUY / SFX_BUY_PP / SFX_BUY_WEAPON
 * PRESTIGE      SFX_PRESTIGE
 * DROPS         SFX_DROP_COMMON / SFX_DROP_UNCOMMON / SFX_DROP_RARE
 *               SFX_DROP_EPIC / SFX_DROP_LEGENDARY / SFX_DROP_EXTRAORDINARY
 * CRAFT         SFX_CRAFT_SUCCESS
 * CIBLE         SFX_TARGET_DESTROY
 * AMBIANCES BGM_CAVE / BGM_GARAGE / BGM_STAND / BGM_BASE
 *               BGM_ARENA / BGM_ORBITAL
 */

// ─────────────────────────────────────────────────────────
// C. ÉTAT DU JEU
// ─────────────────────────────────────────────────────────

function defaultState() {
  const uc = {};
  UNITS.forEach(u => { uc[u.id] = 0; });
  const dt = {}, dc = {};
  RARITY_ORDER.forEach(r => { dt[r] = 0; dc[r] = NEVER; });
  return {
    shells:               0,
    totalShells:          0,
    playtime:             0,
    ammoTier:             0,
    damageRank:           0,
    weaponIdx:            0,
    decorLevel:           0,
    unitCounts:           uc,
    // Plumes d'Or (prestige)
    goldenFeathers:       0,
    totalGoldenFeathers:  0,
    prestigeCount:        0,
    skills:               {},
    // Plumes de Platine (monnaie premium / crafting)
    platinumFeathers:     0,
    // Drops
    dropTimers:           dt,
    dropCooldowns:        dc,
    consecutiveCommonDrops: 0,
    // Cible (v0.4 : niveau indépendant du DPC)
    targetLevel:          0,
    // Inventaire & skins
    inventory:            [],
    equippedSkin:         null,
    marketPrices:         {},
    lastSave:             Date.now(),
  };
}

let G = defaultState();

// État UI non sauvegardé
let craftRarity     = 'common';
let craftSelected   = [];
let marketFilter    = 'all';
let lastTs          = 0;
let renderTick      = 0;
let autoSaveTick    = 0;
let shopRefreshTick = 0;
let csCountdown     = null;

// PV cible (locaux, calculés depuis G.targetLevel)
let targetHp    = 100;
let targetMaxHp = 100;

// ─────────────────────────────────────────────────────────
// D. CALCULS
// ─────────────────────────────────────────────────────────

function getCostMult()  { return G.skills.trafic ? 0.80 : 1.0; }
function getDropBonus() { return G.skills.recup  ? 1.10 : 1.0; }

function calcDpc() {
  const ammoBase  = AMMO_TIERS[G.ammoTier].baseDpc;
  const wpnBonus  = WEAPONS[G.weaponIdx].dpcB;
  const base      = ammoBase + wpnBonus;
  const rankMult  = 1 + G.damageRank * DMG_RANK_BONUS_PER_LEVEL; // LINÉAIRE
  const decMult   = DECORS[G.decorLevel].mult;
  const serresLv  = G.skills.serres || 0;
  const skillMult = 1 + serresLv * PROG_BONUS;
  return base * rankMult * decMult * skillMult;
}

function calcDps() {
  let base = 0;
  UNITS.forEach(u => { base += (G.unitCounts[u.id] || 0) * u.baseDps; });
  const wpnBonus  = WEAPONS[G.weaponIdx].dpsB;
  const decMult   = DECORS[G.decorLevel].mult;
  const migrLv    = G.skills.migr || 0;
  const skillMult = 1 + migrLv * PROG_BONUS;
  return (base + wpnBonus) * decMult * skillMult;
}

function getUnitCost(unitId) {
  const u = UNITS.find(u => u.id === unitId);
  return Math.ceil(u.baseCost * Math.pow(u.rate, G.unitCounts[unitId] || 0) * getCostMult());
}

function getDmgRankCost() {
  return Math.ceil(DMG_BASE_COST * Math.pow(DMG_GROWTH, G.damageRank) * getCostMult());
}

function calcPrestigeGain() {
  return Math.max(10, Math.floor(Math.sqrt(G.totalShells / PRESTIGE_THRESHOLD) * 10));
}

/**
 * Calcule les PV max de la cible à partir de G.targetLevel.
 * Formule : 100 × 1.1^level (+10% par niveau)
 * Niveau 0 → 100 HP | Niveau 10 → 259 HP | Niveau 50 → 11 739 HP
 * AVERTISSEMENT : déborde au-delà du niveau ~1073 (prototype OK)
 */
function calcTargetMaxHp(level) {
  return Math.ceil(100 * Math.pow(1.1, level));
}

// ─────────────────────────────────────────────────────────
// E. UTILITAIRES
// ─────────────────────────────────────────────────────────

function $ (id) { return document.getElementById(id); }
function setText(id, v) { const e=$(id); if(e && e.textContent!==String(v)) e.textContent=v; }

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
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  if (h>0) return `${h}h ${m}m`;
  if (m>0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

function weightedRandom(pool, key) {
  if (!pool || pool.length===0) return null;
  const tot = pool.reduce((s,it)=>s+(it[key]||1),0);
  let r = Math.random()*tot;
  for (const it of pool) { r-=(it[key]||1); if(r<=0) return it; }
  return pool[pool.length-1];
}

function addShells(n)   { G.shells+=n; G.totalShells+=n; }
function spendShells(n) { if(G.shells<n) return false; G.shells-=n; return true; }

// ─────────────────────────────────────────────────────────
// F. BOUCLE DE JEU
// ─────────────────────────────────────────────────────────

function gameLoop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts-lastTs)/1000, .5);
  lastTs = ts;
  G.playtime += dt;
  addShells(calcDps()*dt);
  renderTick++;
  if (renderTick%2===0) renderHeader();
  requestAnimationFrame(gameLoop);
}

function slowTick() {
  checkDrops();
  checkPrestigeBtn();
  autoSaveTick++;
  if (autoSaveTick>=30) { autoSaveTick=0; saveGame(true); }
  shopRefreshTick++;
  if (shopRefreshTick%5===0) {
    renderBgUnits();
    if (isTabActive('shop'))     renderShop();
    if (isTabActive('crafting')) renderCrafting();
  }
  // Pity : toujours visible, couleur contextuelle
  const pityEl = $('h-pity');
  if (pityEl) {
    setText('h-pity', G.consecutiveCommonDrops);
    const wrap = pityEl.closest('.hstat-pity');
    if (wrap) wrap.classList.toggle('pity-active', G.consecutiveCommonDrops > 0);
  }
}

function isTabActive(id) { const e=$('tab-'+id); return e&&e.classList.contains('active'); }

// ─────────────────────────────────────────────────────────
// G. SYSTÈME DE CLIC
// ─────────────────────────────────────────────────────────

function handleClick(e) {
  const dpc  = calcDpc();
  const roll = Math.random();
  let val    = dpc, type = 'normal';

  if (roll < .005)     { val=dpc*10; type='supercrit'; }
  else if (roll < .05) { val=dpc*3;  type='crit'; }

  addShells(val);

  // ── Audio hooks ────────────────────────────────────────
  if (type==='supercrit')  playSound('SFX_SUPERCRIT');
  else if (type==='crit')  playSound('SFX_CRIT');
  else                     playSound('SFX_SHOT_' + WEAPONS[G.weaponIdx].id.toUpperCase());
  // ───────────────────────────────────────────────────────

  damageTarget(val);
  triggerKickback();
  triggerMuzzleFlash();
  spawnCasing();

  const rect = $('range-area').getBoundingClientRect();
  spawnFloat(val, type, e.clientX-rect.left, e.clientY-rect.top);
}

function triggerKickback() {
  const ctr=$('pigeon-sprite-container'); if(!ctr)return;
  ctr.classList.remove('kickback');
  void ctr.offsetWidth;
  ctr.classList.add('kickback');
  setTimeout(()=>ctr.classList.remove('kickback'), 230);
}

function triggerMuzzleFlash() {
  const mf=$('muzzle-flash'); if(!mf)return;
  mf.classList.add('active');
  setTimeout(()=>mf.classList.remove('active'), 75);
}

function spawnCasing() {
  const zone=$('pigeon-zone'); if(!zone)return;
  const c=document.createElement('div');
  c.className='casing';
  c.style.cssText='position:absolute;left:120px;top:36px;z-index:10;';
  zone.appendChild(c);
  setTimeout(()=>c.remove(), 800);
}

/**
 * spawnFloat — v0.4 : drift latéral aléatoire via CSS var --drift-x
 * Chaque chiffre flottant part dans une direction légèrement différente.
 * Résultat : dispersion naturelle, plus d'empilement sur clics rapides.
 */
function spawnFloat(val, type, x, y) {
  const layer=$('float-layer'); if(!layer)return;
  const el=document.createElement('div');
  el.className=`ft ${type}`;
  el.textContent=(type==='normal'?'+':'⚡ +')+fmt(val);
  el.style.left=Math.max(5,x-25)+'px';
  el.style.top =Math.max(5,y-10)+'px';
  // Drift latéral aléatoire : −40px à +40px
  const driftX=((Math.random()*80)-40).toFixed(1)+'px';
  el.style.setProperty('--drift-x', driftX);
  layer.appendChild(el);
  setTimeout(()=>el.remove(), 1200);
}

// ─────────────────────────────────────────────────────────
// H. CIBLE — LOGIQUE PV (v0.4)
// ─────────────────────────────────────────────────────────

/**
 * damageTarget — v0.4
 * Le dommage correspond au DPC réel (pas 1 HP fixe).
 * Un gros upgrade → le joueur peut one-shot la cible immédiatement.
 * La cible se met à niveau progressivement via G.targetLevel (+10%/niv).
 *
 * @param {number} damage — valeur DPC du clic
 */
function damageTarget(damage) {
  if (targetMaxHp <= 0) return;
  targetHp = Math.max(0, targetHp - damage);

  // Mise à jour de la barre et des chiffres HP
  const pct = (targetHp / targetMaxHp * 100);
  const fill=$('target-hp-fill');
  if (fill) fill.style.width = pct + '%';
  setText('target-hp-val', fmt(Math.ceil(targetHp)));

  // Effet visuel de touche
  const t=$('target');
  if (t) { t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit'); }

  // Trous de balle (max 20, seulement si damage > 1% du max pour éviter micro-trous)
  const holes=$('bullet-holes');
  if (holes && holes.children.length<20 && damage >= targetMaxHp*0.01) {
    const h=document.createElement('div');
    h.className='bullet-hole';
    h.style.left=(8+Math.random()*82)+'%';
    h.style.top =(8+Math.random()*82)+'%';
    holes.appendChild(h);
  }

  if (targetHp<=0) respawnTarget();
}

/**
 * respawnTarget — v0.4
 * G.targetLevel++ → PV max = 100 × 1.1^level (+10% fixe et prévisible).
 * Le joueur RESSENT sa puissance : si DPC > nouveau max, il one-shot encore.
 */
function respawnTarget() {
  G.targetLevel++;
  targetMaxHp = calcTargetMaxHp(G.targetLevel);
  targetHp    = targetMaxHp;

  const fill=$('target-hp-fill');
  if (fill) fill.style.width='100%';
  const holes=$('bullet-holes');
  if (holes) holes.innerHTML='';
  setText('target-hp-val',  fmt(targetMaxHp));
  setText('target-hp-max',  fmt(targetMaxHp));
  setText('target-lvl-num', G.targetLevel + 1); // +1 pour afficher "Niv. 1" au départ

  playSound('SFX_TARGET_DESTROY');
}

// ─────────────────────────────────────────────────────────
// I. BOUTIQUE
// ─────────────────────────────────────────────────────────

/**
 * buyPP — ajoute des Plumes de Platine (test en DEV_MODE)
 * TODO PROD : remplacer le corps par appel Steamworks Microtransaction API
 */
function buyPP(amount) {
  G.platinumFeathers += amount;
  renderHeader();
  setText('pp-count-shop',  G.platinumFeathers);
  setText('pp-count-craft', G.platinumFeathers);
  if (isTabActive('crafting')) updateCraftBtn();
  // Pas de SFX_BUY ici — son distinct pour achat premium
  playSound('SFX_BUY_PP');
}

function buyAmmo(idx) {
  if (idx<=G.ammoTier || idx!==G.ammoTier+1) return;
  if (!spendShells(Math.ceil(AMMO_TIERS[idx].cost*getCostMult()))) return;
  G.ammoTier = idx;
  renderShop();
  playSound('SFX_BUY');
}

function buyDmgRank() {
  if (G.damageRank>=DMG_RANK_MAX) return;
  if (!spendShells(getDmgRankCost())) return;
  G.damageRank++;
  renderShop();
  playSound('SFX_BUY');
}

function buyUnit(unitId) {
  if (!spendShells(getUnitCost(unitId))) return;
  G.unitCounts[unitId]=(G.unitCounts[unitId]||0)+1;
  renderShop(); renderBgUnits();
  playSound('SFX_BUY');
}

function buyWeapon(idx) {
  if (G.weaponIdx>=idx) return;
  const wpn=WEAPONS[idx];
  if (G.totalShells<wpn.reqTotal) return;
  if (!spendShells(Math.ceil(wpn.cost*getCostMult()))) return;
  G.weaponIdx=idx;
  updateWeaponDisplay(); renderShop();
  playSound('SFX_BUY_WEAPON');
}

function buyDecor(level) {
  if (level<=G.decorLevel || level!==G.decorLevel+1) return;
  if (!spendShells(Math.ceil(DECORS[level].cost*getCostMult()))) return;
  G.decorLevel=level;
  updateDecorDisplay(); renderShop();
  playSound('SFX_BUY');
}

function buySkill(skillId) {
  const sk=GF_SKILLS.find(s=>s.id===skillId); if(!sk)return;
  if (sk.type==='progressive') {
    const lv=G.skills[skillId]||0;
    if (lv>=10)return;
    if (G.goldenFeathers<sk.costs[lv])return;
    G.goldenFeathers-=sk.costs[lv];
    G.skills[skillId]=lv+1;
  } else {
    if (G.skills[skillId])return;
    if (sk.req&&!G.skills[sk.req])return;
    if (G.goldenFeathers<sk.cost)return;
    G.goldenFeathers-=sk.cost;
    G.skills[skillId]=true;
  }
  renderShop(); renderHeader();
  playSound('SFX_BUY');
}

// ─────────────────────────────────────────────────────────
// J. DROPS
// ─────────────────────────────────────────────────────────

function checkDrops() {
  const wpn=WEAPONS[G.weaponIdx];
  const maxRarIdx=RARITY_ORDER.indexOf(wpn.maxRar);
  const pity=G.consecutiveCommonDrops>=20;

  for (let ri=0;ri<=maxRarIdx;ri++) {
    const rar=RARITY_ORDER[ri], meta=RARITY[rar];
    if (G.playtime-G.dropTimers[rar]<dW(rar))continue;
    G.dropTimers[rar]=G.playtime;
    if (G.playtime-G.dropCooldowns[rar]<dC(rar))continue;

    if (pity&&rar==='common') {
      if (maxRarIdx>=RARITY_ORDER.indexOf('rare')) {
        const rW=dW('rare');
        if (G.playtime-G.dropTimers['rare']>=rW&&G.playtime-G.dropCooldowns['rare']>=dC('rare')) {
          G.dropTimers['rare']=G.playtime;
          awardDrop('rare',true); return;
        }
      }
      continue;
    }
    if (Math.random()<meta.chance*getDropBonus()){
      awardDrop(rar,false); return;
    }
  }
}

function awardDrop(rarity, forced) {
  const skin=selectSkinDrop(rarity); if(!skin)return;
  G.inventory.push({iid:uid(), skinId:skin.id});
  G.dropCooldowns[rarity]=G.playtime;
  if (rarity==='common') G.consecutiveCommonDrops++;
  else                   G.consecutiveCommonDrops=0;
  showDropNotif(skin,forced);
  updateInvBadge();
  playSound('SFX_DROP_'+rarity.toUpperCase());
}

function selectSkinDrop(rarity) {
  const wpn=WEAPONS[G.weaponIdx];
  let pool=SKINS.filter(s=>s.rarity===rarity);
  if (!wpn.collOK) pool=pool.filter(s=>s.sub==='classic');
  return weightedRandom(pool,'dropW');
}

function selectSkinCraft(fromRarity) {
  const toIdx=RARITY_ORDER.indexOf(fromRarity)+1;
  const toRarity=RARITY_ORDER[toIdx]; if(!toRarity)return null;
  let pool=SKINS.filter(s=>s.rarity===toRarity);
  if (G.weaponIdx<2) pool=pool.filter(s=>s.sub==='classic');
  return weightedRandom(pool,'craftW');
}

function showDropNotif(skin, forced) {
  const meta=RARITY[skin.rarity];
  const px=(G.marketPrices[skin.id]||skin.basePx).toFixed(2);
  $('drop-rarity-tag').textContent=(forced?'🎰 PITY — ':'')+meta.label+(skin.sub==='collector'?' ⭐ Collector':'');
  $('drop-rarity-tag').style.color=meta.color;
  $('drop-skin-icon').textContent=WEAPONS.find(w=>w.id===skin.weapon)?.emoji||'🎁';
  $('drop-skin-name').textContent=skin.name;
  $('drop-skin-desc').textContent=skin.desc;
  $('drop-price-est').textContent=`Valeur estimée : ~${px} €`;
  $('drop-notif').classList.remove('hidden');
}

function closeDrop() {
  $('drop-notif').classList.add('hidden');
  if (isTabActive('inventory')) renderInventory();
}

// ─────────────────────────────────────────────────────────
// K. PRESTIGE
// ─────────────────────────────────────────────────────────

function checkPrestigeBtn() {
  const btn=$('prestige-btn');
  if (btn) btn.disabled=G.totalShells<PRESTIGE_THRESHOLD;
}

function openPrestigeModal() {
  if (G.totalShells<PRESTIGE_THRESHOLD)return;
  const gain=calcPrestigeGain();
  setText('pi-earn',  gain+' 🪶');
  setText('pi-after', (G.goldenFeathers+gain)+' 🪶');
  setText('pi-pp',    G.platinumFeathers+' 💎 (conservées)');
  setText('pi-count', G.prestigeCount+1);
  $('prestige-modal').classList.remove('hidden');
}
function closePrestigeModal() { $('prestige-modal').classList.add('hidden'); }

function doPrestige() {
  const gain=calcPrestigeGain();
  const keepShells=G.skills.vestige?Math.floor(G.shells*.05):0;

  const savedSkills    = {...G.skills};
  const savedGF        = G.goldenFeathers+gain;
  const savedTotalGF   = G.totalGoldenFeathers+gain;
  const savedPP        = G.platinumFeathers;          // PP conservées
  const savedInv       = [...G.inventory];
  const savedPrices    = {...G.marketPrices};
  const savedPrestige  = G.prestigeCount+1;
  const savedEquipped  = G.equippedSkin;              // visuel conservé

  G=defaultState();
  G.goldenFeathers      = savedGF;
  G.totalGoldenFeathers = savedTotalGF;
  G.platinumFeathers    = savedPP;
  G.skills              = savedSkills;
  G.inventory           = savedInv;
  G.marketPrices        = savedPrices;
  G.prestigeCount       = savedPrestige;
  G.shells              = keepShells;
  G.equippedSkin        = savedEquipped;
  // G.targetLevel = 0 (reset via defaultState → nouvelle courbe de difficulté)

  targetHp    = calcTargetMaxHp(0);
  targetMaxHp = targetHp;

  closePrestigeModal();
  renderAll();
  saveGame(true);
  playSound('SFX_PRESTIGE');
}

// ─────────────────────────────────────────────────────────
// L. CRAFTING (v0.4 : 20 items + 1 PP)
// ─────────────────────────────────────────────────────────

function setCraftRarity(r) { craftRarity=r; craftSelected=[]; renderCrafting(); }

function toggleCraftItem(iid) {
  const idx=craftSelected.indexOf(iid);
  if (idx>=0) craftSelected.splice(idx,1);
  else if (craftSelected.length<CRAFT_ITEMS) craftSelected.push(iid);
  renderCraftSlots(); renderCraftPool(); updateCraftBtn();
}

function updateCraftBtn() {
  const btn=$('craft-btn'), info=$('craft-info'), warn=$('craft-pp-warn');
  const n=craftSelected.length;
  if (info) info.textContent=`${n} / ${CRAFT_ITEMS} sélectionnés`;
  const hasPP=G.platinumFeathers>=CRAFT_PP_COST;
  const ready=n>=CRAFT_ITEMS&&hasPP;
  if (btn) btn.disabled=!ready;
  if (warn) warn.classList.toggle('hidden', hasPP||n<CRAFT_ITEMS);
  // Mise à jour du compteur PP dans le craft tab
  setText('pp-count-craft', G.platinumFeathers);
}

function executeCraft() {
  if (craftSelected.length<CRAFT_ITEMS)return;
  if (G.platinumFeathers<CRAFT_PP_COST) {
    alert(`Il vous faut ${CRAFT_PP_COST} Plume de Platine (💎) pour fusionner !\nAchetez-en dans la Boutique.`);
    return;
  }

  // Validation : tous les items de la bonne rareté
  const valid=craftSelected.every(iid=>{
    const inv=G.inventory.find(i=>i.iid===iid);
    const skin=inv?SKINS.find(s=>s.id===inv.skinId):null;
    return skin&&skin.rarity===craftRarity;
  });
  if (!valid){ alert('Sélection invalide !'); return; }

  // Dépenser 1 PP
  // TODO PROD : remplacer G.platinumFeathers-- par Steamworks Microtransaction API call
  G.platinumFeathers-=CRAFT_PP_COST;

  // Retirer les 20 items
  craftSelected.forEach(iid=>{
    const idx=G.inventory.findIndex(i=>i.iid===iid);
    if(idx>=0) G.inventory.splice(idx,1);
  });
  craftSelected=[];

  // Sélectionner le résultat (rareté supérieure, poids craftW)
  const result=selectSkinCraft(craftRarity);
  if (!result){ alert('Aucun skin disponible dans la rareté supérieure.'); return; }

  G.inventory.push({iid:uid(), skinId:result.id});

  // Log
  const log=$('craft-log');
  if (log) {
    const meta=RARITY[result.rarity];
    const entry=document.createElement('div');
    entry.className='cl-entry';
    entry.innerHTML=`→ <span style="color:${meta.color};font-weight:600">${result.name}</span>`+
      `<span style="margin-left:6px;opacity:.7">${result.sub==='collector'?'⭐ Collector':'○ Classique'}</span>`;
    log.prepend(entry);
    if (log.children.length>25) log.lastElementChild.remove();
  }

  renderCrafting(); renderInventory(); updateInvBadge();
  showCraftSuccess(result);
}

// ─────────────────────────────────────────────────────────
// M. MODALE CRAFT SUCCESS
// ─────────────────────────────────────────────────────────

function showCraftSuccess(skin) {
  const meta=RARITY[skin.rarity];
  const px=(G.marketPrices[skin.id]||skin.basePx).toFixed(2);

  // Flash coloré plein écran
  const flash=document.createElement('div');
  flash.className='screen-flash';
  flash.style.background=meta.color;
  document.body.appendChild(flash);
  setTimeout(()=>flash.remove(), 500);

  // Remplir la modale
  const card=$('cs-card'); if(!card)return;
  card.style.setProperty('--cs-color', meta.color);
  const ring=$('cs-glow-ring');
  if (ring) ring.style.borderColor=meta.color+'88';

  $('cs-rarity-tag').textContent=meta.label+(skin.sub==='collector'?' ⭐ COLLECTOR':'');
  $('cs-rarity-tag').style.color=meta.color;
  $('cs-weapon-icon').textContent=WEAPONS.find(w=>w.id===skin.weapon)?.emoji||'🔫';
  $('cs-skin-name').textContent=skin.name;

  const typeEl=$('cs-skin-type');
  if (typeEl){ typeEl.textContent=skin.sub==='collector'?'⭐ Collector Rare':'○ Classique'; typeEl.style.color=skin.sub==='collector'?'#ffd700':meta.color; }
  $('cs-skin-desc').textContent=skin.desc;
  $('cs-price-row').textContent=`Valeur estimée marché : ~${px} €`;
  $('craft-success').classList.remove('hidden');

  if (csCountdown) clearInterval(csCountdown);
  let count=4; setText('cs-cd',count);
  csCountdown=setInterval(()=>{
    count--; setText('cs-cd',count);
    if (count<=0) closeCraftSuccess();
  },1000);

  playSound('SFX_CRAFT_SUCCESS');
}

function closeCraftSuccess() {
  if (csCountdown){ clearInterval(csCountdown); csCountdown=null; }
  $('craft-success').classList.add('hidden');
}

// ─────────────────────────────────────────────────────────
// N. MARCHÉ
// ─────────────────────────────────────────────────────────

function initMarketPrices() {
  SKINS.forEach(s=>{
    if (!G.marketPrices[s.id])
      G.marketPrices[s.id]=s.basePx*(.85+Math.random()*.30);
  });
}

function updateMarketPrices() {
  SKINS.forEach(s=>{
    let px=G.marketPrices[s.id]||s.basePx;
    const noise=1+(Math.random()*.06-.03);
    if (s.sub==='collector'){ px*=(1+.005+Math.random()*.01)*noise; px=Math.min(px,s.basePx*6); }
    else                    { px*=(1-.003-Math.random()*.005)*noise; px=Math.max(px,s.basePx*.35); }
    G.marketPrices[s.id]=Math.max(.01,px);
  });
  if (isTabActive('market')) renderMarket();
}

// ─────────────────────────────────────────────────────────
// O. SAUVEGARDE
// ─────────────────────────────────────────────────────────

const SAVE_KEY='shotclicker_v04';

function saveGame(silent=false) {
  try{ localStorage.setItem(SAVE_KEY,JSON.stringify(G)); if(!silent)showToast(); }
  catch(e){ console.error('[SC] Save failed:',e); }
}

function loadGame() {
  try {
    const raw=localStorage.getItem(SAVE_KEY);
    if (!raw)return;
    const saved=JSON.parse(raw);
    G=Object.assign(defaultState(),saved);

    // Sanity checks & migrations
    UNITS.forEach(u=>{if(G.unitCounts[u.id]==null)G.unitCounts[u.id]=0;});
    RARITY_ORDER.forEach(r=>{
      if(G.dropTimers[r]==null)G.dropTimers[r]=0;
      if(G.dropCooldowns[r]==null||G.dropCooldowns[r]===-Infinity)G.dropCooldowns[r]=NEVER;
    });
    if(!Array.isArray(G.inventory))      G.inventory={};
    if(!Array.isArray(G.inventory))      G.inventory=[];
    if(typeof G.marketPrices!=='object') G.marketPrices={};
    if(typeof G.skills!=='object')       G.skills={};
    if(typeof G.unitCounts!=='object')   G.unitCounts={};

    // Migration v0.1/v0.2 : anciens booleans skills → integers
    if(G.skills.serres1||G.skills.serres2||G.skills.serres3){
      let lv=0; if(G.skills.serres1)lv=1; if(G.skills.serres2)lv=2; if(G.skills.serres3)lv=3;
      G.skills.serres=Math.max(G.skills.serres||0,lv);
      delete G.skills.serres1; delete G.skills.serres2; delete G.skills.serres3;
    }
    if(G.skills.migr1||G.skills.migr2){
      let lv=0; if(G.skills.migr1)lv=1; if(G.skills.migr2)lv=2;
      G.skills.migr=Math.max(G.skills.migr||0,lv);
      delete G.skills.migr1; delete G.skills.migr2;
    }
    // Migration v0.3 : platinumFeathers manquant → 0
    if(G.platinumFeathers==null) G.platinumFeathers=0;
    // Migration : targetLevel manquant → 0
    if(G.targetLevel==null) G.targetLevel=0;

  } catch(e){ console.error('[SC] Load failed, reset:',e); G=defaultState(); }
}

function showToast() {
  const t=$('save-toast'); if(!t)return;
  t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2200);
}

// ─────────────────────────────────────────────────────────
// P. RENDU UI
// ─────────────────────────────────────────────────────────

function renderAll() {
  renderHeader(); renderShop(); renderInventory();
  renderCrafting(); renderMarket(); renderBgUnits();
  updateWeaponDisplay(); updateDecorDisplay(); updateInvBadge();
  checkPrestigeBtn();
}

function renderHeader() {
  setText('h-shells', fmt(G.shells));
  setText('h-dpc',    fmt(calcDpc()));
  setText('h-dps',    fmt(calcDps()));
  setText('h-po',     G.goldenFeathers);
  setText('h-pp',     G.platinumFeathers);
  setText('h-time',   fmtTime(G.playtime));
  setText('h-pity',   G.consecutiveCommonDrops);
  // Couleur pity
  const pw = $('h-pity')?.closest('.hstat-pity');
  if (pw) pw.classList.toggle('pity-active', G.consecutiveCommonDrops>0);
}

// ── BOUTIQUE ──────────────────────────────────────────────

function renderShop() {
  renderPPShop();
  renderWeaponsShop();
  renderAmmoShop();
  renderUnitsShop();
  renderDecorShop();
  renderSkillsShop();
  setText('pp-count-shop', G.platinumFeathers);
}

function si(name,desc,btnLbl,btnCls,onclick,disabled,extra=''){
  const af=!disabled&&btnCls!=='s-owned'&&btnCls!=='s-equipped'&&btnCls!=='s-maxed';
  return `<div class="si${af?' can-afford':''}${btnCls==='s-owned'||btnCls==='s-equipped'?' is-owned':''}">
    <div class="si-info">
      <div class="si-name">${name}</div>
      <div class="si-desc">${desc}</div>${extra}
    </div>
    <button class="shop-btn ${btnCls}" onclick="${onclick}" ${disabled?'disabled':''}>${btnLbl}</button>
  </div>`;
}

function renderPPShop() {
  const el=$('s-pp-packages'); if(!el)return;
  el.innerHTML=PP_PACKAGES.map(pkg=>
    `<div class="pp-pkg">
      <div class="pp-pkg-info">
        <div class="pp-pkg-name">💎 ${pkg.amount} Plumes de Platine <small>${pkg.bonus?`— ${pkg.bonus}`:''}</small></div>
        <div class="pp-pkg-sub">
          ${DEV_MODE?'<b style="color:#f0a040">[TEST]</b> Ajoute les PP instantanément · ':''
          }<span class="todo-tag">TODO PROD: Steamworks ${pkg.price}</span>
        </div>
      </div>
      <button class="pp-btn${DEV_MODE?' dev-mode':''}" onclick="buyPP(${pkg.amount})">
        ${DEV_MODE?`🔧 +${pkg.amount} 💎`:pkg.price}
      </button>
    </div>`
  ).join('');
}

function renderWeaponsShop() {
  const el=$('s-weapons'); if(!el)return;
  el.innerHTML=WEAPONS.map((wpn,idx)=>{
    const owned=G.weaponIdx>=idx, eqp=G.weaponIdx===idx;
    const meetsReq=G.totalShells>=wpn.reqTotal;
    const cost=idx===0?'Départ':fmt(Math.ceil(wpn.cost*getCostMult()))+' 🔶';
    const btnLbl=eqp?'✓ Équipée':owned?'✓ Possédée':!meetsReq?`🔒 ${fmt(wpn.reqTotal)} total`:cost;
    const dis=owned||!meetsReq||G.shells<Math.ceil(wpn.cost*getCostMult());
    return si(`${wpn.emoji} ${wpn.name}`,
      `+${fmt(wpn.dpcB)}/clic · +${fmt(wpn.dpsB)}/s · Drops max: ${RARITY[wpn.maxRar].label}${wpn.collOK?' + Collector':''}`,
      btnLbl,eqp?'s-equipped':owned?'s-owned':'',`buyWeapon(${idx})`,dis);
  }).join('');
}

function renderAmmoShop() {
  const el=$('s-ammo'); if(!el)return;
  el.innerHTML=AMMO_TIERS.map((tier,idx)=>{
    const owned=G.ammoTier>=idx,isNext=G.ammoTier===idx-1;
    const cost=idx===0?'Départ':fmt(Math.ceil(tier.cost*getCostMult()))+' 🔶';
    return si(`${tier.icon} ${tier.name}`,`Base : ${fmt(tier.baseDpc)} dégâts/clic`,
      owned?'✓ Actives':isNext?cost:'🔒',owned?'s-owned':'',`buyAmmo(${idx})`,
      owned||!isNext||G.shells<Math.ceil(tier.cost*getCostMult()));
  }).join('');

  const dr=$('s-dmgrank'); if(!dr)return;
  const rCost=getDmgRankCost(),maxed=G.damageRank>=DMG_RANK_MAX;
  const curPct=(G.damageRank*DMG_RANK_BONUS_PER_LEVEL*100).toFixed(0);
  dr.innerHTML=si(
    `📈 Rang de Dégâts <span class="unit-cnt">${G.damageRank}/${DMG_RANK_MAX}</span>`,
    `+${curPct}% DPC actuellement · Formule LINÉAIRE +15%/rang · Coût: ${DMG_BASE_COST}×1.15ⁿ`,
    maxed?'✓ MAX':fmt(rCost)+' 🔶',maxed?'s-maxed':'','buyDmgRank()',maxed||G.shells<rCost);
}

function renderUnitsShop() {
  const el=$('s-units'); if(!el)return;
  el.innerHTML=UNITS.map(u=>{
    const cost=getUnitCost(u.id),cnt=G.unitCounts[u.id]||0;
    return si(`${u.icon} ${u.name} <span class="unit-cnt">×${cnt}</span>`,
      `${u.desc} · ${u.baseDps}/s chacune`,fmt(cost)+' 🔶','',`buyUnit('${u.id}')`,G.shells<cost);
  }).join('');
}

function renderDecorShop() {
  const el=$('s-decor'); if(!el)return;
  el.innerHTML=DECORS.map((d,idx)=>{
    const owned=G.decorLevel>=idx,isNext=G.decorLevel===idx-1;
    const cost=idx===0?'Départ':fmt(Math.ceil(d.cost*getCostMult()))+' 🔶';
    return si(`${d.icon} ${d.name}`,`Multiplicateur global ×${d.mult}`,
      owned?'✓ Actif':isNext?cost:'🔒',owned?'s-owned':'',`buyDecor(${idx})`,
      owned||!isNext||G.shells<Math.ceil(d.cost*getCostMult()));
  }).join('');
}

function renderSkillsShop() {
  const el=$('s-skills'); if(!el)return;
  el.innerHTML=GF_SKILLS.map(sk=>{
    if (sk.type==='progressive'){
      const lv=G.skills[sk.id]||0,maxed=lv>=10;
      const nextCost=maxed?0:sk.costs[lv];
      const curPct=(lv*PROG_BONUS*100).toFixed(0);
      const nxtPct=maxed?'-':((lv+1)*PROG_BONUS*100).toFixed(0);
      const canBuy=!maxed&&G.goldenFeathers>=nextCost;
      const bar=`<div class="skill-bar"><div class="skill-bar-fill" style="width:${lv/10*100}%"></div></div>`;
      return si(`🪶 ${sk.name} <span class="unit-cnt">Niv. ${lv}/10</span>`,
        `+${curPct}% actuellement · Prochain: +${nxtPct}% · ${sk.desc}`,
        maxed?'✓ MAX niv.10':`Niv.${lv+1} — ${nextCost} 🪶`,
        maxed?'s-maxed':'',`buySkill('${sk.id}')`,!canBuy,bar);
    } else {
      const owned=!!G.skills[sk.id];
      const reqMet=!sk.req||!!G.skills[sk.req];
      const canBuy=!owned&&reqMet&&G.goldenFeathers>=sk.cost;
      return si(`🪶 ${sk.name}`,sk.desc,
        owned?'✓ Acquise':!reqMet?'🔒':sk.cost+' 🪶',
        owned?'s-owned':'',`buySkill('${sk.id}')`,!canBuy);
    }
  }).join('');
}

// ── INVENTAIRE ────────────────────────────────────────────

function renderInventory() {
  const grid=$('inv-grid'),cnt=$('inv-count'); if(!grid)return;
  if (cnt) cnt.textContent=G.inventory.length;
  if (!G.inventory.length){
    grid.innerHTML='<p style="color:var(--dim);padding:16px">Aucun skin. Jouez pour obtenir des drops !</p>'; return;
  }
  const sorted=[...G.inventory].sort((a,b)=>{
    const sa=SKINS.find(s=>s.id===a.skinId),sb=SKINS.find(s=>s.id===b.skinId);
    if(!sa||!sb)return 0;
    const d=RARITY_ORDER.indexOf(sb.rarity)-RARITY_ORDER.indexOf(sa.rarity);
    return d!==0?d:(sb.sub==='collector'?1:-1);
  });
  grid.innerHTML=sorted.map(inv=>{
    const skin=SKINS.find(s=>s.id===inv.skinId); if(!skin)return '';
    const meta=RARITY[skin.rarity],eqp=G.equippedSkin===inv.iid;
    const px=(G.marketPrices[skin.id]||skin.basePx).toFixed(2);
    const isLocked=WEAPONS.findIndex(w=>w.id===skin.weapon)>G.weaponIdx;
    return `<div class="inv-card${eqp?' equipped':''}"
      style="border-color:${eqp?'var(--c-epic)':meta.color+'55'}"
      onclick="equipSkin('${inv.iid}')" title="${skin.desc}">
      <div class="inv-rar rar-${skin.rarity}">${meta.label}</div>
      <div class="inv-sub ${skin.sub==='collector'?'col-tag':'cls-tag'}">${skin.sub==='collector'?'⭐':'○'}</div>
      <div class="inv-name">${skin.name}</div>
      <div class="inv-wpn">${WEAPONS.find(w=>w.id===skin.weapon)?.name||skin.weapon}</div>
      <div class="inv-px">~${px} €</div>
      ${eqp?'<div class="eqp-tag">✓ Équipé</div>':''}
      ${isLocked&&eqp?'<div class="lock-tag">🔒 Arme en déblocage</div>':''}
    </div>`;
  }).join('');
}

function equipSkin(iid) {
  G.equippedSkin=G.equippedSkin===iid?null:iid;
  updateWeaponDisplay(); renderInventory();
}

function updateWeaponDisplay() {
  const we=$('pspr-weapon-emoji'),lbl=$('equipped-label'); if(!we)return;
  if (G.equippedSkin){
    const inv=G.inventory.find(i=>i.iid===G.equippedSkin);
    const skin=inv?SKINS.find(s=>s.id===inv.skinId):null;
    if (skin){
      const meta=RARITY[skin.rarity];
      const isLocked=WEAPONS.findIndex(w=>w.id===skin.weapon)>G.weaponIdx;
      we.textContent=WEAPONS.find(w=>w.id===skin.weapon)?.emoji||'🔫';
      we.style.filter=`drop-shadow(0 0 10px ${meta.color})`;
      we.style.opacity=isLocked?'.75':'1';
      if (lbl){ lbl.textContent=isLocked?`${skin.name} 🔒`:skin.name; lbl.style.color=isLocked?'#888':meta.color; }
      return;
    }
  }
  we.textContent=WEAPONS[G.weaponIdx].emoji; we.style.filter=''; we.style.opacity='1';
  if (lbl){ lbl.textContent=''; lbl.style.color=''; }
}

function updateDecorDisplay() {
  const d=DECORS[G.decorLevel];
  setText('decor-badge',`${d.icon} ${d.name} — ×${d.mult}`);
  const gw=$('game-wrap'); if(gw) gw.style.background=d.bg;
}

function renderBgUnits() {
  const el=$('bg-units'); if(!el)return;
  let html='';
  UNITS.forEach(u=>{
    const cnt=G.unitCounts[u.id]||0; if(!cnt)return;
    html+=`<span title="${u.name} ×${cnt}">${u.icon.repeat(Math.min(cnt,6))}</span>`;
    if(cnt>6) html+=`<small style="color:var(--dim);font-size:.72em"> ×${cnt}</small>`;
  });
  el.innerHTML=html;
}

function updateInvBadge() {
  const b=$('inv-badge'); if(b) b.textContent=G.inventory.length;
}

// ── CRAFTING UI ───────────────────────────────────────────

function renderCrafting() {
  renderCraftRarityNav(); renderCraftPool(); renderCraftSlots(); updateCraftBtn();
  setText('pp-count-craft', G.platinumFeathers);
}

function renderCraftRarityNav() {
  const nav=$('craft-rarity-nav'); if(!nav)return;
  nav.innerHTML=RARITY_ORDER.slice(0,-1).map(r=>{
    const meta=RARITY[r],toMeta=RARITY[RARITY_ORDER[RARITY_ORDER.indexOf(r)+1]];
    return `<button class="crb${craftRarity===r?' active':''}"
      style="${craftRarity===r?`color:${meta.color}`:''}"
      onclick="setCraftRarity('${r}')">
      <span style="color:${meta.color}">${meta.label}</span> → <span style="color:${toMeta.color}">${toMeta.label}</span>
    </button>`;
  }).join('');
}

function renderCraftPool() {
  const pool=$('craft-pool'); if(!pool)return;
  const items=G.inventory.filter(inv=>{
    const s=SKINS.find(x=>x.id===inv.skinId); return s&&s.rarity===craftRarity;
  });
  if (!items.length){
    pool.innerHTML=`<p style="color:var(--dim);font-size:.76em">Aucun item <b>${RARITY[craftRarity].label}</b> dans l'inventaire.</p>`; return;
  }
  pool.innerHTML=items.map(inv=>{
    const skin=SKINS.find(s=>s.id===inv.skinId); if(!skin)return '';
    const meta=RARITY[skin.rarity],sel=craftSelected.includes(inv.iid);
    const lbl=skin.name.length>22?skin.name.slice(0,20)+'…':skin.name;
    return `<div class="cpill${sel?' sel':''}" style="${sel?'':`color:${meta.color}`}"
      title="${skin.name}${skin.sub==='collector'?' ⭐':''}"
      onclick="toggleCraftItem('${inv.iid}')">${lbl}</div>`;
  }).join('');
}

function renderCraftSlots() {
  const grid=$('craft-slots-grid'); if(!grid)return;
  let html='';
  for (let i=0;i<CRAFT_ITEMS;i++){
    const iid=craftSelected[i];
    const inv=iid?G.inventory.find(x=>x.iid===iid):null;
    const skin=inv?SKINS.find(s=>s.id===inv.skinId):null;
    html+=`<div class="cslot${iid?' filled':''}" title="${skin?.name||''}">${
      skin?WEAPONS.find(w=>w.id===skin.weapon)?.emoji||'🔫':''}</div>`;
  }
  grid.innerHTML=html;
}

// ── MARCHÉ ────────────────────────────────────────────────

function renderMarket() {
  const tbody=$('market-body'); if(!tbody)return;
  let filtered=marketFilter==='all'?[...SKINS]:SKINS.filter(s=>s.rarity===marketFilter);
  filtered.sort((a,b)=>{
    const d=RARITY_ORDER.indexOf(b.rarity)-RARITY_ORDER.indexOf(a.rarity);
    return d!==0?d:(b.sub==='collector'?1:-1);
  });
  tbody.innerHTML=filtered.map(skin=>{
    const meta=RARITY[skin.rarity];
    const px=G.marketPrices[skin.id]||skin.basePx;
    const delta=px-skin.basePx,pct=((delta/skin.basePx)*100).toFixed(1);
    const tc=delta>.001?'tu':delta<-.001?'td':'tn2';
    const ti=delta>.001?'↗':delta<-.001?'↘':'→';
    const own=G.inventory.filter(i=>i.skinId===skin.id).length;
    return `<tr>
      <td><span style="color:${meta.color}">${skin.name}</span></td>
      <td><span class="rar-${skin.rarity}">${meta.label}</span></td>
      <td><span class="${skin.sub==='collector'?'col-marker':'cls-marker'}">${skin.sub==='collector'?'⭐ Collector':'○ Classique'}</span></td>
      <td><b>${px.toFixed(2)} €</b></td>
      <td class="${tc}">${ti} ${Math.abs(pct)}%</td>
      <td>${own>0?`<b>${own}</b>`:'—'}</td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// Q. NAVIGATION & INIT
// ─────────────────────────────────────────────────────────

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tn').forEach(b=>b.classList.remove('active'));
  const pane=$('tab-'+tabId),btn=document.querySelector(`.tn[data-tab="${tabId}"]`);
  if (pane) pane.classList.add('active');
  if (btn)  btn.classList.add('active');
  if (tabId==='shop')      renderShop();
  if (tabId==='inventory') renderInventory();
  if (tabId==='crafting')  renderCrafting();
  if (tabId==='market')    renderMarket();
}

function setupEvents() {
  document.querySelectorAll('.tn').forEach(btn=>{
    btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('.mf').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.mf').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); marketFilter=btn.dataset.f; renderMarket();
    });
  });
}

function init() {
  loadGame();
  initMarketPrices();

  // Initialiser la cible depuis le niveau sauvegardé
  targetMaxHp = calcTargetMaxHp(G.targetLevel);
  targetHp    = targetMaxHp;
  setText('target-hp-val', fmt(targetHp));
  setText('target-hp-max', fmt(targetMaxHp));
  setText('target-lvl-num', G.targetLevel + 1);

  setupEvents();
  renderAll();

  requestAnimationFrame(ts=>{ lastTs=ts; requestAnimationFrame(gameLoop); });
  setInterval(slowTick,          1000);
  setInterval(updateMarketPrices,60000);

  if (DEV_MODE){
    console.log('%c[ShotClicker v0.4] DEV_MODE actif','color:#ffd700;font-weight:bold');
    console.log(`  Drop Common   : toutes les ${dW('common').toFixed(0)}s`);
    console.log(`  Drop Rare     : toutes les ${dW('rare').toFixed(0)}s`);
    console.log('  PP (diamants) : séparés des PO, craft = 20 items + 1 PP');
    console.log('  Cible HP      : 100 × 1.1^level (niv.0=100, niv.10=259, niv.50=11739)');
    console.log('  Audio hooks   : playSound() → console.log ("[Audio] Triggered: ...")');
  }
}

window.addEventListener('DOMContentLoaded', init);
