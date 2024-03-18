(function () {
	//console.trace();
	window.CanvasSizes = [
		{ width: 600, height: 400 },
		{ width: 900, height: 600 },
		{ width: 1200, height: 800 },
		{ width: 1800, height: 1200 },
	];

	var lastComputed;
	var input = getInput();

	var recomputeHandler = {
		handler: 'recompute',
		deep: true,
	};

	var transientProperties = {
		costs: { attacker: { count: 0, cost: 0, }, defender: { count: 0, cost: 0, } },
		storedValues:{attacker: {tgsEarned:0, yinAgentUses:0, reflectiveShieldingUses:0, directHitUses:0, tgsSpent:0}, 
					defender: {tgsEarned:0, yinAgentUses:0, reflectiveShieldingUses:0, directHitUses:0, tgsSpent:0},
					rounds: 0 },
		showOptions: false,
		showHelp: false,
		computing: false,
		forceSlow: false, // do `app.forceSlow = true;` in developers console to force slow but robust calculation
	};

	app = new Vue({
		el: '#root',
		data: Object.assign(input, transientProperties),
		methods: {
			increment: function (unitInput) {
				unitInput.count++;
			},
			decrement: function (unitInput) {
				unitInput.count = unitInput.count === 0 ? 0 : unitInput.count - 1;
			},
			displayName: function (unitType) {
				if (unitType === UnitType.WarSun) return 'War Sun';
				else if (unitType === UnitType.Ground) return 'Infantry';
				else return unitType;
			},
			
			clear: function (side) {
				for (var unitType in UnitType) {
					this[SideUnits[side]][unitType].count = 0;
					this[SideUnits[side]][unitType].upgraded = false;
				}
				for (var options in NonSpecificOptions) {
					for (var option in NonSpecificOptions[options]){
						if (option !== "riskDirectHit")
							this.options[side][option] = false;
					}
				}
				for (var options in SpecificOptions) {
					for (var race in SpecificOptions[options]){
						for (var option in SpecificOptions[options][race]){
							
							this.options[side][option] = false;
						}
					}
				}
			},
			recompute: function () {
				this.tallyCosts();
				this.computing = true;
				var self = this;
				//console.trace();
				//print(this.options);
				persistInput();
				// veeery poor man's background processing
				setTimeout(function () {
					// unfortunately some game aspects are hard to handle in the calculator
					var duraniumArmor = self.options.attacker.duraniumArmor || self.options.defender.duraniumArmor;
					var l1z1xFlagship = (self.options.attacker.race === Race.L1Z1X && self.attackerUnits.Flagship.count !== 0 ||
						self.options.defender.race === Race.L1Z1X && self.defenderUnits.Flagship.count !== 0) && self.battleType === BattleType.Space;
					var letnevFlagship = (self.options.attacker.race === Race.Letnev && self.attackerUnits.Flagship.count !== 0 ||
						self.options.defender.race === Race.Letnev && self.defenderUnits.Flagship.count !== 0) && self.battleType === BattleType.Space;
					// I could not figure out how to have it so that when sardakk's mechs sustain damage in the normal calculator, only then would they produce a hit, may be possible but IDK

					var sardakkMechVsMech = (self.options.attacker.race === Race.Sardakk && self.attackerUnits.Mech.count !== 0 &&
						self.options.defender.race === Race.Sardakk && self.defenderUnits.Mech.count !== 0) && self.battleType === BattleType.Ground && !self.options.attacker.articlesOfWar;
					var sardakkMechVsNonEuclidean = ((self.options.attacker.race === Race.Sardakk && self.attackerUnits.Mech.count !== 0 && self.options.defender.nonEuclidean) || 
						(self.options.defender.race === Race.Sardakk && self.defenderUnits.Mech.count !== 0 && self.options.attacker.nonEuclidean)) && self.battleType === BattleType.Ground && !self.options.attacker.articlesOfWar;
					//var sardakkMech = false;
					// Same reason as Sardakk Mechs
					//var reflective = (self.options.attacker.reflectiveShielding || self.options.defender.reflectiveShielding) && self.battleType === BattleType.Space;
					var reflectiveVsReflective = (self.options.attacker.reflectiveShielding && self.options.defender.reflectiveShielding) && self.battleType === BattleType.Space;
					var reflectiveVsNonEuclidean = ((self.options.attacker.reflectiveShielding && self.options.defender.nonEuclidean) || 
						(self.options.defender.reflectiveShielding)) && self.battleType === BattleType.Space;
					var l1z1xX89Omega = (self.options.attacker.race === Race.L1Z1X && self.options.attacker.x89Omega);
					var mentakH = (self.options.attacker.mentakHero || self.options.defender.mentakHero) && self.battleType === BattleType.Space;
					var yinA = (self.options.attacker.yinAgent || self.options.defender.yinAgent || self.options.attacker.yinAgentOmega || self.options.defender.yinAgentOmega)
					var directHit = (self.options.attacker.directHit || self.options.attacker.directHit2A || self.options.attacker.directHit3A || self.options.attacker.directHit4A ||
									self.options.defender.directHit || self.options.defender.directHit2D || self.options.defender.directHit3D || self.options.defender.directHit4D) && self.battleType === BattleType.Space;
					var valkyrieAndNonEuclidean = ((self.options.attacker.valkyrieParticleWeave && self.options.defender.nonEuclidean) || (self.options.defender.valkyrieParticleWeave && self.options.attacker.nonEuclidean)) && 
						self.battleType === BattleType.Ground;
					var valkyrieVsValkyrie = ((self.options.attacker.valkyrieParticleWeave || self.options.attacker.valkyrieParticleWeaveC) && (self.options.defender.valkyrieParticleWeave || self.options.defender.valkyrieParticleWeaveC))
					var dunlainMechs = ((self.options.attacker.dunlainMechs && self.attackerUnits.Ground.count > 1) || (self.options.defender.dunlainMechs && self.defenderUnits.Ground.count > 1)) && self.battleType === BattleType.Ground;
					var nomadA = (self.options.attacker.nomadAgent || self.options.defender.nomadAgent);
					var betterSustains = (self.options.attacker.nonEuclidean && !self.options.attacker.riskDirectHit) || (self.options.defender.nonEuclidean && !self.options.defender.riskDirectHit);
					//var superchargerC = self.options.attacker.superchargerC || self.options.defender.superchargerC;
					if ((duraniumArmor || l1z1xFlagship || letnevFlagship || sardakkMechVsMech || sardakkMechVsNonEuclidean || reflectiveVsReflective || reflectiveVsNonEuclidean || l1z1xX89Omega || mentakH || yinA  || directHit || valkyrieAndNonEuclidean || valkyrieVsValkyrie || dunlainMechs || nomadA || betterSustains) || self.forceSlow){
						lastComputed= imitator.estimateProbabilities(self);
					} else {
						lastComputed = calculator.computeProbabilities(self);
					}
					self.displayDistribution(lastComputed);

					self.computing = false;
				}, 15); // number is magic. but at least the spinner has time to show up before calculation begins
			},
			displayDistribution: function (solution) {

				drawChart(solution);
				
				drawTotalWinProbabilities(solution.distribution);

				return;

				function drawChart(solution) {
					var labels = [];
					var data = [];
					var dataLabels = [];
					var from = Math.min(-8, solution.distribution.min);
					var to = Math.max(8, solution.distribution.max);
					for (var i = from; i <= to; ++i) {
						labels.push(getLabel(i, solution.attacker, solution.defender));
						if (i === 0) {
							data.push(solution.distribution.at(0) * 100);
							dataLabels.push(Math.round(solution.distribution.at(0) * 1000).toString()/10 + '%');
						} else {
							data.push(solution.distribution.downTo(i) * 100);
							dataLabels.push(Math.round(solution.distribution.downTo(i) * 1000).toString()/10 + '%');
						}
					}
					RGraph.clear(document.getElementById('chart-area'));
					RGraph.ObjectRegistry.Clear();

					var line = new RGraph.Line('chart-area', data)
						.Set('labels', labels)
						.Set('chart.background.grid.vlines', true)
						.Set('chart.background.grid.autofit.numvlines', 1)
						.Set('chart.filled', true)
						.Set('chart.tickmarks', 'circle')
						.Set('chart.numxticks', 0)
						.Set('chart.ymax', Math.max.apply(null, data) * 1.08)
						.Set('chart.colors', ['rgba(200,200,256,0.7)']);
					if (to - from < 20)
						line.Set('chart.labels.ingraph', dataLabels);
					else
						line.Set('chart.tooltips', dataLabels);
					line.Draw();

					function getLabel(i, attacker, defender) {
						if (i === 0)
							return '=';
						if (i < 0) {
							i = -i;
							if (i <= attacker.length)
								return attacker[i - 1];
							else
								return '';
						}
						else {
							if (i <= defender.length)
								return defender[i - 1];
							else
								return '';
						}
					}
				}

				function drawTotalWinProbabilities(distribution) {
					var attackerWinProbability = 0;
					var defenderWinProbability = 0;
					var drawProbability = distribution.at(0);
					for (var i = distribution.min; i < 0; i++) {
						attackerWinProbability += distribution.at(i);
					}
					for (var i = 1; i <= distribution.max; i++) {
						defenderWinProbability += distribution.at(i);
					}

					var canvas = document.getElementById('chart-area-overlay');
					RGraph.clear(canvas);
					var context = canvas.getContext('2d');
					var canvasWidth = canvas.width;
					var canvasHeight = canvas.height;
					context.font = 'bold 100px Arial';

					context.fillStyle = 'rgba(256, 100, 100, 0.5)';
					var roundedAttackerProbability = Math.round(attackerWinProbability * 1000)/10;
					context.fillText(roundedAttackerProbability + '%', canvasWidth / 12, 3 * canvasHeight / 4);

					context.fillStyle = 'rgba(100, 100, 256, 0.5)';
					var roundedDefenderProbability = Math.round(defenderWinProbability * 1000)/10;
					context.fillText(roundedDefenderProbability + '%', 7 * canvasWidth / 12, 3 * canvasHeight / 4);

					if (drawProbability > .005 && (roundedAttackerProbability + roundedDefenderProbability) < 100 ) {
						context.font = 'bold 80px Arial';
						context.fillStyle = 'rgba(160, 160, 160, 0.5)';
						context.fillText(Math.round(drawProbability * 1000)/10 + '%', 5 * canvasWidth / 12, 3 * canvasHeight / 8);
					}
				}
			},
			tallyCosts: function () {
				tally(this.costs.attacker, this.attackerUnits, this.options.attacker);
				tally(this.costs.defender, this.defenderUnits, this.options.defender);

				function tally(costs, units, sideOptions) {
					costs.count = 0;
					costs.cost = 0;
					for (var unitType in UnitType) {
						if (unitType === UnitType.PDS) continue;
						var counter = units[unitType];
						costs.count += counter.count;
						costs.cost += (counter.upgraded && MergedUpgrades[sideOptions.race][unitType].cost || MergedUnits[sideOptions.race][unitType].cost) * counter.count;
					}
				}	
			},
			participates: function (battleSide, unitType) {
				var bombardmentPossible = this.defenderUnits.PDS.count === 0 // either there are no defending PDS
					|| this.attackerUnits.WarSun.count !== 0 // or there are but attacking WarSuns negate their Planetary Shield
					|| this.options.attacker.race === Race.Letnev && this.attackerUnits.Flagship.count !== 0; // Letnev Flagship negates Planetary Shield as well
				switch (unitType) {
					case UnitType.Flagship:
						return this.battleType === BattleType.Space ||
							battleSide === BattleSide.attacker && (this.options.attacker.race === Race.Naalu || this.options.attacker.race === Race.Letnev && !this.options.defender.conventionsOfWar);
					case UnitType.WarSun:
						return this.battleType === BattleType.Space ||
							battleSide === BattleSide.attacker && !this.options.defender.conventionsOfWar;
					case UnitType.Dreadnought:
						return this.battleType === BattleType.Space ||
							battleSide === BattleSide.attacker && bombardmentPossible && !this.options.defender.conventionsOfWar;
					case UnitType.Cruiser:
						return this.battleType === BattleType.Space;
					case UnitType.Carrier:
						return this.battleType === BattleType.Space;
					case UnitType.Destroyer:
						return this.battleType === BattleType.Space;
					case UnitType.Fighter:
						return this.battleType === BattleType.Space ||
							battleSide === BattleSide.attacker && this.options.attacker.race === Race.Naalu && this.attackerUnits.Flagship.count !== 0;
					case UnitType.Ground:
						return this.battleType === BattleType.Ground ||
							this.options[battleSide].race === Race.Virus && this[SideUnits[battleSide]].Flagship.count !== 0;
					case UnitType.Mech:
						return this.battleType === BattleType.Ground || this.options[battleSide].race === Race.NaazRokha || (this.options[battleSide].race === Race.Virus && this[SideUnits[battleSide]].Flagship.count !== 0);
					case UnitType.PDS:
						return this.battleType === BattleType.Space || battleSide === BattleSide.defender;
					case UnitType.Planet:
						return this.battleType === BattleType.Space || battleSide === BattleSide.defender;
				}
			},
			damageableCount: function (count) {
				var result = [];
				for (var i = 0; i <= count; i++)
					result.push(i);
				return result;
			},
		},
		watch: {
			'options.attacker.race': resetUpdatesAndTechnologies('attacker'),
			'options.defender.race': resetUpdatesAndTechnologies('defender'),
			'options.attacker.publicizeSchematics': function (value) {
				this.options.defender.publicizeSchematics = value;
			},
			'options.defender.publicizeSchematics': function (value) {
				this.options.attacker.publicizeSchematics = value;
			},
			'options.attacker.articlesOfWar': function (value) {
				this.options.defender.articlesOfWar = value;
			},
			'options.defender.articlesOfWar': function (value) {
				this.options.attacker.articlesOfWar = value;
			},
			'options.defender.magenDefense': function (value) {
				if (value){
					this.options.defender.magenDefenseOmega = false;
					this.options.defender.magenDefenseC = false;
				}
			},
			'options.defender.magenDefenseOmega': function (value) {
				if (value){
					this.options.defender.magenDefense = false;
					this.options.defender.magenDefenseC = false;
				}
				else
					this.options.defender.hasDock = false;
			},
			'options.defender.magenDefenseC': function (value) {
				if (value){
					this.options.defender.magenDefenseOmega = false;
					this.options.defender.magenDefense = false;
				}
				else {
					this.defenderUnits.Planet.count = 0;
				}
			},
			'options.attacker.magenDefense': function (value) {
				if (value){
					this.options.attacker.magenDefenseOmega = false;
					this.options.attacker.magenDefenseC = false;
				}
			},
			'options.attacker.magenDefenseOmega': function (value) {
				if (value){
					this.options.attacker.magenDefense = false;
					this.options.attacker.magenDefenseC = false;
				}
				else
					this.options.attacker.hasStructure = false;
			},
			'options.attacker.magenDefenseC': function (value) {
				if (value){
					this.options.attacker.magenDefenseOmega = false;
					this.options.attacker.magenDefense = false;
				}
				else {
					this.attackerUnits.Planet.count = 0;
				}
			},
			'options.attacker.x89Omega': function (value) {
				if (!value)
					this.options.defender.x89Conservative = false;
			},
			'options.attacker.argentStrikeWing': function (value) {
				if (!value)
					this.options.attacker.argentStrikeWingBombardmentA = false;
					this.options.attacker.argentStrikeWingBarrageA = false;
					this.options.attacker.argentStrikeWingSpaceCannonA = false;
			},
			'options.defender.argentStrikeWing': function (value) {
				if (!value)
					this.options.defender.argentStrikeWingBarrageD = false;
					this.options.defender.argentStrikeWingSpaceCannonD = false;
			},
			'options.attacker.nomadCavalry': function (value) {
				if (!value)
					this.options.attacker.hasMemoriaIIA = false;
			},
			'options.defender.nomadCavalry': function (value) {
				if (!value)
					this.options.attacker.hasMemoriaIID = false;
			},
			'options.attacker.keleresHero': function (value) {
				if (!value)
					this.options.attacker.keleresHeroIA = false;
					this.options.attacker.keleresHeroIIA = false;
			},
			'options.attacker.keleresHeroIA': function (value) {
				if (value)
					this.options.attacker.keleresHeroIIA = false;
			},
			'options.attacker.keleresHeroIIA': function (value) {
				if (value)
					this.options.attacker.keleresHeroIA = false;
			},
			'options.defender.keleresHero': function (value) {
				if (!value)
					this.options.defender.keleresHeroID = false;
					this.options.defender.keleresHeroIID = false;
			},
			'options.defender.keleresHeroID': function (value) {
				if (value)
					this.options.defender.keleresHeroIID = false;
			},
			'options.defender.keleresHeroIID': function (value) {
				if (value)
					this.options.defender.keleresHeroID = false;
			},
			'options.attacker.directHit': function (value) {
				if (!value)
					this.options.attacker.directHit2A = false;
			},
			'options.attacker.directHit2A': function (value) {
				if (!value)
					this.options.attacker.directHit3A = false;
			},
			'options.attacker.directHit3A': function (value) {
				if (!value)
					this.options.attacker.directHit4A = false;
			},
			'options.defender.directHit': function (value) {
				if (!value)
					this.options.defender.directHit2D = false;
			},
			'options.defender.directHit2D': function (value) {
				if (!value)
					this.options.defender.directHit3D = false;
			},
			'options.defender.directHit3D': function (value) {
				if (!value)
					this.options.defender.directHit4D = false;
			},
			'options.attacker.argentCommander': function (value) {
				if (!value)
					this.options.attacker.argentCommanderFirstRound = false;
			},
			'options.attacker.indoctrinateMechOmegaA' : function(value){
				if (value)
					this.options.attacker.indoctrinateMechA = false;
			},
			'options.attacker.indoctrinateMechA' : function(value){
				if (value)
					this.options.attacker.indoctrinateMechOmegaA = false;
			},
			'options.defender.indoctrinateMechD' : function(value){
				if (value)
					this.options.defender.indoctrinateMechOmegaD = false;
			},
			'options.defender.indoctrinateMechOmegaD' : function(value){
				if (value)
					this.options.defender.indoctrinateMechD = false;
			},
			'options.attacker.yinAgent' : function(value){
				if (value)
					this.options.attacker.yinAgentOmega = false;
			},
			'options.attacker.yinAgentOmega' : function(value){
				if (value)
					this.options.attacker.yinAgent = false;
			},
			'options.defender.yinAgent' : function(value){
				if (value)
					this.options.defender.yinAgentOmega = false;
			},
			'options.defender.yinAgentOmega' : function(value){
				if (value)
					this.options.defender.yinAgent = false;
			},
			'options.attacker.plasmaScoring' : function(value){
				if (value)
					this.options.attacker.plasmaScoringC = false;
				if (!value)
					this.options.attacker.plasmaScoringFirstRound = false;
			},
			'options.attacker.plasmaScoringC' : function(value){
				if (value)
					this.options.attacker.plasmaScoring = false;
				if (!value)
					this.options.attacker.plasmaScoringFirstRound = false;
			},
			'options.defender.plasmaScoring' : function(value){
				if (value)
					this.options.defender.plasmaScoringC = false;
			},
			'options.defender.plasmaScoringC' : function(value){
				if (value)
					this.options.defender.plasmaScoring = false;
			},
			'options.attacker.crownThalnosSafe' : function(value){
				if (value)
					this.options.attacker.crownThalnosC = false;
			},
			'options.attacker.crownThalnosC' : function(value){
				if (value)
					this.options.attacker.crownThalnosSafe = false;
			},
			'options.defender.crownThalnosSafe' : function(value){
				if (value)
					this.options.defender.crownThalnosC = false;
			},
			'options.defender.crownThalnosC' : function(value){
				if (value)
					this.options.defender.crownThalnosSafe = false;
			},
			'attackerUnits.Flagship.upgraded' : function(value) {
				if (!value)
					this.options.attacker.memoriaII = false;
				else
					this.options.attacker.memoriaII = true;
			},
			
			'attackerUnits.WarSun.upgraded' : function(value) {
				if (!value)
					this.options.attacker.protoWarSunII = false;
				else 
					this.options.attacker.protoWarSunII = true
			},
			'attackerUnits.Dreadnought.upgraded' : function(value) {
				if (!value){
					this.options.attacker.superDreadnoughtII = false;
					this.options.attacker.exotriremeII = false;
				}
			},
			'options.attacker.superDreadnoughtII': function (value) {
				if (value)
					this.options.attacker.exotriremeII = false;
			},
			'options.attacker.exotriremeII': function (value) {
				if (value)
					this.options.attacker.superDreadnoughtII = false;
			},
			'options.attacker.specOpsII': function (value) {
				if (value)
					this.options.attacker.crimsonII = false;
			},
			'options.attacker.crimsonII': function (value) {
				if (value)
					this.options.attacker.specOpsII = false;
			},
			'attackerUnits.Cruiser.upgraded' : function(value) {
				if (!value)
					this.options.attacker.saturnEngineII = false;
			},
			'attackerUnits.Carrier.upgraded' : function(value) {
				if (!value)
					this.options.attacker.advancedCarrierII = false;
			},
			'attackerUnits.Destroyer.upgraded' : function(value) {
				if (!value)
					this.options.attacker.strikeWingII = false;
			},
			'attackerUnits.Fighter.upgraded' : function(value) {
				if (!value)
					this.options.attacker.crystalFighterII = false;
			},
			'attackerUnits.Ground.upgraded' : function(value) {
				if (!value){
					this.options.attacker.specOpsII = false;
					this.options.attacker.crimsonII = false;
					this.options.attacker.infantryIIA = false;
				}
			},
			'attackerUnits.PDS.upgraded' : function(value) {
				if (!value)
					this.options.attacker.helTitanII = false;
			},
			'options.attacker.memoriaII': function (value) {
				if (!value)
					this.attackerUnits.Flagship.upgraded = false;
			},
			'options.attacker.protoWarSunII': function (value) {
				if (!value)
					this.attackerUnits.WarSun.upgraded = false;
			},

			'defenderUnits.Flagship.upgraded' : function(value) {
				if (!value)
					this.options.defender.memoriaII = false;
				else
					this.options.defender.memoriaII = true;
			},
			'defenderUnits.WarSun.upgraded' : function(value) {
				if (!value)
					this.options.defender.protoWarSunII = false;
				else 
					this.options.defender.protoWarSunII = true
			},
			'defenderUnits.Dreadnought.upgraded' : function(value) {
				if (!value){
					this.options.defender.superDreadnoughtII = false;
					this.options.defender.exotriremeII = false;
				}
			},
			'options.defender.superDreadnoughtII': function (value) {
				if (value)
					this.options.defender.exotriremeII = false;
			},
			'options.defender.exotriremeII': function (value) {
				if (value)
					this.options.defender.superDreadnoughtII = false;
			},
			'options.defender.crimsonII': function (value) {
				if (value)
					this.options.defender.specOpsII = false;
			},
			'options.defender.specOpsII': function (value) {
				if (value)
					this.options.defender.crimsonII = false;
			},
			'defenderUnits.Cruiser.upgraded' : function(value) {
				if (!value)
					this.options.defender.saturnEngineII = false;
			},
			'defenderUnits.Carrier.upgraded' : function(value) {
				if (!value)
					this.options.defender.advancedCarrierII = false;
			},
			'defenderUnits.Destroyer.upgraded' : function(value) {
				if (!value)
					this.options.defender.strikeWingII = false;
			},
			'defenderUnits.Fighter.upgraded' : function(value) {
				if (!value)
					this.options.defender.crystalFighterII = false;
			},
			'defenderUnits.Ground.upgraded' : function(value) {
				if (!value){
					this.options.defender.specOpsII = false;
					this.options.defender.crimsonII = false;
					this.options.defender.infantryIID = false;
				}
			},
			'defenderUnits.PDS.upgraded' : function(value) {
				if (!value)
					this.options.defender.helTitanII = false;
			},
			'options.defender.memoriaII': function (value) {
				if (!value)
					this.defenderUnits.Flagship.upgraded = false;
			},
			'options.defender.protoWarSunII': function (value) {
				if (!value)
					this.defenderUnits.WarSun.upgraded = false;
			},		
			'options.attacker.battleType': function (value) {
				if (value === 'Ground')
					this.defenderUnits.Planet.count = Math.min(1,this.defenderUnits.Planet.count);
			},
			'defenderUnits.Planet.count' : function(value) {
				if (value>1 && this.battleType === 'Ground')
					this.defenderUnits.Planet.count = Math.min(1,this.defenderUnits.Planet.count);
			},
			'options.attacker.supercharger': function (value) {
				if (value)
					this.options.attacker.superchargerC = false;
			},
			'options.defender.supercharger': function (value) {
				if (value)
					this.options.defender.superchargerC = false;
			},
			'options.attacker.superchargerC': function (value) {
				if (value)
					this.options.attacker.supercharger = false;
			},
			'options.defender.superchargerC': function (value) {
				if (value)
					this.options.defender.supercharger = false;
			},
			'options.attacker.valkyrieParticleWeave': function (value) {
				if (value)
					this.options.attacker.valkyrieParticleWeaveC = false;
			},
			'options.defender.valkyrieParticleWeave': function (value) {
				if (value)
					this.options.defender.valkyrieParticleWeaveC = false;
			},
			'options.attacker.valkyrieParticleWeaveC': function (value) {
				if (value)
					this.options.attacker.valkyrieParticleWeave = false;
			},
			'options.defender.valkyrieParticleWeaveC': function (value) {
				if (value)
					this.options.defender.valkyrieParticleWeave = false;
			},
			battleType: recomputeHandler,
			attackerUnits: updateDamageableCountAndRecomputeHandler('attacker'),
			defenderUnits: updateDamageableCountAndRecomputeHandler('defender'),
			options: recomputeHandler,
			canvasSize: function () {
				persistInput();
				var self = this;
				if (lastComputed)
					this.$nextTick(function () {
						this.displayDistribution(lastComputed);
					});
			},
			forceSlow: recomputeHandler,
		},
		computed: {
			technologies: function() {
				var result = [];
				var techKeys = Object.keys(Technologies);
				for (var i = 0; i < techKeys.length; ++i){
					var tech = Technologies[techKeys[i]];
					if ((tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) && tech.limitedToSide === 'attacker') && 
						(i + 1 < techKeys.length) && 
						(Technologies[techKeys[i+1]].availableFor("defender", this.options.defender.units, this.options.defender.battleType, this.options) && Technologies[techKeys[i+1]].limitedToSide === 'defender')){
						result.push({
							pair: {
							[BattleSide.attacker]: {
								key: techKeys[i],
								option:Technologies[techKeys[i]],
							},
							[BattleSide.defender]: {
								key: techKeys[i + 1],
								option: Technologies[techKeys[i + 1]],
							}
						}});
						i++;
					} else {
						if (tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) || tech.availableFor("defender", this.options.defender.units, this.options.defender.battleType,this.options)){
							result.push({
								key: techKeys[i],
								option: tech
							});
						}
					}
				}
				return result;
			},
			actionCards: function() {
				var result = [];
				var techKeys = Object.keys(ActionCards);
				for (var i = 0; i < techKeys.length; ++i){
					var tech = ActionCards[techKeys[i]];
					if ((tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) && tech.limitedToSide === 'attacker') && 
						(i + 1 < techKeys.length) && 
						(ActionCards[techKeys[i+1]].availableFor("defender", this.options.defender.units, this.options.defender.battleType, this.options) && ActionCards[techKeys[i+1]].limitedToSide === 'defender')){
						result.push({
							pair: {
							[BattleSide.attacker]: {
								key: techKeys[i],
								option: ActionCards[techKeys[i]],
							},
							[BattleSide.defender]: {
								key: techKeys[i + 1],
								option: ActionCards[techKeys[i + 1]],
							}
						}});
						i++;
					} else {
						if (tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) || tech.availableFor("defender", this.options.defender.units, this.options.defender.battleType,this.options)){
							result.push({
								key: techKeys[i],
								option: tech
							});
						}
					}
				}
				return result;
			},
			miscellaneous: function() {
				var result = [];
				var techKeys = Object.keys(Miscellaneous);
				for (var i = 0; i < techKeys.length; ++i){
					var tech = Miscellaneous[techKeys[i]];
					if (tech.limitedToSide === "attacker" && (i + 1 < techKeys.length) && Miscellaneous[techKeys[i+1]].limitedToSide === "defender"){
						// special collapsing of Ω techs into one row
						result.push({
							pair: {
							[BattleSide.attacker]: {
								key: techKeys[i],
								option: Miscellaneous[techKeys[i]],
							},
							[BattleSide.defender]: {
								key: techKeys[i + 1],
								option: Miscellaneous[techKeys[i + 1]],
							}
						}});
						i++;
					} else {
						if (tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) || tech.availableFor("defender", this.options.defender.units, this.options.defender.battleType,this.options)){
							result.push({
								key: techKeys[i],
								option: tech
							});
						}
					}
				}
				return result;
			},
			leaders: function() {
				var result = [];
				var techKeys = Object.keys(Leaders);
				for (var i = 0; i < techKeys.length; ++i){
					var tech = Leaders[techKeys[i]];
					if (tech.limitedToSide === "attacker" && (i + 1 < techKeys.length) && Leaders[techKeys[i+1]].limitedToSide === "defender"){
						// special collapsing of Ω techs into one row
						result.push({
							pair: {
							[BattleSide.attacker]: {
								key: techKeys[i],
								option: Leaders[techKeys[i]],
							},
							[BattleSide.defender]: {
								key: techKeys[i + 1],
								option: Leaders[techKeys[i + 1]],
							}
						}});
						i++;
					} else {
						if (tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) || tech.availableFor("defender", this.options.defender.units, this.options.defender.battleType,this.options)){
							result.push({
								key: techKeys[i],
								option: tech
							});
						}
					}
				}
				return result;
			},
			raceTechnologies: function () {
				var attackerTech = Object.assign({},RaceSpecificTechnologies[this.options.attacker.race] || {});
				var defenderTech = Object.assign({},RaceSpecificTechnologies[this.options.defender.race] || {});
				if (this.options.defender.race === Race.Virus){
					defenderTech = {...defenderTech, ...(this.defenderUnits.Flagship.upgraded ? {memoriaII : VirusUpgrades[this.options.defender.race].memoriaII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.WarSun.upgraded ? {protoWarSunII : VirusUpgrades[this.options.defender.race].protoWarSunII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.Dreadnought.upgraded ? {superDreadnoughtII : VirusUpgrades[this.options.defender.race].superDreadnoughtII, exotriremeII : VirusUpgrades[this.options.defender.race].exotriremeII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.Cruiser.upgraded ? {saturnEngineII : VirusUpgrades[this.options.defender.race].saturnEngineII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.Carrier.upgraded ? {advancedCarrierII : VirusUpgrades[this.options.defender.race].advancedCarrierII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.Destroyer.upgraded ? {strikeWingII : VirusUpgrades[this.options.defender.race].strikeWingII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.Fighter.upgraded ? {crystalFighterII : VirusUpgrades[this.options.defender.race].crystalFighterII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.Ground.upgraded ? {specOpsII : VirusUpgrades[this.options.defender.race].specOpsII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.Ground.upgraded ? {crimsonII : VirusUpgrades[this.options.defender.race].crimsonII} : {})};
					defenderTech = {...defenderTech, ...(this.defenderUnits.PDS.upgraded ? {helTitanII : VirusUpgrades[this.options.defender.race].helTitanII} : {})};
				}
				if (this.options.attacker.race === Race.Virus){
					attackerTech = {...attackerTech, ...(this.attackerUnits.Flagship.upgraded ? {memoriaII : VirusUpgrades[this.options.attacker.race].memoriaII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.WarSun.upgraded ? {protoWarSunII : VirusUpgrades[this.options.attacker.race].protoWarSunII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.Dreadnought.upgraded ? {superDreadnoughtII : VirusUpgrades[this.options.attacker.race].superDreadnoughtII, exotriremeII : VirusUpgrades[this.options.attacker.race].exotriremeII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.Cruiser.upgraded ? {saturnEngineII : VirusUpgrades[this.options.attacker.race].saturnEngineII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.Carrier.upgraded ? {advancedCarrierII : VirusUpgrades[this.options.attacker.race].advancedCarrierII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.Destroyer.upgraded ? {strikeWingII : VirusUpgrades[this.options.attacker.race].strikeWingII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.Fighter.upgraded ? {crystalFighterII : VirusUpgrades[this.options.attacker.race].crystalFighterII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.Ground.upgraded ? {specOpsII : VirusUpgrades[this.options.attacker.race].specOpsII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.Ground.upgraded ? {crimsonII : VirusUpgrades[this.options.attacker.race].crimsonII} : {})};
					attackerTech = {...attackerTech, ...(this.attackerUnits.PDS.upgraded ? {helTitanII : VirusUpgrades[this.options.attacker.race].helTitanII} : {})};
				}
				for (var tech in defenderTech){
					if (!defenderTech[tech].availableFor("defender", this.options.defender.units, this.options.defender.battleType, this.options))
						delete defenderTech[tech];
				}
				for (var tech in attackerTech){
					if (!attackerTech[tech].availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options))
						delete attackerTech[tech];
				}
				var attackerTechKeys = Object.keys(attackerTech);
				var defenderTechKeys = Object.keys(defenderTech);

				var result = [];
				for (var i = 0; i < attackerTechKeys.length || i < defenderTechKeys.length; ++i) {
					var pair = {};
					pair.attacker = i < attackerTechKeys.length ? {
						key: attackerTechKeys[i],
						option: attackerTech[attackerTechKeys[i]],
					} : stub(defenderTech[defenderTechKeys[i]].title);

					pair.defender = i < defenderTechKeys.length ? {
						key: defenderTechKeys[i],
						option: defenderTech[defenderTechKeys[i]],
					} : stub(attackerTech[attackerTechKeys[i]].title);
					result.push(pair);
				}
				return result;

				function stub(name) {
					return {
						key: '',
						option:
							{
								title: name,
								availableFor: function () {
									return false;
								}
							}
					};
				}
			},
			heroes: function() {
				var result = [];
				var modHeroes = Object.assign({}, Heroes[this.options.attacker.race], Heroes[this.options.defender.race]);
				var techKeys = Object.keys(modHeroes);
				for (var i = 0; i < techKeys.length; ++i){
					var tech = modHeroes[techKeys[i]];
					if ((tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) && tech.limitedToSide === 'attacker') && 
						(i + 1 < techKeys.length) && 
						(modHeroes[techKeys[i+1]].availableFor("defender", this.options.defender.units, this.options.defender.battleType, this.options) && modHeroes[techKeys[i+1]].limitedToSide === 'defender')){
						// special collapsing of Ω techs into one row
						result.push({
							
							[BattleSide.attacker]: {
								key: techKeys[i],
								option: modHeroes[techKeys[i]],
							},
							[BattleSide.defender]: {
								key: techKeys[i + 1],
								option: modHeroes[techKeys[i + 1]],
							}
						});
						i++;
					} else {
						if (tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) || tech.availableFor("defender", this.options.defender.units, this.options.defender.battleType,this.options)){
							result.push({
								
									attacker: {
										key: techKeys[i],
										option: tech,
									},
									defender : {
										key: techKeys[i],
										option: tech,
									}
								
							});
						}
					}
				}
				return result;
			},
			/*heroes: function () {
				var attackerOption = Heroes[this.options.attacker.race] || {};
				var defenderOption = Heroes[this.options.defender.race] || {};
				var attackerOptionKeys = Object.keys(attackerOption);
				var defenderOptionKeys = Object.keys(defenderOption);
				var result = [];
				for (var i = 0; i < attackerOptionKeys.length || i < defenderOptionKeys.length; ++i) {
					var pair = {};
					pair.attacker = i < attackerOptionKeys.length ? {
						key: attackerOptionKeys[i],
						option: attackerOption[attackerOptionKeys[i]],
					} : stub(defenderOption[defenderOptionKeys[i]].title);
					pair.defender = i < defenderOptionKeys.length ? {
						key: defenderOptionKeys[i],
						option: defenderOption[defenderOptionKeys[i]],
					} : stub(attackerOption[attackerOptionKeys[i]].title);
					result.push(pair);
				}
				return result;

				function stub(name) {
					return {
						key: '',
						option:
							{
								title: name,
								availableFor: function () {
									return false;
								}
							}
					};
				}
			},*/
			raceOptions: function () {
				var attackerOption = Object.assign({}, RacialSpecific[this.options.attacker.race] || {});
				var defenderOption = Object.assign({},RacialSpecific[this.options.defender.race] || {});
				for (var option in attackerOption){
					if (!attackerOption[option].availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options))
						delete attackerOption[option];
				}
				for (var option in defenderOption){
					if (!defenderOption[option].availableFor("defender", this.options.defender.units, this.options.defender.battleType,this.options))
						delete defenderOption[option];
				}
				var attackerOptionKeys = Object.keys(attackerOption);
				var defenderOptionKeys = Object.keys(defenderOption);
				var result = [];

				for (var i = 0; i < attackerOptionKeys.length || i < defenderOptionKeys.length; ++i) {
					var pair = {};
					pair.attacker = i < attackerOptionKeys.length ? {
						key: attackerOptionKeys[i],
						option: attackerOption[attackerOptionKeys[i]],
					} : stub(defenderOption[defenderOptionKeys[i]].title);
					pair.defender = i < defenderOptionKeys.length ? {
						key: defenderOptionKeys[i],
						option: defenderOption[defenderOptionKeys[i]],
					} : stub(attackerOption[attackerOptionKeys[i]].title);
					result.push(pair);
				}
				return result;

				function stub(name) {
					return {
						key: '',
						option:
							{
								title: name,
								availableFor: function () {
									return false;
								}
							}
					};
				}
			},
			promissory: function() {
				var result = [];
				var techKeys = Object.keys(Promissory);
				for (var i = 0; i < techKeys.length; ++i){
					var tech = Promissory[techKeys[i]];
					if ((tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) && tech.limitedToSide === 'attacker') && 
						(i + 1 < techKeys.length) && 
						(Promissory[techKeys[i+1]].availableFor("defender", this.options.defender.units, this.options.defender.battleType, this.options) && Promissory[techKeys[i+1]].limitedToSide === 'defender')){
						// special collapsing of Ω techs into one row
						result.push({
							pair: {
							[BattleSide.attacker]: {
								key: techKeys[i],
								option: Promissory[techKeys[i]],
							},
							[BattleSide.defender]: {
								key: techKeys[i + 1],
								option: Promissory[techKeys[i + 1]],
							}
						}});
						i++;
					} else {
						if (tech.availableFor("attacker", this.options.attacker.units, this.options.attacker.battleType,this.options) || tech.availableFor("defender", this.options.defender.units, this.options.defender.battleType,this.options)){
							result.push({
								key: techKeys[i],
								option: tech
							});
						}
					}
				}
				return result;
			},
			canvasWidth: function () {
				return window.CanvasSizes[this.canvasSize].width + 'px';
			},
			canvasHeight: function () {
				return window.CanvasSizes[this.canvasSize].height + 'px';
			},
		},
	});
	Vue.component('left-option', {
		props: ['optionName', 'option', 'options', 'side'],
		template:
		'<div class="o-grid__cell left-option" :class="{ hidden: !option.availableFor(side, options[side].units, options[side].battleType,options) }">' +
		'	<label class="" v-bind:for="side + \'.\' + optionName"' +
		'			v-bind:title="option.description">{{option.availableFor(side, options[side].units, options[side].battleType,options) ? option.name() : option.title}}</label>' +
		'	<input type="checkbox" class="" v-bind:id="side + \'.\' + optionName"' +
		'			v-model="options[side][optionName]">' +
		'</div>',
	});
	Vue.component('right-option', {
		props: ['optionName', 'option', 'options', 'side'],
		template:
		'<div class="o-grid__cell right-option" :class="{ hidden: !option.availableFor(side, options[side].units, options[side].battleType,options) }">' +
		'	<input type="checkbox" class="" v-bind:id="side + \'.\' + optionName"' +
		'			v-model="options[side][optionName]">' +
		'	<label class="" v-bind:for="side + \'.\' + optionName"' +
		'			v-bind:title="option.description">{{option.availableFor(side, options[side].units, options[side].battleType,options) ? option.name() : option.title}}</label>' +
		'</div>',
	});
	Vue.component('option-pair', {
		props: ['optionName', 'option', 'options', 'pair', 'visible'],
		template:
		'<div class="o-grid center-grid" v-if="visible !== false">' +
		'	<left-option :option-name="option ? optionName : pair.attacker.key" :option="option || pair.attacker.option" :options="options" side="attacker"></left-option>' +
		'	<help-mark v-if="option" :option="option" ></help-mark>' +
		'	<help-mark v-if="pair" :option="pair.attacker.option" :class="{ hidden: !pair.attacker.option.availableFor(\'attacker\', options.attacker.units, options.attacker.battleType, options) }"></help-mark>' +
		'	<help-mark v-if="pair" :option="pair.defender.option" :class="{ hidden: !pair.defender.option.availableFor(\'defender\', options.defender.units, options.defender.battleType, options) }"></help-mark>' +
		'	<right-option :option-name="option ? optionName : pair.defender.key" :option="option || pair.defender.option" :options="options" side="defender"></right-option>' +
		'</div>',
	});
	Vue.component('help-mark', {
		props: ['option'],
		template:
		'<div class="o-grid__cell">' +
		'	<button type="button" class="help" v-bind:title="option.description" @click="showHelp"></button>' +
		'</div>',
		methods: {
			showHelp: function () {
				alert(this.option.name() + ':\n' + this.option.description);
			}
		}
	});

	app.recompute();

	/** When the race changed from the race having an upgrade for the unit (eg Sol Carrier)
	 * to the race not having such upgrade, input flag for the unit upgrade should be set to false */
	function resetUpdatesAndTechnologies(battleSide) {
		return function (newRace, oldRace) {
			// clear now included

			for (var unitType in UnitType) {
				this[SideUnits[battleSide]][unitType].count = 0;
				this[SideUnits[battleSide]][unitType].upgraded = false;
			}
			for (var options in NonSpecificOptions) {
				for (var option in NonSpecificOptions[options]){
					if (option !== "riskDirectHit")
						this.options[battleSide][option] = false;
				}
			}
			for (var options in SpecificOptions) {
				for (var race in SpecificOptions[options]){
					for (var option in SpecificOptions[options][race]){
						
						this.options[battleSide][option] = false;
					}
				}
			}
			
			for (var unitType in UnitType) {
				var counter = this[SideUnits[battleSide]][unitType];
				if (!upgradeable(newRace, unitType)) {
					counter.upgraded = false;
				}
				if (!damageable(newRace, unitType, counter.upgraded, this.options)) {
					counter.damaged = 0;
				}
				if (newRace != oldRace) {
					counter.participants = 0;
					counter.notBombarding = 0;
				}
			}
			if (RaceSpecificTechnologies[oldRace]){
				for (var tech in RaceSpecificTechnologies[oldRace]){
					this.options[battleSide][tech] = false;
				}
			}
			if (oldRace === Race.Virus){
				for (var tech in VirusUpgrades[oldRace]){
					this.options[battleSide][tech] = false;
				}
			}
			if (RacialSpecific[oldRace]){
				for (var option in RacialSpecific[oldRace]){
					this.options[battleSide][option] = false;
				}
			}
			if (Heroes[oldRace]){
				for (var option in Heroes[oldRace]){
					this.options[battleSide][option] = false;
				}
			}
			for (var num in startingOptions[newRace]){
				var tech= startingOptions[newRace][num];
				this.options[battleSide][tech] = true;
			}
			
		};
	}

	function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		console.log(callNow);
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

	function updateDamageableCountAndRecomputeHandler(battleSide) {
		return {
			handler: function () {
				for (var unitType in UnitType) {
					var counter = this[SideUnits[battleSide]][unitType];
					counter.damaged = Math.min(counter.damaged, counter.count);
					counter.participants = Math.min(counter.participants,counter.count);
					counter.notBombarding = Math.min(counter.notBombarding,counter.count);
				}
				this.recompute();
			},
			deep: true
		}
	}

	function getInput() {
		return mergeDeep(getDefaultInput(), getPersistedInput());

		function isObject(item) {
			return (item && typeof item === 'object' && !Array.isArray(item));
		}

		function mergeDeep(target, ...sources) {
			if (!sources.length) return target;
			const source = sources.shift();

			if (isObject(target) && isObject(source)) {
				for (const key in source) {
					if (isObject(source[key])) {
						if (!target[key]) Object.assign(target, { [key]: {} });
						mergeDeep(target[key], source[key]);
					} else {
						Object.assign(target, { [key]: source[key] });
					}
				}
			}

			return mergeDeep(target, ...sources);
		}
	}

	function getDefaultInput() {
		var result = {
			battleType: BattleType.Space,
			attackerUnits: {},
			defenderUnits: {},
			options: {
				attacker: {
					race: Race.Arborec,
				}, defender: null,
			},
			canvasSize: 0,
		};

		for (var technology in Technologies) {
			result.options.attacker[technology] = false;
		}
		for (var actionCard in ActionCards) {
			result.options.attacker[actionCard] = false;
		}
		for (var agenda in Agendas) {
			result.options.attacker[agenda] = false;
		}
		for (var prom in Promissory) {
			result.options.attacker[prom] = false;
		}
		for (var mis in Miscellaneous) {
			result.options.attacker[mis] = false;
		}
		result.options.attacker.riskDirectHit = true;
		result.options.attacker.magenDefenseOmega = true;

		result.options.defender = Object.assign({}, result.options.attacker);

		for (var unitType in UnitType) {
			result.attackerUnits[unitType] = { count: 0, upgraded: false, damaged: 0, participants: 0, notBombarding: 0 };
			result.defenderUnits[unitType] = { count: 0, upgraded: false, damaged: 0, participants: 0, notBombarding: 0 };
		}
		result.options.attacker.units=result.attackerUnits;
		result.options.defender.units=result.defenderUnits;
		return result;
	}

	function persistInput() {
		if (localStorage) {
			var inputToSave = JSON.parse(JSON.stringify(input));
			for (var viewOnlyProperty in transientProperties) {
				delete inputToSave[viewOnlyProperty];
			}
			localStorage.setItem('ti4calc/input', JSON.stringify(inputToSave));
			return true;
		}
		return false;
	}
	function getPersistedInput() {
		if (!localStorage) return null;
		var resultString = localStorage.getItem('ti4calc/input');
		if (!resultString) return null;
		var result = JSON.parse(resultString);
		for (var unitType in UnitType) {
			// because previous published version didn't have already damaged units, persisted input might miss these fields
			
			result.attackerUnits[unitType].damaged = result.attackerUnits[unitType].damaged || 0;
			result.defenderUnits[unitType].damaged = result.defenderUnits[unitType].damaged || 0;
			result.attackerUnits[unitType].participants = result.attackerUnits[unitType].participants || 0;
			result.defenderUnits[unitType].participants = result.defenderUnits[unitType].participants || 0;
			result.attackerUnits[unitType].notBombarding = result.attackerUnits[unitType].notBombarding || 0;
			result.defenderUnits[unitType].notBombarding = result.defenderUnits[unitType].notBombarding || 0;
		}
		return result;
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
})();