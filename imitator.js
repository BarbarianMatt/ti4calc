(function (root) {

	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
	} else {
		structs = window;
		game = window;
	}

	root.imitationIterations = 20000;
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
			var result = new structs.EmpiricalDistribution();
			var finalAttacker = game.expandFleet(input, game.BattleSide.attacker).filterForBattle()
				.map(function (unit) { return [unit.shortType]; });
			var finalDefender = game.expandFleet(input, game.BattleSide.defender).filterForBattle()
				.map(function (unit) { return [unit.shortType]; });
			var defaultValues = { attacker: {tgsEarned:0, yinAgentUses:0, reflectiveShieldingUses:0, directHitUses:0, tgsSpent:0}, 
								defender: {tgsEarned:0, yinAgentUses:0, reflectiveShieldingUses:0, directHitUses:0, tgsSpent:0},
								rounds: 0 };
			root.storedValues = defaultValues;
			for (var i = 0; i < root.imitationIterations; ++i) {
				var attacker = game.expandFleet(input, game.BattleSide.attacker);
				var defender = game.expandFleet(input, game.BattleSide.defender);

				root.storedValues.attacker.yinAgentUses=options.attacker.yinAgentUses;
				root.storedValues.attacker.reflectiveShieldingUses=options.attacker.reflectiveShieldingUses;
				root.storedValues.attacker.directHitUses=options.attacker.directHitUses;
				root.storedValues.defender.yinAgentUses=options.defender.yinAgentUses;
				root.storedValues.defender.reflectiveShieldingUses=options.defender.reflectiveShieldingUses;
				root.storedValues.defender.directHitUses=options.defender.directHitUses;
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
			storedValues.attacker.tgsEarned = (storedValues.attacker.tgsEarned===0 || storedValues.attacker.tgsEarned===null) ? null: (storedValues.attacker.tgsEarned/root.imitationIterations).toFixed(2)  + " EA";
			storedValues.defender.tgsEarned = (storedValues.defender.tgsEarned===0 || storedValues.defender.tgsEarned===null) ? null: (storedValues.defender.tgsEarned/root.imitationIterations).toFixed(2)  + " ED";

			storedValues.attacker.tgsSpent = (storedValues.attacker.tgsSpent===0 || storedValues.attacker.tgsSpent===null) ? null: (storedValues.attacker.tgsSpent/root.imitationIterations).toFixed(2) + " SA";
			storedValues.defender.tgsSpent = (storedValues.defender.tgsSpent===0 || storedValues.defender.tgsSpent===null) ? null: (storedValues.defender.tgsSpent/root.imitationIterations).toFixed(2) + " SD";
			storedValues.rounds = storedValues.rounds/root.imitationIterations;
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
			},storedValues];
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
							(attacker.length && defender.length);
					} else
						throw new Error('first pre-battle action not Space Cannon -> Ships');
				}
				else if (i === 5) {
					if (action.name === 'Space Cannon -> Ground Forces') {
						// if last unit's are destroyed by Mentak racial ability or Assault Cannon or Barrage,
						// make sure "after combat round" effects still occur
						doAtLeastOneRound = battleType === game.BattleType.Ground &&
							(attacker.length && defender.length);
					} else
						throw new Error('first pre-battle action not Space Cannon -> Ground Forces');
				}
			}
			attacker.sort(attacker.comparer);
			defender.sort(defender.comparer);
			var round = 0;
			var losePlanetaryDefender = attackerFull.some(unitIs(game.UnitType.WarSun)) || (attackerFull.some(unitIs(game.UnitType.Flagship)) && options.attacker.race === game.Race.Letnev);
			var losePlanetaryAttacker = defenderFull.some(unitIs(game.UnitType.WarSun)) || (defenderFull.some(unitIs(game.UnitType.Flagship)) && options.defender.race === game.Race.Letnev);
			var magenDefenseActivatedDefender = battleType === game.BattleType.Ground &&
				options.defender.magenDefense &&
				defenderFull.some(unitShield(options.attacker.disable)) &&
				!losePlanetaryDefender;
			
			var magenDefenseActivatedAttacker = battleType === game.BattleType.Ground &&
				options.attacker.magenDefense &&
				attackerFull.some(unitShield(options.defender.disable)) &&
				!losePlanetaryAttacker;
			while (hasUnits(attacker) && hasUnits(defender) || (doAtLeastOneRound && round === 0)) {
				round++;
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
				storedValues.attacker.tgsSpent+= options.attacker.race === game.Race.Letnev && options.attacker.munitions ? 2 : 0;
				storedValues.defender.tgsSpent+= options.defender.race === game.Race.Letnev && options.defender.munitions ? 2 : 0;
				if (round === 1) {
					attackerReroll = options.attacker.fireTeam && battleType === game.BattleType.Ground ||
						options.attacker.letnevMunitionsFunding && battleType === game.BattleType.Space ||
						options.attacker.munitions && battleType === game.BattleType.Space;
					defenderReroll = options.defender.fireTeam && battleType === game.BattleType.Ground ||
						options.defender.letnevMunitionsFunding && battleType === game.BattleType.Space||
						options.defender.munitions && battleType === game.BattleType.Space;
					storedValues.attacker.tgsSpent+= options.attacker.race === game.Race.Letnev && options.attacker.letnevMunitionsFunding && !options.attacker.munitions ? 2 : 0;
					storedValues.defender.tgsSpent+= options.defender.race === game.Race.Letnev && options.defender.letnevMunitionsFunding && !options.defender.munitions ? 2 : 0;
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
				var attackerRolling = options.attacker.daxcive ? attackerFull.filterForBattle() : attacker;
				if (options.attacker.race === game.Race.L1Z1X && attacker.some(unitIs(game.UnitType.Flagship))) {
					attackerInflictedToNonFighters = rollDice(attackerRolling.filter(flagshipOrDreadnought), game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker);
					attackerInflictedToEverything = rollDice(attackerRolling.filter(not(flagshipOrDreadnought)), game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker);
				} else
					attackerInflictedToEverything = rollDice(attackerRolling, game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker);
				if (options.defender.race === game.Race.L1Z1X && defender.some(unitIs(game.UnitType.Flagship))) {
					defenderInflictedToNonFighters = rollDice(defender.filter(flagshipOrDreadnought), game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender);
					defenderInflictedToEverything = rollDice(defender.filter(not(flagshipOrDreadnought)), game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender);
				} else
					defenderInflictedToEverything = rollDice(defender, game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender);
				/*console.log(JSON.parse(JSON.stringify(attackerRolling)));
				console.log(JSON.parse(JSON.stringify(defender)));
				console.log("attacker damage: " + JSON.parse(JSON.stringify(attackerInflictedToEverything)));
				console.log("defender damage: " + JSON.parse(JSON.stringify(defenderInflictedToEverything)));*/
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
				[attackerInflictedToNonFighters,defenderInflictedToNonFighters]=sustainDamageStep(attacker, attackerInflictedToNonFighters, defender, defenderInflictedToNonFighters,
				true, [null,notFighterShip(true)], [null,notFighterShip(true)], options,input);
				[attackerInflictedToEverything,defenderInflictedToEverything]=sustainDamageStep(attacker, attackerInflictedToEverything, defender, defenderInflictedToEverything,
				true, [null,null], [null,null], options,input);
				
				var A1 = applyDamage(attacker, defenderInflictedToNonFighters, options.attacker, null, notFighterShip(true));
				var A2 = applyDamage(attacker, defenderInflictedToEverything, options.attacker);
				var D1 = applyDamage(defender, attackerInflictedToNonFighters, options.defender, null, notFighterShip(true));
				var D2 = applyDamage(defender, attackerInflictedToEverything, options.defender);
				/*console.log(JSON.parse(JSON.stringify(attacker)));
				console.log(JSON.parse(JSON.stringify(defender)));
				console.log("end");*/
				var aDeadUnits=A1.concat(A2);
				var dDeadUnits=D1.concat(D2);

				destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,true,options,input);


				if (options.attacker.duraniumArmor)
					repairUnit(attacker);
				if (options.defender.duraniumArmor)
					repairUnit(defender);
				//console.log(JSON.parse(JSON.stringify(defender)));
				if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) { // Harrow
					// https://www.reddit.com/r/twilightimperium/comments/g82tk6/ground_combat_when_one_side_didnt_come/
					// https://boardgamegeek.com/thread/2286628/does-ground-combat-still-occur-if-invading-ground
					actions.find(function (a) {
						return a.name === 'Bombardment';
					}).execute(attacker, defender, attackerFull, defenderFull, options, input, false);
				}
				//console.log(JSON.parse(JSON.stringify(defender)));
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
					aDeadUnits = attacker.splice(0);
					destroyedUnits(aDeadUnits,[],attacker,defender,true,options,input);
				}
				if (round === 1 && battleType === game.BattleType.Space && options.defender.rout && hasUnits(defender)){
					attacker.splice(0);
					break;
				}
			}
			root.storedValues.rounds+=round;
			return { attacker: attacker, defender: defender };
	
			
			function winnuFlagships(fleet, sideOptions, opposingFleet) {
				if (battleType === game.BattleType.Space && sideOptions.race === game.Race.Winnu) {
					// according to https://boardgamegeek.com/thread/1916774/nekrowinnu-flagship-interaction
					var battleDice = opposingFleet.filter(notFighterShip(true)).length;
					// In the game there could be only one flagship, but why the hell not)
					fleet.filter(unitIs(game.UnitType.Flagship)).forEach(function (flagship) {
						flagship.battleDice = battleDice;
					});
				}
			}

			function flagshipOrDreadnought(unit) {
				return unit.type === game.UnitType.Flagship || unit.type === game.UnitType.Dreadnought;
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

		function applyDamage(fleet, hits, sideOptions, hardPredicate, softPredicate) {
			hardPredicate = hardPredicate || function (unit) {
				return true;
			};
			var deadUnits=[];
			for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
				if (hardPredicate(fleet[i]) && (!softPredicate || softPredicate(fleet[i]))) {
					var killed = hit(i);
					deadUnits.push(killed);
				}
			}
			if (softPredicate) {
				for (var i = fleet.length - 1; 0 <= i && 0 < hits; i--) {
					if (hardPredicate(fleet[i])) {
						var killed = hit(i);
						deadUnits.push(killed);
					}
				}
			}
			return deadUnits;

			function hit(i) {
				var killed = fleet.splice(i, 1)[0];
				hits--;
				return killed;
			}
		}

		function sustainDamageStep(attackerFleet, attackerHits, defenderFleet, defenderHits, combat, attackerPredicates, defenderPredicates, options, input) {
			var aPass = true;
			var dPass = true;
			var aSustains=[];
			var dSustains=[];
			attackerPredicates[0] = attackerPredicates[0] || function () {
				return function (unit) {
					return true;
				}
			};
			defenderPredicates[0] = defenderPredicates[0] || function () {
				return function (unit) {
					return true;
				}
			};
			while (true){
				[aPass,attackerHits,defenderHits,attackerUnit] = searchForSustainDamage(attackerFleet,attackerHits, defenderHits,"attacker", attackerPredicates[0], attackerPredicates[1]);
				[dPass,defenderHits,attackerHits,defenderUnit] = searchForSustainDamage(defenderFleet,defenderHits,attackerHits,"defender", defenderPredicates[0], defenderPredicates[1]);
				if (attackerUnit)
					aSustains.push(attackerUnit);
				if (defenderUnit)
					dSustains.push(defenderUnit)
				if (!aPass && !dPass){
					if (directHits(aSustains,attackerFleet,"defender","attacker",options,input) && directHits(dSustains,defenderFleet,"attacker","defender",options,input))
						break;
				}
			}
			return [attackerHits,defenderHits];

			function searchForSustainDamage(fleet,myHits,opponentHits,mySide, hardPredicate, softPredicate){
				for (var i = fleet.length - 1; Math.max(fleet.length - opponentHits,0) <= i && 0 < opponentHits; i--) {
					var unit = fleet[i];
					if (unit.isDamageGhost && (combat || unit.typeGroundForce) && hardPredicate(unit) && (!softPredicate || softPredicate(unit))){
						if (options[mySide].letnevCommander)
							root.storedValues[mySide].tgsEarned++;
						opponentHits=Math.max(opponentHits-(options[mySide].nonEuclidean ? 2 : 1),0);
						unit.damageCorporeal.damaged = true;
						unit.damageCorporeal.damagedThisRound = true;
						fleet.splice(fleet.indexOf(unit),1);
						sustainDamageEffects(unit);
						return [true,myHits,opponentHits,unit];
					}
				}
				if (softPredicate){
					for (var i = fleet.length - 1; 0 <= i && 0 < opponentHits; i--) {
						var unit = fleet[i];
						if (unit.isDamageGhost && (combat || unit.typeGroundForce) && hardPredicate(unit)){
							if (options[mySide].letnevCommander)
								root.storedValues[mySide].tgsEarned++;
							opponentHits=Math.max(opponentHits-(options[mySide].nonEuclidean ? 2 : 1),0);
							unit.damageCorporeal.damaged = true;
							unit.damageCorporeal.damagedThisRound = true;
							fleet.splice(fleet.indexOf(unit),1);
							sustainDamageEffects(unit);
							return [true,myHits,opponentHits,unit];
						}
					}
				}
				return [false,myHits,opponentHits,null];

				function sustainDamageEffects(unit){
					if (root.storedValues[mySide].reflectiveShieldingUses > 0 && combat && unit.typeShip){
						myHits+=2;
						root.storedValues[mySide].reflectiveShieldingUses--;
					}
					if (options[mySide].race === root.Race.Sardakk && unit.type === game.UnitType.Mech && combat && !options[mySide].articlesOfWar)
						myHits++;
				}
			}

			function directHits(opponentSustains,opponentFleet,mySide,opponentSide,options,input){
				if (root.storedValues[mySide].directHitUses>0){
					organizeFleet(opponentSustains,opponentSide,options,input);
					//console.log(JSON.parse(JSON.stringify(opponentSustains)));
					for (var i = 0; i < opponentSustains.length && i < root.storedValues[mySide].directHitUses;i++){
						var unit = opponentSustains[i].damageCorporeal;

						if (unit && unit.typeShip && (unit.type !== game.UnitType.Dreadnought || !(input[root.SideUnits[opponentSide]][UnitType.Dreadnought] || {}).upgraded)){
							var destroyedUnit=opponentFleet.splice(opponentFleet.indexOf(unit),1);
							root.storedValues[mySide].directHitUses--;
							if (mySide ==="attacker")
								destroyedUnits([],[destroyedUnit], attackerFleet, defenderFleet,combat,options,input);
							else 
								destroyedUnits([destroyedUnit],[],attackerFleet, defenderFleet, combat, options,input);
							return false;
						}
					}
				}
				return true;
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
					if (thisSideOptions.infiniteTG && rollResult+modifierFunction(unit)+1===battleValue && throwType===game.ThrowType.Battle){
						rollResult+=1;
						storedValues[thisSideOptions.side].tgsSpent++;
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
		
		function moreDieForStrongestUnit(fleet, throwType, dice){
			return function(unit) {
				return (unit === getUnitWithLowest(fleet, game.ThrowValues[throwType])) ? dice : 0;
			}
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
						var attackerReroll= options.attacker.jolnarCommander;
						var attackerAdditional = options.attacker.plasmaScoring ? 1 : 0;
						attackerAdditional += options.attacker.argentCommander ? 1 : 0;
						attackerAdditional += options.attacker.argentStrikeWingSpaceCannonA && options.attacker.race !== game.Race.Argent ? 1 : 0;
						var attackerInflicted = rollDice(attackerFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, attackerModifier, attackerReroll, moreDieForStrongestUnit(attackerFull, game.ThrowType.SpaceCannon, attackerAdditional), options.attacker);
						attackerInflicted= options.defender.solarFlare || (defender.some(unitIs(game.UnitType.Flagship)) && options.defender.race === game.Race.Argent) ? 0 : Math.max(attackerInflicted- (options.defender.maneuveringJets ? 1 : 0),0);
						attackerInflicted = options.attacker.noSpaceCannon ? 0 : attackerInflicted;

						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var defenderReroll= options.defender.jolnarCommander ;
						var defenderAdditional = options.defender.plasmaScoring ? 1 : 0;
						defenderAdditional += options.defender.argentCommander ? 1 : 0;
						defenderAdditional += options.defender.argentStrikeWingSpaceCannonD && options.defender.race !== game.Race.Argent ? 1 : 0;
						var defenderInflicted = rollDice(defenderFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, defenderModifier, defenderReroll, moreDieForStrongestUnit(defenderFull, game.ThrowType.SpaceCannon, defenderAdditional), options.defender);
						defenderInflicted= options.attacker.solarFlare || (attacker.some(unitIs(game.UnitType.Flagship)) && options.attacker.race === game.Race.Argent) ? 0 : Math.max(defenderInflicted-(options.attacker.maneuveringJets ? 1 : 0),0);
						defenderInflicted = options.defender.noSpaceCannon ? 0 : defenderInflicted;
						
						var attackerPredicate = options.attacker.gravitonLaser ? notFighterShip(false) : null;
						var defenderPredicate = options.defender.gravitonLaser ? notFighterShip(false) : null;
						[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, false,
						[null,attackerPredicate], [null,defenderPredicate], options,input);
						
						var aDeadUnits = applyDamage(defender, attackerInflicted, options.defender, validUnit(false), attackerPredicate);
						var dDeadUnits = applyDamage(attacker, defenderInflicted, options.attacker, validUnit(false), defenderPredicate);
						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,false,options,input);
						
						if (defenderInflicted)
							markDamagedNotThisRound(attacker);
						if (attackerInflicted)
							markDamagedNotThisRound(defender);

						function hasSpaceCannon(unit) {
							return unit.spaceCannonDice !== 0;
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

						if (options.attacker.assaultCannon && attacker.filter(notFighterShipNorGhost(true)).length >= 3){
							var defenderVictim = killOffNonFighter(defender);
							destroyedUnits([],[defenderVictim],attacker,defender,true,options,input);
						}
						if (options.defender.assaultCannon && defender.filter(notFighterShipNorGhost(true)).length >= 3) {
							var attackerVictim = killOffNonFighter(attacker);
							destroyedUnits([attackerVictim],[],attacker,defender,true,options,input);
						}

						function killOffNonFighter(fleet) {
							for (var i = fleet.length - 1; i >= 0; i--) {
								var unit = fleet[i];
								if (notFighterShipNorGhost(true)(unit)) {
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
							return rollDice(firing, game.ThrowType.Battle, null, null, null, sideOptions);
						}

						var attackerInflicted = 0;
						var defenderInflicted = 0;
						if (options.attacker.race === game.Race.Mentak)
							attackerInflicted = getInflicted(attacker, options.attacker);
						if (options.defender.race === game.Race.Mentak)
							defenderInflicted = getInflicted(defender, options.defender);
						[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, true, [null,null], [null,null], options,input);
						var aDeadUnits = applyDamage(attacker, defenderInflicted, options.attacker);
						var dDeadUnits = applyDamage(defender, attackerInflicted, options.defender);
						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,true,options,input);
					},
				},
				{
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						var attackerBarrageUnits = attacker.filter(hasBarrage);
						var defenderBarrageUnits = defender.filter(hasBarrage);
						var attackerReroll= options.attacker.jolnarCommander;
						var defenderReroll= options.defender.jolnarCommander;

						var attackerExtraDie = options.attacker.argentCommander ? 1 : 0;
						attackerExtraDie += options.attacker.argentStrikeWingBarrageA && options.attacker.race !== game.Race.Argent ? 1 : 0;
						var defenderExtraDie = options.defender.argentCommander ? 1 : 0;
						defenderExtraDie += options.defender.argentStrikeWingBarrageD && options.defender.race !== game.Race.Argent ? 1 : 0;

						var attackerInflicted = rollDice(attackerBarrageUnits, game.ThrowType.Barrage, 0, attackerReroll, moreDieForStrongestUnit(attackerBarrageUnits, game.ThrowType.Barrage, attackerExtraDie), options.attacker);
						attackerInflicted = options.attacker.noBarrage ? 0 : attackerInflicted;
						var defenderInflicted = rollDice(defenderBarrageUnits, game.ThrowType.Barrage, 0, defenderReroll, moreDieForStrongestUnit(defenderBarrageUnits, game.ThrowType.Barrage, defenderExtraDie), options.defender);
						defenderInflicted = options.defender.noBarrage ? 0 : defenderInflicted;

						if ((attackerInflicted > defender.filter(unitIsFighter()).length) && options.attacker.race === game.Race.Argent){
							var damages=attackerInflicted-defender.filter(unitIsFighter()).length;
							for (var i=defender.length-1; i>=0 || damages>0; i--){
								var unit = defender[i] || {};
								if (unit.isDamageGhost){
									unit.damageCorporeal.damaged = true;
									unit.damageCorporeal.damagedThisRound = true;
									defender.splice(i,1);
									damages--;
								}
							}
						}

						if (defenderInflicted > attacker.filter(unitIsFighter()).length && options.defender.race === game.Race.Argent){
							var damages=defenderInflicted-attacker.filter(unitIsFighter()).length;
							for (var i = attacker.length - 1 ; i >= 0 || damages>0; i--){
								var unit = attacker[i] || {};
								if (unit.isDamageGhost){
									unit.damageCorporeal.damaged = true;
									unit.damageCorporeal.damagedThisRound = true;
									attacker.splice(i,1);
									damages--;
								}
							}
						}
						var attackerPredicate = options.defender.waylay ? null : (attacker.filter(unitIsFighter()).length>=defenderInflicted ? unitIsFighterOrCancelHit() : unitIsFighter());
						var defenderPredicate = options.attacker.waylay ? null : (defender.filter(unitIsFighter()).length>=attackerInflicted ? unitIsFighterOrCancelHit() : unitIsFighter());
						[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, true, 
						[attackerPredicate, null], [defenderPredicate, null], options,input);
						var dDeadUnits = applyDamage(defender, attackerInflicted, options.attacker, defenderPredicate);
						var aDeadUnits = applyDamage(attacker, defenderInflicted, options.defender, attackerPredicate);
						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,true,options,input);
						

						function hasBarrage(unit) {
							return unit.barrageDice !== 0;
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
						if (!bombardmentPossible || options.attacker.noBombardment) return;
						
						var bombardmentAttacker = attackerFull.filter(hasBombardment);
						//console.log(JSON.parse(JSON.stringify(bombardmentAttacker)));
						if (options.attacker.race === game.Race.L1Z1X && !initialBombardment){
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
						//console.log(JSON.parse(JSON.stringify(bombardmentAttacker)));
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
						//console.log(JSON.parse(JSON.stringify(bombardmentAttacker)));
						var attackerModifier = options.defender.bunker ? -4 : 0;
						var reroll = options.attacker.jolnarCommander;
						var attackerAdditional = initialBombardment && options.attacker.argentStrikeWingBombardmentA && options.attacker.race !== game.Race.Argent ? 1 : 0;
						attackerAdditional += options.attacker.plasmaScoring && !(initialBombardment && options.attacker.plasmaScoringFirstRound) ? 1 : 0;
						attackerAdditional += options.attacker.argentCommander && !(initialBombardment && options.attacker.argentCommanderFirstRound) ? 1 : 0;
						//console.log(JSON.parse(JSON.stringify("end")));
						var attackerInflicted = rollDice(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier, reroll, moreDieForStrongestUnit(bombardmentAttacker, game.ThrowType.Bombardment, attackerAdditional), options.attacker);
						var defenderInflicted = 0;
						if (options.attacker.x89Omega){
							var killInfantryConservative = conservativeX89(defender,attackerInflicted,options.defender);
							var killInfantrynonConservative = nonConservativeX89(defender,attackerInflicted,options.defender);

							if (options.defender.x89Conservative ? killInfantryConservative : killInfantrynonConservative){
								attackerInflicted-=defender.filter(unitIsInfantry).length;
								[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [null,null], options,input);
								var dDeadUnits = applyDamage(defender,defender.filter(unitIsInfantry).length+attackerInflicted,options.defender,null,unitIsInfantry);
								var dDeadUnits = applyDamage(defender,100000,options.defender,unitIsInfantry);
							} else if (options.defender.x89Conservative && !killInfantryConservative){
								[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [null,null], options,input);
								var dDeadUnits = applyDamage(defender,attackerInflicted,options.defender,null,unitIsNotInfantry);
							} else if (!options.defender.x89Conservative && !killInfantryConservative){
								[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [null,null], options,input);
								var dDeadUnits = applyDamage(defender,attackerInflicted,options.defender);
							}
							var aDeadUnits = applyDamage(attacker,defenderInflicted,options.attacker);
						} else {
							var defenderPredicate = initialBombardment && options.defender.race === game.Race.Sardakk && options.defender.sustainMechs ? mechsHittable() : null;
							[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [defenderPredicate,null], options,input);
							var aDeadUnits = applyDamage(attacker,defenderInflicted,options.attacker);
							var dDeadUnits = applyDamage(defender,attackerInflicted,options.defender,null,defenderPredicate);
						}
						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,false,options,input);
						function hasBombardment(unit) {
							return unit.bombardmentDice !== 0;
						}
						function unitIsInfantry(unit){			
								return unit.type === game.UnitType.Ground;
						}
						function unitIsNotInfantry(unit){			
							return unit.type !== game.UnitType.Ground;
					}
						function mechsHittable() {
							return function (unit) {
								return unit.type !== game.UnitType.Mech;
							};
						}
						function absorbsHits(thisSideOptions){
							return function (unit) {
								return (unit.isDamageGhost && thisSideOptions.nonEuclidean) ? 2 : 1;
							}
						}
						function nonConservativeX89(fleet,hits,thisSideOptions){
							var tempHits=hits;
							for (var i = fleet.length - 1; 0 <= i && 0 < tempHits; --i) {
								var unit = fleet[i];
								if (unit.type!==game.UnitType.Ground)
									tempHits -= absorbsHits(thisSideOptions)(fleet[i]);
								else
									return true;
							}
							return false;
						}
						function conservativeX89(fleet,hits,thisSideOptions){
							var tempHits=hits;
							for (var i = fleet.length - 1; 0 <= i && 0 < tempHits; --i) {
								var unit = fleet[i];
								if (unit.type !== game.UnitType.Ground)
									tempHits -= absorbsHits(thisSideOptions)(fleet[i]);
							}
							return tempHits>0;
						}
					},
				},
				{
					name: 'Space Cannon -> Ground Forces',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						if (options.attacker.l4Disruptors || options.defender.noSpaceCannon) return;

						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var spaceCannonUnits = defenderFull.filter(groundForceSpaceCannon);
						var reroll= options.defender.jolnarCommander;
						var defenderAdditional = options.defender.plasmaScoring ? 1 : 0;
						defenderAdditional += options.defender.argentCommander ? 1 : 0;
						defenderAdditional += options.defender.argentStrikeWingSpaceCannonD && options.defender.race !== game.Race.Argent ? 1 : 0;
						
						var defenderInflicted = rollDice(spaceCannonUnits, game.ThrowType.SpaceCannon, defenderModifier, reroll, moreDieForStrongestUnit(defenderFull, game.ThrowType.SpaceCannon, defenderAdditional), options.defender);
						defenderInflicted = Math.max(defenderInflicted-(options.defender.maneuveringJets ? 1 : 0),0);
						
						var attackerInflicted = 0;
						var attackerPredicate = options.attacker.race === game.Race.Sardakk && options.attacker.sustainMechs ? mechsHittable() : null;
						[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, false,
						[attackerPredicate,null], [null,null], options,input);
						
						var aDeadUnits =applyDamage(attacker, defenderInflicted, options.attacker,null,attackerPredicate);
						var dDeadUnits=[];
						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,false,options,input);
						function mechsHittable() {
							return function (unit) {
								return unit.type !== game.UnitType.Mech;
							};
						}
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
										storedValues[options[mySide].side].tgsSpent+=2;
										return;
									}
								}
							}
							return;
						}
					},
				},
				{
					name: 'Sol Commander',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						if (!(hasUnits(attacker) && hasUnits(defender))) return;
						if (options.defender.solCommander){
							addUnitBasedOnRace(game.UnitType.Ground,'defender','attacker',options,defender,attacker,input);
							organizeFleet(defender,'defender',options,input);
						}
					},
				},
				{
					name: 'Magen Defense Omega',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						if (!(hasUnits(attacker) && hasUnits(defender))) return;
						var attackerInflicted= (options.attacker.magenDefenseOmega && attacker.some(unit.typeStructure)) ? 1 : 0;
						var defenderInflicted= (options.defender.magenDefenseOmega && (defenderFull.some(unit.typeStructure) || defender.hasDock)) ? 1 : 0;
						[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, true,
						[null,null], [null,null], options,input);
						var aDeadUnits =applyDamage(attacker, defenderInflicted, options.attacker);
						var dDeadUnits =applyDamage(defender, attackerInflicted, options.defender);
						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,true,options,input);
					},
				},
			];
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
						return round === 1 && sideOptions.supercharger ? 1 : 0;
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

		function validUnit(combat) {
			return function (unit) {
				return combat || !unit.typeGroundForce;
			}
		}
		function unitShield(disable) {
			return function (unit) {
				return unit.planetaryShield && !unit.isDamageGhost && (!disable || (disable && unit.type !== game.UnitType.PDS));
			};
		}
		function notFighterShipNorGhost(combat){
			return function (unit) {
				return notFighterShip(combat)(unit) && !unit.isDamageGhost;
			}
		}
		function notFighterShip(combat){
			return function (unit) {
				return unit.type !== game.UnitType.Fighter && unit.typeShip && validUnit(combat)(unit);
			}
		}

		function not(predicate) {
			return function (unit) {
				return !predicate(unit);
			}
		}

		function sum(a, b) {
			return a + b;
		}

		function destroyedUnits(attackerDeadUnits,defenderDeadUnits,attacker,defender,combat,options,input){
			if ((options.attacker.race === game.Race.Yin && attackerDeadUnits.some(unitIs(game.UnitType.Flagship))) || 
			(options.defender.race === game.Race.Yin && defenderDeadUnits.some(unitIs(game.UnitType.Flagship))))
				yinFlagship();
			if (options.attacker.mentakHero && combat && input.battleType === root.BattleType.Space)
				mentakHero(defenderDeadUnits,"attacker","defender",attacker,defender);
			if (options.defender.mentakHero && combat && input.battleType === root.BattleType.Space)
				mentakHero(attackerDeadUnits,"defender","attacker",defender,attacker);
			if (root.storedValues.attacker.yinAgentUses>0)
				yinAgent(attackerDeadUnits,"attacker","defender",attacker,defender);
			if (root.storedValues.defender.yinAgentUses>0)
				yinAgent(defenderDeadUnits,"defender","attacker",defender,attacker);
			function yinFlagship(){
				attackerDeadUnits=attackerDeadUnits.concat(attacker);
				defenderDeadUnits=defenderDeadUnits.concat(defender);
				attacker.splice(0);
				defender.splice(0);
			}
			function mentakHero(deadUnits,mySide,opponentSide,myFleet,opponentFleet){
				for (deadUnit in deadUnits){
					var unit = deadUnits[deadUnit];
					if (!unit.typeGroundForce){
						addUnitBasedOnRace(unit.type,mySide,opponentSide,options,myFleet,opponentFleet,input);
						organizeFleet(myFleet,mySide,options,input);
					}
				}
			}
			function yinAgent(deadUnits,mySide,opponentSide,myFleet,opponentFleet){
				if (deadUnits.some(unitIs(game.UnitType.Cruiser)) || deadUnits.some(unitIs(game.UnitType.Destroyer))){
					addUnitBasedOnRace(game.UnitType.Fighter,mySide,opponentSide,options,myFleet,opponentFleet,input);
					addUnitBasedOnRace(game.UnitType.Fighter,mySide,opponentSide,options,myFleet,opponentFleet,input);
					organizeFleet(myFleet,mySide,options,input);
					storedValues[mySide].yinAgentUses-=1;
				}
			}
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
