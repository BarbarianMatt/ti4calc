(function (root) {
	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
	} else {
		structs = window;
		game = window;
	}

	
	root.calculator = (function () {
		var boosts = initBoosts();
		var rollBoosts = initExtraRolls();
		var prebattleActions = initPrebattleActions();
		return {
			computeProbabilities: computeProbabilities,
			fleetTransitionsVector: fleetTransitionsVector,
		};

		/** Compute survival probabilities of each subset of attacker and defender */
		function computeProbabilities(input) {
			var battleType = input.battleType;
			var options = input.options || { attacker: {}, defender: {} };
			var attackerFull = game.expandFleet(input, game.BattleSide.attacker);
			var defenderFull = game.expandFleet(input, game.BattleSide.defender);
			var attacker = attackerFull.filterForBattle();
			var defender = defenderFull.filterForBattle();
			input.storedValues.rounds=0;

			attacker.yinAgentUses= options.attacker.yinAgent || options.attacker.yinAgentOmega ? 1 : 0;
			attacker.nomadAgentUses = options.attacker.nomadAgent ? 1 : 0;
			attacker.reflectiveShieldingUses = options.attacker.reflectiveShielding ? 1 : 0;
			attacker.directHitUses = options.attacker.directHit + options.attacker.directHit2A + options.attacker.directHit3A + options.attacker.directHit4A;
			attacker.hitsProduced=[];
			attacker.deadUnits=[];
			attacker.earned=0;
			attacker.spent=0;
			attacker.battleDiceRolled=0;
			var attackerTG=[0,0];
			var defenderTG=[0,0];
			defender.yinAgentUses= options.defender.yinAgent || options.defender.yinAgentOmega ? 1 : 0;
			defender.nomadAgentUses=options.defender.nomadAgent ? 1 : 0;
			defender.reflectiveShieldingUses=options.defender.reflectiveShielding ? 1 : 0;
			defender.directHitUses = options.defender.directHit + options.defender.directHit2D + options.defender.directHit3D + options.defender.directHit4D;
			defender.hitsProduced=[];
			defender.deadUnits=[];
			defender.earned=0;
			defender.spent=0;
			defender.battleDiceRolled=0;


			//use upper left as an origin
			//initially all the probability mass is concentrated at both fleets being unharmed

			//apply all pre-battle actions, like PDS fire and Barrage

			//needs major rewriting
			var actions=prebattleActions;
			var distribution = structs.createMatrix(attacker.length + 1, defender.length + 1, 0);
			distribution[attacker.length][defender.length] = 1;
			var start= new structs.Problem(distribution, attacker, defender);
			start.last_action_attacker={name:null};
			start.last_action_defender={name:null};
			start.passed_attacker=false;
			start.passed_defender=false;
			start.next_to_act='attacker';
			start.other_side='defender';
			start.completed_actions_attacker=[];
			start.completed_actions_defender=[];
			start.start_of_combat_units_both_sides=false;
			var unresolvedProblems=[start];
			var resolvedProblems=[];
			var iterations=0
			while (unresolvedProblems.length!==0 && iterations<50){
				var current_problem=unresolvedProblems[0];
				var mySide=current_problem.next_to_act;
				var otherSide=current_problem.other_side;
				var action=findNextAction(current_problem);
				if (action === null){
					current_problem['passed_'+mySide]=true;
					current_problem.next_to_act=otherSide;
					current_problem.other_side=mySide;
				} else {
					var subproblems=action.execute(current_problem, mySide === 'attacker' ? attackerFull : defenderFull, mySide === 'attacker' ? defenderFull : attackerFull, mySide,otherSide, options, input);
					//print(action);
					for (var k = 0; k < subproblems.length; k++){
						var sub=subproblems[k];
						for (let property of ['last_action_attacker','last_action_defender','passed_attacker','passed_defender','completed_actions_attacker','completed_actions_defender','start_of_combat_units_both_sides']) {
							if (current_problem.hasOwnProperty(property)) {
								sub[property] = JSON.parse(JSON.stringify(current_problem[property]));
							}
						}	
						sub['completed_actions_' + mySide].push(action.name);
						sub['last_action_' + mySide]=action;
						sub['passed_'+mySide]=false;
						current_problem['passed_'+mySide]=false;
						sub.next_to_act=otherSide;
						sub.other_side=mySide;
						if (action.name === 'Space Cannon -> Ships' || action.name === 'Space Cannon -> Ground Forces')
							sub.start_of_combat_units_both_sides = sub.attacker.length>0 && sub.defender.length>0;
						unresolvedProblems.push(sub);
					}
					unresolvedProblems.shift();
				}
				
				if (current_problem.passed_attacker && current_problem.passed_defender && mySide === 'attacker'){
					resolvedProblems.push(current_problem);
					unresolvedProblems.shift()
				}
				iterations+=1;
				//print("iterations " + iterations);
			}

			problemArray=resolvedProblems;

			function findNextAction(issue){
				for (var j = 0; j < actions.length; j++){
					var ac = actions[j];
					// general condition of the action
					var condition1 = (typeof ac.condition === 'function' ? ac.condition(issue, mySide === 'attacker' ? attackerFull : defenderFull, mySide === 'attacker' ? defenderFull : attackerFull, mySide,otherSide, options, input) : true)
					// action must apply to battleType
					var condition2 = ac.appliesTo === battleType;
					var stops=['Space Cannon -> Ships','Anti-Fighter Barrage','Nomad Space Mechs','Bombardment','Space Cannon -> Ground Forces'];
					// if the action is a stop action, it can only be done if the defender has passed or if the last action was the same action, in order to ensure they are done at the same time
					var condition3= !stops.includes(ac.name) || (mySide==='attacker' && (issue.passed_defender) || (mySide==='defender' && issue.last_action_attacker.name === ac.name));
					// if an action is a start of combat action, it can only be performed after space cannon and before anti-fighter barrage
					var condition4= stops.includes(ac.name) || ((battleType === game.BattleType.Space && issue['completed_actions_'+mySide].includes('Nomad Space Mechs') && !issue['completed_actions_'+mySide].includes('Anti-Fighter Barrage')) 
					|| (battleType === game.BattleType.Ground && issue['completed_actions_'+mySide].includes('Space Cannon -> Ground Forces')));
					// if an action is a start of combat action, it can only be performed if both sides had units at the start of combat, therefore initiating combat
					var condition5 = (stops.includes(ac.name) && ac.name !== 'Nomad Space Mechs') || issue.start_of_combat_units_both_sides;
					// an action cannot be performed by the same side multiple times
					var condition6 = !issue['completed_actions_'+mySide].includes(ac.name);
					if (condition1 && condition2 && condition3 && condition4 && condition5 && condition6)
						return ac;
				}
				return null;
			}
			
			
			// the most interesting part - actually compute outcome probabilities
			attackerTG[1] += options.attacker.race === game.Race.Letnev && options.attacker.letnevMunitionsFunding && !options.attacker.munitions ? 2 * input.storedValues.rounds : 0;
			defenderTG[1] += options.defender.race === game.Race.Letnev && options.defender.letnevMunitionsFunding && !options.defender.munitions ? 2 * input.storedValues.rounds : 0;
			for (var i = 0; i < problemArray.length; ++i){
				if (problemArray[i].defender.length > defender.length)
					defender= problemArray[i].defender;
				if (problemArray[i].attacker.length > attacker.length)
					attacker= problemArray[i].attacker;
				if (problemArray[i].attacker.length && problemArray[i].defender.length){
					solveProblem(problemArray[i], battleType, attackerFull, defenderFull, options,input);
				}
			}
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
			var r = 0;
			for (var j=0; j<problemArray.length; j++){
				var infantry = 0;
				var sustains = 0;
				attackerTG[1]+=sumArray(problemArray[j].distribution) * (problemArray[j].attacker.spent || 0)
				for (var i=problemArray[0].attacker.length;i>=0;i--){
					var probability=sumRow(problemArray[j].distribution,i);
					var unit = problemArray[0].attacker[Math.max(i-1,0)] || {isDamageGhost: false};
					r+=probability*infantry*(options.attacker.race === game.Race.Mahact || options.attacker.crimsonII)*(options.attacker.units.Ground.upgraded ? 1 : 0.5);
					r+=probability*sustains*options.attacker.letnevCommander;
					infantry+=(unit.type === game.UnitType.Ground);
					sustains+=(unit.isDamageGhost);

				}
			}
			attacker.earned+=r;
			var r = 0;
			for (var j=0; j<problemArray.length; j++){
				var infantry = 0;
				var sustains = 0;
				defenderTG[1]+=sumArray(problemArray[j].distribution) * (problemArray[j].defender.spent || 0);
				for (var i=problemArray[0].defender.length;i>=0;i--){
					var probability=sumColumn(problemArray[j].distribution,i);
					//print(probability);
					var unit = problemArray[0].defender[Math.max(i-1,0)] || {isDamageGhost: false};
					r+=probability*infantry*(options.defender.race === game.Race.Mahact || options.defender.crimsonII)*(options.defender.units.Ground.upgraded ? 1 : 0.5);
					r+=probability*sustains*options.defender.letnevCommander;
					infantry+=(unit.type === game.UnitType.Ground);
					sustains+=(unit.isDamageGhost);
				}
			}
			defender.earned+=r;
			input.storedValues.attacker.tgsSpent += options.attacker.infiniteTG ? input.storedValues.attacker.battleDiceRolled * 0.1 : 0; //this assumption only works because the flagship is assumed to die last
			input.storedValues.defender.tgsSpent += options.defender.infiniteTG ? input.storedValues.defender.battleDiceRolled * 0.1 : 0;
			input.storedValues.attacker.tgsSpent += options.attacker.race === game.Race.Letnev && options.attacker.munitions ? 2 * input.storedValues.rounds : 0;
			input.storedValues.defender.tgsSpent += options.defender.race === game.Race.Letnev && options.defender.munitions ? 2 * input.storedValues.rounds : 0;

			input.storedValues.attacker.tgsEarned = attacker.earned ===0 || isNaN(attacker.earned) ? null : attacker.earned.toFixed(2) + " EA";
			input.storedValues.defender.tgsEarned = defender.earned ===0 || isNaN(defender.earned) ? null : defender.earned.toFixed(2) + " ED";
			input.storedValues.attacker.tgsSpent  = attackerTG[1] === 0 || isNaN(attackerTG[1]) ? null : attackerTG[1].toFixed(2) + " SA";
			input.storedValues.defender.tgsSpent  = defenderTG[1] === 0 || isNaN(defenderTG[1])? null : defenderTG[1].toFixed(2) + " SD";
			return {
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
			};
		}

		/** Do full probability mass redistribution according to transition vectors */
		function solveProblem(problem, battleType, attackerFull, defenderFull, options, input) {
			if (problem.defender.length===0) return;
			var attackerBoost = boost(battleType, options.attacker, options.defender, problem.attacker, true);
			var defenderBoost = boost(battleType, options.defender, options.attacker, problem.defender, true);
			var attackerRollBoost = rollBoost(battleType, options.attacker, options.defender, problem.attacker, true,attackerFull);
			var defenderRollBoost = rollBoost(battleType, options.defender, options.attacker, problem.defender, true,defenderFull);
			var attackerReroll = battleType === game.BattleType.Ground && options.attacker.fireTeam ||
				battleType === game.BattleType.Space && options.attacker.letnevMunitionsFunding ||
				battleType === game.BattleType.Space && options.attacker.munitions;
			var defenderReroll = battleType === game.BattleType.Ground && options.defender.fireTeam ||
				battleType === game.BattleType.Space && options.defender.letnevMunitionsFunding ||
				battleType === game.BattleType.Space && options.defender.munitions;
				
			var losePlanetaryDefender = attackerFull.some(unitIs(game.UnitType.WarSun)) || (attackerFull.some(unitIs(game.UnitType.Flagship)) && options.attacker.race === game.Race.Letnev);
			var losePlanetaryAttacker = defenderFull.some(unitIs(game.UnitType.WarSun)) || (defenderFull.some(unitIs(game.UnitType.Flagship)) && options.defender.race === game.Race.Letnev);
			var magenDefenseAttacker = battleType === game.BattleType.Ground &&
				options.attacker.magenDefense &&
				attackerFull.some(unitShield(options.defender.disable)) &&
				!losePlanetaryAttacker;
			var magenDefenseDefender = battleType === game.BattleType.Ground &&
				options.defender.magenDefense &&
				defenderFull.some(unitShield(options.attacker.disable)) &&
				!losePlanetaryDefender;
			var magenDefenseActivated = magenDefenseAttacker || magenDefenseDefender;
			var effectsFlags = {
				valkyrieParticleWeave: true,
				winnuFlagship: battleType === game.BattleType.Space,
				sardakkMech: battleType === game.BattleType.Ground,
				reflectiveShielding: battleType === game.BattleType.Space,

			};
			for (var i = 0; i<problem.distribution.rows;i++){
				var sum=sumRow(problem.distribution,i);
				attackerFull.battleDiceRolled+=dieRolled(problem.attacker, game.ThrowType.Battle, attackerBoost, attackerRollBoost, i, true)*sum;
			}
			for (var j = 0; j<problem.distribution.columns;j++){
				var sum=sumColumn(problem.distribution,j);
				defenderFull.battleDiceRolled+=dieRolled(problem.defender, game.ThrowType.Battle, defenderBoost, defenderRollBoost, j, true)*sum;
			}
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
					// Remember this row, as it might get some probability mass from applyTransitons. And this mass is liable to harrow
					var stashedRow = problem.distribution[0];
					problem.distribution[0] = new Array(problem.distribution.columns);
					problem.distribution[0].fill(0);
					applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
					
					problem.distribution = prebattleActions.find(function (action) {
						return action.name === 'Bombardment';
					}).execute([problem], attackerFull, defenderFull, options, input)[0].distribution;
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
						return computeFleetTransitions(problem.attacker, game.ThrowType.Battle, boost(battleType, options.attacker, options.defender, problem.attacker, false), rollBoost(battleType, options.attacker, options.defender, problem.attacker, false,attackerFull), battleType === game.BattleType.Space && options.attacker.munitions, options.attacker);
				};
				var defenderTransitionsFactory = function () {
						return computeFleetTransitions(problem.defender, game.ThrowType.Battle, boost(battleType, options.defender, options.attacker, problem.defender, false), rollBoost(battleType, options.defender, options.attacker, problem.defender, false,defenderFull), battleType === game.BattleType.Space && options.defender.munitions, options.defender);
					};
				if (magenDefenseAttacker)
					defenderTransitionsFactory = function () {
						return computeFleetTransitions(problem.defender, game.ThrowType.Battle, defenderBoost, defenderRollBoost, defenderReroll, options.defender);
				};
				if (magenDefenseDefender)
					attackerTransitionsFactory = function () {
						return computeFleetTransitions(problem.attacker, game.ThrowType.Battle, attackerBoost, attackerRollBoost, attackerReroll, options.attacker);
				};
				
				if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) {
					var stashedRow = problem.distribution[0];
					problem.distribution[0] = new Array(problem.distribution.columns);
					problem.distribution[0].fill(0);
					applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
					problem.distribution = prebattleActions.find(function (action) {
						return action.name === 'Bombardment';
					}).execute([problem], attackerFull, defenderFull, options, input)[0].distribution;
					for (var d = 0; d < problem.distribution.columns; ++d) {
						problem.distribution[0][d] += stashedRow[d];
					}
				} else {
					applyTransitions(problem, attackerTransitionsFactory, defenderTransitionsFactory, options, effectsFlags);
				}
			}
			propagateProbabilityUpLeft(problem, battleType, attackerFull, defenderFull, options,input);
		}

		function propagateProbabilityUpLeft(problem, battleType, attackerFull, defenderFull, options, input) {
			var distr = problem.distribution;
			// evaluate probabilities of transitions for each fleet
			var attackerReroll = options.attacker.munitions;
			var defenderReroll = options.defender.munitions;
			var attackerTransitions = computeFleetTransitions(problem.attacker, game.ThrowType.Battle, boost(battleType, options.attacker, options.defender, problem.attacker, false), rollBoost(battleType, options.attacker, options.defender, problem.attacker, false, attackerFull), attackerReroll,options.attacker);
			var defenderTransitions = computeFleetTransitions(problem.defender, game.ThrowType.Battle, boost(battleType, options.defender, options.attacker, problem.defender, false), rollBoost(battleType, options.defender, options.attacker, problem.defender, false, defenderFull), defenderReroll, options.defender);
			if (options.attacker.race === game.Race.L1Z1X && battleType === game.BattleType.Ground) {
				var harrowTransitions = bombardmentTransitionsVector(attackerFull, defenderFull, options, input, false);
				if (harrowTransitions.length === 1) //means no bombardment
					harrowTransitions = undefined;
			}
			else
				var harrowTransitions = undefined;
			var winnuFlagshipRelevant = battleType === game.BattleType.Space &&
				(options.attacker.race === game.Race.Winnu && problem.attacker.some(unitIs(game.UnitType.Flagship)) ||
					options.defender.race === game.Race.Winnu && problem.defender.some(unitIs(game.UnitType.Flagship)));
			var superchargerCRelevant = battleType === game.BattleType.Space && (options.attacker.superchargerC || options.defender.superchargerC);
			var attackerFlagshipIndex = options.attacker.race === game.Race.Yin ?
				findLastIndex(problem.attacker, unitIs(game.UnitType.Flagship)) + 1
				: 0;
			var defenderFlagshipIndex = options.defender.race === game.Race.Yin ?
				findLastIndex(problem.defender, unitIs(game.UnitType.Flagship)) + 1
				: 0;
			var sardakkMechRelevant = battleType === game.BattleType.Ground &&
				(options.attacker.race === game.Race.Sardakk && problem.attacker.some(unitIs(game.UnitType.Mech))
				 || options.defender.race === game.Race.Sardakk && problem.defender.some(unitIs(game.UnitType.Mech)));
			var valkyrieRelevant = ((options.attacker.valkyrieParticleWeave || options.defender.valkyrieParticleWeave) && battleType === game.BattleType.Ground) || 
				(options.attacker.valkyrieParticleWeaveC || options.defender.valkyrieParticleWeaveC);
			var reflectiveShieldingRelevant = battleType === game.BattleType.Space && (options.attacker.reflectiveShielding || options.defender.reflectiveShielding);
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
					if (superchargerCRelevant) {
						if (options.attacker.superchargerC) {
							modifyDamaged(problem.attacker, a)
							attackerTransitions = computeFleetTransitions(problem.attacker, game.ThrowType.Battle, boost(battleType, options.attacker, options.defender, problem.attacker, false), rollBoost(battleType, options.attacker, options.defender, problem.attacker, false,defenderFull),attackerReroll, options.attacker);
						}
						if (options.defender.superchargerC) {
							modifyDamaged(problem.defender, d)
							defenderTransitions = computeFleetTransitions(problem.defender, game.ThrowType.Battle, boost(battleType, options.defender, options.attacker, problem.defender, false), rollBoost(battleType, options.defender, options.attacker, problem.defender, false,attackerFull),defenderReroll, options.defender);
						}
					}
					
					var attackerTransitionsVector = adjustForNonEuclidean(attackerTransitions[a], problem.defender, d - 1, options.defender);				
					var defenderTransitionsVector = adjustForNonEuclidean(defenderTransitions[d], problem.attacker, a - 1, options.attacker);
					var transitionMatrix = orthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector, d + 1, a + 1);
					if (valkyrieRelevant)
						transitionMatrix = adjustForValkyrieParticleWeave(transitionMatrix, options, d + 1, a + 1);
					if (sardakkMechRelevant)
						transitionMatrix = adjustForSardakkMech(transitionMatrix, options, problem, a - 1, d - 1);
					if (reflectiveShieldingRelevant)
						transitionMatrix = adjustForReflectiveShielding(transitionMatrix, options, problem, a - 1, d - 1);
					if (harrowTransitions)
						transitionMatrix = harrowMultiply(transitionMatrix, harrowTransitions, d + 1, a + 1); // no Sustain Damage assumption
					var result=[]
					for (var i=0;i<transitionMatrix.rows;i++){
						var row=[]
						for (var j=0;j<transitionMatrix.columns;j++){
							row.push(transitionMatrix.at(i,j));
						}
						result.push(row);
					}
					var k;
					if (distr[a][d] === 0)
						continue;
					else {
						k = distr[a][d] / (1 - transitionMatrix.at(0, 0));
					}
					attackerFull.battleDiceRolled += dieRolled(problem.attacker,game.ThrowType.Battle,boost(battleType, options.attacker, options.defender, problem.attacker, false), rollBoost(battleType, options.defender, options.attacker, problem.defender, false,defenderFull),a, true)*k;
					defenderFull.battleDiceRolled += dieRolled(problem.defender,game.ThrowType.Battle,boost(battleType, options.defender, options.attacker, problem.defender, false), rollBoost(battleType, options.attacker, options.defender, problem.attacker, false,attackerFull),d, true)*k;
					input.storedValues.rounds+=k;
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
					distr[a][d] = 0;
				}
			}
		}

		/** Compute transition arrays for all left-subsets of the fleet
		 * result[4] === [X,Y,Z,..] means that probabilities of the first 4 units in the fleet
		 * inflicting 0, 1, 2 etc damage points are X, Y, Z, etc respectively
		 * @param throwType game.ThrowType */
		function dieRolled(fleet,throwType,modifier,modifierRoll,fleetCount,ignoreImpossible){
			modifierRoll = modifierRoll || 0;
			var modifierRollFunction = typeof modifierRoll === 'function' ? modifierRoll: function (unit) {
				return modifierRoll;
			};
			var modifierFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifier === 'function' ? modifier(unit) : modifier;
			};
			var diceRolls=0
			for (var a = 1; a <= fleetCount; ++a) {
				var unit = fleet[a - 1];
				diceRolls+= 10+modifierFunction(unit)>=unit[game.ThrowValues[throwType]] || !ignoreImpossible ? unit[game.ThrowDice[throwType]] + modifierRollFunction(unit) : 0;
			}
			return diceRolls;
		}
		function computeFleetTransitions(fleet, throwType, modifier, modifierRoll, reroll, thisSideOptions) {
			modifier = modifier || 0;
			modifierRoll = modifierRoll || 0;
			var result = [[1]];
			var transitions=[]
			for (var a = 0; a < fleet.length; a++) {
				var unit = fleet[a];
				unit.dead = false;
				var thisUnitTransitions = computeUnitTransitions(unit, throwType, modifier, modifierRoll, reroll,thisSideOptions);
				thisUnitTransitions.unit=unit;
				transitions.push(thisUnitTransitions);
				result.push(slideMultiply(thisUnitTransitions, result[a]));
			}
			result[fleet.length].transitions=transitions;
			if (thisSideOptions.infantryIIA || thisSideOptions.infantryIID){
				for (var a = 1; a < result.length-1; a++){
					var infantryTransition = [1];
					for (var i=a; i < fleet.length; i++){
						var unit = fleet[i];
						if (unit.type === game.UnitType.Ground){
							unit.dead = true;
							infantryTransition = slideMultiply(computeUnitTransitions(unit, throwType, modifier, modifierRoll, reroll,thisSideOptions),infantryTransition);
						}
					}
					result[a]=slideMultiply(result[a],infantryTransition);
				}
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
					var transitions = computeUnitTransitions(unit, throwType, modifier, 0, reroll,thisSideOptions);
					currentTransitions = slideMultiply(currentTransitions, transitions);
				}
				result.push(currentTransitions);
			}
			
			var bestUnit = getUnitWithLowest(fleet, game.ThrowValues[throwType]);
			if (bestUnit) {
				result.pop();
				var dummyUnit = bestUnit.clone();
				dummyUnit[game.ThrowDice[throwType]] = 0;
				var transitions = computeUnitTransitions(dummyUnit, throwType, modifier, extraRoll, reroll,thisSideOptions);
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
			var modifierFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifier === 'function' ? modifier(unit) : modifier;
			};
			var modifierRollFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifierRoll === 'function' ? modifierRoll(unit) : modifierRoll;
			};
			var singleDie = [];
			var diceRolls=diceCount + modifierRollFunction(unit);
			var oneRollMiss = Math.max(Math.min((battleValue - 1 - modifierFunction(unit)) / game.dieSides, 1), 0);
			if (diceRolls===0) return [1];
			if (unit.type === game.UnitType.Flagship && unit.race === game.Race.JolNar && throwType === game.ThrowType.Battle) {
				var oneRollHit = 1 - oneRollMiss;
				var oneRollZeroHit = Math.min(0.8, oneRollMiss);
				var oneRollOneHit = Math.max(0, (oneRollHit - 0.2)); // hit, but not 9 or 0 on the die
				if (thisSideOptions.crownThalnosC){
					var oneRollTwoHit = 0.1*(oneRollHit<=0.1); // +2 hits, but not a regular hit somehow.
					var oneRollThreeHit = 0.1*(oneRollHit>=0.2) + 0.1*(oneRollHit<=0);
					var oneRollFourHit = Math.min(0.1,oneRollHit);
				}
				else {
					var oneRollTwoHit = Math.max(0, 0.2 - oneRollHit); // +2 hits, but not a regular hit somehow.
					var oneRollThreeHit = Math.min(0.2, oneRollHit);
				}
				singleDie[0] = oneRollZeroHit * (reroll ? oneRollZeroHit : 1); // miss both on first roll and reroll
				singleDie[1] = oneRollOneHit + (reroll ? oneRollMiss * oneRollOneHit : 0); // hit on first roll or hit on reroll
				singleDie[2] = oneRollTwoHit + (reroll ? oneRollMiss * oneRollTwoHit : 0);
				singleDie[3] = oneRollThreeHit + (reroll ? oneRollMiss * oneRollThreeHit : 0);
				if (thisSideOptions.crownThalnosC)
					singleDie[4] = oneRollFourHit + (reroll ? oneRollMiss * oneRollFourHit : 0);
			} else {
				if (thisSideOptions.crownThalnosC){
					var oneRollHit = 1 - oneRollMiss;
					var oneRollZeroHit = Math.min(0.9, oneRollMiss);
					var oneRollOneHit = Math.max(0, (oneRollHit - 0.1)) + Math.max(0, 0.1 - oneRollHit);
					var oneRollTwoHit = Math.min(0.1, oneRollHit);
					singleDie[0] = oneRollZeroHit * (reroll ? oneRollZeroHit : 1); // miss both on first roll and reroll
					singleDie[1] = oneRollOneHit + (reroll ? oneRollMiss * oneRollOneHit : 0); // hit on first roll or hit on reroll
					singleDie[2] = oneRollTwoHit + (reroll ? oneRollMiss * oneRollTwoHit : 0);
				}
				else {
					singleDie[0] = oneRollMiss;
					if (reroll)
						singleDie[0] = singleDie[0] * singleDie[0];
					singleDie[1] = 1 - singleDie[0];
				}
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
			while(result[result.length-1] === 0){ // While the last element is a 0,
				result.pop();                  // Remove that last element
			}
			return result;
		}
		function moreDieForStrongestUnit(fleet, throwType, dice){
			return function(unit) {
				return (unit === getUnitWithLowest(fleet, game.ThrowValues[throwType])) ? dice : 0;
			}
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
					if (effectsFlags.sardakkMech)
						transitionMatrix = adjustForSardakkMech(transitionMatrix, options, problem, a - 1, d - 1);
					if (effectsFlags.reflectiveShielding)
						transitionMatrix = adjustForReflectiveShielding(transitionMatrix, options, problem, a - 1, d - 1);
					var result=[]
					for (var i=0;i<transitionMatrix.rows;i++){
						var row=[]
						for (var j=0;j<transitionMatrix.columns;j++){
							row.push(transitionMatrix.at(i,j));
						}
						result.push(row);
					}
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
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						var result = [];
						var thisTransitionVector = getSpaceCannonTransitionsVector(thisSideFull, otherSideFull, options[thisSide], options[otherSide]);
						var otherTransitionVector = [1];

						var ensemble = new structs.EnsembleSplit(problem);

						var distribution = problem.distribution;
						for (var a = 0; a < distribution.rows; a++) {
							for (var d = 0; d < distribution.columns; d++) {
								if (distribution[a][d] === 0) continue;

								var transitionMatrix = thisSide === 'attacker' ? unconstrainedOrthogonalMultiply(thisTransitionVector, otherTransitionVector) : unconstrainedOrthogonalMultiply(otherTransitionVector, thisTransitionVector);

								for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
									for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {

										var attackerVictims = gravitonLaserVictims(problem.attacker, thisSide === 'attacker' ? thisSideFull : otherSideFull, a, defenderInflicted, options.attacker, options.defender);
										var defenderVictims = gravitonLaserVictims(problem.defender, thisSide === 'attacker' ? otherSideFull : thisSideFull, d, attackerInflicted, options.defender, options.attacker);
										ensemble.increment(attackerVictims, defenderVictims, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
									}
								}
							}
						}
						var subproblems = ensemble.getSubproblems();
						subproblems.forEach(function (subproblem) {
							collapseYinFlagship(subproblem, options, problem);
							if (options.defender.mentakFlagship && !subproblem.defender.some(unitIs(game.UnitType.Flagship))){
								game.restoreDamage(input,'attacker',subproblem.attacker);
								var array = Array(subproblem.attacker.length+1-subproblem.distribution.length).fill().map(() => Array(subproblem.defender.length+1).fill(0));
								addRow(subproblem.distribution,array,0);
								subproblem.distribution.rows = subproblem.attacker.length+1;
								subproblem.distribution.columns = subproblem.defender.length+1;
							}
							if (options.attacker.mentakFlagship && !subproblem.attacker.some(unitIs(game.UnitType.Flagship))){
								game.restoreDamage(input,'defender',subproblem.defender);
								var array = Array(subproblem.attacker.length+1).fill().map(() => Array(subproblem.defender.length+1-subproblem.distribution[0].length).fill(0));
								addColumn(subproblem.distribution,array,0);
								subproblem.distribution.rows = subproblem.attacker.length+1;
								subproblem.distribution.columns = subproblem.defender.length+1;
							}
						});
						result.push.apply(result, subproblems);
						return result;

						function gravitonLaserVictims(fleet, thisSideFleetFull, index, hits, thisSideOptions, opponentSideOptions) {
							hits = (thisSideFleetFull.some(unitIs(game.UnitType.Flagship)) && thisSideOptions.race === game.Race.Argent) || thisSideOptions.solarFlare ? 0 : hits;
							if (hits === 0 || index === 0)
								return structs.Victim.Null;
							/*if (!(opponentSideOptions.gravitonLaser || opponentSideOptions.gravitonLaserC) && !thisSideOptions.nonEuclidean && !fleet.some(unitIs(game.UnitType.Ground)) && !fleet.some(unitIs(game.UnitType.Mech)) && !fleet.some(unitIsAndGhost(game.UnitType.Mech))) {
								var result = new structs.Victim();
								result._dead = Math.min(hits, fleet.map(absorbsHits).reduce(sum));
								return result;
							}*/

							var ranges = [];
							var currentRange = null;
							var i = index - 1;
							while (0 <= i && 0 < hits) {
								var unit = fleet[i];
								if (unit.type === game.UnitType.Fighter && (opponentSideOptions.gravitonLaser || opponentSideOptions.gravitonLaserC)) {
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
							if (opponentSideOptions.gravitonLaser || opponentSideOptions.gravitonLaserC)
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
						}
					},
				},
				{
					name: 'Nomad Space Mechs',
					appliesTo: game.BattleType.Space,
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						if (!thisSideFull.some(unitIs(game.UnitType.Mech)) || options[thisSide].race !== game.Race.Nomad || options[thisSide].articlesOfWar)
							return [problem];
						for (var i = 0; i<thisSideFull.length;i++){
							var unit = thisSideFull[i];
							if (unit.type === game.UnitType.Mech && unit.isDamageGhost)
								addUnit(problem,thisSide, otherSide,thisSideFull, input, game.UnitType.Mech, 1, problem[thisSide], false, {...unit, cancelHit:true});		
						}
						return [problem];
					},
				},
				{
					name: 'Assault Cannon',
					appliesTo: game.BattleType.Space,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						fleet=problem[thisSide]
						var nonFightersFound = 0;
						for (var i = 0; i < fleet.length; i++) {
							if (notFighterShipNorGhost(true)(fleet[i]))
								nonFightersFound++;
							if (nonFightersFound >= 3 && options[thisSide].assaultCannon)
								return true && problem[otherSide].length>0;
						}
						return false;
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options) {
						var result = [];
						var ensemble = new structs.EnsembleSplit(problem);
						var thisThreshold = findAssaultCannonThreshold(problem[thisSide], options[thisSide].assaultCannon);
						var otherVictims = calculateVictims(problem[otherSide], thisThreshold < problem[thisSide].length);
						var distribution = problem.distribution;
						for (var a = 0; a < distribution.rows; a++) {
							for (var d = 0; d < distribution.columns; d++) {
								if (distribution[a][d] === 0) continue;
								var attackerVictim = thisSide === 'defender' && thisThreshold < d ? otherVictims[a] : structs.Victim.Null;
								var defenderVictim = thisSide === 'attacker' && thisThreshold < a ? otherVictims[d] : structs.Victim.Null;
								ensemble.increment(attackerVictim, defenderVictim, a, d, distribution[a][d]);
							}
						}
						var subproblems = ensemble.getSubproblems();
						subproblems.forEach(function (subproblem) {
							collapseYinFlagship(subproblem, options, problem);
						});
						result.push.apply(result, subproblems);
						return result;

						function findAssaultCannonThreshold(fleet, assaultCannon) {
							var nonFightersFound = 0;
							for (var i = 0; i < fleet.length; i++) {
								if (notFighterShipNorGhost(true)(fleet[i]))
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
									if ((notFighterShipNorGhost(true))(fleet[i])) {
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
					name: 'Nekro Flagship',
					appliesTo: game.BattleType.Space,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						return problem[thisSide].some(unitIs(game.UnitType.Flagship)) && thisSideFull.some(groundForce) && options[thisSide].race === game.Race.Virus;
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						for (var i = 0; i<thisSideFull.length;i++){
							var unit = thisSideFull[i];
							if (unit.typeGroundForce && !unit.isDamageGhost){
								addUnit(problem,thisSide, otherSide,thisSideFull, input, unit.type, 1, problem[thisSide], false, {...unit, typeShip: true});		
							}
						}
						return [problem];
					},
				},
				{
					name: 'Nomad Promissory',
					appliesTo: game.BattleType.Space,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						return options[thisSide].nomadCavalry && options[otherSide].race!==game.Race.Nomad && options[thisSide].race!==game.Race.Nomad;//problem[thisSide].some(notFighterShipNorGhost(true));
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						var prefered = [game.UnitType.Warsun, game.UnitType.Flagship, game.UnitType.Dreadnought, game.UnitType.Mech, game.UnitType.Cruiser, game.UnitType.Ground, game.UnitType.Destroyer, game.UnitType.Carrier];
						var convertUnit=problem[thisSide][problem[thisSide].length-1];
						var convertUnitIndex=problem[thisSide].length-1;
						for (var i = problem[thisSide].length-1; i>=0;i--){
							var unit = problem[thisSide][i];
							if (prefered.indexOf(unit.type)>prefered.indexOf(convertUnit.type)){
								convertUnit=fleet[i];
								convertUnitIndex=i;
							}
						}
						if (convertUnit === undefined || convertUnit.type === game.UnitType.Fighter)
							return [problem];
						var v = new structs.Victim();
						v.addRange(convertUnitIndex, undefined);
						if (convertUnit.damageCorporeal)
							v.addRange(problem[thisSide].indexOf(convertUnit.damageCorporeal), undefined);
						var inherit = 	(thisSide === 'attacker' && options[thisSide].hasMemoriaIIA) || (thisSide === 'defender' && options[thisSide].hasMemoriaIID) ? 
										{...convertUnit, sustainDamage: true,sustainDamageHits:1, barrageDice:3, barrageValue:5, battleDice:2, battleValue:5} :
										{...convertUnit, sustainDamage: true,sustainDamageHits:1, barrageDice:3, barrageValue:8, battleDice:2, battleValue:7}

						var p = removeUnit(problem,thisSide,convertUnit.type,options,v);
						addUnit(p,thisSide, otherSide,thisSideFull, input, convertUnit.type, 1, p[thisSide], true, inherit);
						return [p];
						
					},
				},
				{
					name: 'Naaz-Rokha Space Mechs',
					appliesTo: game.BattleType.Space,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						return thisSideFull.some(unitIs(game.UnitType.Mech)) && options[thisSide].race === game.Race.NaazRokha && !options[thisSide].articlesOfWar;
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						for (var i = 0; i<thisSideFull.length;i++){
							var unit = thisSideFull[i];
							if (unit.type === game.UnitType.Mech && !unit.isDamageGhost)
								addUnit(problem,thisSide, otherSide,thisSideFull, input, game.UnitType.Mech, 1, problem[thisSide], false, {...unit, typeShip: true, sustainDamage:false,sustainDamageHits:0, battleValue:8});		
						}
						return [problem];
					},
				},
				{
					name: 'Keleres Argent Hero',
					appliesTo: game.BattleType.Space,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						return options[thisSide].keleresHero;
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						addUnit(problem,thisSide, otherSide,thisSideFull, input, game.UnitType.Flagship, 1, problem[thisSide], true);
						if ((thisSide === 'attacker' && options[thisSide].keleresHeroIA) || (thisSide === 'defender' && options[thisSide].keleresHeroID))
							addUnit(problem,thisSide, otherSide,thisSideFull, input, game.UnitType.Destroyer, 2, problem[thisSide], true);
						else if ((thisSide === 'attacker' && options[thisSide].keleresHeroIIA) || (thisSide === 'defender' && options[thisSide].keleresHeroIID)){
							addUnit(problem,thisSide, otherSide,thisSideFull, input, game.UnitType.Destroyer, 1, problem[thisSide], true);
							addUnit(problem,thisSide, otherSide,thisSideFull, input, game.UnitType.Cruiser, 1, problem[thisSide], true);
						}
						else
							addUnit(problem,thisSide, otherSide,thisSideFull, input, game.UnitType.Cruiser, 2, problem[thisSide], true);
						return [problem];
					},
				},
				
				{
					name: 'Mentak racial',
					appliesTo: game.BattleType.Space,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						return problem[thisSide].filter(unitIs(game.UnitType.Cruiser)).length+problem[thisSide].filter(unitIs(game.UnitType.Destroyer)).length>0 && options[thisSide].race === game.Race.Mentak;
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						if (options.attacker.race !== game.Race.Mentak && options.defender.race !== game.Race.Mentak)
							return;

						function createMentakTransitions(fleet, thisSideOptions) {
							var firedShips = 0;
							// motivated by timing order discussed at https://boardgamegeek.com/thread/2007331/mentak-ambush
							return computeSelectedUnitsTransitions(fleet, game.ThrowType.Battle, function (ship) {
								if (2 <= firedShips) {
									return false;
								} else if (ship.type === game.UnitType.Cruiser || ship.type === game.UnitType.Destroyer) {
									firedShips++;
									return true;
								}
								return false;
							}, 0,0,false,thisSideOptions);
						}

						var thisSideTransitions=createMentakTransitions(problem[thisSide], options[thisSide]);
						var otherSideTransitions = scale([1], problem[otherSide].length + 1);
						if (thisSide === 'attacker')
						 	applyTransitions(problem, thisSideTransitions, otherSideTransitions, options) 
						else
							applyTransitions(problem, otherSideTransitions, thisSideTransitions, options);
						collapseYinFlagship(problem, options);
						return [problem]
					},
				},
				{
					name: 'Anti-Fighter Barrage',
					appliesTo: game.BattleType.Space,
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						var result = [];
						var thisTransitionVector = getBarrageTransitionsVector(problem[thisSide], otherSideFull, options[thisSide], options[otherSide])
						var otherTransitionVector = [1];

						var ensemble = new structs.EnsembleSplit(problem);

						var distribution = problem.distribution;
						for (var a = 0; a < distribution.rows; a++) {
							for (var d = 0; d < distribution.columns; d++) {
								if (distribution[a][d] === 0) continue;

								var transitionMatrix = thisSide === 'attacker' ? unconstrainedOrthogonalMultiply(thisTransitionVector, otherTransitionVector) : unconstrainedOrthogonalMultiply(otherTransitionVector, thisTransitionVector);

								for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
									for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {

										var attackerVictims = barrageVictims(problem.attacker, options.defender.waylay ? True() : unitIsFighter(), a, defenderInflicted, options.attacker, options.defender);
										var defenderVictims = barrageVictims(problem.defender, options.attacker.waylay ? True() : unitIsFighter(), d, attackerInflicted, options.defender, options.attacker);

										ensemble.increment(attackerVictims, defenderVictims, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
									}
								}
							}
						}
						var subproblems = ensemble.getSubproblems();
						subproblems.forEach(function (subproblem) {
							collapseYinFlagship(subproblem, options, problem);
							if (options.defender.mentakFlagship && !subproblem.defender.some(unitIs(game.UnitType.Flagship))){
								game.restoreDamage(input,'attacker',subproblem.attacker);
								var array = Array(subproblem.attacker.length+1-subproblem.distribution.length).fill().map(() => Array(subproblem.defender.length+1).fill(0));
								addRow(subproblem.distribution,array,0);
								subproblem.distribution.rows = subproblem.attacker.length+1;
								subproblem.distribution.columns = subproblem.defender.length+1;
							}
							if (options.attacker.mentakFlagship && !subproblem.attacker.some(unitIs(game.UnitType.Flagship))){
								game.restoreDamage(input,'defender',subproblem.defender);
								var array = Array(subproblem.attacker.length+1).fill().map(() => Array(subproblem.defender.length+1-subproblem.distribution[0].length).fill(0));
								addColumn(subproblem.distribution,array,0);
								subproblem.distribution.rows = subproblem.attacker.length+1;
								subproblem.distribution.columns = subproblem.defender.length+1;
							}
						});
						result.push.apply(result, subproblems);
						return result;
						

						function unitIsFighter(){
							return function (unit) {
								return unit.type === game.UnitType.Fighter;
							}; 
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
					execute: function (problem, attackerFull, defenderFull, thisSide, otherSide, options, input) {
						if (thisSide === 'defender')
							return [problem];
							
						var result = [];
						var attackerTransitionsVector = bombardmentTransitionsVector(attackerFull, defenderFull, options, input, true);
						var defenderTransitionsVector = [1];
						var ensemble = new structs.EnsembleSplit(problem);

						var distribution = problem.distribution;
						for (var a = 0; a < distribution.rows; a++) {
							for (var d = 0; d < distribution.columns; d++) {
								if (distribution[a][d] === 0) continue;

								var transitionMatrix = unconstrainedOrthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector);

								for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
									for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
										var attackerVictims = bombardmentVictims(problem.attacker,  a, defenderInflicted, options.attacker, options.defender);
										var defenderVictims = bombardmentVictims(problem.defender,  d, attackerInflicted, options.defender, options.attacker);
										ensemble.increment(attackerVictims, defenderVictims, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
									}
								}
							}
						}

						var subproblems = ensemble.getSubproblems();
						subproblems.forEach(function (subproblem) {
							if (options.defender.mentakMech && !subproblem.defender.some(unitIs(game.UnitType.Mech))){
								game.restoreDamage(input,'attacker',subproblem.attacker);
								var array = Array(subproblem.attacker.length+1-subproblem.distribution.length).fill().map(() => Array(subproblem.defender.length+1).fill(0));
								addRow(subproblem.distribution,array,0);
								subproblem.distribution.rows = subproblem.attacker.length+1;
								subproblem.distribution.columns = subproblem.defender.length+1;
							}
							if (options.attacker.mentakMech && !subproblem.attacker.some(unitIs(game.UnitType.Mech))){
								game.restoreDamage(input,'defender',subproblem.defender);
								var array = Array(subproblem.attacker.length+1).fill().map(() => Array(subproblem.defender.length+1-subproblem.distribution[0].length).fill(0));
								addColumn(subproblem.distribution,array,0);
								subproblem.distribution.rows = subproblem.attacker.length+1;
								subproblem.distribution.columns = subproblem.defender.length+1;
							}
						});
						result.push.apply(result, subproblems);
						return result;

						function inRange(ind, list) {
							for (n in list){
								if (ind>=list[n][0] && ind<=list[n][1])
									return true;
							}
							return false;
						}
						function bombardmentVictims(fleet, index, hits, thisSideOptions, opponentSideOptions) {
							if (hits === 0 || index === 0)
								return structs.Victim.Null;

							var ranges = [];
							var currentRange = null;
							var i = index - 1;
							while (0 <= i && 0 < hits) {
								var unit = fleet[i];
								if (unit.type === game.UnitType.Ground && opponentSideOptions.gravitonLaserC) {
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
							if (opponentSideOptions.gravitonLaserC){
								for (var i = index - 1; 0 <= i && 0 < hits; --i) {
									if (fleet[i].type === game.UnitType.Ground) {
										if (currentRange === null) {
											currentRange = [i + 1, i + 1];
											ranges.push(currentRange);
										}
										currentRange[0]--;
										hits -= absorbsHits(fleet[i]); // will always be the same as hits--
									}
								}
							}
							if (opponentSideOptions.x89Omega){
								var killInfantry=false;
								for (var i = 0; i<ranges.length; i++) {
									var range = ranges[i];
									var segment = fleet.slice(...range);
									if (segment.some(unitIs(game.UnitType.Ground)))
										killInfantry=true;
								}
								if (killInfantry){
									currentRange = null;
									for (var i = index - 1; 0 <= i; --i) {
										var unit = fleet[i];
										if (!unitIs(game.UnitType.Ground)(unit) || inRange(i,ranges)){
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
							}
							ranges.sort(function (r1, r2) { return r1[0] - r2[0]; });
							var result = new structs.Victim();
							ranges.forEach(function (range) { result.addRange(range[0], range[1]); });
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
					ignore: true,
					execute: function (problem, thisSideFull,otherSideFull, thisSide, otherSide, options, input) {
						if (thisSide === 'attacker')
							return [problem];
						else {
							attackerFull = otherSideFull
							defenderFull = thisSideFull
						}

						var result = [];
						var attackerTransitionsVector = [1];
						var defenderTransitionsVector = getSpaceCannonTransitionsVector(problem.defender.concat(defenderFull.filterForBattle(true)).filter(unitOnPlanetWithSpaceCannon), attackerFull, options.defender, options.attacker);
						var ensemble = new structs.EnsembleSplit(problem);

						var distribution = problem.distribution;
						for (var a = 0; a < distribution.rows; a++) {
							for (var d = 0; d < distribution.columns; d++) {
								if (distribution[a][d] === 0) continue;

								var transitionMatrix = unconstrainedOrthogonalMultiply(attackerTransitionsVector, defenderTransitionsVector);

								for (var attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
									for (var defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
										var attackerVictims = gravitonVictims(problem.attacker, a, defenderInflicted, options.attacker, options.defender);

										ensemble.increment(attackerVictims,structs.Victim.Null, a, d, transitionMatrix.at(attackerInflicted, defenderInflicted) * distribution[a][d]);
									}
								}
							}
						}

						var subproblems = ensemble.getSubproblems();
						subproblems.forEach(function (subproblem) {
							if (options.defender.mentakMech && !subproblem.defender.some(unitIs(game.UnitType.Mech))){
								game.restoreDamage(input,'attacker',subproblem.attacker);
								var array = Array(subproblem.attacker.length+1-subproblem.distribution.length).fill().map(() => Array(subproblem.defender.length+1).fill(0));
								addRow(subproblem.distribution,array,0);
								subproblem.distribution.rows = subproblem.attacker.length+1;
								subproblem.distribution.columns = subproblem.defender.length+1;
							}
							if (options.attacker.mentakMech && !subproblem.attacker.some(unitIs(game.UnitType.Mech))){
								game.restoreDamage(input,'defender',subproblem.defender);
								var array = Array(subproblem.attacker.length+1).fill().map(() => Array(subproblem.defender.length+1-subproblem.distribution[0].length).fill(0));
								addColumn(subproblem.distribution,array,0);
								subproblem.distribution.rows = subproblem.attacker.length+1;
								subproblem.distribution.columns = subproblem.defender.length+1;
							}
							if (subproblem.attacker.length>0 && options.defender.race === game.Race.Keleres) 
								subproblem.attacker.spent=incr(subproblem.attacker.spent,subproblem.defender.filter(unitIs(game.UnitType.Mech)).length);
						});
						result.push.apply(result, subproblems);
						return result;
						function gravitonVictims(fleet, index, hits, thisSideOptions, opponentSideOptions) {
							if (hits === 0 || index === 0)
								return structs.Victim.Null;

							var ranges = [];
							var currentRange = null;
							var i = index - 1;
							while (0 <= i && 0 < hits) {
								var unit = fleet[i];
								if (unit.type === game.UnitType.Ground && opponentSideOptions.gravitonLaserC) {
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
							if (opponentSideOptions.gravitonLaserC)
								for (var i = index - 1; 0 <= i && 0 < hits; --i) {
									if (fleet[i].type === game.UnitType.Ground) {
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
							
						}
					},
				},
				{
					name: 'Sol Commander',
					appliesTo: game.BattleType.Ground,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						//return options[thisSide].solCommander;
						return thisSide === 'defender' && options[thisSide].solCommander;
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						addUnit(problem,thisSide,otherSide,thisSideFull, input, game.UnitType.Ground, 1, problem[thisSide], true, {});
						return [problem];
					},
				},
				{
					name: 'Dunlain Mechs',
					appliesTo: game.BattleType.Ground,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						return problem[thisSide].some(unitIs(game.UnitType.Ground)) && (options[thisSide].dunlainMechsOnce || options[thisSide].dunlainMechs);
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						var p = removeUnit(problem,thisSide,game.UnitType.Ground,options);
						addUnit(p,thisSide,otherSide,thisSideFull, input, game.UnitType.Mech, 1, p[thisSide], true, {});
						p[thisSide].spent = p[thisSide].spent === undefined ? 2 : p[thisSide].spent+2;
						return [p];
					},
				},
				
				{
					name: 'Yin Indoctrination',
					appliesTo: game.BattleType.Ground,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						return 	(options[thisSide].indoctrinate && problem[otherSide].some(unitIs(game.UnitType.Ground))) || 
								(options[thisSide].indoctrinateMechOmegaD && problem[otherSide].some(unitIs(game.UnitType.Mech))) ||
								(options[thisSide].greyfireMutagenOmega && options[otherSide].race !== game.Race.Yin && problem[otherSide].filter(groundForce).length>1);
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						var unitType = problem[otherSide].some(unitIs(game.UnitType.Mech)) && options[thisSide].indoctrinateMechOmegaD ? game.UnitType.Mech : game.UnitType.Ground;
						var p= removeUnit(problem,otherSide,unitType,options);
						addUnit(p,thisSide,otherSide,thisSideFull, input, unitType, 1, p[thisSide], true, {});
						p[thisSide].spent = p[thisSide].spent === undefined ? 2 : p[thisSide].spent+2;
						return [p];
					},
				},
				{
					name: 'Magen Omega',
					appliesTo: game.BattleType.Ground,
					condition: function (problem, thisSideFull, otherSideFull, thisSide,otherSide, options, input) {
						return options[thisSide].magenDefenseOmega && (options[thisSide].hasDock || thisSideFull.some(structure));
					},
					execute: function (problem, thisSideFull, otherSideFull, thisSide, otherSide, options, input) {
						var otherSideVictims=calculateVictims(problem[otherSide])
						var p= removeUnit(problem,otherSide,game.UnitType.Ground,options,otherSideVictims);
						return [p];

						function calculateVictims(fleet) {
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
						fleet.some(unitIs(game.UnitType.Mech)) && !sideOptions.articlesOfWar ?
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
				/*{
					name: 'superchargerC',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions, opponentOptions, fleet) {
						return sideOptions.superchargerC && battleType === game.BattleType.Space ?
							function (unit) {
								return unit.damaged ? -1 : 0;
							} : 0;
					}
				},*/
				{
					name: 'Hacan Flagship',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions, opponentOptions, fleet) {
						return sideOptions.infiniteTG ? 1 : 0;
					}
				},
				{
					name: 'solDeadInfantry',
					firstRoundOnly: false,
					apply: function (battleType, sideOptions, opponentOptions, fleet) {
						return (sideOptions.race === game.Race.Sol || sideOptions.specOpsII) ?
							function (unit) {
								return unit.type === game.UnitType.Ground && unit.dead ? 1 : 0;
							} : 0;
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
			//console.trace();
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
						return (sideOptions.race === game.Race.NaazRokha  &&
						fleetFull.some(unitIs(game.UnitType.Flagship))) ?
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
					apply: function (battleType, sideOptions, opponentOptions, fleet, fleetFull) {
						return (sideOptions.solAgent && battleType === game.BattleType.Ground) ?
							function (unit) {
								return unit === getUnitWithLowest(fleet, game.ThrowValues[game.ThrowType.Battle]) ? 1 : 0;
							} : 0;
					}
				},
			]
		}
		function getSpaceCannonTransitionsVector(fleetFull, opponentFleetFull, thisSideOptions, opponentSideOptions) {
			var modifier = opponentSideOptions.antimassDeflectors ? -1 : 0;
			var spaceCannonFleet = fleetFull.filter(hasSpaceCannon);
			var argentFlagship = opponentFleetFull.some(unitIs(game.UnitType.Flagship)) && opponentSideOptions.race === game.Race.Argent;
			
			var additional = 0;
			var reroll = thisSideOptions.jolnarCommander;

			additional += thisSideOptions.plasmaScoring ? 1 : 0;
			additional += thisSideOptions.argentCommander ? 1 : 0;
			additional += thisSideOptions.side === 'attacker' && thisSideOptions.argentStrikeWingSpaceCannonA && thisSideOptions.race !== game.Race.Argent ? 1 : 0;
			additional += thisSideOptions.side === 'defender' && thisSideOptions.argentStrikeWingSpaceCannonD && thisSideOptions.race !== game.Race.Argent ? 1 : 0;
			var vector=fleetTransitionsVector(spaceCannonFleet, game.ThrowType.SpaceCannon, modifier, moreDieForStrongestUnit(spaceCannonFleet, game.ThrowType.SpaceCannon, additional), reroll, thisSideOptions);
			if ((opponentSideOptions.solarFlare && thisSideOptions.battleType === game.BattleType.Space) || 
				(argentFlagship && thisSideOptions.battleType === game.BattleType.Space) || (opponentSideOptions.l4Disruptors && thisSideOptions.battleType === game.BattleType.Ground) || thisSideOptions.noSpaceCannon)
				return cancelHits(vector, 100000);
			return cancelHits(vector, opponentSideOptions.maneuveringJets ? 1 : 0);

		}
		function getBarrageTransitionsVector(fleetFull, opponentFleetFull, thisSideOptions, opponentSideOptions) {
			var barrageFleet = fleetFull.filter(hasBarrage);
			var naaluMech = opponentFleetFull.some(unitIs(game.UnitType.Mech)) && opponentSideOptions.race === game.Race.Naalu;
			var additional = 0;
			var reroll = thisSideOptions.jolnarCommander;

			additional += thisSideOptions.argentCommander ? 1 : 0;
			additional += thisSideOptions.side === 'attacker' && thisSideOptions.argentStrikeWingBarrageA && thisSideOptions.race !== game.Race.Argent ? 1 : 0;
			additional += thisSideOptions.side === 'defender' && thisSideOptions.argentStrikeWingBarrageD && thisSideOptions.race !== game.Race.Argent ? 1 : 0;
			var vector=fleetTransitionsVector(barrageFleet, game.ThrowType.Barrage, 0, moreDieForStrongestUnit(barrageFleet, game.ThrowType.Barrage, additional), reroll, thisSideOptions);
			if ((naaluMech && thisSideOptions.battleType === game.BattleType.Space) || thisSideOptions.noBarrage)
				return cancelHits(vector, 100000);
			return vector;

		}
		function fleetTransitionsVector(fleet, throwType, modifier, modifierRoll, reroll, mySideOptions) {
			var vector = computeFleetTransitions(fleet, throwType, modifier, modifierRoll, reroll, mySideOptions).pop();
			if (mySideOptions.plasmaScoringC && ((throwType==game.ThrowType.Bombardment && !(fleet.initialBombardment && mySideOptions.plasmaScoringFirstRound)) || throwType==game.ThrowType.SpaceCannon) && vector.length>1){
				vector=listCoords(vector.transitions,throwType, modifier, modifierRoll);
			}
			return vector;
		}
		function listCoords(dimensions,throwType, modifier, modifierRoll) {
			var cumulatives = new Array(dimensions.length);
			var total = 1;
			var altTotal=0;
			modifierRoll = modifierRoll || 0;
			var modifierFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifier === 'function' ? modifier(unit) : modifier;
			};
			var modifierRollFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifierRoll === 'function' ? modifierRoll(unit) : modifierRoll;
			};
			for (var d = dimensions.length - 1; d >= 0; d--) {
				cumulatives[d] = total;
				total *= dimensions[d].length;
				altTotal+=dimensions[d].length;
			}
			var coords = new Array(altTotal-dimensions.length+1).fill(0);
			for (var i = 0; i < total; i++) {
				var prob=1;
				var hits=0;
				var misses=0;
				for (var d = dimensions.length - 1; d >= 0; d--) {
					var index=Math.floor(i / cumulatives[d]) % dimensions[d].length
					prob *= dimensions[d][index];
					hits+=index;
					var unit=dimensions[d].unit;
					misses+=unit[game.ThrowDice[throwType]]+modifierRollFunction(unit)>index && 10+modifierFunction(unit)>=unit[game.ThrowValues[throwType]];
				}
				if (misses>0)
					hits+=1;
				coords[hits] += prob;
			}
			return coords;
		}
		function scale(transitionsVector, repeat) {
			var result = new Array(repeat);
			result.fill(transitionsVector);
			return result;
		}

		function bombardmentTransitionsVector(attackerFull, defenderFull, options, input, initialBombardment) {
			var bombardmentPossible = !options.defender.conventionsOfWar && (
				!defenderFull.some(unitShield(options.attacker.disable)) // cheching for units with Planetary Shield
				|| attackerFull.some(unitIs(game.UnitType.WarSun)) //attacking WarSuns negate their Planetary Shield
				|| options.attacker.race === game.Race.Letnev && attackerFull.some(unitIs(game.UnitType.Flagship)) // Letnev Flagship negates Planetary Shield as well
				|| options.attacker.L1Z1XCommander // L1Z1X Commander ignores all planetary shield
			);
			if (!bombardmentPossible || options.attacker.noBombardment) return [1];
			var attackerModifier = options.defender.bunker ? -4 : 0;
			var bombardmentAttacker = attackerFull.filter(hasBombardment);
			if (options.attacker.race === game.Race.L1Z1X && !initialBombardment){
				var temp=[];
				var thisSideCounters = input[game.SideUnits["attacker"]];
				var counter = thisSideCounters[game.UnitType.Mech];
				if (counter === undefined)
					counter = { count: 0};
				else if (typeof counter == 'number')
					counter = { count: counter}
				else if (counter.count === undefined)
					counter.count = 0;
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
			var reroll = options.attacker.jolnarCommander;
			var attackerAdditional = initialBombardment && options.attacker.argentStrikeWingBombardmentA && options.attacker.race !== game.Race.Argent ? 1 : 0;
			attackerAdditional += options.attacker.plasmaScoring && !(initialBombardment && options.attacker.plasmaScoringFirstRound) ? 1 : 0;
			attackerAdditional += options.attacker.argentCommander && !(initialBombardment && options.attacker.argentCommanderFirstRound) ? 1 : 0;
			bombardmentAttacker.initialBombardment=initialBombardment;
			//console.log(JSON.parse(JSON.stringify(bombardmentAttacker)));
			var resultTransitionsVector=fleetTransitionsVector(bombardmentAttacker, game.ThrowType.Bombardment, attackerModifier, moreDieForStrongestUnit(bombardmentAttacker, game.ThrowType.Bombardment, attackerAdditional), reroll, options.attacker);

			return resultTransitionsVector;

			function hasBombardment(unit) {
				return unit.bombardmentDice !== 0;
			}
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
		function reify(transitionMatrix, rows, columns) {
			rows = Math.max(rows, rows || transitionMatrix.rows);
			columns = Math.max(columns, columns || transitionMatrix.columns);
			var result = [];
			for (var i = 0; i < rows; i++) {
				var row = [];
				result.push(row);
				for (var j = 0; j < columns; j++)
					row.push(i < transitionMatrix.rows && j < transitionMatrix.columns ? transitionMatrix.at(i, j) : 0);
			}
			return result;
		}
		function adjustForSardakkMech(transitionMatrix, options, problem, attackerIndex, defenderIndex) {

			var attackerSardakk = options.attacker.race === game.Race.Sardakk && problem.attacker.some(unitIsAndGhost(game.UnitType.Mech));
			var defenderSardakk = options.defender.race === game.Race.Sardakk && problem.defender.some(unitIsAndGhost(game.UnitType.Mech));
			var attackerSustains = attackerSardakk ? problem.attacker.slice(0, attackerIndex + 1).filter(unitIsAndGhost(game.UnitType.Mech)).length : 0;
			var defenderSustains = defenderSardakk ? problem.defender.slice(0, defenderIndex + 1).filter(unitIsAndGhost(game.UnitType.Mech)).length : 0;
			var Rows = defenderIndex+2;
			var Columns = attackerIndex+2;
			if (!attackerSardakk && !defenderSardakk)
				return transitionMatrix;
			if (attackerSardakk ^ defenderSardakk) {
				// only one Sardakk, no weird Sardakk vs Sardakk mech damaging chain lightning
				var rows = transitionMatrix.rows + attackerSustains;
				var columns = transitionMatrix.columns + defenderSustains;
				var reifiedMatrix = reify(transitionMatrix, rows, columns);
				if (attackerSardakk) {
					for (var i=attackerIndex; i>=0; i--) {
						for (var dmg = attackerIndex-i+1; (dmg < columns) && (0 <= i); dmg++, i--) {
							if (unitIsAndGhost(game.UnitType.Mech)(problem.attacker[i])) {
								for (var a = rows-1; 0 < a; --a) {
									for (var d = columns-1; dmg <= d; --d)
										reifiedMatrix[a][d] = reifiedMatrix[a - 1][d];
								}
								for (var d = columns-1; dmg <= d; --d)
										reifiedMatrix[0][d] = 0;
								break;
							}
						}
					}
				}
				if (defenderSardakk) {
					for (var i=defenderIndex; i>=0; i--) {
						for (var dmg = defenderIndex-i+1; (dmg < rows) && (0 <= i); dmg++, i--) {
							if (unitIsAndGhost(game.UnitType.Mech)(problem.defender[i])) {
								for (var d = columns-1; 0 < d; --d) {
									for (var a = rows-1; dmg <= a; --a)
										reifiedMatrix[a][d] = reifiedMatrix[a][d-1];
								}
								for (var a = rows-1; dmg <= a; --a)
										reifiedMatrix[a][0] = 0;
								break;
							}
						}
					}
				}
			}
			else {
				print("tried to do Sardakk vs Sardakk")
				// Sardakk vs Sardakk, one mech damaging might cause another mech damaging
			}
			var b = {
				rows: rows,
				columns: columns,
				at: function(i1, i2) {
					return reifiedMatrix[i1][i2];
				}
			};
			var restraint=constrainTransitionMatrix(b, Rows, Columns);
			return restraint;
		}
		function adjustForReflectiveShielding(transitionMatrix, options, problem, attackerIndex, defenderIndex) {

			var attackerReflective = options.attacker.reflectiveShielding;
			var defenderReflective = options.defender.reflectiveShielding;
			var attackerLast = problem.attacker.filter(unitGhost).pop();
			var defenderLast = problem.defender.filter(unitGhost).pop();
			var Rows = defenderIndex+2;
			var Columns = attackerIndex+2;
			if (!attackerReflective && !defenderReflective)
				return transitionMatrix;
			if (attackerReflective ^ defenderReflective) {
				var rows = transitionMatrix.rows + (attackerIndex >= problem.attacker.indexOf(attackerLast) && attackerReflective ? 2 : 0);
				var columns = transitionMatrix.columns + (defenderIndex >= problem.defender.indexOf(defenderLast) && defenderReflective ? 2 : 0);
				var reifiedMatrix = reify(transitionMatrix, rows, columns);
				if (attackerReflective) {
					for (var i=attackerIndex; i>=0; i--) {
						for (var dmg = attackerIndex-i+1; (dmg < columns) && (0 <= i); dmg++, i--) {
							if (problem.attacker[i]===attackerLast) {
								for (var a = rows-1; 1 < a; --a) {
									for (var d = columns-1; dmg <= d; --d)
										reifiedMatrix[a][d] = reifiedMatrix[a - 2][d];
								}
								for (var d = columns-1; dmg <= d; --d){
									reifiedMatrix[0][d] = 0;
									reifiedMatrix[1][d] = 0
								}
								break;
							}
						}
					}
				}
				if (defenderReflective) {
					for (var i=defenderIndex; i>=0; i--) {
						for (var dmg = defenderIndex-i+1; (dmg < rows) && (0 <= i); dmg++, i--) {
							if (problem.defender[i]===defenderLast) {
								for (var d = columns-1; 1 < d; --d) {
									for (var a = rows-1; dmg <= a; --a)
										reifiedMatrix[a][d] = reifiedMatrix[a][d-2];
								}
								for (var a = rows-1; dmg <= a; --a){
									reifiedMatrix[a][0] = 0;
									reifiedMatrix[a][1] = 0;
								}
								break;
							}
						}
					}
				}
			}
			else {
				print("tried to do reflective vs reflective")
			}
			var b = {
				rows: rows,
				columns: columns,
				at: function(i1, i2) {
					return reifiedMatrix[i1][i2];
				}
			};
			var restraint=constrainTransitionMatrix(b, Rows, Columns);
			return restraint;
		}
		function adjustForValkyrieParticleWeave(transitionMatrix, options, rows, columns) {
			var valkA = ((options.attacker.valkyrieParticleWeave && options.attacker.battleType === 'Ground') || options.attacker.valkyrieParticleWeaveC);
			var valkD = ((options.defender.valkyrieParticleWeave  && options.defender.battleType === 'Ground') || options.defender.valkyrieParticleWeaveC);
			if (!valkA && !valkD)
				return transitionMatrix;
			var b = {
				rows: transitionMatrix.rows + (valkA ? 1 : 0 ),
				columns: transitionMatrix.columns + (valkD ? 1 : 0 ),
				at: function (i1, i2) {
					if (i1 === 0 && i2 === 0)
						return transitionMatrix.at(0, 0);
					if (i1 === 0)
						return valkA || i2 === transitionMatrix.columns ? 0 : transitionMatrix.at(i1, i2);
					if (i2 === 0)
						return valkD || i1 === transitionMatrix.rows ? 0 : transitionMatrix.at(i1, i2);
					if (i1 === 1 && i2 === 1 && valkA && valkD)
						return (transitionMatrix.columns === 1 ? 0 : transitionMatrix.at(0, 1)) + (transitionMatrix.rows === 1 ? 0 : transitionMatrix.at(1, 0));
					if (valkA && valkD &&
						( i1 === transitionMatrix.rows && i2 === 1 ||
							i1 === 1 && i2 === transitionMatrix.columns))
						return 0;
					var rowShift = valkA && !(valkD && i2 === 1) ? 1 : 0;
					var columnShift =valkD && !(valkA && i1 === 1) ? 1 : 0;
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
				if (fleet[i][property] < bestBattleValue && !fleet[i].isDamageGhost && (fleet[i].type !== game.UnitType.Planet)) {
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
					(battleDice = opposingFleet.slice(0, opposingFleetCount).filter(notFighterShipNorGhost(true)).length) :
					battleDice;
			});
			
			return battleDice !== null; // means flagship present
		}
		function modifyDamaged(fleet, fleetCount) {
			for (var i=fleet.length-1; i>=0;i--){
				if (fleet[i].isDamageGhost){
					fleet[i].damageCorporeal.damaged = (i > fleetCount-1);
				}
				if (fleet[i].damaged && fleet[i].sustainDamageHits>0){
					fleet[i].battleValue=fleet[i].battleValue+1;
					fleet[i].sustainDamageHits=0;
				}
			}
			
			//return battleDice !== null; // means flagship present
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
		function incr(obj,num){
			if (obj === undefined || obj === null){
				obj=0;
			}
			return obj+=num;
		}
		function unitIsAndGhost(unitType) {
			return function (unit) {
				return unit.type === unitType && unit.isDamageGhost;
			};
		}
		function unitGhost(unit){
			return unit.isDamageGhost;
		}
		function unitShield(disable) {
			return function (unit) {
				return unit.planetaryShield && !unit.isDamageGhost && (!disable || (disable && unit.type !== game.UnitType.PDS));
			};
		}
		function unitOnPlanetWithSpaceCannon(unit) {
			return unit.spaceCannonDice !== 0 && !unit.typeShip;
		}
		function True(){
			return function (){
				return true;
			}
		}
		function False(){
			return function (){
				return false;
			}
		}
		function getKeyByValue(object, value) { 
			return Object.keys(object).find(key => object[key] === value); 
		}	

		function notFighterShipNorGhost(combat){
			return function (unit) {
				return notFighterShip(combat)(unit) && !unit.isDamageGhost;
			}
		}
		function ship(combat){
			return function (unit) {
				return unit.typeShip && validUnit(combat)(unit);
			}
		}
		function notFighterShip(combat){
			return function (unit) {
				return unit.type !== game.UnitType.Fighter && unit.typeShip && validUnit(combat)(unit);
			}
		}
		function validUnit(combat) {
			return function (unit) {
				return  combat || !unit.typeGroundForce;
			}
		}

		function groundForce(unit) {
			return unit.typeGroundForce && !unit.isDamageGhost;
		}
		function structure(unit) {
			return unit.typeStructure && !unit.isDamageGhost;
		}

		function notFighterNorGroundForceShip(unit) {
			return unit.type !== game.UnitType.Fighter && !unit.typeGroundForce && !unit.isDamageGhost;
		}
		function hasSpaceCannon(unit) {
			return unit.spaceCannonDice !== 0;
		}
		function hasBarrage(unit) {
			return unit.barrageDice !== 0;
		}

		function findLastIndex(array, predicate) {
			for (var i = array.length - 1; 0 <= i; --i) {
				if (predicate(array[i]))
					return i;
			}
			return -1;
		}
		function sum(a, b) {
			return a + b;
		}
		function sumColumn(array,index){
			var result = 0;
			for (var i=0; i<array.length; i++){
				result += array[i][index] || 0;
			}
			return result;
		}
		function sumRow(array,index){
			var result = array[index] || [0];
			return result.reduce(sum,0);
		}
		function sumArray(array){
			var result = 0;
			for (var i=0; i<array.length; i++){
				for (var j=0; j<array[i].length; j++){
					result += array[i][j] || 0;
				}
			}
			return result;
		}
		function removeRow(array,index){
			if (index === Infinity) return;
			array.splice(index,1);
		}
		function removeColumn(array,index){
			if (index === Infinity) return;
			for (var i=0; i<array.length; i++){
				array[i].splice(index,1);
			}
		}
		function addColumn(array, columns,position) {
			for (var j = 0; j < columns.length; j++) {
				var row = columns[j];
				for (var i = row.length-1; i>=0; i--) {
					array[j].splice(position, 0, row[i]);
				}
			}
		}

		function addUnit(problem,thisSide,otherSide,thisSideFull, input, unitType, amount, fleet, ignoreDamage, properties){
			game.createUnit(input,thisSide,unitType, amount, fleet, ignoreDamage, properties);
			problem[thisSide]=problem[thisSide].sort(thisSideFull.comparer);
			var array = thisSide === "attacker" ? Array(problem[thisSide].length+1-problem.distribution.length).fill().map(() => Array(problem[otherSide].length+1).fill(0)) : Array(problem[otherSide].length+1).fill().map(() => Array(problem[thisSide].length+1-problem.distribution[0].length).fill(0));
			thisSide === "attacker" ? addRow(problem.distribution,array,0) : addColumn(problem.distribution,array,0);
			problem.distribution.rows = thisSide === "attacker" ? problem[thisSide].length+1 : problem[otherSide].length+1;
			problem.distribution.columns = thisSide === "defender" ? problem[thisSide].length+1 : problem[otherSide].length+1;
		}
		function removeUnit(problem,thisSide,unitType,options,customRange){
			var result=[];
			var ensemble = new structs.EnsembleSplit(problem);
			var thisSideVictims = customRange === undefined ? calculateVictims(problem[thisSide]) : customRange;
			var otherSideVictims = structs.Victim.Null;
			var distribution = problem.distribution;
			for (var a = 0; a < distribution.rows; a++) {
				for (var d = 0; d < distribution.columns; d++) {
					if (distribution[a][d] === 0) continue;
					var attackerVictim = a===0 ? structs.Victim.Null : thisSide === 'attacker' ? thisSideVictims : otherSideVictims;
					var defenderVictim = d===0 ? structs.Victim.Null : thisSide === 'attacker' ? otherSideVictims : thisSideVictims;
					ensemble.increment(attackerVictim, defenderVictim, a, d, distribution[a][d]);
				}
			}
			var subproblems = ensemble.getSubproblems();
			subproblems.forEach(function (subproblem) {
				collapseYinFlagship(subproblem, options, problem);
			});
			result.push.apply(result, subproblems);
			return result[0];

			function calculateVictims(fleet) {
				var v = new structs.Victim();
				for (var i = fleet.length-1; i >=0; --i) {
					var unit = fleet[i];
					if (unit.type === unitType){
						if (unit.damageCorporeal)
							v.addRange(fleet.indexOf(unit.damageCorporeal), undefined);
						v.addRange(i, undefined);
						return v;
					}
				}
				return v;
			}
		}
		function addRow(array, rows, position) {
			for (var i=rows.length-1; i>=0; i--)
				array.splice(position, 0, rows[i]);
			return array;
		}
	})();
})(typeof exports === 'undefined' ? window : exports);