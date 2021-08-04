(function (root) {
	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
	} else {
		structs = window;
		game = window;
	}

	root.stats= {attacker: {tgHacan:0}, defender: {tgHacan:0}};
	root.calculator = (function () {
		var boosts = initBoosts();
		var rollBoosts = initExtraRolls();
		var prebattleActions = initPrebattleActions();

		return {
			computeProbabilities: computeProbabilities,
		};

		/** Compute survival probabilities of each subset of attacker and defender */
		function computeProbabilities(input) {
			var battleType = input.battleType;
			var options = input.options || { attacker: {}, defender: {} };
			var attackerFull = game.expandFleet(input, game.BattleSide.attacker);
			var defenderFull = game.expandFleet(input, game.BattleSide.defender);
			var attacker = attackerFull.filterForBattle();
			var defender = defenderFull.filterForBattle();
			console.log(options);
			//use upper left as an origin
			//initially all the probability mass is concentrated at both fleets being unharmed

			//apply all pre-battle actions, like PDS fire and Barrage
			var actions = prebattleActions;
			if (options.attacker.race === game.Race.Mentak) {
				actions = prebattleActions.slice();
				var t = actions[1];
				actions[1] = actions[2];
				actions[2] = t;
				if (actions[1].name !== 'Mentak racial' ||
					actions[2].name !== 'Assault Cannon')
					throw new Error('unexpected pre-battle actions order');
			}
				var distribution = structs.createMatrix(attacker.length + 1, defender.length + 1, 0);
				distribution[attacker.length][defender.length] = 1;
				var problemArray = [new structs.Problem(distribution, attacker, defender)];
				actions.forEach(function (action) {
					if (action.appliesTo === battleType)
						problemArray = action.execute(problemArray, attackerFull, defenderFull, options, input);
				});
				// the most interesting part - actually compute outcome probabilities
				for (var i = 0; i < problemArray.length; ++i)
					if (problemArray[i].attacker.length && problemArray[i].defender.length)
						solveProblem(problemArray[i], battleType, attackerFull, defenderFull, options,input );

				// format output
				var finalDistribution = new structs.DistributionBase(-attacker.length, defender.length);
				
				var finalAttacker = attacker.map(function (unit) {
					return [unit.shortType];
				});
				var finalDefender = defender.map(function (unit) {
					return [unit.shortType];
				});
				problemArray.forEach(function (problem) {
					finalDistribution[0] = finalDistribution.at(0) + problem.distribution[0][0];

					for (var a = 1; a < problem.distribution.rows; a++) {
						finalDistribution[-a] = finalDistribution.at(-a) + problem.distribution[a][0];
						if (finalAttacker[a - 1].indexOf(problem.attacker[a - 1].shortType) < 0)
							finalAttacker[a - 1].push(problem.attacker[a - 1].shortType);
					}

					for (var d = 1; d < problem.distribution.columns; d++) {
						finalDistribution[d] = finalDistribution.at(d) + problem.distribution[0][d];
						if (finalDefender[d - 1].indexOf(problem.defender[d - 1].shortType) < 0)
							finalDefender[d - 1].push(problem.defender[d - 1].shortType);
					}
				});
	

			var finalAttacker = attacker.map(function (unit) {
				return [unit.shortType];
			});
			var finalDefender = defender.map(function (unit) {
				return [unit.shortType];
			});
			var tgsAttacker=0;
			for (var i = finalDistribution.min; i <=finalDistribution.max; i++){
				var sustainDamages=0;
				for (var j=0; j<i+finalDistribution.min*-1;j++){
					var unit = problemArray[0].attacker[Math.max(problemArray[0].attacker.length-1-j,0)] || {isDamageGhost: false};
					sustainDamages+=unit.isDamageGhost ? 1 : 0;
				}
				tgsAttacker+= finalDistribution[i]*sustainDamages;
			}
			var tgsDefender=0;
			for (var i = finalDistribution.max; i >=finalDistribution.min; i--){
				var sustainDamages=0;
				for (var j=0; j<finalDistribution.max-i;j++){
					var unit = problemArray[0].defender[Math.max(problemArray[0].defender.length-1-j,0)] || {isDamageGhost: false};
					sustainDamages+=unit.isDamageGhost ? 1 : 0;
				}
				tgsDefender+= finalDistribution[i]*sustainDamages;
			}
			tgsAttacker=tgsAttacker==0 || !options.attacker.letnevCommander ? null : Math.round(tgsAttacker*1000)/1000;
			tgsDefender=tgsDefender==0 || !options.defender.letnevCommander ? null : Math.round(tgsDefender*1000)/1000;

			tgsHacanAttacker=stats.attacker.tgHacan==0 || !options.attacker.hacanFlagship ? null : Math.round(stats.attacker.tgHacan*1000)/1000;
			tgsHacanDefender=stats.defender.tgHacan==0 || !options.defender.hacanFlagship ? null : Math.round(stats.defender.tgHacan*1000)/1000;

			return [{
				distribution: finalDistribution,
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
			}, tgsAttacker, tgsDefender, tgsHacanAttacker, tgsHacanDefender];
		}

		/** Do full probability mass redistribution according to transition vectors */
		function solveProblem(problem, battleType, attackerFull, defenderFull, options, input ) {

			var attackerBoost = boost(battleType, options.attacker, options.defender, problem.attacker, true);
			var defenderBoost = boost(battleType, options.defender, options.attacker, problem.defender, true);
			var attackerRollBoost = rollBoost(battleType, options.attacker, options.defender, problem.attacker, true,attackerFull);
			var defenderRollBoost = rollBoost(battleType, options.defender, options.attacker, problem.defender, true,defenderFull);
			//console.log(defenderRollBoost);
			var attackerReroll = battleType === game.BattleType.Ground && options.attacker.fireTeam ||
				battleType === game.BattleType.Space && options.attacker.letnevMunitionsFunding ||
				battleType === game.BattleType.Space && options.attacker.munitions;
			var defenderReroll = battleType === game.BattleType.Ground && options.defender.fireTeam ||
				battleType === game.BattleType.Space && options.defender.letnevMunitionsFunding ||
				battleType === game.BattleType.Space && options.defender.munitions;
				
			var losePlanetary = attackerFull.some(unitIs(game.UnitType.WarSun)) || (attackerFull.some(unitIs(game.UnitType.Flagship)) && options.attacker.race === game.Race.Letnev);
			var magenDefenseAttacker = battleType === game.BattleType.Ground &&
				options.attacker.magenDefense &&
				attackerFull.some(unitShield(options.defender.disable)) &&
				!losePlanetary;
			var magenDefenseDefender = battleType === game.BattleType.Ground &&
				options.defender.magenDefense &&
				defenderFull.some(unitShield(options.attacker.disable)) &&
				!losePlanetary;
			var magenDefenseActivated = magenDefenseAttacker || magenDefenseDefender;
			var effectsFlags = {
				valkyrieParticleWeave: battleType === game.BattleType.Ground,
				winnuFlagship: battleType === game.BattleType.Space,

			};
			/*if (battleType === game.BattleType.Ground && options.defender.magenDefenseOmega && (options.defender.hasDock || defenderFull.some(unitIs(game.UnitType.PDS)))) {
				// Naalu Fighters are considered to be vulnerable to Magen Omega.
				// Also, I don't try to be clever with which Naalu unit will be killed, GF of a Fighter, even though it's defencers choice
				var attackerTransitions = scale([1], problem.attacker.length + 1); // attacker does not fire
				var defenderTransitions = scale([0, 1], problem.defender.length); // defender inflicts one hit if there is anyone present
				defenderTransitions.unshift([1]); // otherwise there is no Ground Comband and hence no Magen Defence Grid Ω
				applyTransitions(problem, attackerTransitions, defenderTransitions, options);
			}*/
			
			if (attackerBoost !== undefined || defenderBoost !== undefined || // boosts apply to the first round only
				attackerRollBoost !== undefined || defenderRollBoost !== undefined ||
				magenDefenseActivated || // Magen Defence applies to the first round
				attackerReroll || defenderReroll // re-rolls apply to the first round
			) {
				//need to make one round of propagation with either altered probabilities or attacker not firing
				var attackerTransitionsFactory = function () {
					return computeFleetTransitions(problem.attacker, game.ThrowType.Battle, attackerBoost, attackerRollBoost, attackerReroll,options.attacker);
				};
				var defenderTransitionsFactory = function () {
					return computeFleetTransitions(problem.defender, game.ThrowType.Battle, defenderBoost, defenderRollBoost, defenderReroll,options.defender);
				};
				if (magenDefenseActivated){
					if (magenDefenseDefender)
						attackerTransitionsFactory = function () {
							return scale([1], problem.attacker.length + 1); // attacker does not fire
					};
					if (magenDefenseAttacker)
						defenderTransitionsFactory = function () {
							return scale([1], problem.defender.length + 1); // defender does not fire
					};
				}

				if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) { // Harrow
					// The first row, the one where the attacker was wiped out by defending pds should not be affected by the harrow
					// Remember this row, as it might get some probability mass from applyTransiions. And this mass is liable to harrow
					var stashedRow = problem.distribution[0];
					problem.distribution[0] = new Array(problem.distribution.columns);
					problem.distribution[0].fill(0);
					applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
					prebattleActions.find(function (action) {
						return action.name === 'Bombardment';
					}).execute([problem], attackerFull, defenderFull, options)
					for (var d = 0; d < problem.distribution.columns; ++d) {
						problem.distribution[0][d] += stashedRow[d];
					}
				} else {
					applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
				}
				if (battleType === game.BattleType.Space){
					collapseYinFlagship(problem, options);
				}
				if (battleType === game.BattleType.Space && options.defender.rout){
					for (var ro=0; ro<problem.distribution.rows; ro++){
						for (var col=0; col<problem.distribution.columns; col++){
							if (ro !== 0 && col !== 0){
								problem.distribution[0][col]+=problem.distribution[ro][col];
								problem.distribution[ro][col]=0;
							}
						}
					}
				}
			} else if (battleType === game.BattleType.Space && options.defender.rout){
				var attackerTransitionsFactory = function () {
					return computeFleetTransitions(problem.attacker, game.ThrowType.Battle, attackerBoost, attackerRollBoost, attackerReroll,options.attacker);
				};
				var defenderTransitionsFactory = function () {
					return computeFleetTransitions(problem.defender, game.ThrowType.Battle, defenderBoost, defenderRollBoost, defenderReroll,options.defender);
				};
				applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
				for (var ro=0; ro<problem.distribution.rows; ro++){
					for (var col=0; col<problem.distribution.columns; col++){
						if (ro !== 0 && col !== 0){
							problem.distribution[0][col]+=problem.distribution[ro][col];
							problem.distribution[ro][col]=0;
						}
					}
				}
			}

			if (magenDefenseActivated && ((attackerBoost !== undefined || attackerReroll || attackerRollBoost !== undefined) || (defenderBoost !== undefined || defenderReroll || defenderRollBoost !== undefined))) {
				// damn it, one more round of propagation with altered probabilities, but just for attacker
				// Harrow ignored, because Magen Defense implies Planetary Shield and no Bombardment.
				// Yin Flagship ignored, because Magen Defense implies Ground combat
				var attackerTransitionsFactory = function () {
					return computeFleetTransitions(problem.attacker, game.ThrowType.Battle, attackerBoost, attackerRollBoost, attackerReroll, options.attacker);
				};
				var defenderTransitionsFactory = function () {
					return computeFleetTransitions(problem.defender, game.ThrowType.Battle, defenderBoost, defenderRollBoost, defenderReroll, options.defender);
				};
				if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) {
					var stashedRow = problem.distribution[0];
					problem.distribution[0] = new Array(problem.distribution.columns);
					problem.distribution[0].fill(0);
					applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
					prebattleActions.find(function (action) {
						return action.name === 'Bombardment';
					}).execute([problem], attackerFull, defenderFull, options)
					for (var d = 0; d < problem.distribution.columns; ++d) {
						problem.distribution[0][d] += stashedRow[d];
					}
				} else {
					applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
				}
			}
			propagateProbabilityUpLeft(problem, battleType, attackerFull, defenderFull, options,input);
		}

		function propagateProbabilityUpLeft(problem, battleType, attackerFull, defenderFull, options,input) {
			
			var distr = problem.distribution;
			/*var p = distr;
			for (i in p){
				console.log(p[i]);
			}*/
			// evaluate probabilities of transitions for each fleet
			var attackerReroll = options.attacker.munitions;
			var defenderReroll = options.defender.munitions;
			var attackerTransitions = computeFleetTransitions(problem.attacker, game.ThrowType.Battle, boost(battleType, options.attacker, options.defender, problem.attacker, false), rollBoost(battleType, options.attacker, options.defender, problem.attacker, false, attackerFull), attackerReroll,options.attacker);
			var defenderTransitions = computeFleetTransitions(problem.defender, game.ThrowType.Battle, boost(battleType, options.defender, options.attacker, problem.defender, false), rollBoost(battleType, options.defender, options.attacker, problem.defender, false, defenderFull), defenderReroll, options.defender);
			if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) {
				var harrowTransitions = bombardmentTransitionsVector(attackerFull, defenderFull, options,input, false);
				if (harrowTransitions.length === 1) //means no bombardment
					harrowTransitions = undefined;
			}
			else
				var harrowTransitions = undefined;
			var winnuFlagshipRelevant = battleType === game.BattleType.Space &&
				(options.attacker.race === game.Race.Winnu && problem.attacker.some(unitIs(game.UnitType.Flagship)) ||
					options.defender.race === game.Race.Winnu && problem.defender.some(unitIs(game.UnitType.Flagship)));
			var attackerFlagshipIndex = options.attacker.race === game.Race.Yin ?
				findLastIndex(problem.attacker, unitIs(game.UnitType.Flagship)) + 1
				: 0;
			var defenderFlagshipIndex = options.defender.race === game.Race.Yin ?
				findLastIndex(problem.defender, unitIs(game.UnitType.Flagship)) + 1
				: 0;


			for (var a = distr.rows - 1; 0 < a; a--) {
				for (var d = distr.columns - 1; 0 < d; d--) {

					if (winnuFlagshipRelevant) {
						if (options.attacker.race === game.Race.Winnu && modifyWinnuFlagship(problem.attacker, problem.defender, d)) {
							attackerTransitions = computeFleetTransitions(problem.attacker, game.ThrowType.Battle, boost(battleType, options.attacker, options.defender, problem.attacker, false), rollBoost(battleType, options.attacker, options.defender, problem.attacker, false,defenderFull),attackerReroll, options.attacker);
						}
						if (options.defender.race === game.Race.Winnu && modifyWinnuFlagship(problem.defender, problem.attacker, a)) {
							defenderTransitions = computeFleetTransitions(problem.defender, game.ThrowType.Battle, boost(battleType, options.defender, options.attacker, problem.defender, false), rollBoost(battleType, options.defender, options.attacker, problem.defender, false,attackerFull),defenderReroll, options.defender);
						}
					}
					var attackerTransitionsVector = adjustForNonEuclidean(attackerTransitions[a], problem.defender, d - 1, options.defender);
					var defenderTransitionsVector = adjustForNonEuclidean(defenderTransitions[d], problem.attacker, a - 1, options.attacker);
					var transitionMatrix = orthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector, d + 1, a + 1);
					if (battleType === game.BattleType.Ground)
						transitionMatrix = adjustForValkyrieParticleWeave(transitionMatrix, options, d + 1, a + 1);
					if (harrowTransitions)
						transitionMatrix = harrowMultiply(transitionMatrix, harrowTransitions, d + 1, a + 1); // no Sustain Damage assumption
					
					var k;
					if (distr[a][d] === 0)
						continue;
					else {
						k = distr[a][d] / (1 - transitionMatrix.at(0, 0));
					}
					// transitions for everything except for attackerInflicted===0&&defenderInflicted===0
					for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
						for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns && defenderInflicted <= a; defenderInflicted++) {
							if (attackerInflicted === 0 && defenderInflicted === 0) continue;
							var targetA = a - defenderInflicted;
							var targetD = d - attackerInflicted;
							if (targetA < attackerFlagshipIndex || targetD < defenderFlagshipIndex) {
								targetA = targetD = 0;
							}
							distr[targetA][targetD] += transitionMatrix.at(attackerInflicted, defenderInflicted) * k;
							
						}
					}
					/*var p = distr;
					for (i in p){
						console.log(p[i]);
					}*/
					// all probability mass was moved from distr[a][d]
					distr[a][d] = 0;
				}
			}
		}

		/** Compute transition arrays for all left-subsets of the fleet
		 * result[4] === [X,Y,Z,..] means that probabilities of the first 4 units in the fleet
		 * inflicting 0, 1, 2 etc damage points are X, Y, Z, etc respectively
		 * @param throwType game.ThrowType */
		function computeFleetTransitions(fleet, throwType, modifier, modifierRoll, reroll, thisSideOptions) {
			modifier = modifier || 0;
			modifierRoll = modifierRoll || 0;
			var result = [[1]];
			for (var a = 1; a <= fleet.length; ++a) {
				var unit = fleet[a - 1];
				var thisUnitTransitions = computeUnitTransitions(unit, throwType, modifier, modifierRoll, reroll,thisSideOptions);
				result.push(slideMultiply(thisUnitTransitions, result[a - 1]));
			}
			return result;
		}

		/** like computeFleetTransitions, but not all units are allowed to throw dice */
		function computeSelectedUnitsTransitions(fleet, throwType, predicate, modifier, extraRoll, reroll, thisSideOptions) {
			var result = [[1]];
			var currentTransitions = [[1]];
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];
				if (predicate(unit)) {
					var transitions = computeUnitTransitions(unit, throwType, modifier,0, reroll,thisSideOptions);
					currentTransitions = slideMultiply(currentTransitions, transitions);
				}
				result.push(currentTransitions);
			}
			
			var bestUnit = getUnitWithLowest(fleet, game.ThrowValues[throwType]);
			if (bestUnit) {
				result.pop();
				var dummyUnit = bestUnit.clone();
				dummyUnit[game.ThrowDice[throwType]] = 0;
				var transitions = computeUnitTransitions(dummyUnit, throwType, modifier,extraRoll, reroll,thisSideOptions);
				currentTransitions = slideMultiply(currentTransitions, transitions)
				result.push(currentTransitions);
			}
			return result;
		}

		/** Compute probabilities of the unit inflicting 0, 1, etc. hits.
		 * @param reroll is used for units that can reroll failed throws */
		function computeUnitTransitions(unit, throwType, modifier, modifierRoll, reroll, thisSideOptions) {
			var battleValue = unit[game.ThrowValues[throwType]];
			var diceCount = unit[game.ThrowDice[throwType]];
			modifier = modifier || 0;
			modifierRoll = modifierRoll || 0;
			//console.log(modifierRoll);
			var modifierFunction = typeof modifier === 'function' ? modifier : function (unit) {
				return modifier;
			};
			var modifierRollFunction = typeof modifierRoll === 'function' ? modifierRoll: function (unit) {
				return modifierRoll;
			};
			var singleDie = [];
			var diceRolls=diceCount + modifierRollFunction(unit);
			var oneRollMiss = Math.max(Math.min((battleValue - 1 - modifierFunction(unit)) / game.dieSides, 1), 0);
			if (diceRolls===0 || oneRollMiss===1) return [1];
			if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && throwType === game.ThrowType.Battle) {
				var oneRollHit = 1 - oneRollMiss;
				var oneRollZeroHit = Math.min(0.8, oneRollMiss);
				var oneRollOneHit = Math.max(0, (oneRollHit - 0.2)); // hit, but not 9 or 0 on the die
				var oneRollTwoHit = Math.max(0, 0.2 - oneRollHit); // +2 hits, but not a regular hit somehow.
				var oneRollThreeHit = Math.min(0.2, oneRollHit);

				singleDie[0] = oneRollZeroHit * (reroll ? oneRollZeroHit : 1); // miss both on first roll and reroll
				singleDie[1] = oneRollOneHit + (reroll ? oneRollMiss * oneRollOneHit : 0); // hit on first roll or hit on reroll
				singleDie[2] = oneRollTwoHit + (reroll ? oneRollMiss * oneRollTwoHit : 0);
				singleDie[3] = oneRollThreeHit + (reroll ? oneRollMiss * oneRollThreeHit : 0);
			} else {
				singleDie[0] = oneRollMiss;
				if (reroll)
					singleDie[0] = singleDie[0] * singleDie[0];
				singleDie[1] = 1 - singleDie[0];
			}
			var result = singleDie;
			for (var i = 1; i < (diceCount + modifierRollFunction(unit)); i++) {
				result = slideMultiply(result, singleDie);
			}
			if (thisSideOptions.crownThalnosSafe && diceRolls>1 && throwType == game.ThrowType.Battle){
				var temp1=result;
				var oneRollMissNew= Math.max(Math.min((battleValue - 1 - modifierFunction(unit)-1) / game.dieSides, 1), 0);
				for (var i=diceRolls-1; i>0;i--){
					var temp = chanceList(oneRollMissNew,diceRolls-i);
					var k = temp1[i];
					temp1[i]=0;
					for (var j=0;j<temp.length;j++){
						temp1[i+j]=temp[j]*k+temp1[i+j];
					}
				}
				result=temp1;
			}
			return result;
		}
		function binomialDistribution(trials,numSuc,failChance){
			var coeff = 1;
    		for (var x = trials-numSuc+1; x <= trials; x++) coeff *= x;
    		for (x = 1; x <= numSuc; x++) coeff /= x;
			return coeff * ((1-failChance) ** numSuc) * (failChance ** (trials-numSuc))
		}
		function chanceList(failChance,diceNum){
			var result=[];
			for (var i=0; i<=diceNum;i++)
				result[i]=binomialDistribution(diceNum,i,failChance);
			return result;
		}
		/** Multiply two transition arrays to produce probabilities of total hits being 0, 1, 2 etc. */
		function slideMultiply(transitions1, transitions2) {
			var result = [];
			for (var i = 0; i < transitions1.length + transitions2.length - 1; ++i)
				result[i] = 0;
			for (var i1 = 0; i1 < transitions1.length; ++i1) {
				for (var i2 = 0; i2 < transitions2.length; ++i2)
					result[i1 + i2] += transitions1[i1] * transitions2[i2];
			}
			return result;
		}

		/** Same as unconstrainedOrthogonalMultiply, but will conflate probabilities of damages exceeding rows-1 and columns-1 */
		function orthogonalMultiply(transitions1, transitions2, rows, columns) {
			// Could have been:
			// return constrainTransitionMatrix(unconstrainedOrthogonalMultiply(transitions1, transitions2), rows, columns);
			// but is faster
			return {
				rows: Math.min(rows, transitions1.length),
				columns: Math.min(columns, transitions2.length),
				at: function (i1, i2) {
					var inflicted1 = transitions1[i1];
					if (i1 === rows - 1)
						while (++i1 < transitions1.length)
							inflicted1 += transitions1[i1];
					var inflicted2 = transitions2[i2];
					if (i2 === columns - 1)
						while (++i2 < transitions2.length)
							inflicted2 += transitions2[i2];
					return inflicted1 * inflicted2;
				},
			};
		}

		/** Create matrix-like object providing probabilities of inflicted damage
		 * result.at(1,2) == X means that probability of the first fleet inflicting 1 dmg while the second inflicts 2 is X */
		function unconstrainedOrthogonalMultiply(transitions1, transitions2) {
			return {
				rows: transitions1.length,
				columns: transitions2.length,
				at: function (i1, i2) {
					return transitions1[i1] * transitions2[i2];
				},
			};
		}

		/** Similar in purpose and result to orthogonalMultiply, but takes pre-round firing into account */
		function harrowMultiply(transitionMatrix, postroundAttackerTransitions, rows, columns) {
			if (!postroundAttackerTransitions || postroundAttackerTransitions.length === 1)
				return transitionMatrix;

			return constrainTransitionMatrix({
				rows: transitionMatrix.rows + postroundAttackerTransitions.length - 1,
				columns: transitionMatrix.columns,
				at: function (i1, i2) {
					var result = 0;
					for (var i = 0; i <= i1 && i < postroundAttackerTransitions.length; ++i) {
						if (i1 - i < transitionMatrix.rows) {
							var postRound = postroundAttackerTransitions[i];
							result += postRound * transitionMatrix.at(i1 - i, i2);
						}
					}
					return result;
				},
			}, rows, columns);
		}

		/** Apply transition vectors to the distribution matrix just once
		 * attackerVulnerableFrom and defenderVulnerableFrom could be used*/
		function applyTransitions(problem, attackerTransitions, defenderTransitions, options, effectsFlags) {
			var distribution = problem.distribution;
			if (effectsFlags && !(effectsFlags.winnuFlagship && options.attacker.race === game.Race.Winnu))
				attackerTransitions = attackerTransitions();
			if (effectsFlags && !(effectsFlags.winnuFlagship && options.defender.race === game.Race.Winnu))
				defenderTransitions = defenderTransitions();
			effectsFlags = effectsFlags || {};

			for (var a = 0; a < distribution.rows; a++) {
				for (var d = 0; d < distribution.columns; d++) {

					if (distribution[a][d] === 0) continue;

					var computedAttackerTransitions = attackerTransitions;
					var computedDefenderTransitions = defenderTransitions;
					if (effectsFlags.winnuFlagship) {
						if (options.attacker.race === game.Race.Winnu) {
							modifyWinnuFlagship(problem.attacker, problem.defender, d);
							computedAttackerTransitions = attackerTransitions();
						}
						if (options.defender.race === game.Race.Winnu) {
							modifyWinnuFlagship(problem.defender, problem.attacker, a);
							computedDefenderTransitions = defenderTransitions();
						}
					}
					var attackerTransitionsVector = adjustForNonEuclidean(computedAttackerTransitions[a], problem.defender, d - 1, options.defender);
					var defenderTransitionsVector = adjustForNonEuclidean(computedDefenderTransitions[d], problem.attacker, a - 1, options.attacker);
					var transitionMatrix = orthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector, d + 1, a + 1);
					if (effectsFlags.valkyrieParticleWeave)
						transitionMatrix = adjustForValkyrieParticleWeave(transitionMatrix, options, d + 1, a + 1); // no Sustain Damage assumption. Otherwise Valkyrie should be taken into account before Non-Euclidean Shielding somehow
					for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
						for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
							if (attackerInflicted === 0 && defenderInflicted === 0) continue;
							distribution[a - defenderInflicted][d - attackerInflicted] += transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d];
						}
					}
					distribution[a][d] *= transitionMatrix.at(0, 0);
				}
			}
		}

		function initPrebattleActions() {

			return [
				{
					name: 'Space Cannon -> Ships',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						var result = [];
						var attackerVirusFlagship = options.attacker.race === game.Race.Virus &&
							attackerFull.some(unitIs(game.UnitType.Flagship)) && (attackerFull.some(unitIs(game.UnitType.Ground)) || attackerFull.some(unitIs(game.UnitType.Mech))) && !options.attacker.memoriaII;
						var defenderVirusFlagship = options.defender.race === game.Race.Virus &&
							defenderFull.some(unitIs(game.UnitType.Flagship)) && (defenderFull.some(unitIs(game.UnitType.Ground)) || defenderFull.some(unitIs(game.UnitType.Mech))) && !options.defender.memoriaII;
						var attackerNaazRokhaMech = options.attacker.race === game.Race.NaazRokha &&
							attackerFull.some(unitIs(game.UnitType.Mech));
						var defenderNaazRokhaMech = options.defender.race === game.Race.NaazRokha &&
							defenderFull.some(unitIs(game.UnitType.Mech));
						var attackerNomadMech = options.attacker.race === game.Race.Nomad &&
							attackerFull.some(unitIsOnlyGhost(game.UnitType.Mech));
						var defenderNomadMech = options.defender.race === game.Race.Nomad &&
							defenderFull.some(unitIsOnlyGhost(game.UnitType.Mech));

							
						problemArray.forEach(function (problem) {
							var attackerTransitionsVector = getSpaceCannonTransitionsVector(attackerFull, defenderFull, options.attacker, options.defender);
							var defenderTransitionsVector = getSpaceCannonTransitionsVector(defenderFull, attackerFull, options.defender, options.attacker);

							if (options.attacker.gravitonLaser || options.defender.gravitonLaser ||
								attackerVirusFlagship || defenderVirusFlagship || attackerNaazRokhaMech || 
								defenderNaazRokhaMech || attackerNomadMech || defenderNomadMech
							) {
								var ensemble = new structs.EnsembleSplit(problem);

								var distribution = problem.distribution;
								for (var a = 0; a < distribution.rows; a++) {
									for (var d = 0; d < distribution.columns; d++) {
										if (distribution[a][d] === 0) continue;

										var transitionMatrix = unconstrainedOrthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector);

										for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
											for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
												var attackerVictims = gravitonLaserVictims(problem.attacker, attackerFull, a, defenderInflicted, options.attacker, options.defender);
												var defenderVictims = gravitonLaserVictims(problem.defender, defenderFull, d, attackerInflicted, options.defender, options.attacker);
												ensemble.increment(attackerVictims, defenderVictims, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
											}
										}
									}
								}

								var subproblems = ensemble.getSubproblems();
								subproblems.forEach(function (subproblem) {
									collapseYinFlagship(subproblem, options, problem);
								});
								result.push.apply(result, subproblems);
							} else {

								var attackerTransitions = scale(attackerTransitionsVector, problem.attacker.length + 1);
								var defenderTransitions = scale(defenderTransitionsVector, problem.defender.length + 1);
								applyTransitions(problem, attackerTransitions, defenderTransitions, options);
								collapseYinFlagship(problem, options);
								result.push(problem);
							}
						});
						return result;

						function getSpaceCannonTransitionsVector(fleetFull, opponentFleetFull, thisSideOptions, opponentSideOptions) {
							var modifier = opponentSideOptions.antimassDeflectors ? -1 : 0;
							var spaceCannonFleet = fleetFull.filter(hasSpaceCannon);
							var argentFlagship = opponentFleetFull.some(unitIs(game.UnitType.Flagship)) && opponentSideOptions.race === game.Race.Argent;
							var vector;
							
							var additional = 0;
							var reroll = thisSideOptions.jolnarCommander;

							additional += thisSideOptions.plasmaScoring ? 1 : 0;
							additional += thisSideOptions.argentCommander ? 1 : 0;
							additional += getKeyByValue(options,thisSideOptions) === 'attacker' && thisSideOptions.argentStrikeWingSpaceCannonA && thisSideOptions.race !== game.Race.Argent ? 1 : 0;
							additional += getKeyByValue(options,thisSideOptions) === 'defender' && thisSideOptions.argentStrikeWingSpaceCannonD && thisSideOptions.race !== game.Race.Argent ? 1 : 0;

							vector = fleetTransitionsVectorWithAdditionalRoll(spaceCannonFleet, game.ThrowType.SpaceCannon, modifier, additional, reroll,thisSideOptions);
							if (opponentSideOptions.solarFlare || argentFlagship)
								return cancelHits(vector, 100000);
							return cancelHits(vector, opponentSideOptions.maneuveringJetsUses);

						}

						function hasSpaceCannon(unit) {
							return unit.spaceCannonDice !== 0;
						}

						function gravitonLaserVictims(fleet, thisSideFleetFull, index, hits, thisSideOptions, opponentSideOptions) {
							hits = (thisSideFleetFull.some(unitIs(game.UnitType.Flagship)) && thisSideOptions.race === game.Race.Argent) || thisSideOptions.solarFlare ? 0 : hits;
							if (hits === 0 || index === 0)
								return structs.Victim.Null;
							if (!opponentSideOptions.gravitonLaser && !thisSideOptions.nonEuclidean && !fleet.some(unitIs(game.UnitType.Ground)) && !fleet.some(unitIs(game.UnitType.Mech)) && !fleet.some(unitIsOnlyGhost(game.UnitType.Mech))) {
								var result = new structs.Victim();
								result._dead = Math.min(hits, fleet.map(absorbsHits).reduce(sum));
								return result;
							}

							var ranges = [];
							var currentRange = null;
							var i = index - 1;
							while (0 <= i && 0 < hits) {
								var unit = fleet[i];
								if (unit.type === game.UnitType.Fighter && opponentSideOptions.gravitonLaser) {
									currentRange = null;
								} else if (unit.type === game.UnitType.Ground || unit.type === game.UnitType.Mech) {
									currentRange = null;
								} else {
									if (currentRange === null) {
										currentRange = [i + 1, i + 1];
										ranges.push(currentRange);
									}
									currentRange[0]--;
									hits -= absorbsHits(unit);
								}
								i--;
							}
							var currentRange = null;
							// now hit Fighters if needed
							if (opponentSideOptions.gravitonLaser)
								for (var i = index - 1; 0 <= i && 0 < hits; --i) {
									if (fleet[i].type === game.UnitType.Fighter) {
										if (currentRange === null) {
											currentRange = [i + 1, i + 1];
											ranges.push(currentRange);
										}
										currentRange[0]--;
										hits -= absorbsHits(fleet[i]); // will always be the same as hits--
									}
								}
							ranges.sort(function (r1, r2) { return r1[0] - r2[0]; });
							var result = new structs.Victim();
							ranges.forEach(function (range) { result.addRange(range[0], range[1]); });
							return result;

							function absorbsHits(unit) {
								return (unit.isDamageGhost && thisSideOptions.nonEuclidean) ? 2 : 1;
							}

							function sum(a, b) {
								return a + b;
							}
						}
					},
				},
				{
					name: 'Assault Cannon',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						if (!options.attacker.assaultCannon && !options.defender.assaultCannon) {
							return problemArray;
						}

						var result = [];
						problemArray.forEach(function (problem) {
							console.log(problem.attacker);
							var ensemble = new structs.EnsembleSplit(problem);
							var attackerThreshold = findAssaultCannonThreshold(problem.attacker, options.attacker.assaultCannon);
							var defenderThreshold = findAssaultCannonThreshold(problem.defender, options.defender.assaultCannon);
							var attackerVictims = calculateVictims(problem.attacker, defenderThreshold < problem.defender.length, true);
							var defenderVictims = calculateVictims(problem.defender, attackerThreshold < problem.attacker.length, false);

							//console.log(defenderVictims);
							var distribution = problem.distribution;
							for (var a = 0; a < distribution.rows; a++) {
								for (var d = 0; d < distribution.columns; d++) {
									if (distribution[a][d] === 0) continue;
									var attackerVictim = defenderThreshold < d ? attackerVictims[a] : structs.Victim.Null;
									var defenderVictim = attackerThreshold < a ? defenderVictims[d] : structs.Victim.Null;
									ensemble.increment(attackerVictim, defenderVictim, a, d, distribution[a][d]);
								}
							}
							var subproblems = ensemble.getSubproblems();
							subproblems.forEach(function (subproblem) {
								collapseYinFlagship(subproblem, options, problem);
							});
							result.push.apply(result, subproblems);
						});
						return result;

						function findAssaultCannonThreshold(fleet, assaultCannon) {
							var nonFightersFound = 0;
							for (var i = 0; i < fleet.length; i++) {
								if (notFighterShip(fleet[i]))
									nonFightersFound++;
								if (nonFightersFound >= 3 && assaultCannon)
									return i;
							}
							return i;
						}

						function calculateVictims(fleet, victimsNeeded, canTakeIntoGroundForces) {
							var result = new Array(fleet.length + 1);
							if (!victimsNeeded)
								result.fill(structs.Victim.Null);
							else {
								result[0] = structs.Victim.Null;
								var victim = undefined;
								var splice1 = undefined;
								var splice2 = undefined;
								for (var i = 0; i < fleet.length; ++i) {
									if ((canTakeIntoGroundForces ? notFighterShip : notFighterNorGroundForceShip)(fleet[i])) {
										victim = fleet[i];
										splice1 = i;
										splice2 = undefined;
									} else if (victim && fleet[i].damageCorporeal === victim) {
										splice2 = i;
									}
									var v = new structs.Victim();
									if (splice1 !== undefined) {
										v.addRange(splice1, undefined);
										if (splice2 !== undefined)
											v.addRange(splice2, undefined);
									}
									result[i + 1] = v;
								}
							}
							return result;
						}
					},
				},
				{
					name: 'Mentak racial',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						problemArray.forEach(function (problem) {
							if (options.attacker.race !== game.Race.Mentak && options.defender.race !== game.Race.Mentak)
								return;

							function createMentakTransitions(fleet, thisSideOptions) {
								var firedShips = 0;
								// motivated by timing order discussed at https://boardgamegeek.com/thread/2007331/mentak-ambush
								var boost = thisSideOptions.moraleBoost ? 1 : 0;
								boost = thisSideOptions.winnuCommander ? boost + 2: boost;
								boost = thisSideOptions.nebula ? boost + 1 : boost;
								boost = thisSideOptions.supercharger ? boost + 1: boost;
								return computeSelectedUnitsTransitions(fleet, game.ThrowType.Battle, function (ship) {
									if (2 <= firedShips) {
										return false;
									} else if (ship.type === game.UnitType.Cruiser || ship.type === game.UnitType.Destroyer) {
										firedShips++;
										return true;
									}
									return false;
								}, boost,0,false,thisSideOptions);
							}

							var attackerTransitions;
							var defenderTransitions;
							if (options.attacker.race === game.Race.Mentak)
								attackerTransitions = createMentakTransitions(problem.attacker, options.attacker);
							else
								attackerTransitions = scale([1], problem.attacker.length + 1);
							if (options.defender.race === game.Race.Mentak)
								defenderTransitions = createMentakTransitions(problem.defender, options.defender);
							else
								defenderTransitions = scale([1], problem.defender.length + 1);
							applyTransitions(problem, attackerTransitions, defenderTransitions, options);
							collapseYinFlagship(problem, options);
						});
						return problemArray;
					},
				},
				{
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (problemArray, attackerFull, defenderFull, options) {

						var result = [];
						problemArray.forEach(function (problem) {
							
							var ensemble = new structs.EnsembleSplit(problem);
							var attackerAdditional=0;
							var defenderAdditional=0;
							var attackerReroll= options.attacker.jolnarCommander ? true: false;
							var defenderReroll= options.defender.jolnarCommander ? true: false;
							attackerAdditional+= options.attacker.argentCommander ? 1: 0;
							attackerAdditional+=options.attacker.argentStrikeWingBarrageA && options.attacker.race !== game.Race.Argent ? 1: 0;
							defenderAdditional+= options.defender.argentCommander ? 1: 0;
							defenderAdditional+=options.defender.argentStrikeWingBarrageD && options.defender.race !== game.Race.Argent ? 1: 0;
							var attackerTransitions = computeSelectedUnitsTransitions(problem.attacker, game.ThrowType.Barrage, hasBarrage, 0, attackerAdditional,attackerReroll,options.attacker);
							var defenderTransitions = computeSelectedUnitsTransitions(problem.defender, game.ThrowType.Barrage, hasBarrage, 0, defenderAdditional,defenderReroll,options.defender);

							var distribution = problem.distribution;
							for (var a = 0; a < distribution.rows; a++) {
								for (var d = 0; d < distribution.columns; d++) {
									if (distribution[a][d] === 0) continue;

									var transitionMatrix = unconstrainedOrthogonalMultiply(attackerTransitions[a], defenderTransitions[d]);

									for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
										for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {

											var attackerVictims = barrageVictims(problem.attacker, options.defender.waylay ? True() : unitIsFighter(), a, defenderInflicted, options.attacker, options.defender);
											var defenderVictims = barrageVictims(problem.defender, options.attacker.waylay ? True() : unitIsFighter(), d, attackerInflicted, options.defender, options.attacker);
											ensemble.increment(attackerVictims, defenderVictims, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
										}
									}
								}
							}
							result.push.apply(result, ensemble.getSubproblems());
						});

						return result;

						function unitIsFighter(){
							return function (unit) {
								return unit.type === game.UnitType.Fighter;
							}; 
						}
						function hasBarrage(unit) {
							return unit.barrageDice !== 0;
						}

						function barrageVictims(fleet, predicate, index, hits, thisSideOptions, opposingSideOptions) {
							var cancel = fleet.filter(predicate).length>=hits;
							var excessHits = Math.max(hits-fleet.filter(unitIsFighter()).length,0);
							var ranges = [];
							var argentRanges=[];
							var currentRange = null;
							var i = index - 1;
							if (opposingSideOptions.race == game.Race.Argent){
								while (0 <= i && 0 < excessHits) {
									var unit = fleet[i];
									if (unit.type === game.UnitType.Fighter || !unit.isDamageGhost) {
										currentRange = null;
									} else {
										if (currentRange === null) {
											currentRange = [i + 1, i + 1];
											argentRanges.push(currentRange);
										}
										currentRange[0]--;
										excessHits--;
									}
									i--;
								}
								var currentRange = null;
							}
							for (var i = index - 1; 0 <= i && 0 < hits; --i) {
								var unit = fleet[i];
								if ((predicate(unit) || (cancel && unit.cancelHit)) && !inRange(i,argentRanges)){
									if (currentRange === null) {
										currentRange = [i + 1, i + 1];
										ranges.push(currentRange);
									}
									currentRange[0]--;
									hits -= absorbsHits(fleet[i]); // will always be the same as hits--
								}
							}
							argentRanges.forEach(function (range){ ranges.push(range); });
							ranges.sort(function (r1, r2) { return r1[0] - r2[0]; });
							var result = new structs.Victim();
							ranges.forEach(function (range) { result.addRange(range[0], range[1]); });
							return result;

							function inRange(ind, list) {
								for (n in list){
									if (ind>=list[n][0] && ind<=list[n][1])
										return true;
								}
								return false;
							}
							function absorbsHits(unit) {
								return (unit.isDamageGhost && thisSideOptions.nonEuclidean) ? 2 : 1;
							}
							function unitIsFighter(){
								return function (unit) {
									return unit.type === game.UnitType.Fighter;
								}; 
							}
						}
					},
				},
				{
					name: 'Bombardment',
					appliesTo: game.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull, options,input ) {
						var result = [];
						problemArray.forEach(function (problem) {
							
							var attackerTransitionsVector = bombardmentTransitionsVector(attackerFull, defenderFull, options,input, true);
							var attackerTransitions = scale(attackerTransitionsVector, problem.attacker.length + 1);
							var defenderTransitions = scale([1], problem.defender.length + 1);

							var ensemble = new structs.EnsembleSplit(problem);

							var distribution = problem.distribution;
							for (var a = 0; a < distribution.rows; a++) {
								for (var d = 0; d < distribution.columns; d++) {
									if (distribution[a][d] === 0) continue;

									var transitionMatrix = unconstrainedOrthogonalMultiply(attackerTransitionsVector, defenderTransitions[d]);
				
									for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
										for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
											var defenderVictims = bombardmentVictims(problem.defender,  d, attackerInflicted, options.defender, options.attacker);

											ensemble.increment(structs.Victim.Null, defenderVictims, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
										}
									}
								}
							}
							result.push.apply(result, ensemble.getSubproblems());
						});
						return result;

						function unitIsNotInfantry(){
							return function (unit) {
								return unit.type !== game.UnitType.Ground;
							}; 
						}
						function unitIsInfantry(){
							return function (unit) {
								return unit.type === game.UnitType.Ground;
							}; 
						}
						function unitIsNotCancel(){
							return function (unit) {
								return !unit.cancelHit;
							}; 
						}
						function inRange(ind, list) {
							for (n in list){
								if (ind>=list[n][0] && ind<=list[n][1])
									return true;
							}
							return false;
						}
						function bombardmentVictims(fleet, index, hits, thisSideOptions, opposingSideOptions) {
							var cancel = fleet.length>=hits;
							var nonInfantryHits = fleet.filter(unitIsNotInfantry()).length;
							var infantryHits = fleet.length - nonInfantryHits;
							
							//var predicate = thisSideOptions.x89Conservative && nonInfantryHits<=hits ? unitIsNotInfantry() : (cancel ? True() : unitIsNotCancel());
							var ranges = [];
							var currentRange = null;
							var killAllInfantry=false;
							//console.log(hits);
							if (hits>nonInfantryHits || !thisSideOptions.x89Conservative){
								for (var i = index - 1; 0 <= i && 0 < hits; --i) {
									var unit = fleet[i];
									if (!unitIsInfantry()(unit)){
										currentRange = null;
									} else {
										killAllInfantry = fleet[i].type === game.UnitType.Ground && opposingSideOptions.x89Omega ? true : false;
										if (currentRange === null) {
											currentRange = [i + 1, i + 1];
											ranges.push(currentRange);
										}
										currentRange[0]--;
										hits -= absorbsHits(fleet[i]); // will always be the same as hits--
									}
								}
								var currentRange = null;
								for (var i = index - 1; 0 <= i && 0 < hits; --i) {
									var unit = fleet[i];
									if (unitIsInfantry()(unit) || inRange(i,ranges)){
										currentRange = null;
									} else {
										killAllInfantry = fleet[i].type === game.UnitType.Ground && opposingSideOptions.x89Omega ? true : false;
										if (currentRange === null) {
											currentRange = [i + 1, i + 1];
											ranges.push(currentRange);
										}
										currentRange[0]--;
										hits -= absorbsHits(fleet[i]); // will always be the same as hits--
									}
								}
							} else {
								for (var i = index - 1; 0 <= i && 0 < hits; --i) {
									var unit = fleet[i];
									if (unitIsInfantry()(unit)){
										currentRange = null;
									} else {
										killAllInfantry = fleet[i].type === game.UnitType.Ground && opposingSideOptions.x89Omega ? true : false;
										if (currentRange === null) {
											currentRange = [i + 1, i + 1];
											ranges.push(currentRange);
										}
										currentRange[0]--;
										hits -= absorbsHits(fleet[i]); // will always be the same as hits--
									}
								}
							}
							if (killAllInfantry){
								for (var i = index - 1; 0 <= i; --i) {
									var unit = fleet[i];
									if (unitIsNotInfantry()(unit) || inRange(i,ranges)){
										currentRange = null;
									} else {
										if (currentRange === null) {
											currentRange = [i + 1, i + 1];
											ranges.push(currentRange);
										}
										currentRange[0]--;
									}
								}
							}
							ranges.sort(function (r1, r2) { return r1[0] - r2[0]; });
							var result = new structs.Victim();
							ranges.forEach(function (range) { result.addRange(range[0], range[1]); });
							//console.log(result);
							return result;

							function absorbsHits(unit) {
								return (unit.isDamageGhost && thisSideOptions.nonEuclidean) ? 2 : 1;
							}
							
						}
					},
				},
				{
					name: 'Space Cannon -> Ground Forces',
					appliesTo: game.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						problemArray.forEach(function (problem) {
							if (options.attacker.l4Disruptors) return;

							var attackerTransitions = scale([1], problem.attacker.length + 1); // attacker does not fire
							var defenderModifier = options.attacker.antimassDeflectors ? -1 : 0;
							//var pdsDefender = defenderFull.filter(unitIs(game.UnitType.PDS));
							var pdsDefender = defenderFull.filter(unitOnPlanetWithSpaceCannon);
							var defenderTransitionsVector;
							var additional = 0;
							var reroll= options.defender.jolnarCommander ? true: false;
							if (options.defender.plasmaScoring)
								additional+=1;
							if (options.defender.argentCommander)
								additional+=1;
							if (options.defender.argentStrikeWingSpaceCannonD && options.defender.race !== game.Race.Argent)
								additional+=1;
							defenderTransitionsVector = fleetTransitionsVectorWithAdditionalRoll(pdsDefender, game.ThrowType.SpaceCannon, defenderModifier, additional, reroll,options);
							var defenderTransitions = scale(cancelHits(defenderTransitionsVector, options.attacker.maneuveringJetsUses), problem.defender.length + 1);

							applyTransitions(problem, attackerTransitions, defenderTransitions, options);
						});
						return problemArray;
					},
				},
				{
					name: 'Magen Omega',
					appliesTo: game.BattleType.Ground,
					execute: function (problemArray, attackerFull, defenderFull, options) {
						if (!options.attacker.magenDefenseOmega && !options.defender.magenDefenseOmega) {
							return problemArray;
						}

						var result = [];
						problemArray.forEach(function (problem) {
							var ensemble = new structs.EnsembleSplit(problem);
							var attackerVictim = calculateVictims(problem.attacker, options.defender.magenDefenseOmega && (options.defender.hasDock || defenderFull.some(unitIs(game.UnitType.PDS))));
							var defenderVictim = calculateVictims(problem.defender, options.attacker.magenDefenseOmega && (options.attacker.hasStructure || problem.attacker.some(unitIs(game.UnitType.PDS))));
							var distribution = problem.distribution;
							for (var a = 0; a < distribution.rows; a++) {
								for (var d = 0; d < distribution.columns; d++) {
									if (distribution[a][d] === 0) continue;
									ensemble.increment(attackerVictim, defenderVictim, a, d, distribution[a][d]);
								}
							}
							var subproblems = ensemble.getSubproblems();
							subproblems.forEach(function (subproblem) {
								collapseYinFlagship(subproblem, options, problem);
							});
							result.push.apply(result, subproblems);
						});
						console.log(result);
						return result;

						function calculateVictims(fleet, magenDefenseOmega) {
							if (!magenDefenseOmega){
								return structs.Victim.Null;
							}
							var v = new structs.Victim();
							for (var i = 0; i < fleet.length; ++i) {
								if ((fleet[i].damaged || fleet[i].sustainDamageHits<1) && !fleet[i].isDamageGhost){
									v.addRange(i, undefined);
									return v;
								}
							}
							v.addRange(fleet.length-1, undefined);
							return v;
						}
					},
				},
			];
		}

		function boost(battleType, sideOptions, opponentOptions, fleet, firstRound) {
			var result = undefined;
			for (var i = 0; i < boosts.length; i++) {
				if (!firstRound && boosts[i].firstRoundOnly) continue;

				var boost = boosts[i].apply(battleType, sideOptions, opponentOptions, fleet);
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
					firstRoundOnly: true,
					apply: function (battleType, sideOptions) {
						return sideOptions.moraleBoost ? 1 : 0;
					}
				},
				{
					name: 'fighterPrototype',
					firstRoundOnly: true,
					apply: function (battleType, sideOptions) {
						return battleType === game.BattleType.Space && sideOptions.fighterPrototype ?
							function (unit) {
								return unit.type === game.UnitType.Fighter ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'Sardakk',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return sideOptions.race === game.Race.Sardakk ? 1 : 0;
					}
				},
				{
					name: 'Sardakk Flagship',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions, opponentOptions, fleet) {
						// Unit reordering, where the Flagship is not the first is not taken into account
						// Several Flagships not taken into account
						return sideOptions.race === game.Race.Sardakk && battleType === game.BattleType.Space &&
						fleet.some(unitIs(game.UnitType.Flagship)) ?
							function (unit) {
								return unit.type !== game.UnitType.Flagship && unit.typeShip ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'JolNar',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return sideOptions.race === game.Race.JolNar ? -1 : 0;
					}
				},
				{
					name: 'prophecyOfIxth',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return sideOptions.prophecyOfIxth ?
							function (unit) {
								return unit.type === game.UnitType.Fighter ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'tekklarLegion',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return battleType === game.BattleType.Ground && sideOptions.tekklarLegion && sideOptions.race !== game.Race.Sardakk ? 1 : 0;
					}
				},
				{
					name: 'tekklarLegion of the opponent',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions, opponentOptions) {
						return battleType === game.BattleType.Ground && opponentOptions.tekklarLegion && sideOptions.race === game.Race.Sardakk ? -1 : 0;
					}
				},
				{
					name: 'naaluMech+2',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return (sideOptions.opponentRelicFragment && !sideOptions.articlesOfWar)?
							function (unit) {
								return unit.type === game.UnitType.Mech ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'nekroMech+2',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return (sideOptions.opponentTech && !sideOptions.articlesOfWar) ?
							function (unit) {
								return unit.type === game.UnitType.Mech ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'Jol-NarMechGroundForce',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions, opponentOptions, fleet) {
						// Having Jol-nar Mech and not fragile not taken into account
						return sideOptions.race === game.Race.JolNar && battleType === game.BattleType.Ground &&
						fleet.some(unitIs(game.UnitType.Mech)) && !sideOptions.articlesOfWar?
							function (unit) {
								return unit.type === game.UnitType.Ground ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'mahactFlagship+2',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return sideOptions.opponentNoToken ?
							function (unit) {
								return unit.type === game.UnitType.Flagship ? 2 : 0;
							} : 0;
					}
				},
				{
					name: 'naazrokhamMechSpace',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return sideOptions.race === game.Race.NaazRokha && battleType === game.BattleType.Space ?
							function (unit) {
								return unit.type === game.UnitType.Mech ? -2 : 0;
							} : 0;
					}
				},
				{
					name: 'winnuCommander',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return sideOptions.winnuCommander ? 2 : 0;
					}
				},
				{
					name: 'nebula',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions) {
						return (sideOptions.nebula && battleType === game.BattleType.Space) ? 1 : 0;
					}
				},
				{
					name: 'supercharger',
					firstRoundOnly: true,
					apply: function (battleType, sideOptions) {
						return sideOptions.supercharger ? 1 : 0;
					}
				},
				{
					name: 'Hacan Flagship',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions, opponentOptions, fleet) {
						return sideOptions.infiniteTG ? 1 : 0;
					}
				},
			];
		}
		function rollBoost(battleType, thisSideOptions, opponentSideOptions, fleet, firstRound,fleetFull) {
			var result = undefined;
			for (var i = 0; i < rollBoosts.length; i++) {
				if (!firstRound && rollBoosts[i].firstRoundOnly) continue;

				var boost = rollBoosts[i].apply(battleType, thisSideOptions, opponentSideOptions, fleet,fleetFull);
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
					name: 'NaazRokhaFlagshipMechs',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions, opponentOptions, fleet,fleetFull) {
						return sideOptions.race === game.Race.NaazRokha  &&
						fleetFull.some(unitIs(game.UnitType.Flagship)) ?
							function (unit) {
								
								return unit.type === game.UnitType.Mech ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'baronyAgent',
					firstRoundOnly: true,
					apply: function (battleType, sideOptions, opponentOptions, fleet) {
						return (sideOptions.letnevAgent && battleType === game.BattleType.Space) ?
							function (unit) {
								return unit === getUnitWithLowest(fleet, game.ThrowValues[game.ThrowType.Battle]) ? 1 : 0;
							} : 0;
					}
				},
				{
					name: 'FederationAgent',
					firstRoundOnly: true,
					apply: function (battleType, sideOptions, opponentOptions, fleet) {
						return (sideOptions.solAgent && battleType === game.BattleType.Ground) ?
							function (unit) {
								return unit === getUnitWithLowest(fleet, game.ThrowValues[game.ThrowType.Battle]) ? 1 : 0;
							} : 0;
					}
				},
			]
		}
		function fleetTransitionsVector(fleet, throwType, modifier, reroll) {
			return computeFleetTransitions(fleet, throwType, modifier, 0, reroll).pop();
		}

		function scale(transitionsVector, repeat) {
			var result = new Array(repeat);
			result.fill(transitionsVector);
			return result;
		}

		function bombardmentTransitionsVector(attackerFull, defenderFull, options,input, initialBombardment) {
			var bombardmentPossible = !options.defender.conventionsOfWar && (
				!defenderFull.some(unitShield(options.attacker.disable)) // cheching for units with Planetary Shield
				|| attackerFull.some(unitIs(game.UnitType.WarSun)) //attacking WarSuns negate their Planetary Shield
				|| options.attacker.race === game.Race.Letnev && attackerFull.some(unitIs(game.UnitType.Flagship)) // Letnev Flagship negates Planetary Shield as well
				|| options.attacker.L1Z1XCommander // L1Z1X Commander ignores all planetary shield
			);
			//console.log(initialBombardment);
			if (!bombardmentPossible) return [1];
			var attackerModifier = options.defender.bunker ? -4 : 0;
			var bombardmentAttacker = attackerFull.filter(hasBombardment);
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
			var additional = 0;
			var reroll = options.attacker.jolnarCommander ? true: false;
			additional+= !(!options.attacker.plasmaScoring || (initialBombardment && options.attacker.plasmaScoringFirstRound)) ? 1 : 0;
			additional+=options.attacker.argentCommander ? 1 : 0;
			additional+=options.attacker.argentStrikeWingBombardmentA && options.attacker.race !== game.Race.Argent ? 1 : 0;
			var resultTransitionsVector=fleetTransitionsVectorWithAdditionalRoll(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier, additional, reroll,options.attacker);
			return resultTransitionsVector;

			function hasBombardment(unit) {
				return unit.bombardmentDice !== 0;
			}
		}

		function fleetTransitionsVectorWithAdditionalRoll(fleet, throwType, modifier, roll, reroll,thisSideOptions) {
			var fleetInflicted = computeFleetTransitions(fleet, throwType, modifier, 0, reroll,thisSideOptions).pop();
			var bestUnit = getUnitWithLowest(fleet, game.ThrowValues[throwType]);

			if (bestUnit) {
				var unitWithOneDie = bestUnit.clone();
				unitWithOneDie[game.ThrowDice[throwType]] = roll;
				var unitTransitions = computeUnitTransitions(unitWithOneDie, throwType, modifier, 0, reroll, thisSideOptions);
				fleetInflicted = slideMultiply(unitTransitions, fleetInflicted);
			}
			return fleetInflicted;
		}

		function adjustForNonEuclidean(fleetTransitionsVector, opposingFleet, opposingIndex, opposingSideOptions) {
			if (opposingSideOptions.nonEuclidean && fleetTransitionsVector.length > 2) {
				var result = fleetTransitionsVector.slice();
				// as it is implemented, if the fleet is [D, d, C], and two hits are produced against it, then both
				// the Cruiser will be killed and the Dreadnought damaged. Though it suffices to only damage the Dreadnought,
				// because non-euclidean will absorb both hits.
				for (var dmg = 1; dmg < result.length && 0 < opposingIndex; dmg++) {
					if (opposingFleet[opposingIndex].isDamageGhost) {
						cancelHits(result, 1, dmg);
					}
					opposingIndex--;
				}
				return result;
			} else {
				return fleetTransitionsVector;
			}
		}
		function adjustForSM(fleetTransitionsVector, opposingFleetTransitionsVector, opposingFleet, opposingIndex, opposingSideOptions) {
			if (opposingSideOptions.race === game.Race.Sardakk) {
				var result = fleetTransitionsVector.slice();
				var result2 = opposingFleetTransitionsVector.slice();
				// as it is implemented, if the fleet is [D, d, C], and two hits are produced against it, then both
				// the Cruiser will be killed and the Dreadnought damaged. Though it suffices to only damage the Dreadnought,
				// because non-euclidean will absorb both hits.
				for (var dmg = 1; dmg < result.length && 0 < opposingIndex; dmg++) {
					if (opposingFleet[opposingIndex].isDamageGhost && opposingFleet[opposingIndex].type === game.UnitType.Mech) {
						addHits(result2, 1, result[0]);
					}
					opposingIndex--;
				}
				return result2;
			} else {
				return opposingFleetTransitionsVector;
			}
		}
		function adjustForValkyrieParticleWeave(transitionMatrix, options, rows, columns) {
			if (!options.attacker.valkyrieParticleWeave && !options.defender.valkyrieParticleWeave)
				return transitionMatrix;
			var b = {
				rows: transitionMatrix.rows + (options.attacker.valkyrieParticleWeave ? 1 : 0 ),
				columns: transitionMatrix.columns + (options.defender.valkyrieParticleWeave ? 1 : 0 ),
				at: function (i1, i2) {
					if (i1 === 0 && i2 === 0)
						return transitionMatrix.at(0, 0);
					if (i1 === 0)
						return options.attacker.valkyrieParticleWeave || i2 === transitionMatrix.columns ? 0 : transitionMatrix.at(i1, i2);
					if (i2 === 0)
						return options.defender.valkyrieParticleWeave || i1 === transitionMatrix.rows ? 0 : transitionMatrix.at(i1, i2);
					if (i1 === 1 && i2 === 1 && options.attacker.valkyrieParticleWeave && options.defender.valkyrieParticleWeave)
						return (transitionMatrix.columns === 1 ? 0 : transitionMatrix.at(0, 1)) + (transitionMatrix.rows === 1 ? 0 : transitionMatrix.at(1, 0));
					if (options.attacker.valkyrieParticleWeave && options.defender.valkyrieParticleWeave &&
						( i1 === transitionMatrix.rows && i2 === 1 ||
							i1 === 1 && i2 === transitionMatrix.columns))
						return 0;
					var rowShift = options.attacker.valkyrieParticleWeave && !(options.defender.valkyrieParticleWeave && i2 === 1) ? 1 : 0;
					var columnShift = options.defender.valkyrieParticleWeave && !(options.attacker.valkyrieParticleWeave && i1 === 1) ? 1 : 0;
					return transitionMatrix.at(i1 - rowShift, i2 - columnShift);
				}
			};
			return constrainTransitionMatrix(b, rows, columns);
		}
		function constrainTransitionMatrix(transitionMatrix, rows, columns) {
			if (transitionMatrix.rows <= rows && transitionMatrix.columns <= columns)
				return transitionMatrix;
			return {
				rows: Math.min(transitionMatrix.rows, rows),
				columns: Math.min(transitionMatrix.columns, columns),
				at: function (i1, i2) {
					var result = 0;
					var upperRowsLimit = i1 === this.rows - 1 ? transitionMatrix.rows : i1 + 1;
					var upperColumnsLimit = i2 === this.columns - 1 ? transitionMatrix.columns : i2 + 1;
					for (var i = i1; i < upperRowsLimit; ++i) {
						for (var j = i2; j < upperColumnsLimit; ++j) {
							result += transitionMatrix.at(i, j);
						}
					}
					return result;
				},
			}
		}

		function getUnitWithLowest(fleet, property) {
			var result = null;
			var bestBattleValue = Infinity;
			for (var i = 0; i < fleet.length; i++) {
				if (fleet[i][property] < bestBattleValue && !fleet[i].isDamageGhost) {
					result = fleet[i];
					bestBattleValue = fleet[i][property];
				}
			}
			return result;
		}
		function cancelHits(transitionsVector, cancelledHits, cancelFrom) {
			cancelFrom = cancelFrom || 0;
			for (var c = 0; c < cancelledHits; ++c) {
				if (transitionsVector.length > cancelFrom + 1)
					transitionsVector[cancelFrom] += transitionsVector[cancelFrom + 1];
				for (var i = cancelFrom + 2; i < transitionsVector.length; i++)
					transitionsVector[i - 1] = transitionsVector[i];
				if (transitionsVector.length > cancelFrom + 1)
					transitionsVector.pop();
			}
			return transitionsVector;
		}
		function addHits(transitionsVector, addedHits, missChance) {
			var result = transitionsVector.slice();

			var hitChance = 1-missChance;
			transitionsVector[0]=result[0]*missChance;
			for (var c = 1; c < transitionsVector.length; ++c) {
				transitionsVector[c]=result[c-1]*hitChance+result[c]*missChance;
			}
			transitionsVector.push(transitionsVector[transitionsVector.length-1]*hitChance);
			return transitionsVector;
		}
		function modifyWinnuFlagship(fleet, opposingFleet, opposingFleetCount) {
			var battleDice = null;
			fleet.filter(unitIs(game.UnitType.Flagship)).forEach(function (flagship) {
				flagship.battleDice = battleDice === null ?
					// according to https://boardgamegeek.com/thread/1916774/nekrowinnu-flagship-interaction
					(battleDice = opposingFleet.slice(0, opposingFleetCount).filter(notFighterNorGroundForceShip).length) :
					battleDice;
			});
			
			return battleDice !== null; // means flagship present
		}
		function collapseYinFlagship(problem, options, parentProblem) {
			if (options.attacker.race === game.Race.Yin || options.defender.race === game.Race.Yin) {
				var attackerCollapseTo = getCollapseTo(problem, options, parentProblem, game.BattleSide.attacker);
				var defenderCollapseTo = getCollapseTo(problem, options, parentProblem, game.BattleSide.defender);

				collapse(problem.distribution, attackerCollapseTo, problem.distribution.columns);
				collapse(problem.distribution, problem.distribution.rows, defenderCollapseTo);
			}

			function getCollapseTo(problem, options, parentProblem, battleSide) {
				var flagshipIndex = findLastIndex(problem[battleSide], unitIs(game.UnitType.Flagship));
				if (options[battleSide].race === game.Race.Yin) {
					// Yin flagship could have been a victim of ensemble split. If so, collapse whole distribution
					if (parentProblem &&
						problem[battleSide].length < parentProblem[battleSide].length &&
						flagshipIndex < findLastIndex(parentProblem[battleSide], unitIs(game.UnitType.Flagship))) {
						return battleSide === game.BattleSide.attacker ? problem.distribution.rows : problem.distribution.columns;
					} else // definitely not a victim of ensemble split
						return flagshipIndex + 1;
				}
				return 0;
			}

			function collapse(distribution, toRow, toColumn) {
				for (var a = 0; a < toRow; ++a) {
					for (var d = 0; d < toColumn; ++d) {
						if (a === 0 && d === 0) continue;
						distribution[0][0] += distribution[a][d];
						distribution[a][d] = 0;
					}
				}
			}
		}

		function unitIs(unitType) {
			return function (unit) {
				return unit.type === unitType && !unit.isDamageGhost;
			};
		}
		function unitIsOnlyGhost(unitType) {
			return function (unit) {
				return unit.type === unitType && unit.isDamageGhost;
			};
		}
		function unitShield(disable) {
			return function (unit) {
				return unit.planetaryShield && !unit.isDamageGhost && (!disable || (disable && unit.type !== game.UnitType.PDS));
			};
		}
		function unitOnPlanetWithSpaceCannon(unit) {
			return unit.spaceCannonDice !== 0 && (unit.type === game.UnitType.Mech || unit.type === game.UnitType.Ground || unit.type === game.UnitType.PDS || unit.type === "The Progenitor");
		}
		function True(){
			return function (){
				return true;
			}
		}
		function getKeyByValue(object, value) { 
			return Object.keys(object).find(key => object[key] === value); 
		}	
		function notFighterShip(unit) {
			return unit.type !== game.UnitType.Fighter && !unit.isDamageGhost && unit.typeShip;
		}

		function notFighterNorGroundForceShip(unit) {
			return unit.type !== game.UnitType.Fighter && !unit.typeGroundForce && !unit.isDamageGhost;
		}

		function findLastIndex(array, predicate) {
			for (var i = array.length - 1; 0 <= i; --i) {
				if (predicate(array[i]))
					return i;
			}
			return -1;
		}
	})();
})(typeof exports === 'undefined' ? window : exports);