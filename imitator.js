(function (root) {

	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
	} else {
		structs = window;
		game = window;
	}

	root.imitationIterations = 50000;
	root.tgs = { attacker: {tg:0, yinAgentUses:0, maneuveringJetsUses:0, directHitUses:0, tgHacan:0}, defender: {tg:0, yinAgentUses:0, maneuveringJetsUses:0, directHitUses:0, tgHacan:0} };
	root.imitator = (function () {

		var prebattleActions = initPrebattleActions();
		var boosts = initBoosts();
		var boostsRoll = initExtraRolls();
		return {
			estimateProbabilities: estimateProbabilities,
		};

		function estimateProbabilities(input) {
			var battleType = input.battleType;
			var options = input.options || { attacker: {}, defender: {} };
			options = options || { attacker: {}, defender: {} };
			root.tgs.attacker.tg=0;
			root.tgs.defender.tg=0;
			root.tgs.attacker.tgHacan=0;
			root.tgs.defender.tgHacan=0;
			var result = new structs.EmpiricalDistribution();
			var finalAttacker = game.expandFleet(input, game.BattleSide.attacker).filterForBattle()
				.map(function (unit) { return [unit.shortType]; });
			var finalDefender = game.expandFleet(input, game.BattleSide.defender).filterForBattle()
				.map(function (unit) { return [unit.shortType]; });
			for (var i = 0; i < root.imitationIterations; ++i) {
				var attacker = game.expandFleet(input, game.BattleSide.attacker);
				var defender = game.expandFleet(input, game.BattleSide.defender);

				root.tgs.attacker.yinAgentUses=options.attacker.yinAgentUses;
				root.tgs.attacker.maneuveringJetsUses=options.attacker.maneuveringJetsUses;
				root.tgs.attacker.directHitUses=options.attacker.directHitUses;
				root.tgs.defender.yinAgentUses=options.defender.yinAgentUses;
				root.tgs.defender.maneuveringJetsUses=options.defender.maneuveringJetsUses;
				root.tgs.defender.directHitUses=options.defender.directHitUses;

				var survivors = imitateBattle(attacker, defender, battleType, options,input);

				if (survivors.attacker.length !== 0) {
					result.increment(-survivors.attacker.length);
					for (var a = 0; a < survivors.attacker.length; a++) {
						if (!finalAttacker[a])
							finalAttacker[a] = [];
						if (finalAttacker[a].indexOf(survivors.attacker[a].shortType) < 0)
							finalAttacker[a].push(survivors.attacker[a].shortType);
					}
				} else if (survivors.defender.length !== 0) {
					result.increment(survivors.defender.length);
					for (var d = 0; d < survivors.defender.length; d++) {
						if (!finalDefender[d])
							finalDefender[d] = [];
						if (finalDefender[d].indexOf(survivors.defender[d].shortType) < 0)
							finalDefender[d].push(survivors.defender[d].shortType);
					}
				} else
					result.increment(0);
			}
			result.normalize();
			attackerAvgTG = (tgs.attacker.tg===0 || tgs.attacker.tg===null) ? null: Math.round((tgs.attacker.tg/root.imitationIterations)*1000)/1000;
			defenderAvgTG = (tgs.defender.tg===0 || tgs.defender.tg===null) ? null: Math.round((tgs.defender.tg/root.imitationIterations)*1000)/1000;

			attackerAvgHacanTG = (tgs.attacker.tgHacan===0 || tgs.attacker.tgHacan===null) ? null: Math.round((tgs.attacker.tgHacan/root.imitationIterations)*1000)/1000;
			defenderAvgHacanTG = (tgs.defender.tgHacan===0 || tgs.defender.tgHacan===null) ? null: Math.round((tgs.defender.tgHacan/root.imitationIterations)*1000)/1000;
			return [{
				distribution: result,
				attacker: finalAttacker.map(function (set) {
					return set.reduce(function (prev, item) {
						return prev + item;
					});
				}),
				defender: finalDefender.map(function (set) {
					return set.reduce(function (prev, item) {
						return prev + item;
					});
				}),
			},attackerAvgTG,defenderAvgTG,attackerAvgHacanTG, defenderAvgHacanTG];
		}

		function imitateBattle(attackerFull, defenderFull, battleType, options,input) {
			var attacker = attackerFull.filterForBattle();
			var defender = defenderFull.filterForBattle();
			var doAtLeastOneRound = false;
			var actions = prebattleActions;
			var aDeadUnits=[];
			var dDeadUnits=[];

			if (options.attacker.race === game.Race.Mentak || options.defender.race === game.Race.Mentak) {
				actions = prebattleActions.slice();
				var t = actions[1];
				actions[1] = actions[2];
				actions[2] = t;
				if (actions[1].name !== 'Mentak racial' ||
					actions[2].name !== 'Assault Cannon')
					throw new Error('unexpected pre-battle actions order');
			}
			for (var i = 0; i < actions.length; i++) {
				var action = actions[i];
				if (action.appliesTo === battleType)
					action.execute(attacker, defender, attackerFull, defenderFull, options,input, true);
				if (i === 0) {
					if (action.name === 'Space Cannon -> Ships') {
						// if last unit's are destroyed by Mentak racial ability or Assault Cannon or Barrage,
						// make sure "after combat round" effects still occur
						doAtLeastOneRound = battleType === game.BattleType.Space &&
							(attacker.length || defender.length);
					} else
						throw new Error('first pre-battle action not Space Cannon -> Ships');
				}
			}
			attacker.sort(attacker.comparer);
			defender.sort(defender.comparer);
			var round = 0;
			var losePlanetary = attackerFull.some(unitIs(game.UnitType.WarSun)) || (attackerFull.some(unitIs(game.UnitType.Flagship)) && options.attacker.race === game.Race.Letnev);
			var magenDefenseActivatedDefender = battleType === game.BattleType.Ground &&
				options.defender.magenDefense &&
				defenderFull.some(unitShield(options.attacker.disable)) &&
				!losePlanetary;

			var magenDefenseActivatedAttacker = battleType === game.BattleType.Ground &&
				options.attacker.magenDefense &&
				attackerFull.some(unitShield(options.attacker.disable));
			if (battleType === game.BattleType.Ground && options.defender.magenDefenseOmega &&
				(options.defender.hasDock || defenderFull.some(unit.typeStructure) &&
				hasUnits(attacker) && hasUnits(defender))) {
				// Naalu Fighters are considered to be vulnerable to Magen Omega.
				// Also, I don't try to be clever with which Naalu unit will be killed, GF of a Fighter, even though it's defencers choice
				// https://www.reddit.com/r/twilightimperium/comments/g82tk6/ground_combat_when_one_side_didnt_come/
				//applyDamage(attacker, 1, options.attacker);
				for (i in attacker){
					unit = attacker[i];
					if (((unit.damaged || unit.sustainDamageHits<1) && !unit.isDamageGhost) || i === attacker.length-1){
						attacker.splice(i,1);
						aDeadUnits.push(unit);
						break;
					}
				}
			}
			if (battleType === game.BattleType.Ground && options.attacker.magenDefenseOmega &&
				(options.attacker.hasDock || attacker.some(unit.typeStructure) &&
				hasUnits(attacker) && hasUnits(defender))) {
				for (i in defender){
					unit = defender[i];
					if (((unit.damaged || unit.sustainDamageHits<1) && !unit.isDamageGhost) || i === defender.length-1){
						defender.splice(i,1);
						dDeadUnits.push(unit);
						break;
					}
				}
			}
			while (hasUnits(attacker) && hasUnits(defender) || (doAtLeastOneRound && round === 0)) {
				round++;
				/*console.log('start round')
				console.log('attacker');
				consoles=[];
				consoles[round]=attacker;
				for (i in consoles[round]){
					console.log(consoles[round][i]);
				}
				console.log('defender')
				consolesD=[];
				consolesD[round]=defender;
				for (i in consolesD[round]){
					console.log(consolesD[round][i]);
				}*/
				
				if (options.attacker.race === game.Race.Letnev)
					repairFlagships(attacker);
				if (options.defender.race === game.Race.Letnev)
					repairFlagships(defender);
				var attackerBoost = boost(battleType, round, options.attacker, attacker, options.defender);
				var defenderBoost = boost(battleType, round, options.defender, defender, options.attacker);
				var attackerBoostRoll = boostRoll(battleType, round, options.attacker, attacker, options.defender,attackerFull);
				var defenderBoostRoll = boostRoll(battleType, round, options.defender, defender, options.attacker,defenderFull);
				var attackerReroll = options.attacker.munitions;
				var defenderReroll = options.defender.munitions;
				if (round === 1) {
					attackerReroll = options.attacker.fireTeam && battleType === game.BattleType.Ground ||
						options.attacker.letnevMunitionsFunding && battleType === game.BattleType.Space ||
						options.attacker.munitions && battleType === game.BattleType.Space;
					defenderReroll = options.defender.fireTeam && battleType === game.BattleType.Ground ||
						options.defender.letnevMunitionsFunding && battleType === game.BattleType.Space||
						options.defender.munitions && battleType === game.BattleType.Space;
				}
				if (round === 2 && magenDefenseActivatedDefender) {
					// if Magen Defense was activated - treat the second round as the first for the attacker
					attackerBoost = boost(battleType, 1, options.attacker, attacker, options.defender);
					attackerBoostRoll = boostRoll(battleType, 1, options.attacker, attacker, options.defender,attackerFull);
					attackerReroll = options.attacker.fireTeam && battleType === game.BattleType.Ground ||
						options.attacker.letnevMunitionsFunding && battleType === game.BattleType.Space ||
						options.attacker.munitions && battleType === game.BattleType.Space;
				}
				if (round === 2 && magenDefenseActivatedAttacker) {
					// if Magen Defense was activated - treat the second round as the first for the defender
					defenderBoost = boost(battleType, 1, options.defender, defender, options.attacker);
					defenderBoostRoll = boostRoll(battleType, 1, options.defender, defender, options.attacker,defenderFull);
					defenderReroll = options.defender.fireTeam && battleType === game.BattleType.Ground ||
						options.defender.letnevMunitionsFunding && battleType === game.BattleType.Space||
						options.defender.munitions && battleType === game.BattleType.Space;
				}
				if (round !== 1){
					actions.find(function (a) {
						return a.name === 'Dunlain Mechs';
					}).execute(attacker, defender, attackerFull, defenderFull, options,input,false);
				}
				winnuFlagships(attacker, options.attacker, defender);
				winnuFlagships(defender, options.defender, attacker);
				var attackerInflictedToNonFighters = 0, attackerInflictedToEverything = 0;
				var defenderInflictedToNonFighters = 0, defenderInflictedToEverything = 0;
				if (options.attacker.race === game.Race.L1Z1X && attacker.some(unitIs(game.UnitType.Flagship))) {
					attackerInflictedToNonFighters = rollDice(attacker.filter(flagshipOrDreadnought), game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker);
					attackerInflictedToEverything = rollDice(attacker.filter(not(flagshipOrDreadnought)), game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker);
				} else
					attackerInflictedToEverything = rollDice(attacker, game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker);
				if (options.defender.race === game.Race.L1Z1X && defender.some(unitIs(game.UnitType.Flagship))) {
					defenderInflictedToNonFighters = rollDice(defender.filter(flagshipOrDreadnought), game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender);
					defenderInflictedToEverything = rollDice(defender.filter(not(flagshipOrDreadnought)), game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender);
				} else
					defenderInflictedToEverything = rollDice(defender, game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender);
				if (round === 1 && magenDefenseActivatedDefender) {
					attackerInflictedToEverything = 0;
				}
				if (round === 1 && magenDefenseActivatedAttacker) {
					defenderInflictedToEverything = 0;
				}
				if (battleType === game.BattleType.Ground) {
					var attackerAdditional = 0;
					var defenderAdditional = 0;
					if (options.attacker.valkyrieParticleWeave &&
						defenderInflictedToEverything > 0)
						attackerAdditional = 1;
					if (options.defender.valkyrieParticleWeave &&
						attackerInflictedToEverything > 0)
						defenderAdditional = 1;
					attackerInflictedToEverything += attackerAdditional;
					defenderInflictedToEverything += defenderAdditional;
				}
				
				/*consolesD=[];
				consolesD[round]=defender;
				for (i in consolesD[round]){
					console.log(consolesD[round][i]);
				}
				console.log(attackerInflictedToEverything);
				console.log(defenderInflictedToEverything);*/
				var A1 = applyDamage(attacker, defenderInflictedToNonFighters, options.attacker, null, notFighter);
				var A2 = applyDamage(attacker, defenderInflictedToEverything, options.attacker);
				var D1 = applyDamage(defender, attackerInflictedToNonFighters, options.defender, null, notFighter)
				var D2 = applyDamage(defender, attackerInflictedToEverything, options.defender);

				var attackerList = [A1[0]+A2[0]];
				var defenderList = [D1[0]+D2[0]];

				var aDeadUnits=aDeadUnits.concat(A1[1].concat(A2[1]));
				var dDeadUnits=dDeadUnits.concat(D1[1].concat(D2[1]));
				//console.log(defenderList[0]);
				/*consolesD2=[];
				consolesD2[round]=defender;
				for (i in consolesD2[round]){
					console.log(consolesD2[round][i]);
				}*/
				/*console.log("attacker damage "+ attackerInflictedToEverything);
				console.log("defender damage "+defenderInflictedToEverything);
				consoles3=[];
				consoles3[round]=attacker;
				for (i in consoles3[round]){
					console.log(consoles3[round][i]);
				}
				
				console.log('Dead Units')
				consoles2=[];
				consoles2[round]=aDeadUnits;
				for (i in consoles2[round]){
					console.log(consoles2[round][i]);
				}*/
				//console.log("start");
				while (attackerList[0]>0 || defenderList[0]>0){
					var aTemp = applyDamage(attacker, defenderList[0], options.attacker);
					var dTemp = applyDamage(defender, attackerList[0], options.defender);
					aDeadUnits.concat(aTemp[1]);
					dDeadUnits.concat(dTemp[1]);
					attackerList= aTemp;
					defenderList=dTemp;
				}
				/*console.log("end");
				consolesD1=[];
				consolesD1[round]=defender;
				for (i in consolesD1[round]){
					console.log(consolesD1[round][i]);
				}*/
				letnevCommander(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
				letnevCommander(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
				directHit(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
				directHit(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
				yinFlagship(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
				yinAgent(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
				yinAgent(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
				mentakHero(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
				mentakHero(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
				var aDeadUnits=[];
				var dDeadUnits=[];
				if (options.attacker.duraniumArmor)
					repairUnit(attacker);
				if (options.defender.duraniumArmor)
					repairUnit(defender);

				if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) { // Harrow
					// https://www.reddit.com/r/twilightimperium/comments/g82tk6/ground_combat_when_one_side_didnt_come/
					// https://boardgamegeek.com/thread/2286628/does-ground-combat-still-occur-if-invading-ground
					actions.find(function (a) {
						return a.name === 'Bombardment';
					}).execute(attacker, defender, attackerFull, defenderFull, options,input,false);
				}
				// https://boardgamegeek.com/thread/1904694/how-do-you-resolve-endless-battles
				if ((// both sides have Duranium Armor
				options.attacker.duraniumArmor && options.defender.duraniumArmor &&
				// both sides have Non-Euclidean Shielding
				options.attacker.nonEuclidean && options.defender.nonEuclidean &&
				// and both of them have two repairable ships left
				attacker.filter(function (unit) { return unit.sustainDamageHits > 0 && !unit.isDamageGhost; }).length === 2 &&
				defender.filter(function (unit) { return unit.sustainDamageHits > 0 && !unit.isDamageGhost; }).length === 2 &&
				// and at least one of them (for each side) is not damaged
				attacker.filter(function (unit) { return unit.sustainDamageHits > 0 && !unit.isDamageGhost && !unit.damaged; }).length > 0 &&
				defender.filter(function (unit) { return unit.sustainDamageHits > 0 && !unit.isDamageGhost && !unit.damaged; }).length > 0 &&

				// but both cannot inflict more than two damage
				attacker.map(function (unit) {return unit.battleDice || 0; }).reduce(sum) <= 2 &&
				defender.map(function (unit) {return unit.battleDice || 0; }).reduce(sum) <= 2) ||
				(options.attacker.nonEuclidean && options.defender.nonEuclidean &&
				attacker.some(unitIs(game.UnitType.Flagship)) && attacker.length===1 &&
				defender.some(unitIs(game.UnitType.Flagship)) && defender.length===1 &&
				options.attacker.race === game.Race.Letnev && options.defender.race === game.Race.Letnev)){
					// deadlock detected. report as a draw
					// new ruling says attacker loses if deadlock
					attacker.splice(0);
					break;
				}
				if (round === 1 && battleType === game.BattleType.Space && options.defender.rout && hasUnits(defender)){
					attacker.splice(0);
					break;
				}
			}
			
			return { attacker: attacker, defender: defender };
	
			
			function winnuFlagships(fleet, sideOptions, opposingFleet) {
				if (battleType === game.BattleType.Space && sideOptions.race === game.Race.Winnu) {
					// according to https://boardgamegeek.com/thread/1916774/nekrowinnu-flagship-interaction
					var battleDice = opposingFleet.filter(notFighterNorGroundForceShip).length;
					// In the game there could be only one flagship, but why the hell not)
					fleet.filter(unitIs(game.UnitType.Flagship)).forEach(function (flagship) {
						flagship.battleDice = battleDice;
					});
				}
			}

			function notFighter(unit) {
				return unit.type !== game.UnitType.Fighter;
			}

			function flagshipOrDreadnought(unit) {
				return unit.type === game.UnitType.Flagship || unit.type === game.UnitType.Dreadnought;
			}

			function not(predicate) {
				return function (unit) {
					return !predicate(unit);
				}
			}

			function repairUnit(fleet) {

				var somethingRepaired = false;
				for (var i = 0; i < fleet.length; i++) {
					var unit = fleet[i];
					if (unit.damaged) {
						if (unit.damagedThisRound) {
							unit.damagedThisRound = false;
						} else {
							if (!somethingRepaired) {
								fleet.push(unit.toDamageGhost());
								somethingRepaired = true;
							}
						}
					}
				}

				fleet.sort(fleet.comparer);
			}

			function repairFlagships(fleet) {

				for (var i = 0; i < fleet.length; i++) {
					var unit = fleet[i];
					if (unit.type === game.UnitType.Flagship && unit.damaged) {
						var damageGhost = unit.toDamageGhost();
						// find proper place for the new damage ghost
						var index = structs.binarySearch(fleet, damageGhost, fleet.comparer);
						if (index < 0)
							index = -index - 1;
						fleet.splice(index, 0, damageGhost);
					}
				}
			}

		}

		/** returns true if Yin flagship was killed */
		function applyDamage(fleet, hits, sideOptions, hardPredicate, softPredicate) {
			hardPredicate = hardPredicate || function (unit) {
				return true;
			};
			var hitsProduced = 0;
			var deadUnits=[];
			for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
				if (hardPredicate(fleet[i]) && (!softPredicate || softPredicate(fleet[i]))) {
					var killed = hit(i);
					deadUnits.push(killed);
					if (sideOptions.race === game.Race.Sardakk && killed.type === game.UnitType.Mech && killed.isDamageGhost && !sideOptions.articlesOfWar){
						hitsProduced+=1;
					}
					if (sideOptions.reflectiveShielding && killed.isDamageGhost && killed.typeShip)
						hitsProduced+=2;
				}
			}
			if (softPredicate) {
				for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
					if (hardPredicate(fleet[i])) {
						var killed = hit(i);
						deadUnits.push(killed);
						if (sideOptions.race === game.Race.Sardakk && killed.type === game.UnitType.Mech && killed.isDamageGhost && !sideOptions.articlesOfWar)
							hitsProduced+=1;
						if (sideOptions.reflectiveShielding && killed.isDamageGhost && killed.typeShip)
							hitsProduced+=2;
					}
				}
			}
			return [hitsProduced,deadUnits];

			function hit(i) {
				var killed = fleet.splice(i, 1)[0];
				if (killed.isDamageGhost) {
					killed.damageCorporeal.damaged = true;
					killed.damageCorporeal.damagedThisRound = true;
					if (sideOptions.nonEuclidean)
						hits--;
				}
				hits--;
				return killed;
			}
		}

		function applyBarrageDamage(fleet, hits, sideOptions, hardPredicate, softPredicate) {
			hardPredicate = hardPredicate || function (unit) {
				return true;
			};
			var deadUnits=[];
			for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
				if (hardPredicate(fleet[i]) && (!softPredicate || softPredicate(fleet[i]))) {
					var killed = hit2(i);
					deadUnits.push(killed);
				}
			}
			if (softPredicate) {
				for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
					if (hardPredicate(fleet[i])) {
						var killed = hit2(i);
						deadUnits.push(killed);
					}
				}
			}
			return deadUnits;

			function hit2(i) {
				var killed = fleet.splice(i, 1)[0];
				if (killed.isDamageGhost) {
					killed.damageCorporeal.damaged = true;
					killed.damageCorporeal.damagedThisRound = true;
					if (sideOptions.nonEuclidean)
						hits--;
				}
				hits--;
				return killed;
			}
		}


		function rollDice(fleet, throwType, modifier, reroll, extraModifier, thisSideOptions) {
			modifier = modifier || 0;
			extraModifier= extraModifier || 0;
			var totalRoll = 0;
			var modifierFunction = typeof modifier === 'function' ? modifier : function (unit) {
				return modifier;
			};
			var extraModifierFunction = typeof extraModifier === 'function' ? extraModifier : function (unit) {
				return extraModifier;
			};
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];
				var battleValue = unit[game.ThrowValues[throwType]];
				var diceCount = unit[game.ThrowDice[throwType]] + extraModifierFunction(unit);

				for (var die = 0; die < diceCount; ++die) {
					var rollResult = rollDie();
					if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && 8 < rollResult)
						totalRoll += 2;
					if (thisSideOptions.hacanFlagship && rollResult==battleValue && throwType==game.ThrowType.Battle){
						//console.log(unit);
						rollResult+=1;
						tgs[thisSideOptions.side].tgHacan++;
					}
					if (battleValue <= rollResult + modifierFunction(unit)){
						totalRoll++;
					}
					else if (reroll) { // There is an assumption that Jol-Nar Flagship won't re-roll rolls that produced hits but not +2 hits. Seems reasonable on expectation.
						rollResult = rollDie();
						if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && 8 < rollResult)
							totalRoll += 2;
						if (battleValue <= rollResult + modifierFunction(unit))
							totalRoll++;
					}
				}
			}
			//console.log(totalRoll);
			return totalRoll;
		}

		function rollDie() {
			return Math.floor(Math.random() * game.dieSides + 1);
		}

		function hasUnits(fleet) {
			return fleet.length > 0;
		}

		function initPrebattleActions() {
			return [
				{
					name: 'Space Cannon -> Ships',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						var attackerModifier = options.defender.antimassDeflectors ? -1 : 0;
						var attackerReroll= options.attacker.jolnarCommander ? true: false;
						var attackerInflicted = rollDice(attackerFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, attackerModifier, attackerReroll, 0, options.attacker);
						if (options.attacker.plasmaScoring) 
							attackerInflicted += fromAdditionalRoll(attackerFull, game.ThrowType.SpaceCannon, attackerModifier,attackerReroll, options.attacker);
						if (options.attacker.argentCommander) 
							attackerInflicted += fromAdditionalRoll(attackerFull, game.ThrowType.SpaceCannon, attackerModifier,attackerReroll, options.attacker);
						if (options.attacker.argentStrikeWingSpaceCannonA && options.attacker.race !== game.Race.Argent) 
							attackerInflicted += fromAdditionalRoll(attackerFull, game.ThrowType.SpaceCannon, attackerModifier, attackerReroll, options.attacker);

						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var defenderReroll= options.defender.jolnarCommander ? true: false;
						var defenderInflicted = rollDice(defenderFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, defenderModifier, defenderReroll, 0, options.defender);
						if (options.defender.plasmaScoring) 
							defenderInflicted += fromAdditionalRoll(defenderFull, game.ThrowType.SpaceCannon, defenderModifier, defenderReroll, options.defender);
						if (options.defender.argentCommander) 
							defenderInflicted += fromAdditionalRoll(defenderFull, game.ThrowType.SpaceCannon, defenderModifier, defenderReroll, options.defender);
						if (options.defender.argentStrikeWingSpaceCannonD && options.defender.race !== game.Race.Argent) 
							defenderInflicted += fromAdditionalRoll(defenderFull, game.ThrowType.SpaceCannon, defenderModifier, defenderReroll, options.defender);
						while (root.tgs.attacker.maneuveringJetsUses>0 && defenderInflicted > 0){
							defenderInflicted--;
							root.tgs.attacker.maneuveringJetsUses-=1;
						}
						while (root.tgs.defender.maneuveringJetsUses>0 && attackerInflicted > 0){
							attackerInflicted--;
							root.tgs.defender.maneuveringJetsUses-=1;
						}
						if (options.attacker.solarFlare || (attacker.some(unitIs(game.UnitType.Flagship)) && options.attacker.race === game.Race.Argent)){
							defenderInflicted=0;
						}
						if (options.defender.solarFlare || (defender.some(unitIs(game.UnitType.Flagship)) && options.defender.race === game.Race.Argent)){
							attackerInflicted=0;
						}
						
						var defenderList = applyDamage(defender, attackerInflicted, options.defender, notGroundForce, gravitonLaserUnitHittable(options.attacker, attacker));
						var attackerList = applyDamage(attacker, defenderInflicted, options.attacker, notGroundForce, gravitonLaserUnitHittable(options.defender, defender));
						aDeadUnits=[];
						dDeadUnits=[];
						aDeadUnits=aDeadUnits.concat(attackerList[1]);
						dDeadUnits=dDeadUnits.concat(defenderList[1]);
						letnevCommander(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						letnevCommander(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						directHit(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						directHit(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						yinFlagship(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						yinAgent(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						yinAgent(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						
						if (defenderInflicted)
							markDamagedNotThisRound(attacker);
						if (attackerInflicted)
							markDamagedNotThisRound(defender);

						function hasSpaceCannon(unit) {
							return unit.spaceCannonDice !== 0;
						}

						function gravitonLaserUnitHittable(sideOptions) {
							return function (unit) {
								var gravitonNoFighters = sideOptions.gravitonLaser && unit.type === game.UnitType.Fighter;
								return !(gravitonNoFighters);
							};
						}

						function notGroundForce(sideOptions, fleet) {
							return function (unit) {
								var virusFlagship = sideOptions.race === game.Race.Virus && fleet.some(unitIs(game.UnitType.Flagship)) && (unit.type === game.UnitType.Ground || unit.type === game.UnitType.Mech) && !sideOptions.memoriaII;
								var naazRokhaMech = sideOptions.race === game.Race.NaazRokha && unit.type === game.UnitType.Mech;
								var nomadMech = sideOptions.race === game.Race.Nomad && unit.type === game.UnitType.Mech;
								return !(virusFlagship || naazRokhaMech || nomadMech);
							};
						}

						function markDamagedNotThisRound(fleet) {
							for (var i = 0; i < fleet.length; i++) {
								if (fleet[i].damagedThisRound) {
									fleet[i].damagedThisRound = false;
								}
							}
						}
					},
				},
				{
					name: 'Assault Cannon',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {

						var attackerDestroys = options.attacker.assaultCannon && attacker.filter(notFighterShip).length >= 3;
						var defenderDestroys = options.defender.assaultCannon && defender.filter(notFighterShip).length >= 3;

						var attackerVictim;
						var defenderVictim;
						var aDeadUnits=[];
						var dDeadUnits=[];
						if (attackerDestroys){
							defenderVictim = killOffNonFighter(defender, false);
							dDeadUnits.push(defenderVictim);
						}
						if (defenderDestroys) {
							attackerVictim = killOffNonFighter(attacker, true);
							aDeadUnits.push(attackerVictim);
						}
						yinFlagship(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						yinAgent(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						yinAgent(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						mentakHero(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						mentakHero(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);

						function killOffNonFighter(fleet, canTakeIntoGroundForces) {
							for (var i = fleet.length - 1; i >= 0; i--) {
								var unit = fleet[i];
								if ((canTakeIntoGroundForces ? notFighterShip : notFighterNorGroundForceShip)(unit)) {
									fleet.splice(i, 1);
									if (unit.sustainDamageHits > 0) {
										var damageGhostIndex = fleet.findIndex(function (ghostCandidate) {
											return ghostCandidate.damageCorporeal === unit;
										});
										if (damageGhostIndex >= 0) {
											fleet.splice(damageGhostIndex, 1);
										}
									}
									return unit;
								}
							}
						}
					},
				},
				{
					name: 'Mentak racial',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {

						function getInflicted(fleet, sideOptions) {
							var firing = fleet.filter(unitIs(game.UnitType.Cruiser));
							if (firing.length < 2)
								firing = firing.concat(fleet.filter(unitIs(game.UnitType.Destroyer)));
							if (firing.length > 2)
								firing = firing.slice(0, 2);
							var boost = 0;
							return rollDice(firing, game.ThrowType.Battle, boost, 0, sideOptions);
						}

						var attackerInflicted = 0;
						var defenderInflicted = 0;
						var aDeadUnits=[];
						var dDeadUnits=[];
						if (options.attacker.race === game.Race.Mentak)
							attackerInflicted = getInflicted(attacker, options.attacker);
						if (options.defender.race === game.Race.Mentak)
							defenderInflicted = getInflicted(defender, options.defender);
						var attackerList = applyDamage(attacker, defenderInflicted, options.attacker);
						var defenderList = applyDamage(defender, attackerInflicted, options.defender);
						aDeadUnits=aDeadUnits.concat(attackerList[1]);
						dDeadUnits=dDeadUnits.concat(defenderList[1]);
						letnevCommander(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						letnevCommander(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						directHit(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						directHit(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						yinFlagship(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						yinAgent(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						yinAgent(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						mentakHero(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						mentakHero(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						
					},
				},
				{
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						/*console.log('defender');
						consoles=[];
						consoles[1]=defender;
						for (i in consoles[1]){
							console.log(consoles[1][i]);
						}*/
						var attackerBarrageUnits = attacker.filter(hasBarrage);
						var defenderBarrageUnits = defender.filter(hasBarrage);
						var attackerReroll= options.attacker.jolnarCommander ? true: false;
						var defenderReroll= options.defender.jolnarCommander ? true: false;

						var attackerExtraDie = 0;
						var defenderExtraDie = 0;
						attackerExtraDie += options.attacker.argentCommander ? 1 : 0;
						attackerExtraDie += options.attacker.argentStrikeWingBarrageA && options.attacker.race !== game.Race.Argent ? 1 : 0;
						defenderExtraDie += options.defender.argentCommander ? 1 : 0;
						defenderExtraDie += options.defender.argentStrikeWingBarrageD && options.defender.race !== game.Race.Argent ? 1 : 0;

						var attackerInflicted = rollDice(attackerBarrageUnits, game.ThrowType.Barrage, 0, attackerReroll, attackerExtraDie, options.attacker);
						var defenderInflicted = rollDice(defenderBarrageUnits, game.ThrowType.Barrage, 0, defenderReroll, defenderExtraDie, options.defender);
						//defenderInflicted += fromAdditionalRoll(defenderFull, game.ThrowType.SpaceCannon, defenderModifier, defenderReroll, options.defender);
						if ((attackerInflicted > defender.filter(unitIsFighter()).length) && options.attacker.race === game.Race.Argent){
							var damages=attackerInflicted-defender.filter(unitIsFighter()).length;
							for (var i=defender.length-1;i>=0;i--){
								var unit = defender[i] || {};
								if (unit.isDamageGhost){
									defender.splice(i,1);
									damages--;
								}
								if (damages<=0)
									break;
							}
						}
						if (defenderInflicted > attacker.filter(unitIsFighter()).length && options.defender.race === game.Race.Argent){
							var damages=defenderInflicted-attacker.filter(unitIsFighter()).length;
							for (var i=attacker.length-1;i>=0;i--){
								var unit = attacker[i] || {};
								if (unit.isDamageGhost){
									attacker.splice(i,1);
									damages--;
								}
								if (damages<=0)
									break;
							}
						}
						/*console.log(attackerInflicted);
						console.log('defender2');
						consoles2=[];
						consoles2[1]=defender;
						for (i in consoles2[1]){
							console.log(consoles2[1][i]);
						}*/
						if (options.attacker.waylay)
							var dDeadUnits = applyBarrageDamage(defender, attackerInflicted, options.defender, True);
						else {
							if (defender.filter(unitIsFighter()).length>=attackerInflicted)
								var dDeadUnits = applyBarrageDamage(defender, attackerInflicted, options.defender, unitIsFighterOrCancelHit());
							else
								var dDeadUnits = applyBarrageDamage(defender, attackerInflicted, options.defender, unitIsFighter());
						}
						if (options.defender.waylay)
							var aDeadUnits  = applyBarrageDamage(attacker, defenderInflicted, options.attacker, True);
						else{
							if (attacker.filter(unitIsFighter()).length>=defenderInflicted)
								var aDeadUnits = applyBarrageDamage(attacker, defenderInflicted, options.attacker, unitIsFighterOrCancelHit());
							else
								var aDeadUnits = applyBarrageDamage(attacker, defenderInflicted, options.attacker, unitIsFighter());
						}
						letnevCommander(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						letnevCommander(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						directHit(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						directHit(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						yinFlagship(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						yinAgent(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						yinAgent(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						mentakHero(aDeadUnits,dDeadUnits,'attacker','defender',attacker,defender,options,input);
						mentakHero(dDeadUnits,aDeadUnits,'defender','attacker',defender,attacker,options,input);
						

						function hasBarrage(unit) {
							return unit.barrageDice !== 0;
						}
						function True(unit) {
							return true;
						}
						function unitIsFighterOrCancelHit(){
							return function (unit) {
								return unit.type === game.UnitType.Fighter || unit.cancelHit;
							}; 
						}
						function unitIsFighter(){
							return function (unit) {
								return unit.type === game.UnitType.Fighter;
							}; 
						}
					},
				},
				{
					name: 'Bombardment',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options,input, initialBombardment) {
						var bombardmentPossible = !options.defender.conventionsOfWar && (
							!defenderFull.some(unitShield(options.attacker.disable)) // either there are no defending PDS or Arborec Mechs
							|| attackerFull.some(unitIs(game.UnitType.WarSun)) // or there are but attacking WarSuns negate their Planetary Shield
							|| options.attacker.race === game.Race.Letnev && attackerFull.some(unitIs(game.UnitType.Flagship)) // Letnev Flagship negates Planetary Shield as well
							|| options.attacker.L1Z1XCommander // L1Z1X Commander ignores all planetary shield
						);
						if (!bombardmentPossible) return;
						
						var attackerModifier = options.defender.bunker ? -4 : 0;
						var reroll= options.attacker.jolnarCommander ? true: false;
						var bombardmentAttacker = attackerFull.filter(hasBombardment);
						if (options.attacker.race === game.Race.L1Z1X){
							var temp=[];
							var thisSideCounters = input[game.SideUnits["attacker"]];
							var counter = thisSideCounters[game.UnitType.Mech] || { count: 0 };
							var max = counter.participants;
							for (unit in bombardmentAttacker){
								if (bombardmentAttacker[unit].type !== game.UnitType.Mech)
									temp.push(bombardmentAttacker[unit]);
								else{
									max-=1;
									if (max>=0)
										temp.push(bombardmentAttacker[unit]);
								}
							}
							bombardmentAttacker=temp;
						}
						if (options.attacker.race === game.Race.L1Z1X && initialBombardment){
							temp = []
							dict = {};
							for (unitType in input[game.SideUnits["attacker"]]){
								dict[unitType] = input[game.SideUnits["attacker"]][unitType].notBombarding;
							}
							for (unit in bombardmentAttacker){
								if (dict[bombardmentAttacker[unit].type] <=0){
									temp.push(bombardmentAttacker[unit]);
								}
								dict[bombardmentAttacker[unit].type]-=1;
							}
							bombardmentAttacker=temp;
						}
						
						var attackerInflicted = rollDice(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier,reroll, 0, options.attacker);
						if (!(!options.attacker.plasmaScoring || (initialBombardment && options.attacker.plasmaScoringFirstRound)))
							attackerInflicted += fromAdditionalRoll(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier, reroll, options.attacker);
						if (options.attacker.argentCommander) 
							attackerInflicted += fromAdditionalRoll(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier, reroll, options.attacker);
						if (options.attacker.argentStrikeWingBombardmentA && options.attacker.race !== game.Race.Argent) 
							attackerInflicted += fromAdditionalRoll(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier, reroll, options.attacker);
						var nonInfantryHits=0;
						var dDeadUnits=[];
						/*for (var i = 0; i < defender.length; i++){
							if (defender[i].type !== game.UnitType.Ground)
								nonInfantryHits+=1;
						}
						if (nonInfantryHits >= attackerInflicted && options.defender.x89Conservative){
							for (var i = defender.length - 1; 0 <= i && 0 < attackerInflicted; i--) {
								if (defender[i].type !== game.UnitType.Ground){
									dDeadUnits.push(defender[i]);
									defender.splice(i, 1);
									attackerInflicted--;
								}
							}
						} else if (options.attacker.x89Omega){
							for (var i = defender.length - 1; 0 <= i && 0 < attackerInflicted; i--) {
								if (defender[i].type === game.UnitType.Ground){
									dDeadUnits.push(defender[i]);
									defender.splice(i, 1);
									attackerInflicted--;
								}
							}
						}*/
						if (initialBombardment && defender.some(unitIs(game.UnitType.Mech)) && options.defender.race === game.Race.Sardakk){
							for (var i = defender.length - 1; 0 <= i && 0 < attackerInflicted; i--) {
								if (defender[i].type !== game.UnitType.Mech){
									dDeadUnits.push(defender[i]);
									defender.splice(i, 1);
									attackerInflicted--;
								}
							}
						}
						for (var i = defender.length - 1; 0 <= i && 0 < attackerInflicted; i--) {
							dDeadUnits.push(defender[i]);
							defender.splice(i, 1);
							attackerInflicted-= options.defender.nonEuclidean && defender[i].damageGhost ? 2 : 1;
						}
						if (options.attacker.x89Omega && dDeadUnits.some(unitIs(game.UnitType.Ground))){
							for (var i = defender.length - 1; 0 <= i; i--) {
								if (defender[i].type === game.UnitType.Ground)
									defender.splice(i, 1);

							}
						}
						if (options.defender.race === game.Race.Sardakk && dDeadUnits.some(unitIsTypeGhost(game.UnitType.Mech)) && !options.attacker.articlesOfWar && !initialBombardment){
							applyDamage(attacker,dDeadUnits.filter(unitIsTypeGhost(game.UnitType.Mech)).length, options.attacker);
						}
						
						letnevCommander(dDeadUnits,[],'defender','attacker',defender,attacker,options,input);
						function hasBombardment(unit) {
							return unit.bombardmentDice !== 0;
						}
					},
				},
				{
					name: 'Space Cannon -> Ground Forces',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						if (options.attacker.l4Disruptors) return;

						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var spaceCannonUnits = defenderFull.filter(groundForceSpaceCannon);
						var reroll= options.defender.jolnarCommander ? true: false;
						var defenderInflicted = rollDice(spaceCannonUnits, game.ThrowType.SpaceCannon, defenderModifier, reroll, 0, options.defender);

						if (options.defender.plasmaScoring) 
							defenderInflicted += fromAdditionalRoll(spaceCannonUnits, game.ThrowType.SpaceCannon, defenderModifier, reroll, options.defender);
						if (options.defender.argentCommander) 
							defenderInflicted += fromAdditionalRoll(spaceCannonUnits, game.ThrowType.SpaceCannon, defenderModifier, reroll, options.defender);
						if (options.defender.argentStrikeWingSpaceCannonD && options.defender.race !== game.Race.Argent) 
							defenderInflicted += fromAdditionalRoll(spaceCannonUnits, game.ThrowType.SpaceCannon, defenderModifier, reroll, options.defender);
						if (options.attacker.maneuveringJets && defenderInflicted > 0)
							defenderInflicted--;

						var aDeadUnits =applyDamage(attacker, defenderInflicted, options.attacker);

						letnevCommander(aDeadUnits,[],'attacker','defender',attacker,defender,options,input);
					},
				},
				{
					name: 'Dunlain Mechs',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						if (!attacker.some(unitIs(game.UnitType.Ground)) && !defender.some(unitIs(game.UnitType.Ground))) return;
						if (options.attacker.race === game.Race.Letnev && options.attacker.dunlainMechs)
							upgradeGround('attacker','defender',options,attacker,defender,input)
						if (options.defender.race === game.Race.Letnev && options.defender.dunlainMechs){
							upgradeGround('defender','attacker',options,defender,attacker,input)
						}
						function upgradeGround(mySide,opponentSide,options,myFleet,opponentFleet,input) {
							if (myFleet.filter(unitIs(game.UnitType.Mech)).length < 4 && myFleet.some(unitIs(game.UnitType.Ground))){
								for (var i = myFleet.length-1; i >= 0; i--) {
									var unit = myFleet[i];
									if (unit.type == game.UnitType.Ground){
										myFleet.splice(i, 1);
										addUnitBasedOnRace(game.UnitType.Mech,mySide,opponentSide,options,myFleet,opponentFleet,input)
										organizeFleet(myFleet,mySide,options,input);
										return;
									}
								}
							}
							return;
						}
					},
				},
			];

			function fromAdditionalRoll(fleet, throwType, modifier, reroll, side) {
				var bestUnit = getUnitWithLowest(fleet, game.ThrowValues[throwType]);
				if (bestUnit) {
					var unitWithOneDie = bestUnit.clone();
					unitWithOneDie[game.ThrowDice[throwType]] = 1;
					return rollDice([unitWithOneDie], throwType, modifier, reroll, 0, side);
				}
				return 0;
			}
		}

		function boost(battleType, round, sideOptions, fleet, opponentOptions) {
			var result = 0;
			for (var i = 0; i < boosts.length; i++) {
				var boost = boosts[i].apply(battleType, round, sideOptions, fleet, opponentOptions);
				if (boost && !result) {
					result = boost;
					continue;
				}
				if (boost) {
					result = compose(result, boost);
				}
			}
			return result;

			function compose(boost1, boost2) {
				var boost1IsFunction = typeof boost1 === 'function';
				var boost2IsFunction = typeof boost2 === 'function';
				if (boost1IsFunction || boost2IsFunction) {
					return function (unit) {
						return (boost1IsFunction ? boost1(unit) : boost1) +
							(boost2IsFunction ? boost2(unit) : boost2);
					};
				}
				else {
					return boost1 + boost2;
				}
			}
		}

		function initBoosts() {
			return [
				{
					name: 'moraleBoost',
					apply: function (battleType, round, sideOptions) {
						return round === 1 && sideOptions.moraleBoost ? 1 : 0;
					}
				},
				{
					name: 'fighterPrototype',
					apply: function (battleType, round, sideOptions) {
						return round === 1 && battleType === game.BattleType.Space && sideOptions.fighterPrototype ?
							function (unit) {
								return unit.type === game.UnitType.Fighter ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'Sardakk',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.race === game.Race.Sardakk ? 1 : 0;
					}
				},
				{
					name: 'Sardakk Flagship',
					apply: function (battleType, round, sideOptions, fleet,fleetFull) {
						return sideOptions.race === game.Race.Sardakk && battleType === game.BattleType.Space &&
						fleet.some(unitIs(game.UnitType.Flagship))
							? function (unit) {
								return unit.type !== game.UnitType.Flagship ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'JolNar',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.race === game.Race.JolNar ? -1 : 0;
					}
				},
				{
					name: 'prophecyOfIxth',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.prophecyOfIxth ?
							function (unit) {
								return unit.type === game.UnitType.Fighter ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'tekklarLegion',
					apply: function (battleType, round, sideOptions) {
						return battleType === game.BattleType.Ground && sideOptions.tekklarLegion && sideOptions.race !== game.Race.Sardakk ? 1 : 0;
					}
				},
				{
					name: 'tekklarLegion of the opponent',
					apply: function (battleType, round, sideOptions, fleet, opponentOptions) {
						return battleType === game.BattleType.Ground && opponentOptions.tekklarLegion && sideOptions.race === game.Race.Sardakk ? -1 : 0;
					}
				},
				{
					name: 'naaluMech+2',
					apply: function (battleType, round, sideOptions) {
						return (sideOptions.opponentRelicFragment && !sideOptions.articlesOfWar) ?
							function (unit) {
								return unit.type === game.UnitType.Mech ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'nekroMech+2',
					apply: function (battleType, round, sideOptions) {
						return (sideOptions.opponentTech && !sideOptions.articlesOfWar) ?
							function (unit) {
								return unit.type === game.UnitType.Mech ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'Jol-NarMechGroundForce',
					apply: function (battleType,round, sideOptions, fleet, opponentOptions) {
						// Having Jol-nar Mech and not fragile not taken into account
						return (sideOptions.race === game.Race.JolNar && battleType === game.BattleType.Ground && 
							fleet.some(unitIs(game.UnitType.Mech)) && !sideOptions.articlesOfWar) ?
							function (unit) {
								return unit.type === game.UnitType.Ground ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'mahactFlagship+2',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.opponentNoToken ?
							function (unit) {
								return unit.type === game.UnitType.Flagship ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'naazrokhaMechSpace',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.race === game.Race.NaazRokha && battleType === game.BattleType.Space ?
							function (unit) {
								return unit.type === game.UnitType.Mech ? -2 : 0;
							} : 0;
					}
				},
				{
					name: 'winnuCommander',
					apply: function (battleType, round, sideOptions) {
						return sideOptions.winnuCommander ? 2 : 0;
					}
				},
				{
					name: 'nebula',
					apply: function (battleType, round, sideOptions) {
						return (sideOptions.nebula && battleType === game.BattleType.Space) ? 1 : 0;
					}
				},
				{
					name: 'supercharger',
					firstRoundOnly: true,
					apply: function (battleType, round, sideOptions) {
						return sideOptions.supercharger ? 1 : 0;
					}
				},
			];
		}
		function boostRoll(battleType, round, sideOptions, fleet, opponentOptions,fleetFull) {
			var result = 0;
			
			for (var i = 0; i < boostsRoll.length; i++) {
				var boost = boostsRoll[i].apply(battleType, round, sideOptions, fleet, opponentOptions,fleetFull);
				if (boost && !result) {
					result = boost;
					continue;
				}
				if (boost) {
					result = compose(result, boost);
				}
			}
			return result;

			function compose(boost1, boost2) {
				var boost1IsFunction = typeof boost1 === 'function';
				var boost2IsFunction = typeof boost2 === 'function';
				if (boost1IsFunction || boost2IsFunction) {
					return function (unit) {
						return (boost1IsFunction ? boost1(unit) : boost1) +
							(boost2IsFunction ? boost2(unit) : boost2);
					};
				}
				else {
					return boost1 + boost2;
				}
			}
		}
		function initExtraRolls() {
			return [
				{
					name: 'naazRokhaFlagshipMechs',
					apply: function (battleType, round, sideOptions, fleet, opponentOptions,fleetFull) {
						return sideOptions.race === game.Race.NaazRokha  &&
						fleetFull.some(unitIs(game.UnitType.Flagship)) ?
							function (unit) {
								return unit.type === game.UnitType.Mech ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'baronyAgent',
					apply: function (battleType, round, sideOptions, fleet, opponentOptions) {
						return (sideOptions.letnevAgent && round === 1 && battleType === game.BattleType.Space) ?
							function (unit) {
								return unit === getUnitWithLowest(fleet, game.ThrowValues[game.ThrowType.Battle]) ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'federationAgent',
					apply: function (battleType, round, sideOptions, fleet, opponentOptions) {
						return (sideOptions.solAgent && round === 1 && battleType === game.BattleType.Ground) ?
							function (unit) {
								return unit === getUnitWithLowest(fleet, game.ThrowValues[game.ThrowType.Battle]) ? 1 : 0;
							} : 0;
					}
				},
			]
		}
		function groundForceSpaceCannon(unit) {
			return unit.spaceCannonDice !== 0 && (unit.type === game.UnitType.Mech || unit.type === game.UnitType.Ground || unit.type === game.UnitType.PDS);
		}
		function getUnitWithLowest(fleet, property) {
			var result = null;
			var bestBattleValue = Infinity;
			for (var i = 0; i < fleet.length; i++) {
				if (fleet[i][property] < bestBattleValue) {
					result = fleet[i];
					bestBattleValue = fleet[i][property];
				}
			}
			return result;
		}
		function unitIs(unitType) {
			return function (unit) {
				return unit.type === unitType && !unit.isDamageGhost;
			};
		}
		function unitIsTypeGhost(unitType) {
			return function (unit){
				return unit.type === unitType && unit.isDamageGhost;
			}
		}
		function unitShield(disable) {
			return function (unit) {
				return unit.planetaryShield && !unit.isDamageGhost && (!disable || (disable && unit.type !== game.UnitType.PDS));
			};
		}
		function notFighterShip(unit) {
			return unit.type !== game.UnitType.Fighter && !unit.isDamageGhost && unit.typeShip;
		}

		function notFighterNorGroundForceShip(unit) {
			return unit.type !== game.UnitType.Fighter && unit.typeGroundForce && !unit.isDamageGhost;
		}

		function sum(a, b) {
			return a + b;
		}
		function unitsEqual(unit1,unit2){
			for (key in unit1){
				if (unit1.key != unit2.key){
					return false;
				}
			}
			return true;
		}
		function yinFlagship(myDeadUnits,opponentDeadUnits,mySide,opponentSide,myFleet,opponentFleet,option,input){
			if (option[mySide].race === game.Race.Yin && myDeadUnits.some(unitIs(game.UnitType.Flagship))
				|| option[opponentSide].race === game.Race.Yin && opponentDeadUnits.some(unitIs(game.UnitType.Flagship))){
				myDeadUnits=myDeadUnits.concat(myFleet);
				opponentDeadUnits=opponentDeadUnits.concat(opponentFleet);
				myFleet.splice(0);
				opponentFleet.splice(0);
			}
		}
		function yinAgent(myDeadUnits,opponentDeadUnits,mySide,opponentSide,myFleet,opponentFleet,option,input){
			if (root.tgs[mySide].yinAgentUses>0){
				if (myDeadUnits.some(unitIs(game.UnitType.Cruiser)) || myDeadUnits.some(unitIs(game.UnitType.Destroyer))){
					addUnitBasedOnRace(game.UnitType.Fighter,mySide,opponentSide,option,myFleet,opponentFleet,input);
					addUnitBasedOnRace(game.UnitType.Fighter,mySide,opponentSide,option,myFleet,opponentFleet,input);
					organizeFleet(myFleet,mySide,option,input);
					tgs[mySide].yinAgentUses-=1;
				}
			}
		}
		function mentakHero(myDeadUnits,opponentDeadUnits,mySide,opponentSide,myFleet,opponentFleet,option,input){
			if (option[mySide].mentakHero){
				for (deadUnit in opponentDeadUnits){
					if (!opponentDeadUnits[deadUnit].isDamageGhost){
						addUnitBasedOnRace(opponentDeadUnits[deadUnit].type,mySide,opponentSide,option,myFleet,opponentFleet,input);
						organizeFleet(myFleet,mySide,option,input);
					}
				}
			}
		}
		function letnevCommander(myDeadUnits,opponentDeadUnits,mySide,opponentSide,myFleet,opponentFleet,option,input){
			if (option[mySide].letnevCommander){
				for (deadUnit in myDeadUnits){
					if (myDeadUnits[deadUnit].isDamageGhost){
						root.tgs[mySide].tg++;
					}
				}
			}
		}
		function directHit(myDeadUnits,opponentDeadUnits,mySide,opponentSide,myFleet,opponentFleet,option,input){
			var temp=[];
			var removeUnit;
			var opponentSideCounters = input[root.SideUnits[opponentSide]];
			if (root.tgs[mySide].directHitUses>0){
				for (var i=opponentDeadUnits.length-1; i>=0; i--){
					removeUnit= opponentDeadUnits[i].damageCorporeal;
					if (opponentDeadUnits[i].isDamageGhost && root.tgs[mySide].directHitUses>0 && removeUnit.typeShip && !(removeUnit.type === UnitType.Dreadnought && ((opponentSideCounters[UnitType.Dreadnought] || {}).upgraded))){
						root.tgs[mySide].directHitUses-=1;
						opponentFleet.splice(opponentFleet.indexOf(removeUnit),1);
						temp.push(removeUnit);
					}
				}
			}
			opponentDeadUnits.concat(temp);
			organizeFleet(opponentDeadUnits,opponentSide,option,input);
		}
		function addUnitBasedOnRace(deadUnitType,battleSide,opponentSide,options,fleet,opponentFleet,input){
			if (!deadUnitType) return;
			var thisSideCounters = input[root.SideUnits[battleSide]];
			var counter = thisSideCounters[deadUnitType] || { count: 0 , upgraded:false};
			var standardUnits = root.MergedUnits[options[battleSide].race];
			var upgradedUnits = root.MergedUpgrades[options[battleSide].race];
			var unit = (counter.upgraded ? upgradedUnits : standardUnits)[deadUnitType];
			var opponentMentakFlagship = input.battleType === root.BattleType.Space && options[opponentSide].race === root.Race.Mentak && opponentFleet.some(unitIs(game.UnitType.Flagship));
			var opponentMentakMech = input.battleType === root.BattleType.Ground && options[opponentSide].race === root.Race.Mentak && opponentFleet.some(unitIs(game.UnitType.Mech));
			fleet.push(unit);
			if (unit.sustainDamageHits > 0 &&
				!opponentMentakFlagship &&
				!opponentMentakMech &&
				!(unit.type === game.UnitType.WarSun && options[battleSide].publicizeSchematics) &&
				!(unit.type === game.UnitType.Mech && options[battleSide].race===root.Race.NaazRokha && input.battleType===root.BattleType.Space)
			) {
				fleet.push(unit.toDamageGhost());
			}
		}
		function organizeFleet(fleet,battleSide,option,input){
			var virusFlagship = input.battleType === root.BattleType.Space && option[battleSide].race === root.Race.Virus && fleet.some(unitIs(game.UnitType.Flagship)) && !option[battleSide].memoriaII;
			var naaluFlagship = input.battleType === root.BattleType.Ground && option[battleSide].race === root.Race.Naalu && (input[root.SideUnits[battleSide]][game.UnitType.Flagship] || { count: 0 }).count !== 0;
			var thisSideCounters = input[root.SideUnits[battleSide]];
			var thisSideOptions=option[battleSide];
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
			fleet.sort(comparer);
			fleet.comparer = comparer;

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
		}
	})();
})(typeof exports === 'undefined' ? window : exports);
