(function (root) {

	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
		calcu = require('./calculator').calculator;
	} else {
		structs = window;
		game = window;
		calcu = root.calculator;
	}

	root.imitationIterations = 10000;
	root.printMode = false;
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
			var defaultValues = { attacker: { battleDiceRolled:0, hitsProduced:[], deadUnits:[]}, 
								defender: { battleDiceRolled:0, hitsProduced:[], deadUnits:[]},
								rounds: 0 };
			input.storedValues = defaultValues;
			var attackerTG=[0,0];
			var defenderTG=[0,0];
			var rounds = 0;
			input.failed1200=0;
			for (var i = 0; i < root.imitationIterations; ++i) {
				var attacker = game.expandFleet(input, game.BattleSide.attacker);
				var defender = game.expandFleet(input, game.BattleSide.defender);
				attacker.yinAgentUses= options.attacker.yinAgent || options.attacker.yinAgentOmega ? 1 : 0;
				attacker.nomadAgentUses = options.attacker.nomadAgent ? 1 : 0;
				attacker.reflectiveShieldingUses = options.attacker.reflectiveShielding ? 1 : 0;
				attacker.directHitUses = options.attacker.directHit + options.attacker.directHit2A + options.attacker.directHit3A + options.attacker.directHit4A;
				attacker.hitsProduced=[];
				attacker.deadUnits=[];
				attacker.tgsEarned=0;
				attacker.tgsSpent=0;
				attacker.rounds=0;
				attacker.battleDiceRolled=0;
				attacker.side="attacker";

				defender.yinAgentUses= options.defender.yinAgent || options.defender.yinAgentOmega ? 1 : 0;
				defender.nomadAgentUses=options.defender.nomadAgent ? 1 : 0;
				defender.reflectiveShieldingUses=options.defender.reflectiveShielding ? 1 : 0;
				defender.directHitUses = options.defender.directHit + options.defender.directHit2D + options.defender.directHit3D + options.defender.directHit4D;
				defender.hitsProduced=[];
				defender.deadUnits=[];
				defender.tgsEarned=0;
				defender.tgsSpent=0;
				defender.battleDiceRolled=0;
				defender.side="defender";
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
				attackerTG[0]+=survivors.attacker.tgsEarned;
				defenderTG[0]+=survivors.defender.tgsEarned;
				attackerTG[1]+=survivors.attacker.tgsSpent;
				defenderTG[1]+=survivors.defender.tgsSpent;
				rounds+=survivors.attacker.rounds;
			}
			if (input.failed1200)
				print(input.failed1200 + " simulations failed due to reaching round 1200");
			result.normalize();
			input.storedValues.attacker.tgsEarned = (attackerTG[0]===0 || attackerTG[0]===null) ? null: (attackerTG[0]/root.imitationIterations).toFixed(2)  + " EA";
			input.storedValues.defender.tgsEarned = (defenderTG[0]===0 || defenderTG[0]===null) ? null: (defenderTG[0]/root.imitationIterations).toFixed(2)  + " ED";

			input.storedValues.attacker.tgsSpent = (attackerTG[1]===0 || attackerTG[1]===null) ? null: (attackerTG[1]/root.imitationIterations).toFixed(2) + " SA";
			input.storedValues.defender.tgsSpent = (defenderTG[1]===0 || defenderTG[1]===null) ? null: (defenderTG[1]/root.imitationIterations).toFixed(2) + " SD";
			input.storedValues.rounds = rounds/root.imitationIterations;
			return {
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
			};
		}

		function imitateBattle(attackerFull, defenderFull, battleType, options,input) {
			/*var attacker = attackerFull.filterForBattle();
			var defender = defenderFull.filterForBattle();
			var doAtLeastOneRound = false;
			var actions = prebattleActions;
			var aDeadUnits=[];
			var dDeadUnits=[];
			var maximum_actions=20;
			var actions=0;
			var all_actions_resolved=false;
			var act='attacker';
			var passes=0;
			while (!all_actions_resolved && actions<maximum_actions){
				if (act == 'attacker'){
					for (var j = 0; j < actions.length; i++) {
						var action = actions[j];
						var condition = 
					}
				}
			}
			for (var i = 0; i < actions.length; i++) {
				var action = actions[i];
				if (action.appliesTo === battleType){
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
			}*/
			//var attacker = attackerFull.filterForBattle();
			//var defender = defenderFull.filterForBattle();
			var actions = prebattleActions;
			var aDeadUnits = [];
			var dDeadUnits = [];
			var prebattleActionPassing = {
				last_action_attacker: { name: null },
				last_action_defender: { name: null },
				passed_attacker: false,
				passed_defender: false,
				next_to_act: 'attacker',
				other_side: 'defender',
				completed_actions_attacker: [],
				completed_actions_defender: [],
				start_of_combat_units_both_sides: false,
				attacker: {fleet: attackerFull.filterForBattle(), full:attackerFull},
				defender: {fleet:defenderFull.filterForBattle(),full:defenderFull}
			};
			var iterations = 0;
			var stops=['Space Cannon -> Ships','Anti-Fighter Barrage','Nomad Space Mechs','Bombardment','Space Cannon -> Ground Forces'];
			while (iterations < 50) {
				var mySide = prebattleActionPassing.next_to_act;
				var otherSide = prebattleActionPassing.other_side;
				var mySideFleet=prebattleActionPassing[mySide].fleet;
				var otherSideFleet=prebattleActionPassing[otherSide].fleet;
				var mySideFull=prebattleActionPassing[mySide].full;
				var otherSideFull=prebattleActionPassing[otherSide].full;
				var action = findNextAction();
				//print(action);
				if (action === null) {
					//print("1");
					
					prebattleActionPassing['passed_' + mySide] = true;
					prebattleActionPassing.next_to_act = otherSide;
					prebattleActionPassing.other_side = mySide;
				} else {
					//print("2");
					//print(action);
					//print(prebattleActionPassing);
					action.execute(mySideFleet, otherSideFleet, mySideFull, otherSideFull, mySide,otherSide, options, input);
					//print(prebattleActionPassing);
					prebattleActionPassing['completed_actions_' + mySide].push(action.name);
					prebattleActionPassing['last_action_' + mySide]=action;
					prebattleActionPassing['passed_'+mySide]=false;
					prebattleActionPassing.next_to_act=otherSide;
					prebattleActionPassing.other_side=mySide;

					if (action.name === 'Space Cannon -> Ships' || action.name === 'Space Cannon -> Ground Forces')
						prebattleActionPassing.start_of_combat_units_both_sides = mySideFleet.length>0 && otherSideFleet.length>0;

					//print(prebattleActionPassing);

				}

				if (prebattleActionPassing.passed_attacker && prebattleActionPassing.passed_defender && mySide === 'attacker') {
					break
				}

				iterations += 1;
			}

			//print(resolvedProblem);

			var attacker = prebattleActionPassing.attacker.fleet;
			var defender = prebattleActionPassing.defender.fleet;
			var doAtLeastOneRound = prebattleActionPassing.start_of_combat_units_both_sides;

			function findNextAction(){
				for (var j = 0; j < actions.length; j++){
					var ac = actions[j];
					//print(ac);
					// general condition of the action
					var condition1 = (typeof ac.condition === 'function' ? ac.condition(mySideFleet, otherSideFleet, mySideFull, otherSideFull, mySide,otherSide, options, input) : true)
					// action must apply to battleType
					var condition2 = ac.appliesTo === battleType;
					// if the action is a stop action, it can only be done if the defender has passed or if the last action was the same action, in order to ensure they are done at the same time
					var condition3= !stops.includes(ac.name) || (mySide==='attacker' && (prebattleActionPassing.passed_defender) || (mySide==='defender' && prebattleActionPassing.last_action_attacker.name === ac.name));

					// if an action is a start of combat action, it can only be performed after space cannon and before anti-fighter barrage
					var condition4= stops.includes(ac.name) || ((battleType === game.BattleType.Space && prebattleActionPassing['completed_actions_'+mySide].includes('Nomad Space Mechs') && !prebattleActionPassing['completed_actions_'+mySide].includes('Anti-Fighter Barrage')) 
					|| (battleType === game.BattleType.Ground && prebattleActionPassing['completed_actions_'+mySide].includes('Space Cannon -> Ground Forces')));
					// if an action is a start of combat action, it can only be performed if both sides had units at the start of combat, therefore initiating combat
					var condition5 = (stops.includes(ac.name) && ac.name !== 'Nomad Space Mechs') || prebattleActionPassing.start_of_combat_units_both_sides;
					// an action cannot be performed by the same side multiple times
					var condition6 = !prebattleActionPassing['completed_actions_'+mySide].includes(ac.name);
					//print(condition1 && condition2 && condition3);
					if (condition1 && condition2 && condition3 && condition4 && condition5 && condition6)
						return ac;
				}
				return null;
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
			while ((hasUnits(attacker) && hasUnits(defender)) || (doAtLeastOneRound && round === 0)) {
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
				attacker.tgsSpent+= options.attacker.race === game.Race.Letnev && options.attacker.munitions ? 2 : 0;
				defender.tgsSpent+= options.defender.race === game.Race.Letnev && options.defender.munitions ? 2 : 0;
				if (round === 1) {
					attackerReroll = options.attacker.fireTeam && battleType === game.BattleType.Ground ||
						options.attacker.letnevMunitionsFunding && battleType === game.BattleType.Space ||
						options.attacker.munitions && battleType === game.BattleType.Space;
					defenderReroll = options.defender.fireTeam && battleType === game.BattleType.Ground ||
						options.defender.letnevMunitionsFunding && battleType === game.BattleType.Space||
						options.defender.munitions && battleType === game.BattleType.Space;
					attacker.tgsSpent+= options.attacker.race === game.Race.Letnev && options.attacker.letnevMunitionsFunding && !options.attacker.munitions ? 2 : 0;
					defender.tgsSpent+= options.defender.race === game.Race.Letnev && options.defender.letnevMunitionsFunding && !options.defender.munitions ? 2 : 0;
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
				if (round !== 1 && options.attacker.dunlainMechs){
					actions.find(function (a) {
						return a.name === 'Dunlain Mechs Attacker';
					}).execute(attacker, defender, attackerFull, defenderFull, options,input,false);
				}
				if (round !== 1 && options.defender.dunlainMechs){
					actions.find(function (a) {
						return a.name === 'Dunlain Mechs Defender';
					}).execute(attacker, defender, attackerFull, defenderFull, options,input,false);
				}
				winnuFlagships(attacker, options.attacker, defender);
				winnuFlagships(defender, options.defender, attacker);
				[attackerInflictedToNonFighters,attackerInflictedToEverything,defenderInflictedToNonFighters,defenderInflictedToEverything]=rollCombat();
				
				var attackerExpectedHits=expectedHits(attacker,game.ThrowType.Battle,attackerBoost,attackerBoostRoll,attackerReroll,options.attacker);
				var defenderExpectedHits=expectedHits(defender,game.ThrowType.Battle,defenderBoost,defenderBoostRoll,defenderReroll,options.defender);
				if (round === 1 && (magenDefenseActivatedDefender || magenDefenseActivatedAttacker)){
					if (magenDefenseActivatedDefender){
						attackerInflictedToEverything = 0;
						attackerExpectedHits=0;
					}
					if (magenDefenseActivatedAttacker){
						defenderInflictedToEverything = 0;
						defenderExpectedHits=0;
					}
				}
				if (root.printMode){
					print("attacker fleet: ");
					print(attacker);
					print("defender fleet: ");
					print(defender);
					console.log("attacker damage: " + JSON.parse(JSON.stringify(attackerInflictedToEverything)));
					console.log("defender damage: " + JSON.parse(JSON.stringify(defenderInflictedToEverything)));
					console.log();
				}
				if 	(attackerFull.nomadAgentUses>0 && attackerExpectedHits>(attackerInflictedToEverything+attackerInflictedToNonFighters) 
					&& defenderExpectedHits<(defenderInflictedToEverything+defenderInflictedToNonFighters)){
					[attackerInflictedToNonFighters,attackerInflictedToEverything,defenderInflictedToNonFighters,defenderInflictedToEverything]=rollCombat();
					attackerFull.nomadAgentUses--;
				}
				if 	(defenderFull.nomadAgentUses>0 && defenderExpectedHits>(defenderInflictedToEverything+defenderInflictedToNonFighters) 
					&& attackerExpectedHits<(attackerInflictedToEverything+attackerInflictedToNonFighters)){
					[attackerInflictedToNonFighters,attackerInflictedToEverything,defenderInflictedToNonFighters,defenderInflictedToEverything]=rollCombat();
					defenderFull.nomadAgentUses--;
				}
				
				if (round === 1 && magenDefenseActivatedDefender) {
					attackerInflictedToEverything = 0;
				}
				if (round === 1 && magenDefenseActivatedAttacker) {
					defenderInflictedToEverything = 0;
				}
				if (((options.attacker.valkyrieParticleWeave || options.defender.valkyrieParticleWeave) && battleType === game.BattleType.Ground) || 
				(options.attacker.valkyrieParticleWeaveC || options.defender.valkyrieParticleWeaveC)) {
					var attackerUse=false;
					if ((options.attacker.valkyrieParticleWeave || options.attacker.valkyrieParticleWeaveC) &&
						defenderInflictedToEverything > 0 && !attackerUse){
						attackerInflictedToEverything++;
						attackerUse=true;
					}
					if ((options.defender.valkyrieParticleWeave || options.defender.valkyrieParticleWeaveC) &&
						attackerInflictedToEverything > 0)
						defenderInflictedToEverything++;
					if ((options.attacker.valkyrieParticleWeave || options.attacker.valkyrieParticleWeaveC) &&
						defenderInflictedToEverything > 0 && !attackerUse)
						attackerInflictedToEverything++;
				}

				attacker.hitsProduced.push(attackerInflictedToEverything+attackerInflictedToNonFighters);
				defender.hitsProduced.push(defenderInflictedToEverything+defenderInflictedToNonFighters);
				[attackerInflictedToNonFighters,defenderInflictedToNonFighters]=sustainDamageStep(attacker, attackerInflictedToNonFighters, defender, defenderInflictedToNonFighters,
				true, [null,notFighterShip(true)], [null,notFighterShip(true)], options,input);
				[attackerInflictedToEverything,defenderInflictedToEverything]=sustainDamageStep(attacker, attackerInflictedToEverything, defender, defenderInflictedToEverything,
				true, [null,null], [null,null], options,input);
				if (root.printMode){
					print("Sustain Damage Step")
					print("attacker fleet: ");
					print(attacker);
					print("defender fleet: ");
					print(defender);
					console.log("attacker damage: " + JSON.parse(JSON.stringify(attackerInflictedToEverything)));
					console.log("defender damage: " + JSON.parse(JSON.stringify(defenderInflictedToEverything)));
					console.log();
				}
				

				var A1 = applyDamage(attacker, defenderInflictedToNonFighters, options.attacker, null, notFighterShip(true));
				var A2 = applyDamage(attacker, defenderInflictedToEverything, options.attacker);
				var D1 = applyDamage(defender, attackerInflictedToNonFighters, options.defender, null, notFighterShip(true));
				var D2 = applyDamage(defender, attackerInflictedToEverything, options.defender);
				var aDeadUnits=A1.concat(A2);
				var dDeadUnits=D1.concat(D2);
				destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,true,options,input);

				if (root.printMode){
					print("Damage Taken")
					print("attacker fleet: ");
					print(attacker);
					print("defender fleet: ");
					print(defender);
					print("end");
				}
				if (options.attacker.duraniumArmor)
					repairUnit(attacker);
				if (options.defender.duraniumArmor)
					repairUnit(defender);
				if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) { // Harrow
					// https://www.reddit.com/r/twilightimperium/comments/g82tk6/ground_combat_when_one_side_didnt_come/
					// https://boardgamegeek.com/thread/2286628/does-ground-combat-still-occur-if-invading-ground
					actions.find(function (a) {
						return a.name === 'Bombardment';
					}).execute(attacker, defender, attackerFull, defenderFull, options, input, false);
				}
				// https://boardgamegeek.com/thread/1904694/how-do-you-resolve-endless-battles
				if ((// both sides have Duranium Armor
				options.attacker.duraniumArmor && options.defender.duraniumArmor &&
				// both sides have Non-Euclidean Shielding
				options.attacker.nonEuclidean && options.defender.nonEuclidean &&
				// and both of them have two repairable ships left
				attacker.filter(function (unit) { return unit.sustainDamage && !unit.isDamageGhost; }).length === 2 &&
				defender.filter(function (unit) { return unit.sustainDamage && !unit.isDamageGhost; }).length === 2 &&
				// and at least one of them (for each side) is not damaged
				attacker.filter(function (unit) { return unit.sustainDamage && !unit.isDamageGhost && !unit.damaged; }).length > 0 &&
				defender.filter(function (unit) { return unit.sustainDamage && !unit.isDamageGhost && !unit.damaged; }).length > 0 &&

				// but both cannot inflict more than two damage
				attacker.map(function (unit) {return unit.battleDice || 0; }).reduce(sum) <= 2 &&
				defender.map(function (unit) {return unit.battleDice || 0; }).reduce(sum) <= 2) &&
				!options.attacker.crownThalnosC && !options.defender.crownThalnosC ||
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
				if (round === 2000){
					attacker.splice(0);
					defender.splice(0);
					input.failed1200++;
				}
			}
			attacker.rounds=round;
			return { attacker: attacker, defender: defender };
	
			function rollCombat(){
				var aNonFighters = 0, aEverything = 0;
				var dNonFighters = 0, dEverything = 0;
				if (options.attacker.race === game.Race.L1Z1X && attacker.some(unitIs(game.UnitType.Flagship))) {
					aNonFighters = rollDice(attacker.filter(flagshipOrDreadnought), game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker, attackerFull);
					aEverything = rollDice(attacker.filter(not(flagshipOrDreadnought)), game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker, attackerFull);
				} else
					aEverything = rollDice(attacker, game.ThrowType.Battle, attackerBoost, attackerReroll, attackerBoostRoll, options.attacker, attackerFull);
				if (options.defender.race === game.Race.L1Z1X && defender.some(unitIs(game.UnitType.Flagship))) {
					dNonFighters = rollDice(defender.filter(flagshipOrDreadnought), game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender, defenderFull);
					dEverything = rollDice(defender.filter(not(flagshipOrDreadnought)), game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender, defenderFull);
				} else
					dEverything = rollDice(defender, game.ThrowType.Battle, defenderBoost, defenderReroll, defenderBoostRoll, options.defender, defenderFull);
				return [aNonFighters,aEverything,dNonFighters,dEverything];
			}
			function winnuFlagships(fleet, sideOptions, opposingFleet) {
				if (battleType === game.BattleType.Space && sideOptions.race === game.Race.Winnu) {
					// according to https://boardgamegeek.com/thread/1916774/nekrowinnu-flagship-interaction
					var battleDice = opposingFleet.filter(notFighterShipNorGhost(true)).length;
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
					if (unit.damaged && unit.sustainDamage) {
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

		function sustainDamageStep(thisSideFleet, thisSideHits, otherSideFleet, otherSideHits, combat, thisSidePredicates, otherSidePredicates, options, input) {
			if (thisSideFleet.side === "attacker")
				return sustainDamageStepAbsolute(thisSideFleet, thisSideHits, otherSideFleet, otherSideHits, combat, thisSidePredicates, otherSidePredicates, options, input)
			else
				return sustainDamageStepAbsolute(otherSideFleet, otherSideHits,thisSideFleet, thisSideHits, combat, otherSidePredicates, thisSidePredicates, options, input)

		}

		function sustainDamageStepAbsolute(attackerFleet, attackerHits, defenderFleet, defenderHits, combat, attackerPredicates, defenderPredicates, options, input) {
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
					if (directHits("defender",defenderFleet,"attacker",attackerFleet,aSustains,options,input) && directHits("attacker",attackerFleet,"defender",defenderFleet,dSustains,options,input))
						break;
				}
			}
			return [attackerHits,defenderHits];

			function searchForSustainDamage(fleet,myHits,opponentHits,mySide, hardPredicate, softPredicate){
				for (var i = fleet.length - 1; Math.max(fleet.length - opponentHits,0) <= i && 0 < opponentHits; i--) {
					var unit = fleet[i];
					if (unit.isDamageGhost && hardPredicate(unit) && (!softPredicate || softPredicate(unit))){
						if (options[mySide].letnevCommander && unit.damageCorporeal.sustainDamage)
							fleet.tgsEarned++;
						opponentHits=Math.max(opponentHits-(options[mySide].nonEuclidean && unit.damageCorporeal.sustainDamage ? 2 : 1),0);
						unit.damageCorporeal.damaged = true;
						unit.damageCorporeal.damagedThisRound = true;
						fleet.splice(fleet.indexOf(unit),1);
						unit= unit.damageCorporeal.sustainDamage ? unit : null;
						sustainDamageEffects(unit);
						return [true,myHits,opponentHits,unit];
					}
				}
				if (softPredicate){
					for (var i = fleet.length - 1; 0 <= i && 0 < opponentHits; i--) {
						var unit = fleet[i];
						if (unit.isDamageGhost && unit.damageCorporeal.sustainDamageHits > 0 && hardPredicate(unit)){
							if (options[mySide].letnevCommander && unit.damageCorporeal.sustainDamage)
								fleet.tgsEarned++;
							opponentHits=Math.max(opponentHits-(options[mySide].nonEuclidean && unit.damageCorporeal.sustainDamage ? 2 : 1),0);
							unit.damageCorporeal.damaged = true;
							unit.damageCorporeal.damagedThisRound = true;
							fleet.splice(fleet.indexOf(unit),1);
							unit= unit.damageCorporeal.sustainDamage ? unit : null;
							sustainDamageEffects(unit);
							return [true,myHits,opponentHits,unit];
						}
					}
				}
				return [false,myHits,opponentHits,null];

				function sustainDamageEffects(unit){
					if (!unit) return;
					if (fleet.reflectiveShieldingUses > 0 && combat && unit.typeShip){
						myHits+=2;
						fleet.reflectiveShieldingUses--;
					}
					if (options[mySide].race === game.Race.Sardakk && unit.type === game.UnitType.Mech && combat && !options[mySide].articlesOfWar)
						myHits++;
				}
			}

			function directHits(mySide,myFleet,opponentSide,opponentFleet,opponentSustains,options,input){
				if (myFleet.directHitUses>0){
					organizeFleet(opponentSustains,opponentSide,options,input);
					for (var i = 0; i < opponentSustains.length && i < myFleet.directHitUses;i++){
						var unit = opponentSustains[i].damageCorporeal;

						if (unit && unit.typeShip && (unit.type !== game.UnitType.Dreadnought || !(input[root.SideUnits[opponentSide]][UnitType.Dreadnought] || {}).upgraded)){
							var destroyedUnit=opponentFleet.splice(opponentFleet.indexOf(unit),1);
							myFleet.directHitUses--;
							if (mySide ==="attacker")
								destroyedUnits([],destroyedUnit, attackerFleet, defenderFleet,combat,options,input);
							else 
								destroyedUnits(destroyedUnit,[],attackerFleet, defenderFleet, combat, options,input);
							return false;
						}
					}
				}
				return true;
			}
		} 


		function rollDice(fleet, throwType, modifier, reroll, modifierRoll, thisSideOptions, fleetFull) {
			modifier = modifier || 0;
			modifierRoll= modifierRoll || 0;
			var totalRoll = 0;
			var totalMiss = 0;
			var modifierFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifier === 'function' ? modifier(unit) : modifier;
			};
			var modifierRollFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifierRoll === 'function' ? modifierRoll(unit) : modifierRoll;
			};
			if ((thisSideOptions.infantryIIA || thisSideOptions.infantryIID) && throwType === game.ThrowType.Battle){
				var deadInfantry=fleet.deadUnits.filter(unitIs(game.UnitType.Ground));
				for (var i = 0; i < deadInfantry.length; i++)
					deadInfantry[i].dead = true;
				fleet = fleet.concat(deadInfantry);
			}
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];
				var battleValue = unit[game.ThrowValues[throwType]];
				var diceCount = unit[game.ThrowDice[throwType]] + modifierRollFunction(unit);
				var unitHits=0;
				var unitMisses=0
				for (var die = 0; die < diceCount; ++die) {
					var rollResult = rollDie();
					if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && 8 < rollResult)
						unitHits+= 2;
					if (thisSideOptions.infiniteTG && rollResult+modifierFunction(unit)+1===battleValue && throwType===game.ThrowType.Battle){
						rollResult+=1;
						fleet.tgsSpent++;
					}
					if (battleValue <= rollResult + modifierFunction(unit)){
						unitHits++;
					}
					else if (reroll && (battleValue-modifierFunction(unit))<=10) { // There is an assumption that Jol-Nar Flagship won't re-roll rolls that produced hits but not +2 hits. Seems reasonable on expectation.
						rollResult = rollDie();
						if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && 8 < rollResult)
							unitHits+= 2;
						if (thisSideOptions.infiniteTG && rollResult+modifierFunction(unit)+1===battleValue && throwType===game.ThrowType.Battle){
							rollResult+=1;
							fleet.tgsSpent++;
						}
						if (battleValue <= rollResult + modifierFunction(unit))
							unitHits++;
						else if (10 + modifierFunction(unit) >= battleValue)
							unitMisses++;
					}
					else if ((battleValue-modifierFunction(unit))<=10)
						unitMisses++;
					if (rollResult == 10 && thisSideOptions.crownThalnosC)
						unitHits++;
				}
				if (thisSideOptions.crownThalnosSafe && unitHits>=1 && unitMisses>=1 && throwType===game.ThrowType.Battle){
					for (var die=0; die < unitMisses; ++die){
						var rollResult = rollDie();
						if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && 8 < rollResult)
							unitHits+= 2;
							unitMisses--
						if (thisSideOptions.infiniteTG && rollResult+modifierFunction(unit)+1===battleValue && throwType===game.ThrowType.Battle){
							rollResult+=1;
							fleet.tgsSpent++;
						}
						if (battleValue <= rollResult + modifierFunction(unit) + 1){
							unitHits++;
							unitMisses--
						}
					}
				}
				totalRoll+=unitHits;
				totalMiss+=unitMisses;
			}
			if (thisSideOptions.plasmaScoringC && totalMiss>=1 && ((throwType==game.ThrowType.Bombardment && !(fleet.initialBombardment && thisSideOptions.plasmaScoringFirstRound))|| throwType==game.ThrowType.SpaceCannon)){
				totalRoll++;
				totalMiss--;
			}
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
					/*execute: function (attacker, defender, attackerFull, defenderFull, options, input) {
						var attackerModifier = options.defender.antimassDeflectors ? -1 : 0;
						var attackerReroll= options.attacker.jolnarCommander;
						var attackerAdditional = options.attacker.plasmaScoring ? 1 : 0;
						attackerAdditional += options.attacker.argentCommander ? 1 : 0;
						attackerAdditional += options.attacker.argentStrikeWingSpaceCannonA && options.attacker.race !== game.Race.Argent ? 1 : 0;
						var attackerInflicted = rollDice(attackerFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, attackerModifier, attackerReroll, moreDieForStrongestUnit(attackerFull, game.ThrowType.SpaceCannon, attackerAdditional), options.attacker, attackerFull);
						attackerInflicted= options.defender.solarFlare || (defender.some(unitIs(game.UnitType.Flagship)) && options.defender.race === game.Race.Argent) ? 0 : Math.max(attackerInflicted- (options.defender.maneuveringJets ? 1 : 0),0);
						attackerInflicted = options.attacker.noSpaceCannon ? 0 : attackerInflicted;

						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var defenderReroll= options.defender.jolnarCommander ;
						var defenderAdditional = options.defender.plasmaScoring ? 1 : 0;
						defenderAdditional += options.defender.argentCommander ? 1 : 0;
						defenderAdditional += options.defender.argentStrikeWingSpaceCannonD && options.defender.race !== game.Race.Argent ? 1 : 0;
						var defenderInflicted = rollDice(defenderFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, defenderModifier, defenderReroll, moreDieForStrongestUnit(defenderFull, game.ThrowType.SpaceCannon, defenderAdditional), options.defender, defenderFull);
						defenderInflicted= options.attacker.solarFlare || (attacker.some(unitIs(game.UnitType.Flagship)) && options.attacker.race === game.Race.Argent) ? 0 : Math.max(defenderInflicted-(options.attacker.maneuveringJets ? 1 : 0),0);
						defenderInflicted = options.defender.noSpaceCannon ? 0 : defenderInflicted;

						var attackerPredicate = (options.defender.gravitonLaser || options.defender.gravitonLaserC) ? notFighterShip(false) : null;
						var defenderPredicate = (options.attacker.gravitonLaser || options.attacker.gravitonLaserC) ? notFighterShip(false) : null;
						[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, false,
						[validUnit(false),attackerPredicate], [validUnit(false),defenderPredicate], options,input);

						var aDeadUnits = applyDamage(attacker, defenderInflicted, options.attacker, validUnit(false), attackerPredicate);
						var dDeadUnits = applyDamage(defender, attackerInflicted, options.defender, validUnit(false), defenderPredicate);
						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,false,options,input);
						
						markDamagedNotThisRound(attacker);
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
					},*/
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						var thisSideModifier = options[otherSide].antimassDeflectors ? -1 : 0;
						var thisSideReroll= options[thisSide].jolnarCommander;
						var thisSideAdditional = options[thisSide].plasmaScoring ? 1 : 0;
						thisSideAdditional += options[thisSide].argentCommander ? 1 : 0;
						thisSideAdditional += options[thisSide].argentStrikeWingSpaceCannonA && options[thisSide].race !== game.Race.Argent ? 1 : 0;
						var thisSideInflicted = rollDice(thisSideFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, thisSideModifier, thisSideReroll, moreDieForStrongestUnit(thisSideFull, game.ThrowType.SpaceCannon, thisSideAdditional), options[thisSide], thisSideFull);
						thisSideInflicted= options[otherSide].solarFlare || (otherSideFull.some(unitIs(game.UnitType.Flagship)) && options[otherSide].race === game.Race.Argent) ? 0 : Math.max(thisSideInflicted- (options[otherSide].maneuveringJets ? 1 : 0),0);
						thisSideInflicted = options[thisSide.noSpaceCannon] ? 0 : thisSideInflicted;



						
						/*var otherSideModifier = options[thisSide].antimassDeflectors ? -1 : 0;
						var otherSideReroll= options[otherSide].jolnarCommander ;
						var otherSideAdditional = options[otherSide].plasmaScoring ? 1 : 0;
						otherSideAdditional += options[otherSide].argentCommander ? 1 : 0;
						otherSideAdditional += options[otherSide].argentStrikeWingSpaceCannonD && options[otherSide].race !== game.Race.Argent ? 1 : 0;
						var otherSideInflicted = rollDice(otherSideFull.filter(hasSpaceCannon), game.ThrowType.SpaceCannon, otherSideModifier, otherSideReroll, moreDieForStrongestUnit(otherSideFull, game.ThrowType.SpaceCannon, otherSideAdditional), options[otherSide], otherSideFull);
						otherSideInflicted= options[thisSide].solarFlare || (thisSideFull.some(unitIs(game.UnitType.Flagship)) && options[thisSide].race === game.Race.Argent) ? 0 : Math.max(otherSideInflicted-(options[thisSide].maneuveringJets ? 1 : 0),0);
						otherSideInflicted = options[otherSide].noSpaceCannon ? 0 : otherSideInflicted;*/

						//var thisSidePredicate = (options[otherSide].gravitonLaser || options[otherSide].gravitonLaserC) ? notFighterShip(false) : null;
						var otherSidePredicate = (options[thisSide].gravitonLaser || options[thisSide].gravitonLaserC) ? notFighterShip(false) : null;
						[thisSideInflicted,otherSideInflicted]=sustainDamageStep(thisSideFleet, thisSideInflicted, otherSideFleet, 0, false,
						[null,null], [validUnit(false),otherSidePredicate], options,input);

						//var thisSideDeadUnits = applyDamage(thisSideFleet, 0, options[thisSide], validUnit(false), thisSidePredicate);
						var otherSideDeadUnits = applyDamage(otherSideFleet, thisSideInflicted, options[otherSide], validUnit(false), otherSidePredicate);

						destroyedUnits([],otherSideDeadUnits,thisSideFleet,otherSideFleet,false,options,input);
						
						//markDamagedNotThisRound(thisSideFleet);
						markDamagedNotThisRound(otherSideFleet);

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
					name: 'Nomad Space Mechs',
					appliesTo: game.BattleType.Space,
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						if (!thisSideFull.some(unitIs(game.UnitType.Mech)) || options[thisSide].race !== game.Race.Nomad || options[thisSide].articlesOfWar)
							return;
						for (var i = 0; i<thisSideFull.length;i++){
							var unit = thisSideFull[i];
							if (unit.type === game.UnitType.Mech && unit.isDamageGhost)
								addUnit(thisSideFleet,thisSide, input, game.UnitType.Mech, 1, false, {...unit, cancelHit:true})
						}
					},
				},
				{
					name: 'Assault Cannon',
					appliesTo: game.BattleType.Space,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						var fleet=thisSideFleet;
						var nonFightersFound = 0;
						for (var i = 0; i < fleet.length; i++) {
							if (notFighterShipNorGhost(true)(fleet[i]))
								nonFightersFound++;
							if (nonFightersFound >= 3 && options[thisSide].assaultCannon)
								return true;
						}
						return false;
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {

						var otherSideVictim = killOffNonFighter(otherSideFleet);
						destroyedUnits([],[otherSideVictim],thisSideFleet,otherSideFleet,true,options,input);

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
					name: 'Nekro Flagship',
					appliesTo: game.BattleType.Space,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						return thisSideFull.some(unitIs(game.UnitType.Flagship)) && thisSideFull.some(groundForce) && options[thisSide].race === game.Race.Virus;
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						for (var i = 0; i<thisSideFull.length;i++){
							var unit = thisSideFull[i];
							if (unit.typeGroundForce && !unit.isDamageGhost){
								if (removeUnit(thisSideFull,unit.type,1))
									addUnit(thisSideFleet, thisSide, input, unit.type, 1, false, {...unit, typeShip: true})	
							}
						}
					},
				},

				{
					name: 'Nomad Promissory',
					appliesTo: game.BattleType.Space,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						return options[thisSide].nomadCavalry && options[otherSide].race!==game.Race.Nomad && options[thisSide].race!==game.Race.Nomad;
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						var prefered = [game.UnitType.Warsun, game.UnitType.Flagship, game.UnitType.Dreadnought, game.UnitType.Mech, game.UnitType.Cruiser, game.UnitType.Ground, game.UnitType.Destroyer, game.UnitType.Carrier];
						var convertUnit=thisSideFleet[thisSideFleet.length-1];
						var convertUnitIndex=thisSideFleet.length-1;
						for (var i = thisSideFleet.length-1; i>=0;i--){
							var unit = thisSideFleet[i];
							if (prefered.indexOf(unit.type)>prefered.indexOf(convertUnit.type)){
								convertUnit=thisSideFleet[i];
								convertUnitIndex=i;
							}
						}
						if (convertUnit === undefined || convertUnit.type === game.UnitType.Fighter)
							return;
						var inherit = 	(thisSide === 'attacker' && options[thisSide].hasMemoriaIIA) || (thisSide === 'defender' && options[thisSide].hasMemoriaIID) ? 
										{...convertUnit, sustainDamage: true,sustainDamageHits:1, barrageDice:3, barrageValue:5, battleDice:2, battleValue:5} :
										{...convertUnit, sustainDamage: true,sustainDamageHits:1, barrageDice:3, barrageValue:8, battleDice:2, battleValue:7}

						if (removeUnit(thisSideFleet,convertUnit.type,1))
							addUnit(thisSideFleet, thisSide, input, convertUnit.type, 1, true, inherit);
						
					},
				},
				{
					name: 'Naaz-Rokha Space Mechs',
					appliesTo: game.BattleType.Space,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						return thisSideFull.some(unitIs(game.UnitType.Mech)) && options[thisSide].race === game.Race.NaazRokha && !options[thisSide].articlesOfWar;
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						for (var i = 0; i<thisSideFull.length;i++){
							var unit = thisSideFull[i];
							if (unit.type === game.UnitType.Mech && !unit.isDamageGhost){
								if (removeUnit(thisSideFull,unit.type,1))
									addUnit(thisSideFleet, thisSide, input, unit.type, 1, false, {...unit, typeShip: true, sustainDamage:false,sustainDamageHits:0, battleValue:8});
							}		
						}
					},
				},
				{
					name: 'Keleres Argent Hero',
					appliesTo: game.BattleType.Space,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						return options[thisSide].keleresHero;
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						addUnit(thisSideFleet, thisSide, input, game.UnitType.Flagship, 1, true);
						if ((thisSide === 'attacker' && options[thisSide].keleresHeroIA) || (thisSide === 'defender' && options[thisSide].keleresHeroID))
							addUnit(thisSideFleet, thisSide, input, game.UnitType.Destroyer, 2, true);
						else if ((thisSide === 'attacker' && options[thisSide].keleresHeroIIA) || (thisSide === 'defender' && options[thisSide].keleresHeroIID)){
							addUnit(thisSideFleet, thisSide, input, game.UnitType.Destroyer, 1, true);
							addUnit(thisSideFleet, thisSide, input, game.UnitType.Cruiser, 1, true);
						}
						else
							addUnit(thisSideFleet, thisSide, input, game.UnitType.Cruiser, 2, true);
					},
				},
				{
					name: 'Mentak racial',
					appliesTo: game.BattleType.Space,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						return options[thisSide].race === game.Race.Mentak;
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {

						function getInflicted(fleet, sideOptions, fleetFull) {
							var firing = fleet.filter(unitIs(game.UnitType.Cruiser));
							if (firing.length < 2)
								firing = firing.concat(fleet.filter(unitIs(game.UnitType.Destroyer)));
							if (firing.length > 2)
								firing = firing.slice(0, 2);
							return rollDice(firing, game.ThrowType.Battle, null, null, null, sideOptions, fleetFull);
						}

						var thisSideInflicted = 0;
						thisSideInflicted = getInflicted(thisSideFleet, options[thisSide], thisSideFull);

						[attackerInflicted,defenderInflicted]=sustainDamageStep(thisSideFleet, thisSideInflicted, otherSideFleet, 0, true, [null,null], [null,null], options,input);
						var otherSideDeadUnits = applyDamage(otherSideFleet, thisSideInflicted, options[otherSide]);
						destroyedUnits([],otherSideDeadUnits,thisSideFleet,otherSideFleet,true,options,input);
					},
				},
				{
					/*name: 'Anti-Fighter Barrage',
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

						var attackerInflicted = rollDice(attackerBarrageUnits, game.ThrowType.Barrage, 0, attackerReroll, moreDieForStrongestUnit(attackerBarrageUnits, game.ThrowType.Barrage, attackerExtraDie), options.attacker, attackerFull);
						attackerInflicted = options.attacker.noBarrage ? 0 : attackerInflicted;
						var defenderInflicted = rollDice(defenderBarrageUnits, game.ThrowType.Barrage, 0, defenderReroll, moreDieForStrongestUnit(defenderBarrageUnits, game.ThrowType.Barrage, defenderExtraDie), options.defender, defenderFull);
						defenderInflicted = options.defender.noBarrage ? 0 : defenderInflicted;
						
						if ((attackerInflicted > defender.filter(unitIsFighter()).length) && options.attacker.race === game.Race.Argent){
							var damages=attackerInflicted-defender.filter(unitIsFighter()).length;
							for (var i=defender.length-1; i>=0 && damages>0; i--){
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
							for (var i = attacker.length - 1 ; i >= 0 && damages>0; i--){
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
						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,true,options,input);*/
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {		
						var thisSideBarrageUnits = thisSideFleet.filter(hasBarrage);
						var thisSideReroll= options[thisSide].jolnarCommander;

						var thisSideExtraDie = options[thisSide].argentCommander ? 1 : 0;
						thisSideExtraDie += options[thisSide].argentStrikeWingBarrageA && options[thisSide].race !== game.Race.Argent ? 1 : 0;

						var thisSideInflicted = rollDice(thisSideBarrageUnits, game.ThrowType.Barrage, 0, thisSideReroll, moreDieForStrongestUnit(thisSideBarrageUnits, game.ThrowType.Barrage, thisSideExtraDie), options[thisSide], thisSideFull);
						thisSideInflicted = options[thisSide].noBarrage ? 0 : thisSideInflicted;
						
						if ((thisSideInflicted > otherSideFleet.filter(unitIsFighter()).length) && options[thisSide].race === game.Race.Argent){
							var damages=thisSideInflicted-otherSideFleet.filter(unitIsFighter()).length;
							for (var i=otherSideFleet.length-1; i>=0 && damages>0; i--){
								var unit = otherSide[i] || {};
								if (unit.isDamageGhost){
									unit.damageCorporeal.damaged = true;
									unit.damageCorporeal.damagedThisRound = true;
									otherSideFleet.splice(i,1);
									damages--;
								}
							}
						}
						var otherSidePredicate = options[thisSide].waylay ? null : (otherSideFleet.filter(unitIsFighter()).length>=thisSideInflicted ? unitIsFighterOrCancelHit() : unitIsFighter());

						[thisSideInflicted,otherSideInflicted]=sustainDamageStep(thisSideFleet, thisSideInflicted, otherSideFleet, otherSideInflicted, true, 
						[null, null], [otherSidePredicate, null], options,input);

						var otherSideDeadUnits = applyDamage(otherSide, thisSideInflicted, options.thisSide, otherSidePredicate);
						destroyedUnits([],otherSideDeadUnits,thisSideFleet,otherSideFleet,true,options,input);


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
					//execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
					execute: function (attacker,defender, attackerFull, defenderFull, thisSide, otherSide, options, input) {
						var bombardmentPossible = !options.defender.conventionsOfWar && (
							!defenderFull.some(unitShield(options.attacker.disable)) // either there are no defending PDS or Arborec Mechs
							|| attackerFull.some(unitIs(game.UnitType.WarSun)) // or there are but attacking WarSuns negate their Planetary Shield
							|| options.attacker.race === game.Race.Letnev && attackerFull.some(unitIs(game.UnitType.Flagship)) // Letnev Flagship negates Planetary Shield as well
							|| options.attacker.L1Z1XCommander // L1Z1X Commander ignores all planetary shield
						);
						if (!bombardmentPossible || thisSide === "defender" || options.attacker.noBombardment) return;
						
						var bombardmentAttacker = attackerFull.filter(hasBombardment);

						if (options.attacker.race === game.Race.L1Z1X && !initialBombardment){
							var temp=[];
							var thisSideCounters = input[game.SideUnits["attacker"]];
							var counter = thisSideCounters[game.UnitType.Mech] || { count: 0 };
							var max = counter.participants || 0;
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
								dict[unitType] = input[game.SideUnits["attacker"]][unitType].notBombarding || 0;
							}
							for (unit in bombardmentAttacker){
								if (dict[bombardmentAttacker[unit].type] <=0){
									temp.push(bombardmentAttacker[unit]);
								}
								dict[bombardmentAttacker[unit].type]-=1;
							}
							bombardmentAttacker=temp;
						}
						var attackerModifier = options.defender.bunker ? -4 : 0;
						var reroll = options.attacker.jolnarCommander;
						var attackerAdditional = initialBombardment && options.attacker.argentStrikeWingBombardmentA && options.attacker.race !== game.Race.Argent ? 1 : 0;
						attackerAdditional += options.attacker.plasmaScoring && !(initialBombardment && options.attacker.plasmaScoringFirstRound) ? 1 : 0;
						attackerAdditional += options.attacker.argentCommander && !(initialBombardment && options.attacker.argentCommanderFirstRound) ? 1 : 0;

						bombardmentAttacker.initialBombardment=initialBombardment;
						var attackerInflicted = rollDice(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier, reroll, moreDieForStrongestUnit(bombardmentAttacker, game.ThrowType.Bombardment, attackerAdditional), options.attacker, attackerFull);
						var defenderInflicted = 0;
						var defenderPredicate = initialBombardment && options.defender.race === game.Race.Sardakk && options.defender.sustainMechs ? mechsHittable() : null;
						defenderPredicate = options.attacker.gravitonLaserC ? unitIsNotInfantry : null;
						[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [defenderPredicate,null], options,input);
						var aDeadUnits = applyDamage(attacker,defenderInflicted,options.attacker);
						var dDeadUnits = applyDamage(defender,attackerInflicted,options.defender,null,defenderPredicate);
						/*if (options.attacker.x89Omega){
							//var killInfantryConservative = conservativeX89(defender,attackerInflicted,options.defender);
							//var killInfantrynonConservative = nonConservativeX89(defender,attackerInflicted,options.defender);

							//if (options.defender.x89Conservative ? killInfantryConservative : killInfantrynonConservative){
							if (killInfantrynonConservative){
								attackerInflicted-=defender.filter(unitIsInfantry).length;
								[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [null,null], options,input);
								var dDeadUnits = applyDamage(defender,defender.filter(unitIsInfantry).length+attackerInflicted,options.defender,null,unitIsInfantry);
								var dDeadUnits = applyDamage(defender,100000,options.defender,unitIsInfantry);
							} /*else if (options.defender.x89Conservative && !killInfantryConservative){
								[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [null,null], options,input);
								var dDeadUnits = applyDamage(defender,attackerInflicted,options.defender,null,unitIsNotInfantry);
							} else if (!options.defender.x89Conservative && !killInfantryConservative){
								[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [null,null], options,input);
								var dDeadUnits = applyDamage(defender,attackerInflicted,options.defender);
							}
							var aDeadUnits = applyDamage(attacker,defenderInflicted,options.attacker);
						} else {
							var defenderPredicate = initialBombardment && options.defender.race === game.Race.Sardakk && options.defender.sustainMechs ? mechsHittable() : null;
							defenderPredicate = options.attacker.gravitonLaserC ? unitIsNotInfantry : null;
							[attackerInflicted,defenderInflicted]=sustainDamageStep(attacker, attackerInflicted, defender, defenderInflicted, !initialBombardment, [null,null], [defenderPredicate,null], options,input);
							var aDeadUnits = applyDamage(attacker,defenderInflicted,options.attacker);
							var dDeadUnits = applyDamage(defender,attackerInflicted,options.defender,null,defenderPredicate);
						}*/

						destroyedUnits(aDeadUnits,dDeadUnits,attacker,defender,false,options,input);

						if (dDeadUnits.some(unitIs(game.UnitType.Ground)) && options.attacker.x89Omega){
							var dDeadUnits = applyDamage(defender,100000,options.defender,unitIs(game.UnitType.Ground),null);
							destroyedUnits(null,dDeadUnits,attacker,defender,false,options,input);
						}
						function hasBombardment(unit) {
							return unit.bombardmentDice !== 0;
						}
						function unitIsInfantry(unit){			
								return unit.type === game.UnitType.Ground;
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
						/*function conservativeX89(fleet,hits,thisSideOptions){
							var tempHits=hits;
							for (var i = fleet.length - 1; 0 <= i && 0 < tempHits; --i) {
								var unit = fleet[i];
								if (unit.type !== game.UnitType.Ground)
									tempHits -= absorbsHits(thisSideOptions)(fleet[i]);
							}
							return tempHits>0;
						}*/
					},
				},
				{
					name: 'Space Cannon -> Ground Forces',
					appliesTo: game.BattleType.Ground,
					execute: function (attacker, defender, attackerFull, defenderFull, thisSide, otherSide, options, input) {
					//execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						if (attacker.length>0 && options.defender.race === game.Race.Keleres) 
							attacker.tgsSpent+=defender.filter(unitIs(game.UnitType.Mech)).length;
						if (options.attacker.l4Disruptors || options.defender.noSpaceCannon || thisSide === "defender") return;

						var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
						var spaceCannonUnits = defender.concat(defenderFull.filterForBattle(true)).filter(groundForceSpaceCannon);
						var reroll= options.defender.jolnarCommander;
						var defenderAdditional = options.defender.plasmaScoring ? 1 : 0;
						defenderAdditional += options.defender.argentCommander ? 1 : 0;
						defenderAdditional += options.defender.argentStrikeWingSpaceCannonD && options.defender.race !== game.Race.Argent ? 1 : 0;
						
						var defenderInflicted = rollDice(spaceCannonUnits, game.ThrowType.SpaceCannon, defenderModifier, reroll, moreDieForStrongestUnit(defenderFull, game.ThrowType.SpaceCannon, defenderAdditional), options.defender, defenderFull);
						defenderInflicted = Math.max(defenderInflicted-(options.attacker.maneuveringJets ? 1 : 0),0);
						var attackerInflicted = 0;
						var attackerPredicate = options.attacker.race === game.Race.Sardakk && options.attacker.sustainMechs ? mechsHittable() : null;
						attackerPredicate = options.defender.gravitonLaserC ? unitIsNotInfantry : null;
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
					name: 'Sol Commander',
					appliesTo: game.BattleType.Ground,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						//return options[thisSide].solCommander;
						return thisSide === 'defender' && options[thisSide].solCommander;
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						addUnit(thisSideFleet, thisSide, input, game.UnitType.Ground, 1, true);
					},
				},
				//if (removeUnit(thisSideFull,unit.type,1))
									//addUnit(thisSideFleet, thisSide, input, unit.type, 1, false, {...unit, typeShip: true})	
				{
					name: 'Dunlain Mechs',
					appliesTo: game.BattleType.Ground,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						return thisSideFleet.some(unitIs(game.UnitType.Ground)) && (options[thisSide].dunlainMechsOnce || options[thisSide].dunlainMechs);
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						if (removeUnit(thisSideFull,game.UnitType.Ground,1)){
							addUnit(thisSideFleet, thisSide, input, game.UnitType.Mech, 1, true)	
							thisSideFleet.spent += 2;
						}
					},
				},
				{
					name: 'Yin Indoctrination',
					appliesTo: game.BattleType.Ground,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						return 	(options[thisSide].indoctrinate && otherSideFleet.some(unitIs(game.UnitType.Ground))) || 
								(options[thisSide].indoctrinateMechOmegaD && otherSideFleet.some(unitIs(game.UnitType.Mech))) ||
								(options[thisSide].greyfireMutagenOmega && options[otherSide].race !== game.Race.Yin && otherSideFleet.filter(groundForce).length>1);
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						var unitType = otherSideFleet.some(unitIs(game.UnitType.Mech)) && options[thisSide].indoctrinateMechOmegaD ? game.UnitType.Mech : game.UnitType.Ground;
						if (removeUnit(otherSideFleet,unit.Ground,1)){
							addUnit(thisSideFleet, thisSide, input, unitType, 1, true)
							thisSideFleet.spent += 2;
						}
					},
				},
				{
					name: 'Magen Omega',
					appliesTo: game.BattleType.Ground,
					condition: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						return options[thisSide].magenDefenseOmega && (options[thisSide].hasDock || thisSideFull.some(structure));
					},
					execute: function (thisSideFleet,otherSideFleet, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {

						[thisSideInflicted,otherSideInflicted]=sustainDamageStep(thisSideFleet, 1, otherSideFleet, 0, true, [null,notGhost], [null,null], options,input);
						var thisSideDeadUnits =applyDamage(thisSideFleet, otherSideInflicted, options[thisSide]);
						var otherSideDeadUnits =applyDamage(otherSideFleet, thisSideInflicted, options[otherSide]);
						destroyedUnits(thisSideDeadUnits,otherSideDeadUnits,thisSideFleet,otherSideFleet,true,options,input);

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
					apply: function (battleType, round, sideOptions) {
						return round === 1 && sideOptions.supercharger ? 1 : 0;
					}
				},
				{
					name: 'superchargerC',
					apply: function (battleType, round, sideOptions,fleet) {
						return (sideOptions.superchargerC && battleType === game.BattleType.Space) ?
							function (unit) {
								return unit.damaged ? -1 : 0;
							} : 0;
					}
				},
				{
					name: 'solDeadInfantry',
					apply: function (battleType, round, sideOptions,fleet) {
						return (sideOptions.race === game.Race.Sol) ?
							function (unit) {
								return unit.type === game.UnitType.Ground && unit.dead ? 1 : 0;
							} : 0;
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
			return unit.spaceCannonDice !== 0 && !unit.typeShip;
		}
		function getUnitWithLowest(fleet, property) {
			var result = null;
			var bestBattleValue = Infinity;
			for (var i = 0; i < fleet.length; i++) {
				if (fleet[i][property] < bestBattleValue && !fleet[i].isDamageGhost && (fleet[i].type !== game.UnitType.Planet)) {
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
		function unitIsNotInfantry(unit){			
			return unit.type !== game.UnitType.Ground && unit.typeGroundForce;
		}
		function unitIsStructure() {
			return function (unit) {
				return unit.typeStructure;
			};
		}
		function validUnit(combat) {
			return function (unit) {
				return  combat || !unit.typeGroundForce;
			}
		}
		function groundForce(unit) {
			return unit.typeGroundForce && !unit.isDamageGhost;
		}
		function ship(unit) {
			return unit.typeShip && !unit.isDamageGhost;
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
		function notGhost(combat){
			return function (unit) {
				return !unit.isDamageGhost;
			}
		}
		function notFighterShip(combat){
			return function (unit) {
				return unit.type !== game.UnitType.Fighter &&  unit.typeShip && validUnit(combat)(unit);
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
		function print(obj) {
			// Get the current stack trace to find the line where the function is called
			const stack = new Error().stack;
			const stackLines = stack.split("\n");
		  
			// Get the line number from the stack trace
			const lineNumber = stackLines[1].match(/:(\d+):\d+/)[1];
		  
			// Check if the object is undefined or null and print accordingly
			if (obj === undefined || obj === null) {
			  console.log(obj, "at line:", lineNumber);
			} else {
			  // If the object is neither null nor undefined, print a copy of the object
			  console.log(JSON.parse(JSON.stringify(obj)), "at line:", lineNumber);
			}
		}
		/*function destroyedUnits(thisSideDeadUnits,otherSideDeadUnits,thisSideFleet,otherSideFleet,combat,options,input){
			//print(otherSideDeadUnits);
			if (combat){
				thisSideFleet.deadUnits=thisSideFleet.deadUnits.concat(thisSideDeadUnits);
				otherSideFleet.deadUnits=otherSideFleet.deadUnits.concat(otherSideDeadUnits);
			}
			if ((options[thisSide].race === game.Race.Yin && thisSideDeadUnits.some(unitIs(game.UnitType.Flagship))) || 
			(options[otherSide].race === game.Race.Yin && otherSideDeadUnits.some(unitIs(game.UnitType.Flagship))))
				yinFlagship();
			if (options[thisSide].mentakHero && combat && input.battleType === root.BattleType.Space)
				mentakHero(otherSideDeadUnits,"thisSide","otherSide",thisSideFleet,otherSideFleet);
			if (options[otherSide].mentakHero && combat && input.battleType === root.BattleType.Space)
				mentakHero(thisSideDeadUnits,"otherSide","thisSide",otherSideFleet,thisSideFleet);
			if (thisSide.yinAgentUses>0)
				yinAgent(thisSideDeadUnits,"thisSide","otherSide",thisSide,otherSide);
			if (otherSide.yinAgentUses>0)
				yinAgent(otherSideDeadUnits,"otherSide","thisSide",otherSide,thisSide);
			if (options.thisSide.race === game.Race.Mahact || options.thisSide.crimsonII)
				thisSide.tgsEarned+=thisSideDeadUnits.filter(unitIs(game.UnitType.Ground)).length*(options.thisSide.infantryIIA ? 1 : 0.5);
			if (options.otherSide.race === game.Race.Mahact || options.otherSide.crimsonII)
				otherSide.tgsEarned+=otherSideDeadUnits.filter(unitIs(game.UnitType.Ground)).length*(options.otherSide.infantryIID ? 1 : 0.5);
			if ((options.thisSide.mentakMech && !thisSide.some(unitIs(game.UnitType.Mech)) && thisSideDeadUnits.some(unitIs(game.UnitType.Mech))) || 
				(options.thisSide.mentakFlagship && !thisSide.some(unitIs(game.UnitType.Flagship)) && thisSideDeadUnits.some(unitIs(game.UnitType.Flagship)))){
				root.restoreDamage(input,'otherSide',otherSide);
			}	
			//print(otherSideDeadUnits);
			if ((options.otherSide.mentakMech && !otherSide.some(unitIs(game.UnitType.Mech)) && otherSideDeadUnits.some(unitIs(game.UnitType.Mech))) || 
			(options.otherSide.mentakFlagship && !otherSide.some(unitIs(game.UnitType.Flagship)) && otherSideDeadUnits.some(unitIs(game.UnitType.Flagship)))){
				game.restoreDamage(input,'thisSide',thisSide);
				//print(thisSide);
			}
			thisSide.deadUnits.push(thisSideDeadUnits);
			otherSide.deadUnits.push(thisSideDeadUnits);
		*/
		function destroyedUnits(thisSideDeadUnits,otherSideDeadUnits,thisSideFleet,otherSideFleet,combat,options,input){
			if (thisSideFleet.side ==="attacker")
				return destroyedUnitsAbsolute(thisSideDeadUnits,otherSideDeadUnits,thisSideFleet,otherSideFleet,combat,options,input);
			else 
				return destroyedUnitsAbsolute(otherSideDeadUnits,thisSideDeadUnits,otherSideFleet,thisSideFleet,combat,options,input);
		}

		function destroyedUnitsAbsolute(attackerDeadUnits,defenderDeadUnits,attacker,defender,combat,options,input){
			//print(defenderDeadUnits);
			if (combat){
				attacker.deadUnits=attacker.deadUnits.concat(attackerDeadUnits);
				defender.deadUnits=defender.deadUnits.concat(defenderDeadUnits);
			}
			if ((options.attacker.race === game.Race.Yin && attackerDeadUnits.some(unitIs(game.UnitType.Flagship))) || 
			(options.defender.race === game.Race.Yin && defenderDeadUnits.some(unitIs(game.UnitType.Flagship))))
				yinFlagship();
			if (options.attacker.mentakHero && combat && input.battleType === root.BattleType.Space)
				mentakHero(defenderDeadUnits,"attacker","defender",attacker,defender);
			if (options.defender.mentakHero && combat && input.battleType === root.BattleType.Space)
				mentakHero(attackerDeadUnits,"defender","attacker",defender,attacker);
			if (attacker.yinAgentUses>0)
				yinAgent(attackerDeadUnits,"attacker","defender",attacker,defender);
			if (defender.yinAgentUses>0)
				yinAgent(defenderDeadUnits,"defender","attacker",defender,attacker);
			if (options.attacker.race === game.Race.Mahact || options.attacker.crimsonII)
				attacker.tgsEarned+=attackerDeadUnits.filter(unitIs(game.UnitType.Ground)).length*(options.attacker.infantryIIA ? 1 : 0.5);
			if (options.defender.race === game.Race.Mahact || options.defender.crimsonII)
				defender.tgsEarned+=defenderDeadUnits.filter(unitIs(game.UnitType.Ground)).length*(options.defender.infantryIID ? 1 : 0.5);
			if ((options.attacker.mentakMech && !attacker.some(unitIs(game.UnitType.Mech)) && attackerDeadUnits.some(unitIs(game.UnitType.Mech))) || 
				(options.attacker.mentakFlagship && !attacker.some(unitIs(game.UnitType.Flagship)) && attackerDeadUnits.some(unitIs(game.UnitType.Flagship)))){
				root.restoreDamage(input,'defender',defender);
			}	
			//print(defenderDeadUnits);
			if ((options.defender.mentakMech && !defender.some(unitIs(game.UnitType.Mech)) && defenderDeadUnits.some(unitIs(game.UnitType.Mech))) || 
			(options.defender.mentakFlagship && !defender.some(unitIs(game.UnitType.Flagship)) && defenderDeadUnits.some(unitIs(game.UnitType.Flagship)))){
				game.restoreDamage(input,'attacker',attacker);
				//print(attacker);
			}
			attacker.deadUnits.push(attackerDeadUnits);
			defender.deadUnits.push(attackerDeadUnits);
				
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
						addUnitBasedOnRace(unit.type,mySide,myFleet,false,input);
						organizeFleet(myFleet,mySide,options,input);
					}
				}
			}
			function yinAgent(deadUnits,mySide,opponentSide,myFleet,opponentFleet){
				if (options[mySide].yinAgent){
					if (deadUnits.some(unitIs(game.UnitType.Cruiser)) || deadUnits.some(unitIs(game.UnitType.Destroyer))){
						addUnitBasedOnRace(game.UnitType.Fighter,mySide,myFleet,!combat,input);
						addUnitBasedOnRace(game.UnitType.Fighter,mySide,myFleet,!combat,input);
						organizeFleet(myFleet,mySide,options,input);
						myFleet.yinAgentUses--;
					}
				}
				else {
					if (deadUnits.some(groundForce) || deadUnits.some(ship)){
						var addedUnit = input.battleType === root.BattleType.Space ? game.UnitType.Fighter : game.UnitType.Ground;
						addUnitBasedOnRace(addedUnit,mySide,myFleet,!combat,input);
						addUnitBasedOnRace(addedUnit,mySide,myFleet,!combat,input);
						organizeFleet(myFleet,mySide,options,input);
						myFleet.yinAgentUses--;
					}
				}
			}
		}

		function expectedHits(fleet,throwType,modifier,modifierRoll,reroll,mySideOptions){
			var vector = calcu.fleetTransitionsVector(fleet, throwType, modifier, modifierRoll, reroll, mySideOptions);
			var sum = 0;
			for(var i=0; i< vector.length; i++) {
				sum += i*vector[i];
			}
			return sum;
		}
		function removeUnit(thisSideFleet, unitType, amount){
			var total = 0;
			for (var j = amount; j>0; j--){
				for (var i = thisSideFleet.length-1; i >= 0; i--) {
					var unit = myFleet[i];
					if (unit.type === unitType){
						myFleet.splice(i, 1);
						if (unit.isDamageGhost){	
							unit = unit.damageCorporeal;
							fleet.splice(fleet.indexOf(unit),1);
						}
						//thisSideFleet.sort(thisSideFleet.comparer);
						total+=1;
						break;
					}
				}
			}
			return total;
		}
		function addUnit(thisSideFleet,thisSide, input, unitType, amount, ignoreDamage, properties){
			game.createUnit(input,thisSide,unitType, amount, thisSideFleet, ignoreDamage, properties);
			thisSideFleet.sort(thisSideFleet.comparer);
		}
		function addUnitBasedOnRace(deadUnitType,battleSide,fleet,startOfCombat,input){
			if (!deadUnitType) return;
			//print(root.createUnit);
			game.createUnit(input,battleSide,deadUnitType,1,fleet, true);
		}
		
		function organizeFleet(fleet,battleSide,option,input){
			fleet.sort(fleet.comparer);
		}
	})();
})(typeof exports === 'undefined' ? window : exports);
