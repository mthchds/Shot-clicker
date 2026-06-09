/* ═══════════════════════════════════════════════════════════
   SHOT CLICKER — script.js — v0.3
   Corrections équilibrage, sprite pigeon, craft modal
   ═══════════════════════════════════════════════════════════

   CHANGEMENTS v0.3 vs v0.1 :
   ─ calcDpc() : rankBonus LINÉAIRE (+15% base par rang)
   ─ Craft     : 20 items + 1 PO (remplace 10 items + 500 shells)
   ─ GF_SKILLS : Serres & Migration → 10 niveaux progressifs
   ─ Prestige  : G.equippedSkin conservé (cohérence visuelle)
   ─ Pigeon    : kickback sur #pigeon-sprite-container (3 couches)
   ─ Craft OK  : screen-flash + modale animée avec countdown
   ─ Save compat : migration auto des saves v0.1/v0.2
   ═══════════════════════════════════════════════════════════ */
'use strict';

// ── DEV MODE ────────────────────────────────────────────────
const DEV_MODE = true;   // ← mettre false avant déploiement
const DEV_DIV  = 60;     // divise les fenêtres de drop par 60

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

// Munitions (8 paliers séquentiels)
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

// Rang de dégâts répétable (max 200)
// v0.3 : LINÉAIRE — chaque rang = +15% des dégâts de BASE de l'arme
// Formule DPC : base × (1 + rank × 0.15) × décor × compétences
const DMG_BASE_COST = 10;
const DMG_GROWTH    = 1.15;  // coût exponentiel du rang (pas l'effet)
const DMG_RANK_MAX  = 200;
const DMG_RANK_BONUS_PER_LEVEL = 0.15; // +15% par rang (additif)

// Armes (séquentielles, débloquées par douilles totales)
const WEAPONS = [
  { id:'glock',   name:'Glock 17 "Pigeolo"',              reqTotal:0,    cost:0,    dpcB:0,     dpsB:0,    maxRar:'common',        collOK:false, emoji:'🔫' },
  { id:'shotgun', name:'Fusil à Pompe "Le Claqueur"',     reqTotal:1e4,  cost:8e3,  dpcB:10,    dpsB:5,    maxRar:'uncommon',      collOK:false, emoji:'🔫' },
  { id:'famas',   name:'FAMAS "Le Français"',             reqTotal:1e5,  cost:7.5e4,dpcB:50,    dpsB:30,   maxRar:'uncommon',      collOK:true,  emoji:'🔫' },
  { id:'ak47',    name:'AK-47 "Kalachnikove"',            reqTotal:1e6,  cost:8e5,  dpcB:200,   dpsB:120,  maxRar:'rare',          collOK:true,  emoji:'🔫' },
  { id:'minigun', name:'Minigun "La Tempête de Plumes"',  reqTotal:5e7,  cost:4e7,  dpcB:1000,  dpsB:800,  maxRar:'epic',          collOK:true,  emoji:'🔫' },
  { id:'laser',   name:'Arme Laser "Le Regard du Pigeon"',reqTotal:5e9,  cost:4e9,  dpcB:10000, dpsB:8000, maxRar:'extraordinary',  collOK:true,  emoji:'⚡' },
];

// Unités idle
const UNITS = [
  { id:'pigeonneau',name:'Pigeonneau Stagiaire', baseCost:10,    baseDps:.1,   rate:1.15, icon:'🐣', desc:'Tire avec son bec.' },
  { id:'sniper',    name:'Pigeon Sniper',         baseCost:200,   baseDps:1,    rate:1.15, icon:'🎯', desc:'Lunette télescopique.' },
  { id:'tourelle',  name:'Tourelle Automatique',  baseCost:3000,  baseDps:8,    rate:1.15, icon:'🔧', desc:'Mini-gatling sur trépied.' },
  { id:'drone',     name:'Drone Kamikaze',         baseCost:5e4,   baseDps:47,   rate:1.15, icon:'🚁', desc:'Plonge en boucle.' },
  { id:'tank',      name:'Tank Pigeon',            baseCost:7.5e5, baseDps:260,  rate:1.15, icon:'🛡️', desc:'Blindé, implacable.' },
  { id:'satellite', name:'Satellite Orbital',      baseCost:1e8,   baseDps:1400, rate:1.15, icon:'🛸', desc:'Tire depuis l\'espace.' },
  { id:'quantique', name:'Dimension Quantique',    baseCost:1.4e10,baseDps:7800, rate:1.15, icon:'🌀', desc:'Portail de plumes.' },
];

// Décors (6 stades)
const DECORS = [
  { level:0, name:'Cave Humide',               cost:0,     mult:1,   icon:'🏚️', bg:'#0d0d12' },
  { level:1, name:'Garage de Banlieue',         cost:2.5e4, mult:1.5, icon:'🚗', bg:'#0f1218' },
  { level:2, name:'Stand de Tir Amateur',       cost:2.5e5, mult:3,   icon:'🎯', bg:'#0f1825' },
  { level:3, name:'Base Militaire Abandonnée',  cost:5e6,   mult:8,   icon:'💣', bg:'#101a10' },
  { level:4, name:'Arène Futuriste',            cost:2e8,   mult:25,  icon:'🌐', bg:'#050215' },
  { level:5, name:'Station Orbitale',           cost:2e10,  mult:100, icon:'🚀', bg:'#010108' },
];

// ── Compétences Plumes d'Or (v0.3) ─────────────────────
// type:'progressive' → stocké comme entier (niveau 0-10) dans G.skills
// type:'bool'        → stocké comme boolean dans G.skills
//
// Serres Acérées & Migration Accélérée : 10 niveaux
//   Coûts : [2, 5, 12, 25, 50, 100, 200, 400, 800, 1600]
//   Effet : +20% DPC (resp. DPS) par niveau (multiplicateur cumulatif)
//   Total niv.10 : ×3.0 sur DPC (resp. DPS)
//
// Autres skills : coûts augmentés en v0.3 pour ralentir la progression
const PROG_COSTS = [2, 5, 12, 25, 50, 100, 200, 400, 800, 1600]; // 10 niveaux
const PROG_BONUS = 0.20; // +20% par niveau

const GF_SKILLS = [
  // Progressive
  { id:'serres', type:'progressive', name:'Serres Acérées',      costs:PROG_COSTS, effect:'dpcMult', desc:'+20% dégâts/clic par niveau (max niv.10 = ×3.0)' },
  { id:'migr',   type:'progressive', name:'Migration Accélérée', costs:PROG_COSTS, effect:'dpsMult', desc:'+20% douilles/sec par niveau (max niv.10 = ×3.0)' },
  // Boolean (coûts augmentés vs v0.1)
  { id:'memoire',type:'bool', name:'Mémoire Musculaire',    cost:8,  effect:'idleSpd',    val:2.0,  req:null,     desc:'Vitesse auto-clic idle ×2' },
  { id:'vestige',type:'bool', name:'Vestige des Plumes',    cost:15, effect:'keepShells', val:.05,  req:null,     desc:'Conserve 5% des douilles au Prestige' },
  { id:'trafic', type:'bool', name:'Trafiquant',            cost:30, effect:'costReduc',  val:.80,  req:null,     desc:'-20% sur tous les coûts boutique' },
  { id:'recup',  type:'bool', name:'Récupération de Skins', cost:40, effect:'dropBonus',  val:1.10, req:null,     desc:'+10% chance de drop natif' },
];

// Catalogue de 18 skins
const SKINS = [
  { id:'glock_paindemie',   name:'Glock "Pain de Mie"',                weapon:'glock',   rarity:'common',       sub:'classic',  desc:'Peinte avec de la mie de pain séchée et de la moutarde. Aucun armureur ne sait comment c\'est arrivé.',           basePx:.05,  dropW:50, craftW:45 },
  { id:'glock_camo',        name:'Glock "Camouflage Parking"',         weapon:'glock',   rarity:'common',       sub:'classic',  desc:'Reproduit fidèlement la texture d\'un sol de parking Carrefour. Totalement inutile comme camouflage.',               basePx:.04,  dropW:50, craftW:45 },
  { id:'shotgun_fleurs',    name:'Fusil à Pompe "Fleurs du Balcon"',   weapon:'shotgun', rarity:'uncommon',     sub:'classic',  desc:'Décorée de petites fleurs imprimées par la grand-mère du pigeon. Redoutablement mignonne.',                           basePx:.12,  dropW:35, craftW:28 },
  { id:'shotgun_holo',      name:'Fusil à Pompe "Hologramme Supermarché"',weapon:'shotgun',rarity:'uncommon',   sub:'classic',  desc:'Revêtement holographique récupéré sur un sachet de chips. La prise en main colle légèrement.',                        basePx:.10,  dropW:30, craftW:22 },
  { id:'famas_bleu',        name:'FAMAS "Bleu Roi de la Brocante"',    weapon:'famas',   rarity:'uncommon',     sub:'collector',desc:'Peinte en bleu électrique avec un rouleau à peinture. Des poils de pinceau sont encore visibles.',                    basePx:.45,  dropW:20, craftW:30 },
  { id:'famas_monet',       name:'FAMAS "L\'Hommage à Monet"',         weapon:'famas',   rarity:'uncommon',     sub:'collector',desc:'Le pigeon était censé faire un nénuphar. C\'est raté mais ça vaut cher quand même.',                                   basePx:.60,  dropW:15, craftW:20 },
  { id:'ak47_crimson',      name:'AK-47 "Plumage Crimson"',            weapon:'ak47',    rarity:'rare',         sub:'classic',  desc:'Incrustée de vraies plumes rouges. Le pigeon affirme qu\'il ne connaît pas la victime.',                              basePx:.75,  dropW:30, craftW:22 },
  { id:'ak47_paintball',    name:'AK-47 "Paintball Massacre"',         weapon:'ak47',    rarity:'rare',         sub:'classic',  desc:'Tâches de peinture multicolores. Survécu à 47 parties de paintball et un divorce.',                                    basePx:.65,  dropW:25, craftW:18 },
  { id:'ak47_spectre',      name:'AK-47 "Spectre Ultraviolet"',        weapon:'ak47',    rarity:'rare',         sub:'collector',desc:'Ne devient visible qu\'en lumière noire. Utilisée exclusivement dans des soirées étudiantes.',                          basePx:2.80, dropW:15, craftW:28 },
  { id:'ak47_rouille',      name:'AK-47 "Vieux Rouille Glorieux"',     weapon:'ak47',    rarity:'rare',         sub:'collector',desc:'Couverte de rouille authentique. Étrangement plus précise que les modèles neufs.',                                       basePx:3.50, dropW:10, craftW:22 },
  { id:'minigun_disco',     name:'Minigun "La Disco Ball"',            weapon:'minigun', rarity:'epic',         sub:'classic',  desc:'Chaque canon reflète la lumière différemment. Garantit l\'ambiance lors des fêtes de bureau.',                        basePx:2.80, dropW:40, craftW:28 },
  { id:'minigun_coeur',     name:'Minigun "Coeur de Pigeon"',          weapon:'minigun', rarity:'epic',         sub:'classic',  desc:'Design romantique avec cœurs roses. Recommandée par 9/10 pigeons pour la Saint-Valentin.',                             basePx:2.50, dropW:30, craftW:22 },
  { id:'minigun_abyssal',   name:'Minigun "Abyssal"',                  weapon:'minigun', rarity:'epic',         sub:'collector',desc:'Noire comme l\'âme d\'un lead dev à 3h du mat. Des reflets bleus apparaissent selon l\'angle.',                        basePx:8.50, dropW:30, craftW:50 },
  { id:'laser_soleil',      name:'Laser "Le Soleil Intérieur"',        weapon:'laser',   rarity:'legendary',    sub:'classic',  desc:'Dorée à l\'extrême. Le designer graphique a démissionné après avoir rendu ce fichier.',                               basePx:14.00,dropW:50, craftW:32 },
  { id:'laser_nebuleuse',   name:'Laser "Nébuleuse de Pigeostars"',    weapon:'laser',   rarity:'legendary',    sub:'collector',desc:'Reproduit une vraie photo de nébuleuse. La NASA n\'a pas été consultée.',                                              basePx:35.00,dropW:30, craftW:38 },
  { id:'laser_fragments',   name:'Laser "Fragments d\'Éternité"',      weapon:'laser',   rarity:'legendary',    sub:'collector',desc:'Composée de milliers de petits cristaux animés. Personne ne sait comment elle tire.',                                   basePx:50.00,dropW:20, craftW:30 },
  { id:'laser_oiseaufeu',   name:'Laser "L\'Oiseau de Feu"',           weapon:'laser',   rarity:'extraordinary',sub:'collector',desc:'Animée avec des particules de flamme en temps réel. Certains joueurs entendent des battements d\'ailes.',               basePx:75.00,dropW:60, craftW:42 },
  { id:'laser_kairos',      name:'Laser "Kairos — L\'Instant Unique"', weapon:'laser',   rarity:'extraordinary',sub:'collector',desc:'Texturée d\'une horloge qui tourne à l\'envers. Impossible de la recréer exactement, même pour le développeur.',        basePx:120.00,dropW:40,craftW:58 },
];

// Seuils et coûts
const PRESTIGE_THRESHOLD = 1e6;
const CRAFT_ITEMS   = 20;   // items requis par fusion (v0.3 : 20 items)
const CRAFT_PO_COST = 1;    // Plumes d'Or requises par fusion
                             // TODO PROD: remplacer par 0,10€ Steamworks Microtransaction API
const NEVER = -(Number.MAX_SAFE_INTEGER); // sentinelle "jamais droppé" (JSON-safe)

// ─────────────────────────────────────────────────────────
// B. ÉTAT DU JEU
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
    goldenFeathers:       0,
    totalGoldenFeathers:  0,
    prestigeCount:        0,
    skills:               {},   // { serres: 0-10, migr: 0-10, memoire: bool, ... }
    dropTimers:           dt,
    dropCooldowns:        dc,
    consecutiveCommonDrops: 0,
    inventory:            [],   // [{ iid, skinId }]
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
let csCountdown     = null;   // interval countdown modale craft

// État visuel cible (non sauvegardé)
let targetHp    = 100;
let targetMaxHp = 100;

// ─────────────────────────────────────────────────────────
// C. VALEURS CALCULÉES
// ─────────────────────────────────────────────────────────

function getCostMult()  { return G.skills.trafic ? 0.80 : 1.0; }
function getDropBonus() { return G.skills.recup  ? 1.10 : 1.0; }

/**
 * v0.3 : calcDpc() — rang LINÉAIRE
 * DPC = (ammoBase + weaponBonus) × (1 + rank × 0.15) × decorMult × skillMult
 * Ex : rank 100 → ×16 (vs ×117 en exponentiel v0.1)
 * Ex : rank 200 → ×31 (vs ×1237 en exponentiel v0.1) — inflation maîtrisée
 */
function calcDpc() {
  const ammoBase = AMMO_TIERS[G.ammoTier].baseDpc;
  const wpnBonus = WEAPONS[G.weaponIdx].dpcB;
  const base     = ammoBase + wpnBonus;
  // Rang ADDITIF (linéaire)
  const rankMult = 1 + G.damageRank * DMG_RANK_BONUS_PER_LEVEL;
  const decMult  = DECORS[G.decorLevel].mult;
  // Serres Acérées : niveau 0-10, +20% par niveau
  const serresLv = (G.skills.serres || 0);
  const skillMult = 1 + serresLv * PROG_BONUS;
  return base * rankMult * decMult * skillMult;
}

function calcDps() {
  let base = 0;
  UNITS.forEach(u => { base += (G.unitCounts[u.id] || 0) * u.baseDps; });
  const wpnBonus = WEAPONS[G.weaponIdx].dpsB;
  const decMult  = DECORS[G.decorLevel].mult;
  // Migration Accélérée : niveau 0-10, +20% par niveau
  const migrLv   = (G.skills.migr || 0);
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

/**
 * v0.3 : calcPrestigeGain()
 * Formule sqrt stricte. Au premier reset (1M shells) : 10 PO.
 * Courbe : PO = floor(sqrt(total / 1e6) × 10)
 *   1M  → 10 PO  |  4M  → 20 PO  |  9M  → 30 PO  |  100M → 100 PO
 * Ralentit naturellement : doubler les PO nécessite 4× les shells.
 */
function calcPrestigeGain() {
  return Math.max(10, Math.floor(Math.sqrt(G.totalShells / PRESTIGE_THRESHOLD) * 10));
}

// ─────────────────────────────────────────────────────────
// D. UTILITAIRES
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

function addShells(n)  { G.shells+=n; G.totalShells+=n; }
function spendShells(n){ if(G.shells<n)return false; G.shells-=n; return true; }

// ─────────────────────────────────────────────────────────
// E. BOUCLE DE JEU
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
  if (autoSaveTick>=30){ autoSaveTick=0; saveGame(true); }
  shopRefreshTick++;
  if (shopRefreshTick%5===0) {
    renderBgUnits();
    if (isTabActive('shop'))     renderShop();
    if (isTabActive('crafting')) renderCrafting();
  }
  // Mise à jour du compteur pity dans le header
  const pw = $('h-pity-wrap');
  if (pw) pw.style.display = G.consecutiveCommonDrops>0 ? '' : 'none';
  setText('h-pity', G.consecutiveCommonDrops);
}

function isTabActive(id) {
  const el=$('tab-'+id); return el && el.classList.contains('active');
}

// ─────────────────────────────────────────────────────────
// F. SYSTÈME DE CLIC
// ─────────────────────────────────────────────────────────

function handleClick(e) {
  const dpc  = calcDpc();
  const roll = Math.random();
  let val    = dpc, type = 'normal';
  if (roll<.005)      { val=dpc*10; type='supercrit'; }
  else if (roll<.05)  { val=dpc*3;  type='crit'; }

  addShells(val);
  damageTarget();
  triggerKickback();
  triggerMuzzleFlash();
  spawnCasing();

  const rect = $('range-area').getBoundingClientRect();
  spawnFloat(val, type, e.clientX-rect.left, e.clientY-rect.top);
  // playSound('shot_' + WEAPONS[G.weaponIdx].id);
}

function triggerKickback() {
  const ctr = $('pigeon-sprite-container');
  if (!ctr) return;
  ctr.classList.remove('kickback');
  void ctr.offsetWidth;            // force reflow — redéclenche l'animation
  ctr.classList.add('kickback');
  setTimeout(()=>ctr.classList.remove('kickback'), 230);
}

function triggerMuzzleFlash() {
  const mf=$('muzzle-flash'); if(!mf) return;
  mf.classList.add('active');
  setTimeout(()=>mf.classList.remove('active'), 75);
}

function spawnCasing() {
  // Positionnée relativement au pigeon-zone
  const zone=$('pigeon-zone'); if(!zone) return;
  const c=document.createElement('div');
  c.className='casing';
  c.style.cssText='position:absolute;left:120px;top:36px;z-index:10;';
  zone.appendChild(c);
  setTimeout(()=>c.remove(), 800);
}

function spawnFloat(val, type, x, y) {
  const layer=$('float-layer'); if(!layer) return;
  const el=document.createElement('div');
  el.className=`ft ${type}`;
  el.textContent=(type==='normal'?'+':'⚡ +')+fmt(val);
  el.style.left=Math.max(5,x-25)+'px';
  el.style.top =Math.max(5,y-10)+'px';
  layer.appendChild(el);
  setTimeout(()=>el.remove(), 1200);
}

function damageTarget() {
  targetHp=Math.max(0,targetHp-1);
  const fill=$('target-hp-fill');
  if(fill) fill.style.width=(targetHp/targetMaxHp*100)+'%';
  const t=$('target');
  if(t){ t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit'); }

  // Trous de balle (max 22)
  const holes=$('bullet-holes');
  if(holes && holes.children.length<22){
    const h=document.createElement('div');
    h.className='bullet-hole';
    h.style.left=(8+Math.random()*82)+'%';
    h.style.top =(8+Math.random()*82)+'%';
    holes.appendChild(h);
  }
  if(targetHp<=0) respawnTarget();
}

function respawnTarget() {
  // Recalculer le HP max à chaque respawn pour refléter la progression
  targetMaxHp = Math.max(100, Math.ceil(calcDpc()*12));
  targetHp    = targetMaxHp;
  const fill=$('target-hp-fill');
  if(fill) fill.style.width='100%';
  const holes=$('bullet-holes');
  if(holes) holes.innerHTML='';
  // playSound('sfx_target_destroy');
}

// ─────────────────────────────────────────────────────────
// G. BOUTIQUE
// ─────────────────────────────────────────────────────────

function buyAmmo(idx) {
  if(idx<=G.ammoTier || idx!==G.ammoTier+1) return;
  const cost=Math.ceil(AMMO_TIERS[idx].cost*getCostMult());
  if(!spendShells(cost)) return;
  G.ammoTier=idx;
  respawnTarget();
  renderShop();
}

function buyDmgRank() {
  if(G.damageRank>=DMG_RANK_MAX) return;
  if(!spendShells(getDmgRankCost())) return;
  G.damageRank++;
  renderShop();
}

function buyUnit(unitId) {
  const cost=getUnitCost(unitId);
  if(!spendShells(cost)) return;
  G.unitCounts[unitId]=(G.unitCounts[unitId]||0)+1;
  renderShop(); renderBgUnits();
}

function buyWeapon(idx) {
  if(G.weaponIdx>=idx) return;
  const wpn=WEAPONS[idx];
  if(G.totalShells<wpn.reqTotal) return;
  if(!spendShells(Math.ceil(wpn.cost*getCostMult()))) return;
  G.weaponIdx=idx;
  updateWeaponDisplay(); renderShop();
}

function buyDecor(level) {
  if(level<=G.decorLevel || level!==G.decorLevel+1) return;
  if(!spendShells(Math.ceil(DECORS[level].cost*getCostMult()))) return;
  G.decorLevel=level;
  updateDecorDisplay(); renderShop();
}

/**
 * buySkill — gère les deux types de compétences
 * Progressive : G.skills[id] = 0…10 (niveau)
 * Boolean     : G.skills[id] = true
 */
function buySkill(skillId) {
  const sk=GF_SKILLS.find(s=>s.id===skillId); if(!sk) return;

  if(sk.type==='progressive') {
    const lv=G.skills[skillId]||0;
    if(lv>=10) return;                      // déjà au niveau max
    const cost=sk.costs[lv];               // coût du PROCHAIN niveau
    if(G.goldenFeathers<cost) return;
    G.goldenFeathers-=cost;
    G.skills[skillId]=lv+1;

  } else {
    if(G.skills[skillId]) return;           // déjà acheté
    if(sk.req && !G.skills[sk.req]) return; // prérequis manquant
    if(G.goldenFeathers<sk.cost) return;
    G.goldenFeathers-=sk.cost;
    G.skills[skillId]=true;
  }
  renderShop(); renderHeader();
}

// ─────────────────────────────────────────────────────────
// H. SYSTÈME DE DROPS
// ─────────────────────────────────────────────────────────

function checkDrops() {
  const wpn=WEAPONS[G.weaponIdx];
  const maxRarIdx=RARITY_ORDER.indexOf(wpn.maxRar);
  const pity=G.consecutiveCommonDrops>=20;

  for(let ri=0;ri<=maxRarIdx;ri++){
    const rar=RARITY_ORDER[ri], meta=RARITY[rar];
    const win=dW(rar), cool=dC(rar);
    if(G.playtime-G.dropTimers[rar]<win) continue;
    G.dropTimers[rar]=G.playtime;
    if(G.playtime-G.dropCooldowns[rar]<cool) continue;

    // Pity actif : sauter le common et tenter un rare forcé
    if(pity && rar==='common'){
      if(maxRarIdx>=RARITY_ORDER.indexOf('rare')){
        const rW=dW('rare');
        if(G.playtime-G.dropTimers['rare']>=rW &&
           G.playtime-G.dropCooldowns['rare']>=dC('rare')){
          G.dropTimers['rare']=G.playtime;
          awardDrop('rare',true);
          return;
        }
      }
      continue;
    }

    if(Math.random()<meta.chance*getDropBonus()){
      awardDrop(rar,false); return;
    }
  }
}

function awardDrop(rarity, forced) {
  const skin=selectSkinDrop(rarity); if(!skin) return;
  G.inventory.push({iid:uid(), skinId:skin.id});
  G.dropCooldowns[rarity]=G.playtime;
  if(rarity==='common') G.consecutiveCommonDrops++;
  else                  G.consecutiveCommonDrops=0;
  showDropNotif(skin,forced);
  updateInvBadge();
}

function selectSkinDrop(rarity) {
  const wpn=WEAPONS[G.weaponIdx];
  let pool=SKINS.filter(s=>s.rarity===rarity);
  if(!wpn.collOK) pool=pool.filter(s=>s.sub==='classic');
  return weightedRandom(pool,'dropW');
}

function selectSkinCraft(fromRarity) {
  const toIdx=RARITY_ORDER.indexOf(fromRarity)+1;
  const toRarity=RARITY_ORDER[toIdx]; if(!toRarity) return null;
  let pool=SKINS.filter(s=>s.rarity===toRarity);
  if(G.weaponIdx<2) pool=pool.filter(s=>s.sub==='classic');
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

function closeDrop(){
  $('drop-notif').classList.add('hidden');
  if(isTabActive('inventory')) renderInventory();
}

// ─────────────────────────────────────────────────────────
// I. PRESTIGE
// ─────────────────────────────────────────────────────────

function checkPrestigeBtn(){
  const btn=$('prestige-btn');
  if(btn) btn.disabled=G.totalShells<PRESTIGE_THRESHOLD;
}

function openPrestigeModal(){
  if(G.totalShells<PRESTIGE_THRESHOLD) return;
  const gain=calcPrestigeGain();
  $('pi-earn').textContent=gain+' 🪶';
  $('pi-after').textContent=(G.goldenFeathers+gain)+' 🪶';
  $('pi-count').textContent=G.prestigeCount+1;
  $('prestige-modal').classList.remove('hidden');
}
function closePrestigeModal(){ $('prestige-modal').classList.add('hidden'); }

function doPrestige(){
  const gain=calcPrestigeGain();
  const keepShells=G.skills.vestige?Math.floor(G.shells*.05):0;

  // Éléments permanents à conserver
  const savedSkills   = {...G.skills};
  const savedGF       = G.goldenFeathers+gain;
  const savedTotalGF  = G.totalGoldenFeathers+gain;
  const savedInv      = [...G.inventory];
  const savedPrices   = {...G.marketPrices};
  const savedPrestige = G.prestigeCount+1;
  // v0.3 : le skin équipé est CONSERVÉ (cohérence visuelle)
  const savedEquipped = G.equippedSkin;

  G=defaultState();
  G.goldenFeathers      = savedGF;
  G.totalGoldenFeathers = savedTotalGF;
  G.skills              = savedSkills;
  G.inventory           = savedInv;
  G.marketPrices        = savedPrices;
  G.prestigeCount       = savedPrestige;
  G.shells              = keepShells;
  G.equippedSkin        = savedEquipped; // ← skin visuel préservé

  targetHp=100; targetMaxHp=100;
  closePrestigeModal();
  renderAll();
  saveGame(true);
}

// ─────────────────────────────────────────────────────────
// J. CRAFTING (v0.3 : 20 items + 1 PO)
// ─────────────────────────────────────────────────────────

function setCraftRarity(r){ craftRarity=r; craftSelected=[]; renderCrafting(); }

function toggleCraftItem(iid){
  const idx=craftSelected.indexOf(iid);
  if(idx>=0) craftSelected.splice(idx,1);
  else if(craftSelected.length<CRAFT_ITEMS) craftSelected.push(iid);
  renderCraftSlots(); renderCraftPool(); updateCraftBtn();
}

function updateCraftBtn(){
  const btn=$('craft-btn'), info=$('craft-info');
  const n=craftSelected.length;
  if(info) info.textContent=`${n} / ${CRAFT_ITEMS} sélectionnés`;
  if(btn)  btn.disabled=n<CRAFT_ITEMS||G.goldenFeathers<CRAFT_PO_COST;
}

function executeCraft(){
  if(craftSelected.length<CRAFT_ITEMS) return;
  if(G.goldenFeathers<CRAFT_PO_COST){
    alert(`Il vous faut ${CRAFT_PO_COST} Plume d'Or pour la fusion !`); return;
  }

  // Vérification : tous les items sont de la bonne rareté
  const valid=craftSelected.every(iid=>{
    const inv=G.inventory.find(i=>i.iid===iid);
    const skin=inv?SKINS.find(s=>s.id===inv.skinId):null;
    return skin&&skin.rarity===craftRarity;
  });
  if(!valid){ alert('Sélection invalide !'); return; }

  // Dépenser la Plume d'Or
  // TODO PROD: remplacer G.goldenFeathers-- par appel Steamworks Microtransaction API
  G.goldenFeathers-=CRAFT_PO_COST;

  // Retirer les 20 items
  craftSelected.forEach(iid=>{
    const idx=G.inventory.findIndex(i=>i.iid===iid);
    if(idx>=0) G.inventory.splice(idx,1);
  });
  craftSelected=[];

  // Sélectionner le résultat (poids craftW, favorise les Collector)
  const result=selectSkinCraft(craftRarity);
  if(!result){ alert('Aucun skin disponible dans la rareté supérieure.'); return; }

  G.inventory.push({iid:uid(), skinId:result.id});

  // Log interne
  const log=$('craft-log');
  if(log){
    const meta=RARITY[result.rarity];
    const entry=document.createElement('div');
    entry.className='cl-entry';
    entry.innerHTML=`→ <span style="color:${meta.color};font-weight:600">${result.name}</span>`+
      `<span style="margin-left:6px;opacity:.7">${result.sub==='collector'?'⭐ Collector':'○ Classique'}</span>`;
    log.prepend(entry);
    if(log.children.length>25) log.lastElementChild.remove();
  }

  renderCrafting(); renderInventory(); updateInvBadge();

  // v0.3 : Flash écran + modale de révélation
  showCraftSuccess(result);
}

// ─────────────────────────────────────────────────────────
// K. MODALE CRAFT SUCCESS (v0.3 — nouvelle)
// ─────────────────────────────────────────────────────────

function showCraftSuccess(skin){
  const meta=RARITY[skin.rarity];
  const px=(G.marketPrices[skin.id]||skin.basePx).toFixed(2);

  // 1 — Flash coloré sur tout l'écran
  const flash=document.createElement('div');
  flash.className='screen-flash';
  flash.style.background=meta.color;
  document.body.appendChild(flash);
  setTimeout(()=>flash.remove(), 500);

  // 2 — Remplir la modale
  const card=$('cs-card');
  if(!card) return;

  // Couleur du glow ring via CSS variable
  card.style.setProperty('--cs-color', meta.color);
  const ring=$('cs-glow-ring');
  if(ring) ring.style.borderColor=meta.color+'88';

  $('cs-rarity-tag').textContent=meta.label+(skin.sub==='collector'?' ⭐ COLLECTOR':'');
  $('cs-rarity-tag').style.color=meta.color;
  $('cs-weapon-icon').textContent=WEAPONS.find(w=>w.id===skin.weapon)?.emoji||'🔫';
  $('cs-skin-name').textContent=skin.name;
  $('cs-skin-name').style.color='#fff';

  const typeEl=$('cs-skin-type');
  if(typeEl){
    typeEl.textContent=skin.sub==='collector'?'⭐ Collector Rare':'○ Classique';
    typeEl.style.color=skin.sub==='collector'?'#ffd700':meta.color;
  }
  $('cs-skin-desc').textContent=skin.desc;
  $('cs-price-row').textContent=`Valeur estimée marché : ~${px} €`;

  $('craft-success').classList.remove('hidden');

  // 3 — Countdown 4s
  if(csCountdown) clearInterval(csCountdown);
  let count=4;
  setText('cs-cd',count);
  csCountdown=setInterval(()=>{
    count--;
    setText('cs-cd',count);
    if(count<=0) closeCraftSuccess();
  },1000);

  // playSound('sfx_craft_success');
}

function closeCraftSuccess(){
  if(csCountdown){ clearInterval(csCountdown); csCountdown=null; }
  $('craft-success').classList.add('hidden');
}

// ─────────────────────────────────────────────────────────
// L. MARCHÉ SIMULÉ
// ─────────────────────────────────────────────────────────

function initMarketPrices(){
  SKINS.forEach(s=>{
    if(!G.marketPrices[s.id])
      G.marketPrices[s.id]=s.basePx*(.85+Math.random()*.30);
  });
}

function updateMarketPrices(){
  SKINS.forEach(s=>{
    let px=G.marketPrices[s.id]||s.basePx;
    const noise=1+(Math.random()*.06-.03);
    if(s.sub==='collector'){
      px*=(1+.005+Math.random()*.01)*noise;
      px=Math.min(px,s.basePx*6);
    } else {
      px*=(1-.003-Math.random()*.005)*noise;
      px=Math.max(px,s.basePx*.35);
    }
    G.marketPrices[s.id]=Math.max(.01,px);
  });
  if(isTabActive('market')) renderMarket();
}

// ─────────────────────────────────────────────────────────
// M. SAUVEGARDE
// ─────────────────────────────────────────────────────────

const SAVE_KEY='shotclicker_v03';

function saveGame(silent=false){
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify(G));
    if(!silent) showToast();
  } catch(e){ console.error('[SC] Save failed:',e); }
}

function loadGame(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return;
    const saved=JSON.parse(raw);
    G=Object.assign(defaultState(),saved);

    // Sanity checks
    UNITS.forEach(u=>{ if(G.unitCounts[u.id]==null)G.unitCounts[u.id]=0; });
    RARITY_ORDER.forEach(r=>{
      if(G.dropTimers[r]==null)   G.dropTimers[r]=0;
      if(G.dropCooldowns[r]==null||G.dropCooldowns[r]===-Infinity)
        G.dropCooldowns[r]=NEVER;
    });
    if(!Array.isArray(G.inventory)) G.inventory=[];
    if(typeof G.marketPrices!=='object') G.marketPrices={};
    if(typeof G.skills!=='object')       G.skills={};

    // Migration v0.1 → v0.3 : convertir serres1/2/3 booleans → integer
    if(G.skills.serres1||G.skills.serres2||G.skills.serres3){
      let lv=0;
      if(G.skills.serres1) lv=1;
      if(G.skills.serres2) lv=2;
      if(G.skills.serres3) lv=3;
      G.skills.serres=Math.max(G.skills.serres||0, lv);
      delete G.skills.serres1; delete G.skills.serres2; delete G.skills.serres3;
    }
    // Migration migr1/migr2 → integer
    if(G.skills.migr1||G.skills.migr2){
      let lv=0;
      if(G.skills.migr1) lv=1;
      if(G.skills.migr2) lv=2;
      G.skills.migr=Math.max(G.skills.migr||0, lv);
      delete G.skills.migr1; delete G.skills.migr2;
    }

    targetMaxHp=Math.max(100,Math.ceil(calcDpc()*12));
    targetHp=Math.min(targetMaxHp, targetMaxHp);

  } catch(e){
    console.error('[SC] Load failed, reset:',e);
    G=defaultState();
  }
}

function showToast(){
  const t=$('save-toast'); if(!t)return;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'),2200);
}

// ─────────────────────────────────────────────────────────
// N. RENDU UI
// ─────────────────────────────────────────────────────────

function renderAll(){
  renderHeader(); renderShop(); renderInventory();
  renderCrafting(); renderMarket(); renderBgUnits();
  updateWeaponDisplay(); updateDecorDisplay(); updateInvBadge();
  checkPrestigeBtn();
}

function renderHeader(){
  setText('h-shells', fmt(G.shells));
  setText('h-dpc',    fmt(calcDpc()));
  setText('h-dps',    fmt(calcDps()));
  setText('h-po',     G.goldenFeathers);
  setText('h-time',   fmtTime(G.playtime));
}

// ── BOUTIQUE ──────────────────────────────────────────────

function renderShop(){
  renderWeaponsShop(); renderAmmoShop();
  renderUnitsShop(); renderDecorShop(); renderSkillsShop();
}

function si(name, desc, btnLbl, btnCls, onclick, disabled, extra=''){
  const af=!disabled&&btnCls!=='s-owned'&&btnCls!=='s-equipped'&&btnCls!=='s-maxed';
  return `<div class="si${af?' can-afford':''}${btnCls==='s-owned'||btnCls==='s-equipped'?' is-owned':''}">
    <div class="si-info">
      <div class="si-name">${name}</div>
      <div class="si-desc">${desc}</div>
      ${extra}
    </div>
    <button class="shop-btn ${btnCls}" onclick="${onclick}" ${disabled?'disabled':''}>
      ${btnLbl}
    </button>
  </div>`;
}

function renderWeaponsShop(){
  const el=$('s-weapons'); if(!el)return;
  el.innerHTML=WEAPONS.map((wpn,idx)=>{
    const owned=G.weaponIdx>=idx, eqp=G.weaponIdx===idx;
    const meetsReq=G.totalShells>=wpn.reqTotal;
    const cost=idx===0?'Départ':fmt(Math.ceil(wpn.cost*getCostMult()))+' 🔶';
    const btnLbl=eqp?'✓ Équipée':owned?'✓ Possédée':!meetsReq?`🔒 ${fmt(wpn.reqTotal)} total`:cost;
    const btnCls=eqp?'s-equipped':owned?'s-owned':'';
    const dis=owned||!meetsReq||G.shells<Math.ceil(wpn.cost*getCostMult());
    return si(`${wpn.emoji} ${wpn.name}`,
      `+${fmt(wpn.dpcB)}/clic · +${fmt(wpn.dpsB)}/s · Drops max: ${RARITY[wpn.maxRar].label}${wpn.collOK?' + Collector':''}`,
      btnLbl,btnCls,`buyWeapon(${idx})`,dis);
  }).join('');
}

function renderAmmoShop(){
  const el=$('s-ammo'); if(!el)return;
  el.innerHTML=AMMO_TIERS.map((tier,idx)=>{
    const owned=G.ammoTier>=idx, isNext=G.ammoTier===idx-1;
    const cost=idx===0?'Départ':fmt(Math.ceil(tier.cost*getCostMult()))+' 🔶';
    return si(`${tier.icon} ${tier.name}`,
      `Base : ${fmt(tier.baseDpc)} dégâts/clic`,
      owned?'✓ Actives':isNext?cost:'🔒',
      owned?'s-owned':'',
      `buyAmmo(${idx})`,
      owned||!isNext||G.shells<Math.ceil(tier.cost*getCostMult()));
  }).join('');

  const dr=$('s-dmgrank'); if(!dr)return;
  const rankCost=getDmgRankCost(), maxed=G.damageRank>=DMG_RANK_MAX;
  const curBonus=(G.damageRank*DMG_RANK_BONUS_PER_LEVEL*100).toFixed(0);
  dr.innerHTML=si(
    `📈 Rang de Dégâts <span class="unit-cnt">${G.damageRank}/${DMG_RANK_MAX}</span>`,
    `+${curBonus}% DPC actuellement · Formule LINÉAIRE : +15% base par rang · Coût : ${DMG_BASE_COST}×1.15ⁿ`,
    maxed?'✓ MAX':fmt(rankCost)+' 🔶',
    maxed?'s-maxed':'',
    'buyDmgRank()',
    maxed||G.shells<rankCost);
}

function renderUnitsShop(){
  const el=$('s-units'); if(!el)return;
  el.innerHTML=UNITS.map(u=>{
    const cost=getUnitCost(u.id), cnt=G.unitCounts[u.id]||0;
    return si(`${u.icon} ${u.name} <span class="unit-cnt">×${cnt}</span>`,
      `${u.desc} · ${u.baseDps}/s chacune`,
      fmt(cost)+' 🔶','',`buyUnit('${u.id}')`,G.shells<cost);
  }).join('');
}

function renderDecorShop(){
  const el=$('s-decor'); if(!el)return;
  el.innerHTML=DECORS.map((d,idx)=>{
    const owned=G.decorLevel>=idx, isNext=G.decorLevel===idx-1;
    const cost=idx===0?'Départ':fmt(Math.ceil(d.cost*getCostMult()))+' 🔶';
    return si(`${d.icon} ${d.name}`,
      `Multiplicateur global ×${d.mult} sur DPC et DPS`,
      owned?'✓ Actif':isNext?cost:'🔒',
      owned?'s-owned':'',
      `buyDecor(${idx})`,
      owned||!isNext||G.shells<Math.ceil(d.cost*getCostMult()));
  }).join('');
}

function renderSkillsShop(){
  const el=$('s-skills'); if(!el)return;
  el.innerHTML=GF_SKILLS.map(sk=>{
    if(sk.type==='progressive'){
      const lv=G.skills[sk.id]||0;
      const maxed=lv>=10;
      const nextCost=maxed?0:sk.costs[lv];
      const pct=(lv/10*100).toFixed(0);
      const curBonusPct=(lv*PROG_BONUS*100).toFixed(0);
      const nxtBonusPct=maxed?'-':((lv+1)*PROG_BONUS*100).toFixed(0);
      const canBuy=!maxed&&G.goldenFeathers>=nextCost;
      const btnLbl=maxed?'✓ MAX niv.10':`Niv.${lv+1} — ${nextCost} 🪶`;
      const bar=`<div class="skill-bar"><div class="skill-bar-fill" style="width:${pct}%"></div></div>`;
      return si(
        `🪶 ${sk.name} <span class="unit-cnt">Niv. ${lv}/10</span>`,
        `+${curBonusPct}% actuellement · Prochain : +${nxtBonusPct}% · ${sk.desc}`,
        btnLbl, maxed?'s-maxed':'',
        `buySkill('${sk.id}')`, !canBuy, bar);

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

function renderInventory(){
  const grid=$('inv-grid'), cnt=$('inv-count');
  if(!grid)return;
  if(cnt) cnt.textContent=G.inventory.length;
  if(G.inventory.length===0){
    grid.innerHTML='<p style="color:var(--dim);padding:16px">Aucun skin. Jouez pour obtenir des drops !</p>';
    return;
  }

  const sorted=[...G.inventory].sort((a,b)=>{
    const sa=SKINS.find(s=>s.id===a.skinId), sb=SKINS.find(s=>s.id===b.skinId);
    if(!sa||!sb)return 0;
    const d=RARITY_ORDER.indexOf(sb.rarity)-RARITY_ORDER.indexOf(sa.rarity);
    return d!==0?d:(sb.sub==='collector'?1:-1);
  });

  grid.innerHTML=sorted.map(inv=>{
    const skin=SKINS.find(s=>s.id===inv.skinId); if(!skin)return '';
    const meta=RARITY[skin.rarity];
    const eqp=G.equippedSkin===inv.iid;
    const px=(G.marketPrices[skin.id]||skin.basePx).toFixed(2);
    const skinWpnIdx=WEAPONS.findIndex(w=>w.id===skin.weapon);
    const isLocked=skinWpnIdx>G.weaponIdx;
    return `<div class="inv-card${eqp?' equipped':''}"
      style="border-color:${eqp?'var(--c-epic)':meta.color+'55'}"
      onclick="equipSkin('${inv.iid}')" title="${skin.desc}">
      <div class="inv-rar rar-${skin.rarity}">${meta.label}</div>
      <div class="inv-sub ${skin.sub==='collector'?'col-tag':'cls-tag'}">${skin.sub==='collector'?'⭐':'○'}</div>
      <div class="inv-name">${skin.name}</div>
      <div class="inv-wpn">${WEAPONS.find(w=>w.id===skin.weapon)?.name||skin.weapon}</div>
      <div class="inv-px">~${px} €</div>
      ${eqp?`<div class="eqp-tag">✓ Équipé</div>`:''}
      ${isLocked&&eqp?`<div class="lock-tag">🔒 Arme en déblocage</div>`:''}
    </div>`;
  }).join('');
}

function equipSkin(iid){
  G.equippedSkin=G.equippedSkin===iid?null:iid;
  updateWeaponDisplay(); renderInventory();
}

/**
 * v0.3 : updateWeaponDisplay()
 * Le skin équipé est TOUJOURS visible sur le pigeon.
 * Si l'arme du skin n'est pas encore débloquée (après prestige),
 * le visuel reste mais un indicateur "🔒 en déblocage" est ajouté.
 * Les dégâts restent ceux de G.weaponIdx (Glock après prestige).
 */
function updateWeaponDisplay(){
  const we=$('pspr-weapon-emoji'), lbl=$('equipped-label');
  if(!we)return;

  if(G.equippedSkin){
    const inv=G.inventory.find(i=>i.iid===G.equippedSkin);
    const skin=inv?SKINS.find(s=>s.id===inv.skinId):null;
    if(skin){
      const meta=RARITY[skin.rarity];
      const skinWpnIdx=WEAPONS.findIndex(w=>w.id===skin.weapon);
      const isLocked=skinWpnIdx>G.weaponIdx;
      we.textContent=WEAPONS.find(w=>w.id===skin.weapon)?.emoji||'🔫';
      we.style.filter=`drop-shadow(0 0 10px ${meta.color})`;
      we.style.opacity=isLocked?'0.75':'1';
      if(lbl){
        lbl.textContent=isLocked?`${skin.name} 🔒`:skin.name;
        lbl.style.color=isLocked?'#888':meta.color;
      }
      return;
    }
  }
  we.textContent=WEAPONS[G.weaponIdx].emoji;
  we.style.filter=''; we.style.opacity='1';
  if(lbl){ lbl.textContent=''; lbl.style.color=''; }
}

function updateDecorDisplay(){
  const d=DECORS[G.decorLevel];
  const bdg=$('decor-badge'), gw=$('game-wrap');
  if(bdg) bdg.textContent=`${d.icon} ${d.name} — ×${d.mult}`;
  if(gw)  gw.style.background=d.bg;
}

function renderBgUnits(){
  const el=$('bg-units'); if(!el)return;
  let html='';
  UNITS.forEach(u=>{
    const cnt=G.unitCounts[u.id]||0; if(!cnt)return;
    html+=`<span title="${u.name} ×${cnt}">${u.icon.repeat(Math.min(cnt,6))}</span>`;
    if(cnt>6) html+=`<small style="color:var(--dim);font-size:.74em"> ×${cnt}</small>`;
  });
  el.innerHTML=html;
}

function updateInvBadge(){
  const b=$('inv-badge'); if(b) b.textContent=G.inventory.length;
}

// ── CRAFTING UI ───────────────────────────────────────────

function renderCrafting(){
  renderCraftRarityNav(); renderCraftPool();
  renderCraftSlots(); updateCraftBtn();
}

function renderCraftRarityNav(){
  const nav=$('craft-rarity-nav'); if(!nav)return;
  nav.innerHTML=RARITY_ORDER.slice(0,-1).map(r=>{
    const meta=RARITY[r], toMeta=RARITY[RARITY_ORDER[RARITY_ORDER.indexOf(r)+1]];
    return `<button class="crb${craftRarity===r?' active':''}"
      style="${craftRarity===r?`color:${meta.color}`:''}"
      onclick="setCraftRarity('${r}')">
      <span style="color:${meta.color}">${meta.label}</span> → <span style="color:${toMeta.color}">${toMeta.label}</span>
    </button>`;
  }).join('');
}

function renderCraftPool(){
  const pool=$('craft-pool'); if(!pool)return;
  const items=G.inventory.filter(inv=>{
    const s=SKINS.find(x=>x.id===inv.skinId);
    return s&&s.rarity===craftRarity;
  });
  if(items.length===0){
    pool.innerHTML=`<p style="color:var(--dim);font-size:.78em">Aucun item <b>${RARITY[craftRarity].label}</b> dans l'inventaire.</p>`;
    return;
  }
  pool.innerHTML=items.map(inv=>{
    const skin=SKINS.find(s=>s.id===inv.skinId); if(!skin)return '';
    const meta=RARITY[skin.rarity], sel=craftSelected.includes(inv.iid);
    const lbl=skin.name.length>22?skin.name.slice(0,20)+'…':skin.name;
    return `<div class="cpill${sel?' sel':''}"
      style="${sel?'':`color:${meta.color}`}"
      title="${skin.name}${skin.sub==='collector'?' ⭐':''}"
      onclick="toggleCraftItem('${inv.iid}')">${lbl}</div>`;
  }).join('');
}

function renderCraftSlots(){
  const grid=$('craft-slots-grid'); if(!grid)return;
  let html='';
  for(let i=0;i<CRAFT_ITEMS;i++){
    const iid=craftSelected[i];
    const inv=iid?G.inventory.find(x=>x.iid===iid):null;
    const skin=inv?SKINS.find(s=>s.id===inv.skinId):null;
    html+=`<div class="cslot${iid?' filled':''}" title="${skin?.name||''}">${
      skin?WEAPONS.find(w=>w.id===skin.weapon)?.emoji||'🔫':''
    }</div>`;
  }
  grid.innerHTML=html;
}

// ── MARCHÉ ────────────────────────────────────────────────

function renderMarket(){
  const tbody=$('market-body'); if(!tbody)return;
  let filtered=marketFilter==='all'?[...SKINS]:SKINS.filter(s=>s.rarity===marketFilter);
  filtered.sort((a,b)=>{
    const ri=RARITY_ORDER.indexOf(b.rarity)-RARITY_ORDER.indexOf(a.rarity);
    return ri!==0?ri:(b.sub==='collector'?1:-1);
  });
  tbody.innerHTML=filtered.map(skin=>{
    const meta=RARITY[skin.rarity];
    const px=G.marketPrices[skin.id]||skin.basePx;
    const delta=px-skin.basePx, pct=((delta/skin.basePx)*100).toFixed(1);
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
// O. NAVIGATION ENTRE ONGLETS
// ─────────────────────────────────────────────────────────

function switchTab(tabId){
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tn').forEach(b=>b.classList.remove('active'));
  const pane=$('tab-'+tabId), btn=document.querySelector(`.tn[data-tab="${tabId}"]`);
  if(pane) pane.classList.add('active');
  if(btn)  btn.classList.add('active');
  if(tabId==='shop')      renderShop();
  if(tabId==='inventory') renderInventory();
  if(tabId==='crafting')  renderCrafting();
  if(tabId==='market')    renderMarket();
}

// ─────────────────────────────────────────────────────────
// P. INITIALISATION
// ─────────────────────────────────────────────────────────

function setupEvents(){
  document.querySelectorAll('.tn').forEach(btn=>{
    btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('.mf').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.mf').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      marketFilter=btn.dataset.f;
      renderMarket();
    });
  });
}

function init(){
  loadGame();
  initMarketPrices();
  setupEvents();
  renderAll();

  requestAnimationFrame(ts=>{ lastTs=ts; requestAnimationFrame(gameLoop); });
  setInterval(slowTick,         1000);
  setInterval(updateMarketPrices,60000);

  if(DEV_MODE){
    console.log('%c[ShotClicker v0.3] DEV_MODE actif','color:#ffd700;font-weight:bold');
    console.log(`  Drop Common toutes les ${dW('common').toFixed(0)}s de playtime`);
    console.log(`  Drop Rare   toutes les ${dW('rare').toFixed(0)}s de playtime`);
    console.log('  v0.3 : rankBonus LINÉAIRE (+15%/rang), craft 20items+1PO, skills progressifs 10niv');
  }
}

window.addEventListener('DOMContentLoaded', init);
