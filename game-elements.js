(function (root) {

	root.dieSides = 10;

	root.BattleType = {
		Space: 'Space',
		Ground: 'Ground',
	};

	root.BattleSide = {
		attacker: 'attacker',
		defender: 'defender',
		opponent: function (battleSide) {
			return {
				attacker: 'defender',
				defender: 'attacker',
			}[battleSide];
		}
	};

	root.SideUnits = {
		attacker: 'attackerUnits',
		defender: 'defenderUnits',
	};
	var UnitType = {
		Flagship: 'Flagship',
		WarSun: 'WarSun',
		Dreadnought: 'Dreadnought',
		Cruiser: 'Cruiser',
		Carrier: 'Carrier',
		Destroyer: 'Destroyer',
		Fighter: 'Fighter',
		Mech: 'Mech',
		Ground: 'Ground',
		PDS: 'PDS',
	};
	
	root.UnitType = UnitType;

	var shortUnitType = {
		Flagship: 'X',
		WarSun: 'W',
		Dreadnought: 'D',
		Cruiser: 'C',
		Destroyer: '+',
		Carrier: 'V',
		Fighter: 'F',
		Ground: 'G',
		Mech: 'M',
		PDS: 'P',
		GhostHit:'T',
	};

	root.Race = {
		Arborec: 'Arborec',
		Creuss: 'Creuss',
		Hacan: 'Hacan',
		JolNar: 'JolNar',
		L1Z1X: 'L1Z1X',
		Letnev: 'Letnev',
		Mentak: 'Mentak',
		Muaat: 'Muaat',
		Naalu: 'Naalu',
		Saar: 'Saar',
		Sardakk: 'Sardakk',
		Sol: 'Sol',
		Virus: 'Virus',
		Winnu: 'Winnu',
		Xxcha: 'Xxcha',
		Yin: 'Yin',
		Yssaril: 'Yssaril',
		Argent: 'Argent',
		Empyrean: 'Empyrean',
		Mahact: 'Mahact',
		NaazRokha: 'NaazRokha',
		Nomad: 'Nomad',
		Titans: 'Titans',
		Cabal: 'Cabal',
	};

	root.RacesDisplayNames = {
		Arborec: 'Arborec',
		Creuss: 'Creuss',
		Hacan: 'Hacan',
		JolNar: 'Jol-Nar',
		L1Z1X: 'L1Z1X',
		Letnev: 'Letnev',
		Mentak: 'Mentak',
		Muaat: 'Muaat',
		Naalu: 'Naalu',
		Virus: 'Nekro Virus',
		Saar: 'Saar',
		Sardakk: 'Sardakk N\'orr',
		Sol: 'Sol',
		Winnu: 'Winnu',
		Xxcha: 'Xxcha',
		Yin: 'Yin',
		Yssaril: 'Yssaril',
		Argent: 'Argent Flight',
		Empyrean: 'Empyrean',
		Mahact: 'Mahact',
		NaazRokha: 'Naaz-Rokha',
		Nomad: 'Nomad',
		Titans: 'Titans of Ul',
		Cabal: "Vuil'Raith Cabal",
	};

	function Option(title, description, limitedToSide, limitedToUnit, limitedToBattle, limitedToOption, pointer) {
		this.title = title;
		this.description = description;
		this.limitedToSide = limitedToSide;
		this.limitedToUnit = limitedToUnit;
		this.limitedToBattle = limitedToBattle;
		this.limitedToOption = limitedToOption;
		this.pointer = pointer;
	}
	Object.byString = function(o, s) {
		s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
		s = s.replace(/^\./, '');           // strip a leading dot
		var a = s.split('.');
		for (var i = 0, n = a.length; i < n; ++i) {
			var k = a[i];
			if (k in o) {
				o = o[k];
			} else {
				return;
			}
		}
		return o;
	}
	Option.prototype.availableFor = function (battleSide, thisSideUnits, battleType, options) {
		var condition = (this.limitedToSide === undefined || this.limitedToSide === battleSide) && 
						(this.limitedToUnit === undefined || thisSideUnits[this.limitedToUnit].count>0) &&
						(this.limitedToBattle === undefined || this.limitedToBattle === battleType) &&
						(this.limitedToOption === undefined || Object.byString(options,this.limitedToOption));
		if (this.pointer !== undefined)
			options[battleSide][this.pointer]=condition ? options[battleSide][this.pointer] : false;
		return condition;
	};
	Option.prototype.name = function () {
		if (this.description === "After another player's ship uses Sustain Damage, destroy that ship") return 'Direct Hit';
		else if (this.description === "The Nomad has Memoria II") return 'Has Memoria II';
		else if (this.description === "Use Strike Wind Ambuscade on your Space Cannon roll") return "Strike Wing Space Cannon";
		else if (this.description === "Use Strike Wind Ambuscade on your Anti-Fighter Barrage roll") return "Strike Wing Anti-Fighter Barrage";
		else return this.title;
	};
	root.ActionCards = {
		moraleBoost: new Option('Morale Boost 1st round', '+1 dice modifier to all units during the first battle round'),
		fireTeam: new Option('Fire Team 1st round', 'Reroll dice after first round of invasion combat'),
		fighterPrototype: new Option('Fighter Prototype', '+2 dice modifier to Fighters during the first battle round'),
		experimentalBattlestation: new Option('Experimental Battlestation', 'Additional unit with Space Cannon 5(x3)'),
		maneuveringJets: new Option('Maneuvering Jets', 'Cancel 1 Space Cannon hit'),
		riskDirectHit: new Option('Risk Direct Hit', 'Damage units vulnerable to Direct Hit before killing off fodder'),
		directHit: new Option('Direct Hit', "After another player's ship uses Sustain Damage, destroy that ship"),
		directHit2A: new Option('Direct Hit2A', "After another player's ship uses Sustain Damage, destroy that ship", 'attacker', undefined, undefined, 'attacker.directHit', 'directHit2A'),
		directHit2D: new Option('Direct Hit2D', "After another player's ship uses Sustain Damage, destroy that ship", 'defender', undefined, undefined, 'defender.directHit', 'directHit2D'),
		directHit3A: new Option('Direct Hit3A', "After another player's ship uses Sustain Damage, destroy that ship", 'attacker', undefined, undefined, 'attacker.directHit2A', 'directHit3A'),
		directHit3D: new Option('Direct Hit3D', "After another player's ship uses Sustain Damage, destroy that ship", 'defender', undefined, undefined, 'defender.directHit2D', 'directHit3D'),
		directHit4A: new Option('Direct Hit4A', "After another player's ship uses Sustain Damage, destroy that ship", 'attacker', undefined, undefined, 'attacker.directHit3A', 'directHit4A'),
		directHit4D: new Option('Direct Hit4D', "After another player's ship uses Sustain Damage, destroy that ship", 'defender', undefined, undefined, 'defender.directHit3D', 'directHit4D'),
		disable: new Option('Disable', "Opponents' PDS lose Planetary Shield and Space Cannon"),
		reflectiveShielding: new Option('Reflective Shielding', 'Produce 2 hits when one of your ships uses Sustain Damage'),
		solarFlare: new Option('Solar Flare', 'Other players cannot use SPACE CANNON against your ships'),
		waylay: new Option('Waylay', 'Hits from anti-fighter barrage are produced against all ships'),
		blitz: new Option('Blitz', 'Each non-fighter ship without Bombardment gains Bombardment 6', 'attacker'),
		bunker: new Option('Bunker', '-4 dice modifier to Bombardment rolls', 'defender'),
		rout: new Option('Rout', 'Your Opponent must retreat at the end of the first round of space combat', 'defender'),
	};

	root.Technologies = {
		antimassDeflectors: new Option('Antimass Deflectors', '-1 to opponents\' Space Cannon rolls'),
		gravitonLaser: new Option('Graviton Laser System', 'Space Cannon hits should be applied to non-fighters if possible'),
		plasmaScoring: new Option('Plasma Scoring', 'One additional die for one unit during Space Cannon or Bombardment'),
		plasmaScoringFirstRound: new Option('Plasma Scoring Not Used Initially', "Plasma Scoring isn't used in the initial Bombardment", 'attacker'),
		magenDefense: new Option('Magen Defense Grid', 'Opponent doesn\'t throw dice for one round if you have Planetary Shield'),
		magenDefenseOmega: new Option('Magen Defense Grid Ω', '1 hit at the start of ground combat when having structures'),
		//hasStructure: new Option('Has Structure', 'Attacker has a structure on the planet somehow for Magen Defence Grid Ω', 'attacker'), // not a technology itself, but it's nice to show it close to Magen Defence Grid Ω
		hasDock: new Option('Has Dock', 'Defender has a dock for Magen Defence Grid Ω', 'defender', undefined, undefined, 'defender.magenDefenseOmega', 'hasDock'), // not a technology itself, but it's nice to show it close to Magen Defence Grid Ω
		duraniumArmor: new Option('Duranium Armor', 'After each round repair 1 unit that wasn\'t damaged this round'),
		assaultCannon: new Option('Assault Cannon', 'Opponent destroys 1 non-Fighter ship if you have at least 3 non-Fighters'),
		daxcive: new Option('Daxcive Animators', 'Ground Forces that die continue to roll'),
		x89Omega: new Option('X-89 Bacterial Weapon Ω', 'Destroy all Infantry by bombardment if at least one is destroyed', 'attacker'),
		x89Conservative: new Option('Assign X-89 Hits Conservatively', 'Sacrifice other Ground Forces if it prevents X-89 Bacterial Weapon Ω from activating', 'defender', undefined, 'Ground', 'attacker.x89Omega', 'x89Conservative'),
	};
	root.Agendas = {
		articlesOfWar: new Option('Articles of War', 'All Mechs lose their printed abilities except Sustain Damage'),
		publicizeSchematics: new Option('Publicize Weapon Schematics', 'War Suns don\'t sustain damage'),
		prophecyOfIxth: new Option('Prophecy of IXTH', '+1 to Fighters rolls'),
		conventionsOfWar: new Option('Conventions of War', 'No bombardment', 'defender'),
	};
	
	root.Promissory = {
		letnevMunitionsFunding: new Option('Munitions Reserves/War Funding 1st round', 'Reroll dice during first space combat round'),
		tekklarLegion: new Option('Tekklar Legion', '+1 in invasion combat. -1 to Sardakk if he\'s the opponent'),
		argentStrikeWing: new Option('Strike Wing Ambuscade', 'One additional die for one unit during Space Cannon, Bombardment, or Anti-Fighter Barrage'),	
		argentStrikeWingSpaceCannonA: new Option('Strike Wing Space CannonA', 'Use Strike Wind Ambuscade on your Space Cannon roll','attacker',undefined, undefined, 'attacker.argentStrikeWing', 'argentStrikeWingSpaceCannonA'),
		argentStrikeWingSpaceCannonD: new Option('Strike Wing Space CannonD', 'Use Strike Wind Ambuscade on your Space Cannon roll','defender',undefined, undefined, 'defender.argentStrikeWing', 'argentStrikeWingSpaceCannonD'),
		argentStrikeWingBarrageA: new Option('Strike Wing Anti-Fighter BarrageA', 'Use Strike Wind Ambuscade on your Anti-Fighter Barrage roll','attacker',undefined, undefined, 'attacker.argentStrikeWing', 'argentStrikeWingBarrageA'),	
		argentStrikeWingBarrageD: new Option('Strike Wing Anti-Fighter BarrageD', 'Use Strike Wind Ambuscade on your Anti-Fighter Barrage roll','defender',undefined, undefined, 'defender.argentStrikeWing'),
		argentStrikeWingBombardmentA: new Option('Strike Wing Bombardment', 'Use Strike Wind Ambuscade on your Bombardment roll','attacker',undefined, undefined, 'attacker.argentStrikeWing', 'argentStrikeWingBarrageD'),
		nomadCavalry: new Option('The Cavalry', 'Weakest non-fighter ship gains the Sustain Damage ability, Combat value, and Anti-Fighter Barrage value of the Nomad Flagship. Cannot be used against the Nomad'),
		hasMemoriaIIA: new Option('Has Memoria II', 'The Nomad has Memoria II', 'attacker', undefined, undefined, 'attacker.nomadCavalry', 'hasMemoriaIIA'),
		hasMemoriaIID: new Option('Has Memoria II', 'The Nomad has Memoria II','defender', undefined, undefined, 'defender.nomadCavalry', 'hasMemoriaIID'),
	};

	root.Miscellaneous = {
		crownThalnosSafe: new Option('Crown of Thalnos Safely', 'Use the Crown of Thalnos to reroll misses only on units with multiple die that have already hit'),
		progenitor: new Option('The Progenitor', "Elysium with Titan's hero is in the system"),	
		noBombardment: new Option('No Bombardment', 'Choose not to use Bombardment', 'attacker'),
		nebula: new Option('In a Nebula', 'Defender receives +1 modifier for all ships', 'defender'),
		noSpaceCannon: new Option('No Space Cannon', 'Choose not to use Space Cannon'),
		noBarrage: new Option('No Anti-Fighter Barrage', 'Choose not to use Anti-Fighter Barrage'),
	};

	root.Leaders = {
		argentCommander: new Option('Argent Flight Commander', 'One additional die for one unit during Space Cannon, Bombardment, and Anti-Fighter Barrage'),
		argentCommanderFirstRound: new Option('Argent Flight Commander Not Used Initially', "Argent Flight Commander isn't used in the initial Bombardment", 'attacker'),
		jolnarCommander: new Option('Jol-Nar Commander', 'Reroll Space Cannon, Bombardment, or Anti-Fighter Barrage dice'),
		letnevCommander: new Option('Barony of Letnev Commander', 'Gain 1 trade good when one of your units uses Sustain Damage'),
		winnuCommander: new Option('Winnu Commander', '+2 dice modifier to all units in the Mecatol Rex system, your home system, and each system that contains a legendary planet'),
		L1Z1XCommander: new Option('L1Z1X Commander', 'All units ignore planerary shield', 'attacker'),
		solCommander: new Option('Sol Commander', 'At the start of ground combat, place one infantry', 'defender'),
		letnevAgent: new Option('Letnev Agent 1st Round', 'One additional die for one ship during the first round of space combat'),
		solAgent: new Option('Sol Agent 1st Round', 'One additional die for one ground force during the first round of ground combat'),
		titanAgent: new Option('Titan of Ul Agent', 'Cancel one hit'),
		yinAgent: new Option('Yin Agent', 'This player gains 2 fighters on the first destruction of either one of their cruisers or destroyers'),
	};
	root.Heroes = {
		Mentak: {
			mentakHero: new Option('Mentak Hero', 'For every enemy ship destroyed, gain 1 of that ship type onto your side of the battle'),
		},
	};
	root.RaceSpecificTechnologies = {
		Letnev: {
			nonEuclidean: new Option('Non-Euclidean Shielding', 'Sustain Damage absorbs 2 hits'),
			l4Disruptors: new Option('L4 Disruptors', 'During an Invasion units cannot use Space Cannon against you', 'attacker'),
		},
		Sardakk: {
			valkyrieParticleWeave: new Option('Valkyrie Particle Weave', 'If opponent produces at least one hit in Ground combat, you produce one additional hit'),
		},
		NaazRokha: {
			supercharger: new Option('Supercharger', '+1 dice modifier to all units during the first battle round'),
		},
		Virus: {
			nonEuclidean: new Option('Non-Euclidean Shielding', 'Sustain Damage absorbs 2 hits'),
			valkyrieParticleWeave: new Option('Valkyrie Particle Weave', 'If opponent produces at least one hit in Ground combat, you produce one additional hit'),
			supercharger: new Option('Supercharger', '+1 dice modifier to all units during the first battle round'),
			l4Disruptors: new Option('L4 Disruptors', 'During an Invasion units cannot use Space Cannon against you', 'attacker'),
		},
	};
	root.displayableOptions = [
		Object.getOwnPropertyNames(root.ActionCards).filter(function(item) { return item !== "riskDirectHit"}), 
		Object.getOwnPropertyNames(root.Technologies), 
		Object.getOwnPropertyNames(root.Agendas),
		Object.getOwnPropertyNames(root.Promissory),
		Object.getOwnPropertyNames(root.Miscellaneous),
		Object.getOwnPropertyNames(root.Leaders),
		];
	root.startingTech = {
		Arborec: ['magenDefenseOmega'],
		Hacan: ['antimassDeflectors'],
		JolNar: ['antimassDeflectors', 'plasmaScoring'],
		L1Z1X: ['plasmaScoring'],
		Letnev: ['antimassDeflectors'],
		Mentak: ['plasmaScoring'],
		Muaat: ['plasmaScoring'],
		Virus: ['daxcive'],
		Saar: ['antimassDeflectors'],
		Sol: ['antimassDeflectors'],
		Xxcha: ['gravitonLaser'],
		Argent: ['plasmaScoring'],
		Titans: ['antimassDeflectors'],
	};
	root.VirusUpgrades = {
		Virus :{
			advancedCarrierII : new Option('Advanced Carrier II', "Nekro copied Sol's Advanced Carrier II"),
			specOpsII: new Option('Spec Ops II', "Nekro copied Sol's Spec Ops II"),
			superDreadnoughtII: new Option('Super-Dreadnought II', "Nekro copied L1Z1X's Super-Dreadnought II"),
			crystalFighterII: new Option('Hybrid Crystal Fighter II', "Nekro copied Naalu's Hybrid Crystal Fighter II"),
			protoWarSunII: new Option('Prototype War Sun II', "Nekro copied Muaat's Prototype War Sun II"),
			strikeWingII: new Option('Strike Wing Alpha II', "Nekro copied Argent's Strike Wing Alpha II"),
			memoriaII: new Option('Memoria II', "Nekro copied Nomad's Memoria II"),
			saturnEngineII: new Option('Saturn Engine II', "Nekro copied Titan's Saturn Engine II"),
			helTitanII: new Option('Hel Titan II', "Nekro copied Titan's Hel Titan II"),
			exotriremeII : new Option('Exotrireme II', "Nekro copied Sardakk's Exotrireme II"),
		},
	}
	root.RacialSpecific = {
		Letnev: {
			munitions: new Option('Munitions Reserves Every Round', 'Use the Munitions Reserves Ability at the start of every round of space combat',undefined,undefined,'Space', undefined, 'munitions'),
			dunlainMechs: new Option('Deploy Mechs Every Round', "Use the mech's DEPLOY ability to replace an infantry with a mech at the start of every round of ground combat",undefined,"Ground", 'Ground'),
		},
		Virus: {
			opponentTech: new Option("Has Opponent's Faction Technonology", "Mechs apply +2 to the result of their combat rolls if Nekro has an 'X' or 'Y' token on 1 or more of the opponent's technologies",undefined,"Mech"),
		},
		Naalu: {
			opponentRelicFragment: new Option("Opponent Has a Relic Fragment", "Mechs apply +2 to the result of their combat rolls if Naalu's opponent has a relic fragment",undefined,"Mech", 'Ground'),
		},
		Mahact:{
			opponentNoToken: new Option("Opponent's Command Token Not in Fleet Pool", "Flagship applys +2 to the result of its combat rolls against an opponent whose command token is not in Mahact's fleet pool", undefined,"Flagship",'Space'),
		},
		Hacan:{
			infiniteTG: new Option('Unlimited Trade Goods', "Unlimited Trade Goods to use for the flagship's ability",undefined,"Flagship",'Space', undefined, 'infiniteTG'),
		},
		Sardakk:{
			sustainMechs: new Option("Sustain Only During Combat", "Only use Sustain Damage on your mechs when in combat", undefined,'Mech','Ground'),
		},
	};

	
	root.UnitInfo = (function () {

		function UnitInfo(type, stats) {

			this.type = type;
			var shortType = shortUnitType[this.type];
			this.shortType = stats.isDamageGhost ? (shortType === "+" ? '-': shortType.toLowerCase()) : shortType;

			this.battleValue = stats.battleValue || NaN;
			this.battleDice = stats.battleDice !== undefined ? stats.battleDice : 1;

			this.bombardmentValue = stats.bombardmentValue || NaN;
			this.bombardmentDice = stats.bombardmentDice || 0;

			this.spaceCannonValue = stats.spaceCannonValue || NaN;
			this.spaceCannonDice = stats.spaceCannonDice || 0;

			this.barrageValue = stats.barrageValue || NaN;
			this.barrageDice = stats.barrageDice || 0;

			this.sustainDamageHits = stats.sustainDamageHits || 0;
			this.isDamageGhost = stats.isDamageGhost || false;

			this.damageCorporeal = undefined;
			this.damaged = false;
			this.damagedThisRound = false;

			this.race = stats.race;
			this.cost = stats.cost;

			var list = [
				UnitType.Flagship,
				UnitType.WarSun,
				UnitType.Dreadnought,
				UnitType.Cruiser,
				UnitType.Destroyer,
				UnitType.Carrier,
				UnitType.Fighter,
			];
			this.typeShip = stats.typeShip || list.includes(type);
			this.typeGroundForce = stats.typeGroundForce || type === root.UnitType.Mech || type === root.UnitType.Ground;
			this.typeStructure = stats.typeStructure || type === root.UnitType.PDS;
			this.planetaryShield = stats.planetaryShield || type === root.UnitType.PDS;
			this.importance = stats.importance || NaN;
			this.cancelHit = stats.cancelHit || false;
		}

		UnitInfo.prototype.clone = function () {
			return new UnitInfo(this.type, this);
		};

		// Create damage ghost for damageable units 
		UnitInfo.prototype.toDamageGhost = function () {
			var result = new UnitInfo(this.type, {
				sustainDamageHits: this.sustainDamageHits,
				battleDice: 0,
				isDamageGhost: true,
				typeShip: this.typeShip,
				typeGroundForce: this.typeGroundForce,
				typeStructure: this.typeStructure,
				planetaryShield: this.planetaryShield,
			});
			// 'corporeal' as an antonym to 'ghost' =)
			result.damageCorporeal = this;
			this.damaged = false;
			this.damagedThisRound = false;
			return result;
		};
		return UnitInfo;
	})();

	// These correspond to fields of UnitInfo, like 'battleValue', 'bombardmentValue' etc. 
	root.ThrowType = {
		Battle: 'battle',
		Bombardment: 'bombardment',
		SpaceCannon: 'spaceCannon',
		Barrage: 'barrage',
	};
	root.ThrowValues = {
		battle: 'battleValue',
		bombardment: 'bombardmentValue',
		spaceCannon: 'spaceCannonValue',
		barrage: 'barrageValue',
	};
	root.ThrowDice = {
		battle: 'battleDice',
		bombardment: 'bombardmentDice',
		spaceCannon: 'spaceCannonDice',
		barrage: 'barrageDice',
	};

	root.StandardUnits = {
		WarSun: new root.UnitInfo(UnitType.WarSun, {
			sustainDamageHits: 1,
			battleValue: 3,
			battleDice: 3,
			bombardmentValue: 3,
			bombardmentDice: 3,
			cost: 12,
		}),
		Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
			sustainDamageHits: 1,
			battleValue: 5,
			bombardmentValue: 5,
			bombardmentDice: 1,
			cost: 4,
		}),
		Cruiser: new root.UnitInfo(UnitType.Cruiser, {
			battleValue: 7,
			cost: 2,
		}),
		Carrier: new root.UnitInfo(UnitType.Carrier, {
			battleValue: 9,
			cost: 3,
		}),
		Destroyer: new root.UnitInfo(UnitType.Destroyer, {
			battleValue: 9,
			barrageValue: 9,
			barrageDice: 2,
			cost: 1,
		}),
		Fighter: new root.UnitInfo(UnitType.Fighter, {
			battleValue: 9,
			cost: 0.5,
		}),
		PDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 6,
			spaceCannonDice: 1,
		}),
		Ground: new root.UnitInfo(UnitType.Ground, {
			battleValue: 8,
			cost: 0.5,
		}),
		Mech: new root.UnitInfo(UnitType.Mech, {
			sustainDamageHits: 1,
			battleValue: 6,
			cost: 2,
		}),
		ExperimentalBattlestation: new root.UnitInfo('Bloodthirsty Space Dock', {
			spaceCannonValue: 5,
			spaceCannonDice: 3,
		}),
		GhostHit: new root.UnitInfo('Ghost Hit', {
			battleDice: 0,
		}),
		TheProgenitor: new root.UnitInfo('The Progenitor', {
			spaceCannonValue: 3,
			spaceCannonDice: 1,
		}),
	};

	root.RaceSpecificUnits = {
		Sardakk: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 6,
				battleDice: 2,
				race: root.Race.Sardakk,
				cost: 8,
			}),
			Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
				sustainDamageHits: 1,
				battleValue: 5,
				bombardmentValue: 4,
				bombardmentDice: 2,
				cost: 4,
			}),
		},
		JolNar: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 6,
				battleDice: 2,
				race: root.Race.JolNar,
				cost: 8,
			}),
		},
		Winnu: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: undefined,
				race: root.Race.Winnu,
				cost: 8,
			}),
		},
		Xxcha: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				spaceCannonValue: 5,
				spaceCannonDice: 3,
				race: root.Race.Xxcha,
				cost: 8,
			}),
			Mech: new root.UnitInfo(UnitType.Mech, {
				sustainDamageHits: 1,
				battleValue: 6,
				spaceCannonValue: 8,
				spaceCannonDice: 1,
				cost: 2,
			}),
		},
		Yin: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9,
				battleDice: 2,
				race: root.Race.Yin,
				cost: 8,
			}),
		},
		Yssaril: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.Yssaril,
				cost: 8,
			}),
		},
		Sol: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.Sol,
				cost: 8,
			}),
			Ground: new root.UnitInfo(UnitType.Ground, {
				battleValue: 7,
				cost: 0.5,
			}),
		},
		Creuss: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 1,
				race: root.Race.Creuss,
				cost: 8,
			}),
		},
		L1Z1X: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.L1Z1X,
				cost: 8,
			}),
			Mech: new root.UnitInfo(UnitType.Mech, {
				sustainDamageHits: 1,
				battleValue: 5,
				bombardmentValue: 8,
				bombardmentDice: 1,
				cost: 2,
			}),
		},
		Mentak: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				race: root.Race.Mentak,
				cost: 8,
			}),
		},
		Naalu: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9,
				battleDice: 2,
				race: root.Race.Naalu,
				cost: 8,
			}),
			Fighter: new root.UnitInfo(UnitType.Fighter, {
				battleValue: 8,
				cost: 0.5,
			}),
		},
		Virus: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9,
				battleDice: 2,
				race: root.Race.Virus,
				cost: 8,
			}),
		},
		Arborec: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				race: root.Race.Arborec,
				cost: 8,
			}),
			Mech: new root.UnitInfo(UnitType.Mech, {
				sustainDamageHits: 1,
				battleValue: 6,
				cost: 2,
				planetaryShield: true,
			}),
		},
		Letnev: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				bombardmentValue: 5,
				bombardmentDice: 3,
				race: root.Race.Letnev,
				cost: 8,
			}),
		},
		Saar: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				barrageValue: 6,
				barrageDice: 4,
				race: root.Race.Saar,
				cost: 8,
			}),
		},
		Muaat: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.Muaat,
				cost: 8,
			}),
		},
		Hacan: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				race: root.Race.Hacan,
				cost: 8,
			}),
		},
		Argent: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				race: root.Race.Argent,
				cost: 8,
			}),
			Destroyer: new root.UnitInfo(UnitType.Destroyer, {
				battleValue: 8,
				barrageValue: 9,
				barrageDice: 2,
				cost: 1,
			}),
		},
		Empyrean: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.Empyrean,
				cost: 8,
			}),
		},
		Mahact: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				race: root.Race.Mahact,
				cost: 8,
			}),
		},
		NaazRokha: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 9,
				battleDice: 2,
				race: root.Race.NaazRokha,
				cost: 8,
			}),
			Mech: new root.UnitInfo(UnitType.Mech, {
				sustainDamageHits: 1,
				battleValue: 6,
				battleDice: 2,
				importance: 1.6,
				cost: 2,
				typeShip: true,
			}),
		},
		Nomad: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				barrageValue: 8,
				barrageDice: 3,
				race: root.Race.Nomad,
				cost: 8,
			}),
		},
		Titans: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 7,
				battleDice: 2,
				race: root.Race.Titans,
				cost: 8,
			}),
			Cruiser: new root.UnitInfo(UnitType.Cruiser, {
				battleValue: 7,
				cost: 2,
			}),
			PDS: new root.UnitInfo(UnitType.PDS, {
				sustainDamageHits: 1,
				battleValue: 7,
				spaceCannonValue: 6,
				spaceCannonDice: 1,
				typeGroundForce: true,
				importance: 2.5,
			}), 
		},
		Cabal: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				bombardmentValue: 5,
				bombardmentDice: 1,
				race: root.Race.Cabal,
				cost: 8,
			}),
		},
	};

	root.StandardUpgrades = {
		// same as the regular Dreadnought, but upgrade affects ordering
		Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
			sustainDamageHits: 1,
			battleValue: 5,
			bombardmentValue: 5,
			bombardmentDice: 1,
			cost: 4,
		}),
		Cruiser: new root.UnitInfo(UnitType.Cruiser, {
			battleValue: 6,
			cost: 2,
		}),
		Destroyer: new root.UnitInfo(UnitType.Destroyer, {
			battleValue: 8,
			barrageValue: 6,
			barrageDice: 3,
			cost: 1,
		}),
		Fighter: new root.UnitInfo(UnitType.Fighter, {
			battleValue: 8,
			cost: 0.5,
		}),
		PDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 5,
			spaceCannonDice: 1,
		}),
		Ground: new root.UnitInfo(UnitType.Ground, {
			battleValue: 7,
			cost: 0.5,
		}),
	};

	root.RaceSpecificUpgrades = {
		Sol: {
			Carrier: new root.UnitInfo(UnitType.Carrier, {
				sustainDamageHits: 1,
				battleValue: 9,
				cost: 3,
			}),
			Ground: new root.UnitInfo(UnitType.Ground, {
				battleValue: 6,
				cost: 0.5,
			}),
		},
		L1Z1X: {
			Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
				sustainDamageHits: 1,
				battleValue: 4,
				bombardmentValue: 4,
				bombardmentDice: 1,
				cost: 4,
			}),
		},
		Naalu: {
			Fighter: new root.UnitInfo(UnitType.Fighter, {
				battleValue: 7,
				cost: 0.5,
			}),
		},
		Muaat: {
			WarSun: new root.UnitInfo(UnitType.WarSun, {
				sustainDamageHits: 1,
				battleValue: 3,
				battleDice: 3,
				bombardmentValue: 3,
				bombardmentDice: 3,
				cost: 10,
			}),
		},
		Argent: {
			Destroyer: new root.UnitInfo(UnitType.Destroyer, {
				battleValue: 7,
				barrageValue: 6,
				barrageDice: 3,
				cost: 1,
			}),
		},
		Nomad: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				barrageValue: 5,
				barrageDice: 3,
				race: root.Race.Nomad,
				cost: 8,
			}),
		},
		Titans: {
			Cruiser: new root.UnitInfo(UnitType.Cruiser, {
				sustainDamageHits: 1,
				battleValue: 6,
				cost: 2,
			}),
			PDS: new root.UnitInfo(UnitType.PDS, {
				sustainDamageHits: 1,
				battleValue: 6,
				spaceCannonValue: 5,
				spaceCannonDice: 1,
				typeGroundForce: true,
				importance: 2.5,
			}), 
		},
		Virus: {
			Flagship: new root.UnitInfo(UnitType.Flagship, {
				sustainDamageHits: 1,
				battleValue: 5,
				battleDice: 2,
				barrageValue: 5,
				barrageDice: 3,
				race: root.Race.Nomad,
				cost: 8,
			}),
			WarSun: new root.UnitInfo(UnitType.WarSun, {
				sustainDamageHits: 1,
				battleValue: 3,
				battleDice: 3,
				bombardmentValue: 3,
				bombardmentDice: 3,
				cost: 10,
			}),
			Carrier: new root.UnitInfo(UnitType.Carrier, {
				sustainDamageHits: 1,
				battleValue: 9,
				cost: 3,
			}),
		},
	};

	root.MergedUnits = {};
	root.MergedUpgrades = {};
	for (var race in root.Race) {
		root.MergedUnits[race] = Object.assign({}, root.StandardUnits, root.RaceSpecificUnits[race]);
		root.MergedUpgrades[race] = Object.assign({}, root.StandardUpgrades, root.RaceSpecificUpgrades[race]);
	}
	
	// Make an array of units in their reversed order of dying 
	root.expandFleet = function (input, battleSide) {
		var options = input.options || { attacker: {}, defender: {} };
		var battleType = input.battleType;
		var thisSideOptions = options[battleSide];
		var opponentSide = root.BattleSide.opponent(battleSide);
		var opponentSideOptions = options[opponentSide];
		thisSideOptions.side = ''+ battleSide;
		var oldStandardUnits = root.MergedUnits[thisSideOptions.race];
		var oldUpgradedUnits = root.MergedUpgrades[thisSideOptions.race];
		var opponentMentakFlagship = battleType === root.BattleType.Space && opponentSideOptions.race === root.Race.Mentak &&
			(input[root.SideUnits[opponentSide]][UnitType.Flagship] || { count: 0 }).count !== 0;
		var opponentMentakMech = battleType === root.BattleType.Ground && opponentSideOptions.race === root.Race.Mentak &&
			(input[root.SideUnits[opponentSide]][UnitType.Mech] || { count: 0 }).count !== 0 && !opponentSideOptions.articlesOfWar;

		var virusFlagship = battleType === root.BattleType.Space && thisSideOptions.race === root.Race.Virus &&
			(input[root.SideUnits[battleSide]][UnitType.Flagship] || { count: 0 }).count !== 0 && !thisSideOptions.memoriaII;
		var naaluFlagship = battleType === root.BattleType.Ground && thisSideOptions.race === root.Race.Naalu &&
			(input[root.SideUnits[battleSide]][UnitType.Flagship] || { count: 0 }).count !== 0;
		var result = [];
		var thisSideCounters = input[root.SideUnits[battleSide]];
		var standardUnits = Object.assign({},oldStandardUnits);
		var upgradedUnits = Object.assign({},oldUpgradedUnits);
		if (thisSideOptions.race === root.Race.Virus){
			var index = 0;
			var virusUpgradesList = Object.keys(root.VirusUpgrades[root.Race.Virus]);
			for (var race in root.RaceSpecificUpgrades){
				for (var unitType in root.RaceSpecificUpgrades[race]){
					var unit = root.RaceSpecificUpgrades[race][unitType]
					if (thisSideOptions[virusUpgradesList[index]])
						upgradedUnits[unit.type] = unit;
					index+=1;
				}
			}
		}
		for (var unitType in UnitType) {
			var counter = thisSideCounters[unitType] || { count: 0 };
			for (var i = 0; i < counter.count; i++) {
				var unit = (counter.upgraded ? upgradedUnits : standardUnits)[unitType];
				var addedUnit = unit.clone();
				if (naaluFlagship && unit.type === root.UnitType.Fighter && battleSide === 'attacker')
					addedUnit.typeGroundForce=true;
				if (virusFlagship && unit.typeGroundForce)
					addedUnit.typeShip=true;
				if ((thisSideOptions.articlesOfWar || battleType === root.BattleType.Ground) && unit.type === root.UnitType.Mech && thisSideOptions.race === root.Race.NaazRokha)
					addedUnit.typeShip=false;
				if (thisSideOptions.articlesOfWar && unit.type === root.UnitType.Mech && thisSideOptions.race === root.Race.Xxcha){
					addedUnit.spaceCannonDice=0;
					addedUnit.spaceCannonValue=null;
				}
				if (thisSideOptions.blitz && addedUnit.bombardmentDice === 0 && unit.typeShip && addedUnit.type !== root.UnitType.Fighter){
					addedUnit.bombardmentDice=1;
					addedUnit.bombardmentValue=6;
				}
				if (opponentSideOptions.disable && unit.type === root.UnitType.PDS){
					addedUnit.spaceCannonDice=0;
					addedUnit.planetaryShield=false;
				}
				result.push(addedUnit);
				if (unit.sustainDamageHits > 0 &&
					!opponentMentakFlagship &&
					!(unitType === UnitType.WarSun && thisSideOptions.publicizeSchematics) &&
					!(unitType === UnitType.Mech && opponentMentakMech && battleType===root.BattleType.Ground) &&
					!(unitType === UnitType.Mech && thisSideOptions.race===root.Race.NaazRokha && battleType===root.BattleType.Space)
				) {
					if (i < counter.count - Math.max((counter.damaged || 0),(counter.participants || 0))){
						sustain=addedUnit.toDamageGhost()
						if (sustain.type === root.UnitType.Mech && thisSideOptions.race === root.Race.Nomad)
							sustain.cancelHit=true;
						result.push(sustain);
					}
					else
						addedUnit.damaged = true;
				}

			}
		}
		if (thisSideOptions.titanAgent){
			var ghostHit = root.StandardUnits.GhostHit;
			ghostHit.shortType='T',
			ghostHit.cancelHit=true;
			result.push(ghostHit);
		}
		thisSideOptions.yinAgentUses= thisSideOptions.yinAgent ? 1 : 0 ;
		thisSideOptions.reflectiveShieldingUses= thisSideOptions.reflectiveShielding ? 1 : 0 ;
		thisSideOptions.directHitUses = battleSide === "attacker" ? thisSideOptions.directHit + thisSideOptions.directHit2A + thisSideOptions.directHit3A + thisSideOptions.directHit4A :
										thisSideOptions.directHit + thisSideOptions.directHit2D + thisSideOptions.directHit3D + thisSideOptions.directHit4D;
		thisSideOptions.hacanFlagship = battleType === root.BattleType.Space && thisSideOptions.race === root.Race.Hacan &&
		(input[root.SideUnits[battleSide]][UnitType.Flagship] || { count: 0 }).count !== 0;
		thisSideOptions.virusFlagship = virusFlagship;
		if (thisSideOptions.race !== root.Race.Nomad && opponentSideOptions.race !== root.Race.Nomad && battleType === root.BattleType.Space){
			
			if (battleSide === "attacker" && options.attacker.nomadCavalry){
				thisSideOptions.hasMemoriaIIA ? nomadPromissary(result,2) : nomadPromissary(result,1);
			}
			if (battleSide === "defender" && options.defender.nomadCavalry)
				thisSideOptions.hasMemoriaIID ? nomadPromissary(result,2) : nomadPromissary(result,1);	
		}
		
		var unitOrder = createUnitOrder(virusFlagship);
		var naaluGoundUnitOrder = {};
		naaluGoundUnitOrder[UnitType.Mech] = 0;
		naaluGoundUnitOrder[UnitType.Ground] = 1;
		naaluGoundUnitOrder[UnitType.Fighter] = 2;
		var comparer;
		var vipGround;
		if (naaluFlagship) {
			// in case Fighters are stronger than Ground Forces, I'd like Ground Forces to die first, then sacrifice the
			// Fighters. But, Fighters cannot take control of the planet, so I'd like to save one Ground Force
			vipGround = (thisSideCounters[UnitType.Fighter] || {}).upgraded &&
				!(thisSideCounters[UnitType.Ground] || {}).upgraded &&
				(result.find(function (unit) { return unit.type === UnitType.Mech;}) || result.find(function (unit) { return unit.type === UnitType.Ground;}));
			comparer = naaluComparer;
		} else if ((thisSideCounters[UnitType.Dreadnought] || {}).upgraded){
			comparer = upgradedDreadnoughtsComparer;
		}else
			comparer = defaultComparer;
		result.sort(comparer);
		if (battleType === root.BattleType.Space && thisSideOptions.experimentalBattlestation)
			result.push(root.StandardUnits.ExperimentalBattlestation);
		if (thisSideOptions.progenitor)
			result.push(root.StandardUnits.TheProgenitor);
		//options[battleSide].units=result;
		options[battleSide].battleType=''+battleType;
		
		result.comparer = comparer;
		result.filterForBattle = filterFleet;
		return result;

		function createUnitOrder(virus) {
			var result = [];
			var i = 0;
			for (var unitType in UnitType) {
				result[unitType] = i++;
			}
			if (virus) {
				var tmp = result[UnitType.Ground]; // Virus will need Grounds to die after Fighters, as they are stronger
				result[UnitType.Ground] = result[UnitType.Fighter];
				result[UnitType.Fighter] = tmp;
				tmp = result[UnitType.Mech]; // Virus will need Mechs to die after Grounds, as they are stronger
				result[UnitType.Mech] = result[UnitType.Ground];
				result[UnitType.Ground] = tmp;
			}
			return result;
		}
		function defaultComparer(unit1, unit2) {
			var unitOrder1= isNaN(unit1.importance) ? unitOrder[unit1.type] : unit1.importance;
			var unitOrder2=isNaN(unit2.importance) ? unitOrder[unit2.type] : unit2.importance;
			var typeOrder = unitOrder1 - unitOrder2;
			// damage ghosts come after corresponding units
			var damageGhostOrder = (unit1.isDamageGhost ? 1 : 0) - (unit2.isDamageGhost? 1 : 0);
			// Damaged units come _before_ undamaged ones (within one type of course), which means they die later,
			// this way more Duranium armor has better chance to be applied.
			var damagedOrder = (unit2.damaged ? 1 : 0) - (unit1.damaged ? 1 : 0);
			if (thisSideOptions.riskDirectHit) {
				// means damage ghosts will come last
				var defaultComparison = damageGhostOrder * 1000 + typeOrder * 10 + damagedOrder;
				if (thisSideOptions.race !== root.Race.Letnev) {
					return defaultComparison;
				} else {
					// damage ghosts will still come last, but Flagship ghost should be the very very last, as the Flagship can repair itself
					if (unit1.type === UnitType.Flagship && unit1.isDamageGhost) {
						return unit2.type === UnitType.Flagship && unit2.isDamageGhost ? 0 : 1;
					} else if (unit2.type === UnitType.Flagship && unit2.isDamageGhost) {
						return -1;
					} else {
						return defaultComparison;
					}
				}
			} else {
				// means units are grouped with their damage ghosts
				if (!unit1.typeShip && unit1.isDamageGhost)
					return 1;
				if (!unit2.typeShip && unit2.isDamageGhost)
					return -1;
				return typeOrder * 1000 + damageGhostOrder * 10 + damagedOrder;
			}
		}

		function upgradedDreadnoughtsComparer(unit1, unit2) {
			if (thisSideOptions.riskDirectHit) {
				return defaultComparer(unit1, unit2);
			} else if (unit1.type === UnitType.Dreadnought && unit1.isDamageGhost) {
				return unit2.type === UnitType.Dreadnought && unit2.isDamageGhost ? 0 : 1;
			} else if (unit2.type === UnitType.Dreadnought && unit2.isDamageGhost) {
				return -1;
			} else {
				return defaultComparer(unit1, unit2);
			}
		}

		function naaluComparer(unit1, unit2) {
			var typeOrder = naaluGoundUnitOrder[unit1.type] - naaluGoundUnitOrder[unit2.type];
			var damageGhostOrder = (unit1.isDamageGhost ? 1 : 0) - (unit2.isDamageGhost ? 1 : 0);
			var damagedOrder = (unit2.damaged ? 1 : 0) - (unit1.damaged ? 1 : 0);
			if (vipGround) {
				// Fighters are stronger than Ground
				if (unit1 === vipGround)
					return -1;
				else if (unit2 === vipGround)
					return 1;
				else
					if (!unit1.typeShip && unit1.isDamageGhost)
						return 1;
					if (!unit2.typeShip && unit2.isDamageGhost)
						return -1;
					return -(typeOrder * 1000 + damageGhostOrder * 10 + damagedOrder);
			} else {
				if (!unit1.typeShip && unit1.isDamageGhost)
					return 1;
				if (!unit2.typeShip && unit2.isDamageGhost)
					return -1;
				return (typeOrder * 1000 + damageGhostOrder * 10 + damagedOrder);
			}
		}
		function nomadPromissary(fleet,level){
			var unitPriority = -1;
			var unit = null;
			var perfer = [root.UnitType.Warsun, root.UnitType.Flagship, root.UnitType.Dreadnought, root.UnitType.Mech, root.UnitType.Cruiser,root.UnitType.Ground, root.UnitType.Destroyer, root.UnitType.Carrier];
			
			for (var i = 0; i < fleet.length; i++) {
				if (!fleet[i].isDamageGhost && fleet[i].type !== root.UnitType.Fighter && fleet[i].typeShip){
					if (perfer.indexOf(fleet[i].type)>unitPriority){
						unit=fleet[i];
						unitPriority=perfer.indexOf(fleet[i].type);
					}
				}
			}
			
			if (level === 1 && unit !== null){
				unit.battleValue=7;
				unit.battleDice=2;
				unit.barrageValue=8;
				unit.barrageDice=3;
				unit.importance=1.5;
				if (unit.sustainDamageHits <1){
					unit.sustainDamageHits=1;
					var ghost = unit.toDamageGhost();
					ghost.importance=1.5;
					fleet.push(ghost);
				}
			} else if (level === 2 && unit !== null) {
				unit.battleValue=5;
				unit.battleDice=2;
				unit.barrageValue=5;
				unit.barrageDice=3;
				unit.importance=1.5;
				if (unit.sustainDamageHits <1){
					unit.sustainDamageHits=1;
					var ghost = unit.toDamageGhost();
					ghost.importance=1.5;
					fleet.push(ghost);
				}
			}
			return;
		}
		
		function filterFleet() {
			var allowed = {};
			for (var unitType in UnitType){
				var counter = thisSideCounters[unitType] || { count: 0 };
				var par = counter.count - (counter.participants || 0);
				allowed[unitType]=par;
			}
			var result = this.filter(function (unit) {
				allowed[unit.type] = unit.isDamageGhost ? allowed[unit.type] : allowed[unit.type]-1;
				if (battleType === root.BattleType.Space)
					return (unit.typeShip || (unit.type === UnitType.Mech && thisSideOptions.race === root.Race.Nomad && 
						unit.isDamageGhost && !thisSideOptions.articlesOfWar)) && (allowed[unit.type]>=0 || unit.isDamageGhost);
				else battleType === root.BattleType.Ground
					return (unit.typeGroundForce) && (allowed[unit.type]>=0 || unit.isDamageGhost);
			});
			result.comparer = this.comparer;
			if (result.length >0 && thisSideOptions.titanAgent){
				var ghostHit = root.StandardUnits.GhostHit;
				ghostHit.shortType='T',
				result.push(ghostHit);
			}
			result.sort(this.comparer);
			return result;
		}

	};

	// Check whether the race has an upgrade for the unit 
	root.upgradeable = function (race, unitType) {
		return !!(root.StandardUpgrades.hasOwnProperty(unitType) ||
			root.RaceSpecificUpgrades[race] &&
			root.RaceSpecificUpgrades[race].hasOwnProperty(unitType)) ||
			(race === root.Race.Virus && unitType !== root.UnitType.Mech);
	};

	root.damageable = function (race, unitType, upgraded, options) {
		//console.trace();
		return (upgraded ? root.MergedUpgrades : root.MergedUnits)[race][unitType].sustainDamageHits > 0  || (unitType === root.UnitType.Cruiser && options.saturnEngineII) || (unitType === root.UnitType.PDS && options.helTitanII);
	};

	root.hasBombardment = function (race, unitType, upgraded, blitz) {
		return (upgraded ? root.MergedUpgrades : root.MergedUnits)[race][unitType].bombardmentDice > 0 || ((upgraded ? root.MergedUpgrades : root.MergedUnits)[race][unitType].typeShip && blitz);
	};
	
})(typeof exports === 'undefined' ? window : exports);
//window.alert(5 + 6);
