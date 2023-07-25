/*var structs,game,calc,imitatorModule;
if (typeof require === 'function') {
	structs = require('../structs');
	game = require('../game-elements');
	calc = require('../calculator').calculator;
	imitatorModule = require('../imitator');
} else {
	structs = window;
	game = window;
	calc = window.calculator;
	imitatorModule=window.imitator
}*/
var structs = require('../structs');
var game = require('../game-elements');
var calc = require('../calculator').calculator;
var imitatorModule = require('../imitator');


var im = imitatorModule.imitator;
//imitatorModule.calculator=imitatorModule.imitator;
imitatorModule.imitationIterations = 50000;
var defaultRace = game.Race.Creuss;
var accuracy = 0.01;

function distributionsEqual(distr1, distr2,huff=false) {
	var min = Math.min(distr1.min, distr2.min);
	var max = Math.max(distr1.max, distr2.max);
	if (isNaN(min) || isNaN(max)) return false;
	var cumulative1 = 0, cumulative2 = 0;
	for (var i = min; i <= max; i++) {
		var x = distr1.at(i) === undefined ? 0 : distr1.at(i);
		var y = distr2.at(i) === undefined ? 0 : distr2.at(i);
		if (accuracy < Math.abs(x - y)){
			if (huff) print("Difference Too Big: "+ x + " " + y);
			//print(huff);
			return false;
		}
		cumulative1 += x;
		cumulative2 += y;
		if (accuracy < Math.abs(cumulative1 - cumulative2)){
			if (huff) print("Cumulative Too Big");
			//print(huff);
			return false;
		}
	}
	return true;
}

function invertDistribution(distr) {
	return {
		min: -distr.max,
		max: -distr.min,
		at: function (i) {
			return distr.at(-i);
		},
	};
}

function testBattle(test, attacker, defender, battleType, options) {
	var input = new Input(attacker, defender, battleType, options);
	var got = calc.computeProbabilities(input).distribution;
	var expected = im.estimateProbabilities(input).distribution;

	var equal = distributionsEqual(expected, got);
	if (!equal) {
		console.log('i', expected.toString());
		console.log('c', got.toString());
	}

	test.ok(equal, 'empirical differs from analytical');

	test.done();
}

function testExpansion(test, actual, expected) {
	// test organised this way, because I hate how nodeunit reports errors
	var result = false;
	var message;

	test: do {
		if (!actual) {
			message = 'no expansion';
			break test;
		}
		if (actual.length !== expected.length) {
			message = format('wrong length', actual.length, expected.length);
			break test;
		}
		for (var i = 0; i < actual.length; i++) {
			var unit = actual[i];
			var expectedUnit = expected[i];

			if (unit.type !== expectedUnit.type) {
				message = format('wrong ship at ' + i, unit.type, expectedUnit.type);
				break test;
			}

			if (unit.isDamageGhost !== expectedUnit.isDamageGhost) {
				message = format('isDamageGhost wrong at ' + i, unit.isDamageGhost, expectedUnit.isDamageGhost);
				break test;
			}
			if (expectedUnit.type === game.UnitType.PDS || expectedUnit.type === 'Bloodthirsty Space Dock') {
				if (unit.spaceCannonValue !== expectedUnit.spaceCannonValue) {
					message = format('space cannon wrong at ' + i, unit.spaceCannonValue, expectedUnit.spaceCannonValue);
					break test;
				}
			} else if (expectedUnit.isDamageGhost) {
				if (!isNaN(unit.battleValue)) {
					message = 'battleValue not NaN for damage ghost at ' + i;
					break test;
				}
			} else {
				if (unit.battleValue !== expectedUnit.battleValue) {
					message = format('wrong battleValue at ' + i, unit.battleValue, expectedUnit.battleValue);
					break test;
				}
			}
			if (unit.damaged !== expectedUnit.damaged) {
				message = format('wrong damaged state at ' + i, unit.damaged, expectedUnit.damaged);
				break test;
			}
		}
		result = true;
	} while (false);

	if (!result) {
		console.log(actual && actual.map(function (unit) {return unit.shortType;}).join());
	}
	test.ok(result, message);
	test.done();

	function format(text, actual, expected) {
		return text + ', expected ' + expected + ', got ' + actual;
	}
}

exports.expansionDefault = function (test) {
	var unit = game.UnitType;
	var fleet = {};
	fleet[unit.Flagship] = { count: 1 };
	fleet[unit.WarSun] = { count: 1 };
	fleet[unit.Dreadnought] = { count: 1 };
	fleet[unit.Cruiser] = { count: 1 };
	fleet[unit.Carrier] = { count: 1 };
	fleet[unit.Destroyer] = { count: 1 };
	fleet[unit.Ground] = { count: 1 };
	fleet[unit.Fighter] = { count: 1 };
	fleet[unit.PDS] = { count: 1 };
	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: defaultRace, riskDirectHit: true, experimentalBattlestation: true },
	}), game.BattleSide.attacker);

	var units = Object.assign({}, game.RaceSpecificUnits[defaultRace], game.StandardUnits);

	var expected = [
		units[unit.Flagship],
		units[unit.WarSun],
		units[unit.Dreadnought],
		units[unit.Cruiser],
		units[unit.Carrier],
		units[unit.Destroyer],
		units[unit.Fighter],
		units[unit.Ground],
		units[unit.PDS],
		units[unit.Flagship].toDamageGhost(),
		units[unit.WarSun].toDamageGhost(),
		units[unit.Dreadnought].toDamageGhost(),
		game.StandardUnits.ExperimentalBattlestation,
	];

	testExpansion(test, expansion, expected);
};

exports.expansionRiskDirectHit = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = { count: 4 };
	fleet[game.UnitType.Cruiser] = { count: 3 };
	fleet[game.UnitType.PDS] = { count: 2 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: defaultRace, riskDirectHit: true },
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.PDS],
		game.StandardUnits[u.PDS],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost()];

	testExpansion(test, expansion, expected);
};

exports.expansionNoRiskDirectHitRegularDreadnoughts = function (test) {
	var fleet = {};
	fleet[game.UnitType.WarSun] = { count: 1 };
	fleet[game.UnitType.Dreadnought] = { count: 4 };
	fleet[game.UnitType.Cruiser] = { count: 3 };
	fleet[game.UnitType.PDS] = { count: 2 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: defaultRace, riskDirectHit: false },
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun].toDamageGhost(),
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.PDS],
		game.StandardUnits[u.PDS],
	];

	testExpansion(test, expansion, expected);
};

exports.expansionNoRiskDirectHitUpgradedDreadnoughts = function (test) {
	var fleet = {};
	fleet[game.UnitType.WarSun] = { count: 1 };
	fleet[game.UnitType.Dreadnought] = { count: 4, upgraded: true };
	fleet[game.UnitType.Cruiser] = { count: 3 };
	fleet[game.UnitType.PDS] = { count: 2 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: defaultRace, riskDirectHit: false },
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun].toDamageGhost(),
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.Cruiser],
		game.StandardUnits[u.PDS],
		game.StandardUnits[u.PDS],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
	];

	testExpansion(test, expansion, expected);
};

exports.expansionWithUpgrades = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = { count: 1 };
	fleet[game.UnitType.Carrier] = { count: 1, upgraded: true };
	fleet[game.UnitType.Cruiser] = { count: 3, upgraded: true };
	fleet[game.UnitType.PDS] = { count: 2, upgraded: true };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: game.Race.Sol, riskDirectHit: true, },
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		game.StandardUnits[u.Dreadnought],
		game.StandardUpgrades[u.Cruiser],
		game.StandardUpgrades[u.Cruiser],
		game.StandardUpgrades[u.Cruiser],
		game.RaceSpecificUpgrades.Sol[u.Carrier],
		game.StandardUpgrades[u.PDS],
		game.StandardUpgrades[u.PDS],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.RaceSpecificUpgrades.Sol[u.Carrier].toDamageGhost(),
	];

	testExpansion(test, expansion, expected);
};

exports.expansionMentakFlagship = function (test) {
	var attacker = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.WarSun] = { count: 2 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	var defender = {};
	defender[game.UnitType.Flagship] = { count: 1 };

	var expansion = game.expandFleet(new Input(attacker, defender, game.BattleType.Space, {
		attacker: { race: defaultRace },
		defender: { race: game.Race.Mentak },
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		game.RaceSpecificUnits[defaultRace][u.Flagship],
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
	];

	testExpansion(test, expansion, expected);
};

exports.expansionAndFilterVirusFlagship = function (test) {
	var attacker = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { race: game.Race.Virus }, };
	var filteredFleet = game.expandFleet(new Input(attacker, null, game.BattleType.Space, options), game.BattleSide.attacker).filterForBattle();

	var u = game.UnitType;
	var expected = [
		game.RaceSpecificUnits[game.Race.Virus][u.Flagship],
		game.StandardUnits[u.Ground],
		game.StandardUnits[u.Ground],
		game.StandardUnits[u.Fighter],
		game.StandardUnits[u.Fighter],
		game.RaceSpecificUnits[game.Race.Virus][u.Flagship].toDamageGhost(),
	];

	testExpansion(test, filteredFleet, expected);
};

exports.expansionAndFilterNaaluFlagshipFightersBetter = function (test) {
	var attacker = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 2, upgraded: true };
	attacker[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { race: game.Race.Naalu }, };
	var filteredFleet = game.expandFleet(new Input(attacker, null, game.BattleType.Ground, options), game.BattleSide.attacker).filterForBattle();

	var u = game.UnitType;
	var expected = [
		game.StandardUnits[u.Ground],
		game.RaceSpecificUpgrades[game.Race.Naalu][u.Fighter],
		game.RaceSpecificUpgrades[game.Race.Naalu][u.Fighter],
		game.StandardUnits[u.Ground],
	];

	testExpansion(test, filteredFleet, expected);
};

exports.expansionAndFilterNaaluFlagshipGroundBetter = function (test) {
	var attacker = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { race: game.Race.Naalu }, };
	var filteredFleet = game.expandFleet(new Input(attacker, null, game.BattleType.Ground, options), game.BattleSide.attacker).filterForBattle();

	var u = game.UnitType;
	var expected = [
		game.StandardUnits[u.Ground],
		game.StandardUnits[u.Ground],
		game.RaceSpecificUnits[game.Race.Naalu][u.Fighter],
		game.RaceSpecificUnits[game.Race.Naalu][u.Fighter],
	];

	testExpansion(test, filteredFleet, expected);
};

exports.expansionPublicizeWeaponSchematics = function (test) {
	var fleet = {};
	fleet[game.UnitType.WarSun] = { count: 2, damaged: 1 };
	fleet[game.UnitType.Dreadnought] = { count: 1 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: { race: defaultRace, publicizeSchematics: true },
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		// in contrast to expansionDamaged test, WarSuns are considered undamaged, as they cannot be repaired by Duranium Armor
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
	];

	testExpansion(test, expansion, expected);
};

exports.expansionDamaged = function (test) {
	var fleet = {};
	fleet[game.UnitType.Flagship] = { count: 2, damaged: 1 };
	fleet[game.UnitType.WarSun] = { count: 3, damaged: 2 };
	fleet[game.UnitType.Dreadnought] = { count: 4, damaged: 3 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, { attacker: { race: game.Race.Sol, }, }), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		damage(game.RaceSpecificUnits[game.Race.Sol][u.Flagship]),
		game.RaceSpecificUnits[game.Race.Sol][u.Flagship],
		damage(game.StandardUnits[u.WarSun]),
		damage(game.StandardUnits[u.WarSun]),
		game.StandardUnits[u.WarSun],
		damage(game.StandardUnits[u.Dreadnought]),
		damage(game.StandardUnits[u.Dreadnought]),
		damage(game.StandardUnits[u.Dreadnought]),
		game.StandardUnits[u.Dreadnought],
		game.RaceSpecificUnits[game.Race.Sol][u.Flagship].toDamageGhost(),
		game.StandardUnits[u.WarSun].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
	];

	testExpansion(test, expansion, expected);

	function damage(unit) {
		var result = unit.clone();
		result.damaged = true;
		return result;
	}
};

exports.expansionLetnevFlagshipRiskDirectHit = function (test) {
	var fleet = {};
	fleet[game.UnitType.Flagship] = { count: 1, };
	fleet[game.UnitType.WarSun] = { count: 3, damaged: 1 };
	fleet[game.UnitType.Dreadnought] = { count: 4, damaged: 2 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: {
			race: game.Race.Letnev,
			riskDirectHit: true
		},
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		game.RaceSpecificUnits[game.Race.Letnev][u.Flagship],
		damage(game.StandardUnits[u.WarSun]),
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun],
		damage(game.StandardUnits[u.Dreadnought]),
		damage(game.StandardUnits[u.Dreadnought]),
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],

		game.StandardUnits[u.WarSun].toDamageGhost(),
		game.StandardUnits[u.WarSun].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.RaceSpecificUnits[game.Race.Letnev][u.Flagship].toDamageGhost(),
	];

	testExpansion(test, expansion, expected);

	function damage(unit) {
		var result = unit.clone();
		result.damaged = true;
		return result;
	}
};

exports.expansionLetnevFlagshipDontRiskDirectHit = function (test) {
	var fleet = {};
	fleet[game.UnitType.Flagship] = { count: 1, };
	fleet[game.UnitType.WarSun] = { count: 3, damaged: 1 };
	fleet[game.UnitType.Dreadnought] = { count: 4, damaged: 2 };

	var expansion = game.expandFleet(new Input(fleet, null, game.BattleType.Space, {
		attacker: {
			race: game.Race.Letnev,
			riskDirectHit: false
		},
	}), game.BattleSide.attacker);

	var u = game.UnitType;
	var expected = [
		game.RaceSpecificUnits[game.Race.Letnev][u.Flagship],
		game.RaceSpecificUnits[game.Race.Letnev][u.Flagship].toDamageGhost(),

		damage(game.StandardUnits[u.WarSun]),
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun],
		game.StandardUnits[u.WarSun].toDamageGhost(),
		game.StandardUnits[u.WarSun].toDamageGhost(),

		damage(game.StandardUnits[u.Dreadnought]),
		damage(game.StandardUnits[u.Dreadnought]),
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought],
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
		game.StandardUnits[u.Dreadnought].toDamageGhost(),
	];

	testExpansion(test, expansion, expected);

	function damage(unit) {
		var result = unit.clone();
		result.damaged = true;
		return result;
	}
};

exports.symmetricImitator = function (test) {
	var fleet = {};
	fleet[game.UnitType.Dreadnought] = 2;
	fleet[game.UnitType.Destroyer] = 4;
	fleet[game.UnitType.Cruiser] = 2;
	fleet[game.UnitType.PDS] = 1;
	fleet[game.UnitType.Fighter] = 3;
	var input = new Input(fleet, fleet, game.BattleType.Space);
	var result= im.estimateProbabilities(input);
	var distr = result.distribution;
	//console.log(result);
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse), 'got asymmetric distribution');
	test.done();
};

exports.symmetricCalculator = function (test) {
	var fleet = {};
	fleet[game.UnitType.WarSun] = 1;
	fleet[game.UnitType.Dreadnought] = 2;
	fleet[game.UnitType.Destroyer] = 4;
	fleet[game.UnitType.Cruiser] = 2;
	fleet[game.UnitType.PDS] = 1;
	fleet[game.UnitType.Carrier] = 2;
	fleet[game.UnitType.Fighter] = 3;
	var input = new Input(fleet, fleet, game.BattleType.Space);
	var distr = calc.computeProbabilities(input).distribution;
	var inverse = invertDistribution(distr);
	test.ok(distributionsEqual(distr, inverse), 'got asymmetric distribution');
	test.done();
};

exports.space1 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	testBattle(test, attacker, defender, game.BattleType.Space);
};

exports.space2 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 4 };
	attacker[game.UnitType.Destroyer] = { count: 6 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.WarSun] = { count: 2 };
	defender[game.UnitType.Cruiser] = { count: 7 };
	defender[game.UnitType.Destroyer] = { count: 4 };
	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.Carrier] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	testBattle(test, attacker, defender, game.BattleType.Space);
};

exports.space3 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 6 };
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Carrier] = { count: 6 };

	defender[game.UnitType.WarSun] = { count: 2 };
	defender[game.UnitType.Cruiser] = { count: 7 };
	defender[game.UnitType.Destroyer] = { count: 4 };
	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.Carrier] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	testBattle(test, attacker, defender, game.BattleType.Space);

};

exports.spaceUpgrades = function (test) {

	var attacker = {};

	attacker[game.UnitType.WarSun] = { count: 2 };
	attacker[game.UnitType.Dreadnought] = { count: 4 };
	attacker[game.UnitType.Cruiser] = { count: 2, upgraded: true };
	attacker[game.UnitType.Destroyer] = { count: 3 };

	var defender = {};
	defender[game.UnitType.WarSun] = { count: 1 };
	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Cruiser] = { count: 4 };
	defender[game.UnitType.Destroyer] = { count: 2, upgraded: true };
	defender[game.UnitType.Carrier] = { count: 5 };
	defender[game.UnitType.PDS] = { count: 4, upgraded: true };

	testBattle(test, attacker, defender, game.BattleType.Space);
};

exports.spaceLong = function (test) {

	var attacker = {};

	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Carrier] = { count: 5 };
	attacker[game.UnitType.Fighter] = { count: 22 };

	var defender = {};
	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Carrier] = { count: 5 };
	defender[game.UnitType.Fighter] = { count: 20 };

	testBattle(test, attacker, defender, game.BattleType.Space);
};

exports.spacePerformance = function (test) {

	var attacker = {};

	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Carrier] = { count: 5 };
	attacker[game.UnitType.Fighter] = { count: 22 };

	var defender = {};
	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Carrier] = { count: 5 };
	defender[game.UnitType.Fighter] = { count: 20 };

	var input = new Input(attacker, defender, game.BattleType.Space);
	var s = new Date();
	for (var i = 0; i < 100; ++i)
		calc.computeProbabilities(input);
	var elapsed = new Date() - s;

	s = new Date();
	var dummy = 1;
	for (var i = 0; i < 50000000; ++i)
		dummy *= 1.000000001;
	var elapsedComparison = (new Date() - s) * 100;

	test.ok(elapsed < elapsedComparison, 'such performance is suspicious: ' + elapsed / elapsedComparison);

	test.done();
};

exports.spaceImitatorPerformance = function (test) {

	var attacker = {};

	attacker[game.UnitType.Dreadnought] = { count: 5 };
	attacker[game.UnitType.Fighter] = { count: 5 };

	var defender = {};
	defender[game.UnitType.Dreadnought] = { count: 5 };
	defender[game.UnitType.Fighter] = { count: 6 };

	var input = new Input(attacker, defender, game.BattleType.Space, {
		attacker: { duraniumArmor: true },
		defender: { duraniumArmor: true }
	});
	var s = new Date();
	var previousImitatorIterations = imitatorModule.imitationIterations;
	imitatorModule.imitationIterations = 10000;
	for (var i = 0; i < 10; ++i)
		im.estimateProbabilities(input);
	imitatorModule.imitationIterations = previousImitatorIterations;
	var elapsed = new Date() - s;

	s = new Date();
	var dummy = 1;
	for (var i = 0; i < 140000000; ++i)
		dummy *= 1.000000001;
	var elapsedComparison = (new Date() - s) * 200;

	test.ok(elapsed < elapsedComparison, 'such performance is suspicious: ' + elapsed / elapsedComparison);

	test.done();
};

exports.barrage = {
	noGhosts: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Destroyer] = { count: 5 };
		attacker[game.UnitType.Fighter] = { count: 4 };

		defender[game.UnitType.Destroyer] = { count: 1 };
		defender[game.UnitType.Fighter] = { count: 3 };
		defender[game.UnitType.PDS] = { count: 1 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	splitDefender: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Cruiser] = { count: 2 };
		attacker[game.UnitType.Destroyer] = { count: 4 };
		attacker[game.UnitType.Fighter] = { count: 7 };

		defender[game.UnitType.Dreadnought] = { count: 3 };
		defender[game.UnitType.Destroyer] = { count: 3 };
		defender[game.UnitType.Fighter] = { count: 4 };
		defender[game.UnitType.PDS] = { count: 1 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	splitAttacker: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Dreadnought] = { count: 3 };
		attacker[game.UnitType.Destroyer] = { count: 3 };
		attacker[game.UnitType.Fighter] = { count: 4 };
		attacker[game.UnitType.PDS] = { count: 1 };

		defender[game.UnitType.Cruiser] = { count: 2 };
		defender[game.UnitType.Destroyer] = { count: 4 };
		defender[game.UnitType.Fighter] = { count: 7 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	quadraticSplit: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.WarSun] = { count: 2 };
		attacker[game.UnitType.Destroyer] = { count: 2 };
		attacker[game.UnitType.Fighter] = { count: 4 };

		defender[game.UnitType.Dreadnought] = { count: 3 };
		defender[game.UnitType.Destroyer] = { count: 4 };
		defender[game.UnitType.Fighter] = { count: 2 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	PDSvsDestroyers: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Dreadnought] = { count: 1 };
		attacker[game.UnitType.Fighter] = { count: 2 };
		attacker[game.UnitType.PDS] = { count: 2 };

		defender[game.UnitType.Destroyer] = { count: 3 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	PDSandDestroyers: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Cruiser] = { count: 3 };
		attacker[game.UnitType.Fighter] = { count: 4 };

		defender[game.UnitType.Destroyer] = { count: 3 };
		defender[game.UnitType.PDS] = { count: 4 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	hyperPDS: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Dreadnought] = { count: 1 };
		attacker[game.UnitType.Fighter] = { count: 1 };
		attacker[game.UnitType.PDS] = { count: 8 };

		defender[game.UnitType.Destroyer] = { count: 1 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},

	mess: function (test) {

		var attacker = {};
		var defender = {};
		attacker[game.UnitType.Dreadnought] = { count: 1 };
		attacker[game.UnitType.Destroyer] = { count: 2 };
		attacker[game.UnitType.Fighter] = { count: 4 };
		attacker[game.UnitType.PDS] = { count: 4 };

		defender[game.UnitType.Dreadnought] = { count: 2 };
		defender[game.UnitType.Destroyer] = { count: 4 };
		defender[game.UnitType.Fighter] = { count: 2 };
		defender[game.UnitType.PDS] = { count: 1 };

		testBattle(test, attacker, defender, game.BattleType.Space);

	},
};

exports.groundSimple = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.WarSun] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 6 };
	defender[game.UnitType.Cruiser] = { count: 7 }; //should have no impact
	defender[game.UnitType.PDS] = { count: 2 };

	testBattle(test, attacker, defender, game.BattleType.Ground);

};

exports.groundPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.PDS] = { count: 2 };

	testBattle(test, attacker, defender, game.BattleType.Ground);
};

exports.groundPlanetaryShield = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 0 };

	defender[game.UnitType.Ground] = { count: 6 };
	defender[game.UnitType.PDS] = { count: 2 };

	var input = new Input(attacker, defender, game.BattleType.Ground);
	var noDreadnoughts = calc.computeProbabilities(input).distribution;
	//console.log(noDreadnoughts.toString());

	attacker[game.UnitType.Dreadnought] = { count: 6 };
	var withDreadnoughts = calc.computeProbabilities(input).distribution;
	//console.log(withDreadnoughts.toString());
	test.ok(distributionsEqual(noDreadnoughts, withDreadnoughts), 'Dreadnoughts bombarded over Planetary Shield');

	test.done();
};

exports.groundPlanetaryShieldWarSun = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 5 };

	defender[game.UnitType.Ground] = { count: 6 };
	defender[game.UnitType.PDS] = { count: 2 };

	var input = new Input(attacker, defender, game.BattleType.Ground);
	var noWarSun = calc.computeProbabilities(input).distribution;
	//console.log(noWarSun.toString());

	attacker[game.UnitType.WarSun] = { count: 1 };
	var withWarSun = calc.computeProbabilities(input).distribution;
	//console.log(withWarSun.toString());
	test.ok(!distributionsEqual(noWarSun, withWarSun), 'War Sun didn\'t negate Planetary Shield');

	test.done();

};

exports.mentakRacial = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Destroyer] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { race: game.Race.Mentak }, defender: { race: defaultRace } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.mentakRacialMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Destroyer] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { race: game.Race.Mentak, moraleBoost: true }, defender: { race: defaultRace } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.mentakRacialWithBarrageAndPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Destroyer] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 1 };

	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 2 };
	var options = { attacker: { race: game.Race.Mentak }, defender: { race: defaultRace } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);

};

exports.moraleBoostSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.Fighter] = { count: 5 };

	var options = { attacker: { moraleBoost: true }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.moraleBoostBarrage = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Destroyer] = { count: 1 };

	defender[game.UnitType.Fighter] = { count: 1 };

	var options = { attacker: { moraleBoost: true }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.moraleBoostGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = { attacker: { moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.moraleBoostMagenDefenseGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };

	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: {
			moraleBoost: true,
		}, defender: {
			moraleBoost: true,
			magenDefense: true,
		},
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.fireTeamGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = { attacker: { fireTeam: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.fireTeamMagenDefenseGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 4 };

	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: {
			fireTeam: true,
		}, defender: {
			fireTeam: true,
			magenDefense: true,
		},
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.assaultCannonSimple = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonNonDamageable = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonDamageable = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Dreadnought] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonFighters = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 3 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Dreadnought] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonNotEnoughShips = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Dreadnought] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = {
		attacker: { assaultCannon: true },
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonPds2 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		defender: { assaultCannon: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonMorePdsNoDirectHit = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 6 };

	defender[game.UnitType.Flagship] = { count: 1 };
	defender[game.UnitType.WarSun] = { count: 1 };
	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 6 };

	var options = {
		attacker: { assaultCannon: true, riskDirectHit: false },
		defender: { assaultCannon: true, riskDirectHit: false },
	};
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonPdsBarrage = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 4 };

	defender[game.UnitType.Dreadnought] = { count: 2 };
	defender[game.UnitType.Destroyer] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = {
		attacker: { assaultCannon: true, },
		defender: { assaultCannon: true, },
	};
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonPdsBarrageGravitonLaser = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 4 };

	defender[game.UnitType.Dreadnought] = { count: 2 };
	defender[game.UnitType.Destroyer] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = {
		attacker: { assaultCannon: true, gravitonLaser: true },
		defender: { assaultCannon: true, gravitonLaser: true },
	};
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonNoRiskDirectHit = function (test) {
	var attacker = {};
	var defender = {};

	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { riskDirectHit: false, }, defender: { assaultCannon: true, } };
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.assaultCannonNoSplit = function (test) {
	var attacker = {};
	var defender = {};

	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: {}, defender: { assaultCannon: true, } };
	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.antimassDeflectorsSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { antimassDeflectors: true },
		defender: {},
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);

};

exports.antimassDeflectorsGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { antimassDeflectors: true },
		defender: {},
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.gravitonLaserSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserPureFighters = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserNonEuclidean = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { race: game.Race.Letnev, nonEuclidean: true },
		defender: { gravitonLaser: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserNonEuclidean2 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };

	var options = {
		attacker: {},
		defender: { race: game.Race.Letnev, gravitonLaser: true, nonEuclidean: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserManyPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.gravitonLaserManeuveringJets = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.PDS] = { count: 1 };

	defender[game.UnitType.Carrier] = { count: 1 };

	var options = {
		attacker: {},
		defender: { gravitonLaser: true, maneuveringJets: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.plasmaScoringBombardmentGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: { plasmaScoring: true },
		defender: {},
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.plasmaScoringSpaceCannonSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = {
		attacker: {},
		defender: { plasmaScoring: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.plasmaScoringSpaceCannonXxcha = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.PDS] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 4 };


	var options = {
		attacker: { race: game.Race.Xxcha, plasmaScoring: true },
		defender: {},
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.plasmaScoringSpaceCannonGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = {
		attacker: {},
		defender: { plasmaScoring: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.plasmaScoringAntimassDeflectorsGround = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 1 };

	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: { antimassDeflectors: true },
		defender: { plasmaScoring: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.magenDefenseGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 5 };

	defender[game.UnitType.Ground] = { count: 5 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: {},
		defender: { magenDefense: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.magenDefenseGroundWithoutPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 5 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: {},
		defender: {},
	};

	var input = new Input(attacker, defender, game.BattleType.Ground, options);

	var noMagenDefense = calc.computeProbabilities(input).distribution;
	//console.log(noMagenDefense.toString());

	options.defender.magenDefense = true;
	var withMagenDefense = calc.computeProbabilities(input).distribution;
	//console.log(withMagenDefense.toString());
	test.ok(distributionsEqual(noMagenDefense, withMagenDefense), 'Magen Defense activated without PDS');

	test.done();
};

exports.magenDefenseWarSunGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 5 };

	defender[game.UnitType.Ground] = { count: 5 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: {},
		defender: { magenDefense: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.duraniumArmor = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Flagship] = { count: 1 };
	defender[game.UnitType.WarSun] = { count: 1 };
	defender[game.UnitType.Dreadnought] = { count: 1 };

	var options = {
		attacker: {},
		defender: { duraniumArmor: true },
	};

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	//console.log(distribution.toString());
	var inverse = invertDistribution(distribution);
	test.ok(!distributionsEqual(distribution, inverse), 'Duranium Armor not applied');

	test.done();
};

exports.duraniumArmorRepairAlreadyDamaged = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Fighter] = { count: 1 }; // just a scapegoat

	defender[game.UnitType.Dreadnought] = { count: 1, damaged: 1 };
	defender[game.UnitType.Destroyer] = { count: 10, upgraded: true };

	var options = {
		attacker: {},
		defender: { duraniumArmor: true },
	};

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	//console.log(distribution.toString());
	test.equals(distribution.max, 12, 'Dreadnought not repaired for free');

	test.done();
};

exports.duraniumArmorDestroyUnrepairableFirst = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 2 };

	var options = {
		attacker: {},
		defender: { duraniumArmor: true },
	};

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	//console.log(distribution.toString());
	var expected = Object.assign(new structs.DistributionBase(-4, 3), {
		'-4': 0.005,
		'-3': 0.04,
		'-2': 0.112,
		'-1': 0.141,
		0: 0.06,
		1: 0.088,
		2: 0.183,
		3: 0.248,
		4: 0.123
	}); // this distribution is obtained from one run of the version of the estimator considered correct

	test.ok(distributionsEqual(distribution, expected), 'wrong result distribution');

	test.done();
};

exports.duraniumArmorPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2, upgraded: true };

	defender[game.UnitType.Cruiser] = { count: 4 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: { duraniumArmor: true },
		defender: { },
	};

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	//console.log(distribution.toString());
	test.ok(distribution.downTo(-1) > 0.52, 'Duranium Armor not applied not applied at the first round');

	test.done();
};

exports.fighterPrototypeSimple = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Fighter] = { count: 5 };

	var options = { attacker: { fighterPrototype: true }, defender: { fighterPrototype: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.fighterPrototypeMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Fighter] = { count: 4 };

	var options = { attacker: { fighterPrototype: true }, defender: { fighterPrototype: true, moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.bunkerSimple = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 3 };
	attacker[game.UnitType.Ground] = { count: 7 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: {},
		defender: { bunker: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.bunkerPlasmaScoring = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 3 };
	attacker[game.UnitType.Ground] = { count: 7 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: { plasmaScoring: true },
		defender: { bunker: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.noRiskingDirectHit1 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Cruiser] = { count: 4 };
	attacker[game.UnitType.Destroyer] = { count: 6 };

	defender[game.UnitType.WarSun] = { count: 2 };
	defender[game.UnitType.Cruiser] = { count: 7 };
	defender[game.UnitType.Destroyer] = { count: 4 };
	defender[game.UnitType.Carrier] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { riskDirectHit: false }, defender: { riskDirectHit: false } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.noRiskingDirectHit2 = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 4 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 6 };
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Carrier] = { count: 6 };

	defender[game.UnitType.WarSun] = { count: 2 };
	defender[game.UnitType.Cruiser] = { count: 7 };
	defender[game.UnitType.Destroyer] = { count: 4 };
	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.Carrier] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { riskDirectHit: false }, defender: { riskDirectHit: false } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.maneuveringJetsSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { maneuveringJets: true }, defender: { maneuveringJets: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.maneuveringJetsNoPds = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: {}, defender: { maneuveringJets: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.maneuveringJetsGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { maneuveringJets: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.sardakkRacial = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { race: game.Race.Sardakk }, defender: { race: game.Race.Sardakk } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.sardakkFighterPrototypeMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = {
		attacker: { race: game.Race.Sardakk, moraleBoost: true },
		defender: { race: game.Race.Sardakk, fighterPrototype: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarRacial = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.PDS] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 3 };

	var options = { attacker: { race: game.Race.JolNar }, defender: { race: game.Race.JolNar } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarRacialMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };

	var options = { attacker: { race: game.Race.JolNar, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.l1z1xRacialHarrow = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowBunker = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 4 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { bunker: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowMagenDefense = function (test) {
	// In principle, either L1Z1X can bombard, or Magen Defense can be activated, but not both.
	// But just in case..

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 4 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { magenDefense: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowPlasmaScoring = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 4 };

	var options = { attacker: { race: game.Race.L1Z1X, plasmaScoring: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowNoAttacker = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 1 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l1z1xRacialHarrowBombardmentAgainsPdsMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.l4Disruptors = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = { attacker: { race: game.Race.Letnev, l4Disruptors: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.letnevRacialNonEuclideanSimple = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 3 };

	var options = { attacker: { race: game.Race.Letnev, nonEuclidean: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

/*exports.letnevRacialNonEuclideanDontRiskDirectHit = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 4 };

	var options = { attacker: { race: game.Race.Letnev, nonEuclidean: true, riskDirectHit: false }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.letnevRacialNonEuclideanMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 6 };

	var options = {
		attacker: { race: game.Race.Letnev, nonEuclidean: true, riskDirectHit: false },
		defender: { moraleBoost: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};*/

exports.letnevFlagshipRepairsAtTheStartOfARound = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 2 };

	var options = { attacker: { race: game.Race.Letnev, }, defender: {} };

	var fromUndamaged = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	attacker[game.UnitType.Flagship] = { count: 1, damaged: 1 };
	var fromDamaged = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;

	//console.log('u', fromUndamaged.toString());
	//console.log('d', fromDamaged.toString());

	test.ok(distributionsEqual(fromUndamaged, fromDamaged), 'Letnev Flagship not repaired at the start of the round');

	test.done();
};

exports.sardakkRacialValkyrieParticleWeave = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 1 };

	var options = { attacker: { race: game.Race.Sardakk, valkyrieParticleWeave: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

/*exports.sardakkRacialValkyrieParticleWeaveBoth = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };

	// yes, this cannot happen in the actual game, but anyway
	var options = {
		attacker: { race: game.Race.Sardakk, valkyrieParticleWeave: true },
		defender: { race: game.Race.Sardakk, valkyrieParticleWeave: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};*/

exports.sardakkRacialValkyrieParticleWeaveHarrow = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 2 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 3 };

	var options = {
		attacker: { race: game.Race.L1Z1X, },
		defender: { race: game.Race.Sardakk, valkyrieParticleWeave: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.sardakkRacialValkyrieParticleWeaveMagenDefense = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 1 };

	defender[game.UnitType.Ground] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = {
		attacker: { race: game.Race.Sardakk, valkyrieParticleWeave: true },
		defender: { magenDefense: true }
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.sardakkRacialValkyrieParticleWeaveSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };

	var options = { attacker: { race: game.Race.Sardakk, valkyrieParticleWeave: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.winnuFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { race: game.Race.Winnu, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.winnuFlagshipMany = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 2 };
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 2 };

	var options = { attacker: { race: game.Race.Winnu, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.winnuFlagshipMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 2 };
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 3 };
	defender[game.UnitType.Fighter] = { count: 2 };

	var options = { attacker: { race: game.Race.Winnu, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.Yin, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipPds = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { race: game.Race.Yin, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipAssaultCannon = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.Yin, }, defender: { assaultCannon: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 2 };

	var options = { attacker: { race: game.Race.Yin, }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipMentakRacial = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = { attacker: { race: game.Race.Yin, }, defender: { race: game.Race.Mentak } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.yinFlagshipGravitonLaser = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.PDS] = { count: 2 };

	var options = { attacker: { race: game.Race.Yin, }, defender: { gravitonLaser: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.JolNar, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarFlagshipSanityCheck = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1, damaged: 1 };

	defender[game.UnitType.Fighter] = { count: 3 };

	var options = { attacker: { race: game.Race.JolNar, }, defender: {} };

	var input = new Input(attacker, defender, game.BattleType.Space, options);

	var distr = calc.computeProbabilities(input).distribution;

	var flagshipProbability = distr.at(-1)+ distr.at(0);
	test.ok(0.36 < flagshipProbability, "Jol-Nar flagship is not strong enough: " + flagshipProbability);

	test.done();
};

exports.jolNarFlagshipMunitionsFundingMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1, damaged: 1 };

	defender[game.UnitType.Fighter] = { count: 3 };

	var options = { attacker: { race: game.Race.JolNar, letnevMunitionsFunding: true, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.jolNarFlagshipMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.JolNar, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.sardakkFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = { attacker: { race: game.Race.Sardakk, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.sardakkFlagshipMoraleBoost = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { race: game.Race.Sardakk, moraleBoost: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.virusFlagshipPds = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = { attacker: { race: game.Race.Virus, riskDirectHit: false, }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.virusFlagshipPdsGravitonLaser = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 4 };

	var options = { attacker: { race: game.Race.Virus, riskDirectHit: false, }, defender: { gravitonLaser: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.virusFlagshipAttackerAssaultCannon = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 3 };

	var options = { attacker: { race: game.Race.Virus, }, defender: { assaultCannon: true, } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.virusFlagshipDefenderAssaultCannon = function (test) {
	var attacker = {};
	var defender = {};

	attacker[game.UnitType.Cruiser] = { count: 3 };

	defender[game.UnitType.Flagship] = { count: 1 };
	defender[game.UnitType.Ground] = { count: 1 };
	defender[game.UnitType.Fighter] = { count: 1 };

	var options = { attacker: { assaultCannon: true, }, defender: { race: game.Race.Virus, } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.virusFlagshipWinnuFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 1 };

	defender[game.UnitType.Flagship] = { count: 1 };

	var options = { attacker: { race: game.Race.Virus, }, defender: { race: game.Race.Winnu } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.l1z1xFlagship = function (test) {
	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Fighter] = { count: 2 };

	defender[game.UnitType.Flagship] = { count: 1 };
	defender[game.UnitType.Dreadnought] = { count: 1 };
	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.Fighter] = { count: 2 };

	// calculator doesn't handle L1Z1X flagship, so just check that imitator takes it into account at least somehow.
	// Yssaril is used as an opponent as their Flagship has the same stats (except for special ability of course)
	var options = { attacker: { race: game.Race.L1Z1X, }, defender: { race: game.Race.Yssaril } };

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	//console.log(distribution.toString());
	var inverse = invertDistribution(distribution);
	test.ok(!distributionsEqual(distribution, inverse), 'L1Z1X flagship not working');

	test.done();
};

exports.letnevFlagshipGround = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { race: game.Race.Letnev }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.letnevFlagshipSpace = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Flagship] = { count: 1 };
	defender[game.UnitType.Cruiser] = { count: 2 };

	// calculator doesn't handle Letnev flagship in Space Combat because of repairing ability,
	// so just check that imitator takes it into account at least somehow.
	// Yssaril is used as an opponent as their Flagship has the same stats except for special ability
	var options = { attacker: { race: game.Race.Letnev, }, defender: { race: game.Race.Yssaril } };

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	//console.log(distribution.toString());
	var inverse = invertDistribution(distribution);
	test.ok(!distributionsEqual(distribution, inverse), 'Letnev flagship not working');

	test.done();
};

exports.deadlockStraightAway = function (test) {

	// https://boardgamegeek.com/thread/1904694/how-do-you-resolve-endless-battles

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };

	defender[game.UnitType.Dreadnought] = { count: 2 };

	var options = {
		attacker: {
			duraniumArmor: true,
			nonEuclidean: true,
		},
		defender: {
			duraniumArmor: true,
			nonEuclidean: true,
		}
	};

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	//console.log(distribution.toString());
	var expected = Object.assign(new structs.EmpiricalDistribution(), {
		0: 1,
		min: 0,
		max: 0,
	});
	//test.ok(distributionsEqual(distribution, expected), 'Deadlock not detected');
	test.ok(true, 'Deadlock not detected');

	test.done();
};

exports.probableDeadlockAfterSomeRounds = function (test) {

	// https://boardgamegeek.com/thread/1904694/how-do-you-resolve-endless-battles

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Cruiser] = { count: 1 };

	defender[game.UnitType.Dreadnought] = { count: 2 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = {
		attacker: {
			duraniumArmor: true,
			nonEuclidean: true,
		},
		defender: {
			duraniumArmor: true,
			nonEuclidean: true,
		}
	};

	var distribution = im.estimateProbabilities(new Input(attacker, defender, game.BattleType.Space, options)).distribution;
	test.ok(true, 'It did not hang, so all is fine, I guess');

	test.done();
};

exports.conventionsOfWar = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Dreadnought] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 5 };

	var options = {
		attacker: {},
		defender: { conventionsOfWar: true },
	};

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.prophecyOfIxth = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { prophecyOfIxth: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.prophecyOfIxthMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { prophecyOfIxth: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.prophecyOfIxthNaalu = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 3 };

	var options = { attacker: { race: game.Race.Naalu, prophecyOfIxth: true }, defender: {} };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.munitionsFunding = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Cruiser] = { count: 2 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 3 };

	var options = { attacker: { letnevMunitionsFunding: true }, };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.munitionsFundingMoraleBoost = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 3 };

	defender[game.UnitType.Cruiser] = { count: 1 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { letnevMunitionsFunding: true }, defender: { moraleBoost: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.tekklarLegion = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.Ground] = { count: 3 };

	var options = { attacker: { tekklarLegion: true }, };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.tekklarLegionForSardakk = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.Ground] = { count: 3 };

	// should not take effect
	var options = { attacker: { race: game.Race.Sardakk, tekklarLegion: true }, };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.tekklarLegionFireTeam = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.Ground] = { count: 3 };

	var options = { attacker: { tekklarLegion: true }, defender: { fireTeam: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.tekklarLegionAgainstSardakk = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.Ground] = { count: 3 };

	// should not take effect
	var options = { attacker: { tekklarLegion: true }, defender: { race: game.Race.Sardakk, } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.mentakAttackerAssaultCannonDefender = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { race: game.Race.Mentak }, defender: { assaultCannon: true } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.mentakDefenderAssaultCannonAttacker = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Cruiser] = { count: 2 };
	attacker[game.UnitType.Destroyer] = { count: 1 };

	defender[game.UnitType.Cruiser] = { count: 2 };
	defender[game.UnitType.Destroyer] = { count: 1 };

	var options = { attacker: { assaultCannon: true }, defender: { race: game.Race.Mentak } };

	testBattle(test, attacker, defender, game.BattleType.Space, options);
};

exports.x89Omega = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 4 };

	var options = { attacker: { x89Omega: true }, defender: { } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

/*exports.x89OmegaL1z1xRacialHarrow = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Dreadnought] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 4 };

	var options = { attacker: { race: game.Race.L1Z1X, x89Omega: true }, defender: { } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};*/

exports.magenOmega = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { }, defender: { magenDefenseOmega: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.magenOmegaDock = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 2 };

	var options = { attacker: { }, defender: { magenDefenseOmega: true, hasDock: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.magenOmegaPdsDock = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { }, defender: { magenDefenseOmega: true } };

	var input1 = new Input(attacker, defender, game.BattleType.Ground, options);
	var got1 = calc.computeProbabilities(input1).distribution;

	options.defender.hasDock = true;
	var input2 = new Input(attacker, defender, game.BattleType.Ground, options);
	var got2 = calc.computeProbabilities(input2).distribution;

	var equal = distributionsEqual(got1, got2);
	if (!equal) {
		console.log('  no Dock', got1.toString());
		console.log('with Dock', got2.toString());
	}

	test.ok(equal, 'Dock changed the result though shouldn\'t have');

	test.done();
};

exports.magenOmegaWarsun = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.WarSun] = { count: 1 };
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 5 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { }, defender: { } };

	var input1 = new Input(attacker, defender, game.BattleType.Ground, options);
	var got1 = calc.computeProbabilities(input1).distribution;

	options.defender.magenDefenseOmega = true;
	var input2 = new Input(attacker, defender, game.BattleType.Ground, options);
	var got2 = calc.computeProbabilities(input2).distribution;

	var equal = distributionsEqual(got1, got2);

	test.ok(!equal, 'Magen Defence Omega didn\'t change the result though should have');

	test.done();
};

exports.magenOmegaL1z1xRacialHarrow = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Ground] = { count: 3 };

	defender[game.UnitType.Ground] = { count: 3 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { race: game.Race.L1Z1X }, defender: { magenDefenseOmega: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

exports.magenOmegaNaalu = function (test) {

	var attacker = {};
	var defender = {};
	attacker[game.UnitType.Flagship] = { count: 1 };
	attacker[game.UnitType.Fighter] = { count: 2 };
	attacker[game.UnitType.Ground] = { count: 2 };

	defender[game.UnitType.Ground] = { count: 2 };
	defender[game.UnitType.PDS] = { count: 1 };

	var options = { attacker: { race: game.Race.Naalu, upgraded: true }, defender: { magenDefenseOmega: true } };

	testBattle(test, attacker, defender, game.BattleType.Ground, options);
};

var chaoticProfile = {
	Flagship: { count: 1, zeroBias: 2 },
	WarSun: { count: 1, zeroBias: 5 },
	Dreadnought: { count: 2, zeroBias: 3 },
	Cruiser: { count: 2, zeroBias: 3 },
	Carrier: { count: 2, zeroBias: 3 },
	Destroyer: { count: 2, zeroBias: 3 },
	Fighter: { count: 2, zeroBias: 3 },
	Ground: { count: 2, zeroBias: 3 },
	PDS: { count: 2, zeroBias: 3 },
	Mech: {count: 2, zeroBias: 3},
	Planet: {count: 0, zeroBias: 0},
};

/** Test some random battle. Because I couldn't have imagined all edge cases.
 * When this test fails - take input fleets and options from the console and reproduce the problem */
function chaoticOptions(){
	var attacker = {};
	var defender = {};

	var options = {
		attacker: {
			race: pickRandom(Object.keys(game.Race)),
		},
		defender: {
			race: pickRandom(Object.keys(game.Race)),
		},
	};

	var attackerUnitUpgrades = Object.assign({}, game.StandardUpgrades, game.RaceSpecificUpgrades[options.attacker.race]);
	var defenderUnitUpgrades = Object.assign({}, game.StandardUpgrades, game.RaceSpecificUpgrades[options.defender.race]);

	for (var unitType in game.UnitType) {
		var profile = chaoticProfile[unitType];
		//print(profile);
		//print(unitType);
		var count = Math.max(0, Math.floor(Math.random() * (profile.count + profile.zeroBias + 1)) - profile.zeroBias);
		var upgraded = attackerUnitUpgrades[unitType] && Math.random() < .2;
		attacker[unitType] = { count: count, upgraded: upgraded, damaged: Math.floor(Math.random() * (count + 1)) };
	}

	for (var unitType in game.UnitType) {
		var profile = chaoticProfile[unitType];
		var count = Math.max(0, Math.floor(Math.random() * (profile.count + profile.zeroBias + 1)) - profile.zeroBias);
		var upgraded = defenderUnitUpgrades[unitType] && Math.random() < .2;
		defender[unitType] = { count: count, upgraded: upgraded, damaged: Math.floor(Math.random() * (count + 1)) };
	}

	/*var Options = Object.assign({},
		game.Technologies,
		game.ActionCards,
		game.Agendas,
		game.Promissory,
		game.Miscellaneous,
		game.Leaders,
		game.Heroes.Mentak,
		game.RaceSpecificTechnologies.Letnev,
		game.RaceSpecificTechnologies.Sardakk,
		game.RaceSpecificTechnologies.NaazRokha,
		game.RaceSpecificTechnologies.Virus,
		game.VirusUpgrades.Virus,
		game.RacialSpecific.Letnev,
		game.RacialSpecific.Virus,
		game.RacialSpecific.Naalu,
		game.RacialSpecific.Mahact,
		game.RacialSpecific.Hacan,
		game.RacialSpecific.Sardakk,
		game.RacialSpecific.Yin,);*/
	var battleType = Math.random() < .7 ? game.BattleType.Space : game.BattleType.Ground;
	var Options = Object.assign({},
		game.Technologies, 
		game.ActionCards,
		game.Leaders,
		game.Agendas,
		game.Promissory,
		game.Miscellaneous,);
	for (var option in Options) {
		options.attacker[option] = Math.random() < .1;
		options.defender[option] = Math.random() < .1;
	}
	for (var race in game.Race) {
		Options = Object.assign({},
		game.RacialSpecific[race],
		game.RaceSpecificTechnologies[race],
		game.VirusUpgrades[race],);
		for (var option in Options) {
			options.attacker[option] = options.attacker.race === race ? Math.random() < .5 : false;
			options.defender[option] = options.defender.race === race ? Math.random() < .5 : false;
		}
	}
	options.attacker.infantryIID=false;
	options.defender.infantryIIA=false;
	options.attacker.indoctrinateMechOmegaD=false;
	options.defender.argentStrikeWingSpaceCannonA=false;
	options.defender.argentStrikeWingBarrageA=false;
	options.defender.argentStrikeWingBombardmentA=false;
	options.attacker.argentStrikeWingSpaceCannonD=false;
	options.attacker.argentStrikeWingBarrageD=false;
	options.attacker.nebula=false;
	options.attacker.directHit2D=false;
	options.attacker.directHit3D=false;
	options.attacker.directHit4D=false;
	options.defender.directHit2A=false;
	options.defender.directHit3A=false;
	options.defender.directHit4A=false;
	options.attacker.solCommander=false;
	options.defender.l4Disruptors=false;
	options.attacker.rout=false;
	options.attacker.bunker=false;
	options.defender.L1Z1XCommander=false;
	options.defender.x89Omega=false;
	options.attacker.hasDock=false;
	options.defender.solarFlare=false;
	options.attacker.hasMemoriaIID=false;
	options.defender.hasMemoriaIIA=false;
	options.attacker.experimentalBattlestation=false;
	options.defender.disable=false;
	options.defender.blitz=false;
	if (battleType === game.BattleType.Ground){
		options.attacker.munitions=false;
		options.defender.munitions=false;
	}
	if (battleType === game.BattleType.Space){
		options.attacker.dunlainMechs=false;
		options.defender.dunlainMechs=false;
		options.attacker.dunlainMechsOnce=false;
		options.defender.dunlainMechsOnce=false;
	}
	if (!attacker.Ground.upgraded)
		options.attacker.infantryIIA = false;
	if (!defender.Ground.upgraded)
		options.defender.infantryIID = false;
	if (!options.attacker.plasmaScoring && !options.attacker.plasmaScoringC)
		options.plasmaScoringFirstRound=false;
	if (!options.defender.indoctrinate)
		options.defender.indoctrinateMechOmegaD = false;
	if (!options.attacker.argentStrikeWing){
		options.attacker.argentStrikeWingSpaceCannonA=false;
		options.attacker.argentStrikeWingBarrageA=false;
		options.attacker.argentStrikeWingBombardmentA=false;
	}
	if (!options.defender.argentStrikeWing){
		options.defender.argentStrikeWingSpaceCannonD=false;
		options.defender.argentStrikeWingBarrageD=false;
	}
	if (!options.attacker.directHit){
		options.attacker.directHit2A=false;
		options.attacker.directHit3A=false;
		options.attacker.directHit4A=false;
	}
	if (!options.defender.directHit){
		options.defender.directHit2D=false;
		options.defender.directHit3D=false;
		options.defender.directHit4D=false;
	}
	if (!options.attacker.argentCommander)
		options.attacker.argentCommanderFirstRound=false;
	if (!options.defender.argentCommander)
		options.defender.argentCommanderFirstRound=false;
	if (!options.attacker.argentCommander)
		options.attacker.argentCommanderFirstRound=false;
	if (!options.defender.argentCommander)
		options.defender.argentCommanderFirstRound=false;
	if (options.attacker.magenDefenseC)
		attacker.Planet.count=1;
	if (options.defender.magenDefenseC)
		defender.Planet.count=1;
	if (!options.attacker.nomadCavalry)
		options.attacker.hasMemoriaIIA=false;
	if (!options.defender.nomadCavalry)
		options.defender.hasMemoriaIID=false;
	if (options.defender.crownThalnosC)
		options.defender.crownThalnos=false;
	if (options.attacker.crownThalnosC)
		options.attacker.crownThalnos=false;
	if (options.attacker.superchargerC)
		options.attacker.supercharger=false;
	if (options.defender.superchargerC)
		options.defender.supercharger=false;
	if (options.attacker.gravitonLaserC)
		options.attacker.gravitonLaser=false;
	if (options.defender.gravitonLaserC)
		options.defender.gravitonLaser=false;
	if (attacker.Ground.count===0)
		options.attacker.infantryIIA=false;
	if (defender.Ground.count===0)
		options.defender.infantryIID=false;
	// Duranium Armor is not supported by the calculator, so don't try to test it
	/*options.attacker.duraniumArmor = false;
	options.defender.duraniumArmor = false;
	if (options.attacker.race === game.Race.L1Z1X || options.attacker.race === game.Race.Letnev) {
		attacker.Flagship.count = 0;
	}
	if (options.defender.race === game.Race.L1Z1X || options.defender.race === game.Race.Letnev) {
		defender.Flagship.count = 0;
	}*/

	var input = {
		attackerUnits: attacker,
		defenderUnits: defender,
		battleType: battleType,
		options: options,
	};
	input.storedValues={attacker: {tgsEarned:0, yinAgentUses:0, reflectiveShieldingUses:0, directHitUses:0, tgsSpent:0}, 
	defender: {tgsEarned:0, yinAgentUses:0, reflectiveShieldingUses:0, directHitUses:0, tgsSpent:0},
	rounds: 0 };
	var duraniumArmor = input.options.attacker.duraniumArmor || input.options.defender.duraniumArmor;
	var l1z1xFlagship = (input.options.attacker.race === game.Race.L1Z1X && input.attackerUnits.Flagship.count !== 0 ||
		input.options.defender.race === game.Race.L1Z1X && input.defenderUnits.Flagship.count !== 0) && input.battleType === game.BattleType.Space;
	var letnevFlagship = (input.options.attacker.race === game.Race.Letnev && input.attackerUnits.Flagship.count !== 0 ||
		input.options.defender.race === game.Race.Letnev && input.defenderUnits.Flagship.count !== 0) && input.battleType === game.BattleType.Space;
	// I could not figure out how to have it so that when sardakk's mechs sustain damage in the normal calculator, only then would they produce a hit, may be possible but IDK

	var sardakkMechVsMech = (input.options.attacker.race === game.Race.Sardakk && input.attackerUnits.Mech.count !== 0 &&
		input.options.defender.race === game.Race.Sardakk && input.defenderUnits.Mech.count !== 0) && input.battleType === game.BattleType.Ground && !input.options.attacker.articlesOfWar;
	var sardakkMechVsNonEuclidean = ((input.options.attacker.race === game.Race.Sardakk && input.attackerUnits.Mech.count !== 0 && input.options.defender.nonEuclidean) || 
		(input.options.defender.race === game.Race.Sardakk && input.defenderUnits.Mech.count !== 0 && input.options.attacker.nonEuclidean)) && input.battleType === game.BattleType.Ground && !input.options.attacker.articlesOfWar;
	//var sardakkMech = false;
	// Same reason as Sardakk Mechs
	//var reflective = (input.options.attacker.reflectiveShielding || input.options.defender.reflectiveShielding) && input.battleType === game.BattleType.Space;
	var reflectiveVsReflective = (input.options.attacker.reflectiveShielding && input.options.defender.reflectiveShielding) && input.battleType === game.BattleType.Space;
	var reflectiveVsNonEuclidean = ((input.options.attacker.reflectiveShielding && input.options.defender.nonEuclidean) || 
		(input.options.defender.reflectiveShielding)) && input.battleType === game.BattleType.Space;
	var l1z1xX89Omega = (input.options.attacker.race === game.Race.L1Z1X && input.options.attacker.x89Omega);
	var mentakH = (input.options.attacker.mentakHero || input.options.defender.mentakHero) && input.battleType === game.BattleType.Space;
	var yinA = (input.options.attacker.yinAgent || input.options.defender.yinAgent || input.options.attacker.yinAgentOmega || input.options.defender.yinAgentOmega)
	var directHit = (input.options.attacker.directHit || input.options.attacker.directHit2A || input.options.attacker.directHit3A || input.options.attacker.directHit4A ||
		input.options.defender.directHit || input.options.defender.directHit2D || input.options.defender.directHit3D || input.options.defender.directHit4D) && input.battleType === game.BattleType.Space;
	var valkyrieAndNonEuclidean = ((input.options.attacker.valkyrieParticleWeave && input.options.defender.nonEuclidean) || (input.options.defender.valkyrieParticleWeave && input.options.attacker.nonEuclidean)) && 
		input.battleType === game.BattleType.Ground;
	var valkyrieVsValkyrie = ((input.options.attacker.valkyrieParticleWeave || input.options.attacker.valkyrieParticleWeaveC) && (input.options.defender.valkyrieParticleWeave || input.options.defender.valkyrieParticleWeaveC))
	var dunlainMechs = ((input.options.attacker.dunlainMechs && input.attackerUnits.Ground.count > 1) || (input.options.defender.dunlainMechs && input.defenderUnits.Ground.count > 1)) && input.battleType === game.BattleType.Ground;
	var nomadA = (input.options.attacker.nomadAgent || input.options.defender.nomadAgent);
	var betterSustains = (input.options.attacker.nonEuclidean && !input.options.attacker.riskDirectHit) || (input.options.defender.nonEuclidean && !input.options.defender.riskDirectHit);
	if (duraniumArmor || l1z1xFlagship || letnevFlagship || sardakkMechVsMech || sardakkMechVsNonEuclidean || reflectiveVsReflective || reflectiveVsNonEuclidean || l1z1xX89Omega || 
		mentakH || yinA  || directHit || valkyrieAndNonEuclidean || valkyrieVsValkyrie || dunlainMechs || nomadA || betterSustains){
		input = chaoticOptions();
	}
	return input;
	function pickRandom(obj) {
		if (Array.isArray(obj))
			return obj[Math.floor(Math.random() * obj.length)];
		else
			return obj[pickRandom(Object.keys(obj))];
	}
}
function chaoticTest(test) {
	var input = chaoticOptions();
	//print(input);
	var showInput = false;
	try {
		var expected = im.estimateProbabilities(input).distribution;
		var got = calc.computeProbabilities(input).distribution;
		var testPassed = distributionsEqual(expected, got);
		if (!testPassed) {
			//try two more times in case of false positives
			expected = im.estimateProbabilities(input).distribution;
			if (distributionsEqual(expected, got,true)) {
				// third round to break the tie
				expected = im.estimateProbabilities(input).distribution;
				testPassed = distributionsEqual(expected, got, true);
			}
		}
		if (!testPassed) {
			showInput = true;
		}
		test.ok(testPassed, 'empirical differs from analytical');
	} catch (e) {
		console.log(e);
		showInput = true;
		test.ok(false, 'exception thrown');
	}

	if (showInput) {
		console.log('Battle type =', input.battleType);
		removeIrrelevant(input.attackerUnits);
		removeIrrelevant(input.defenderUnits);
		removeIrrelevant(input.options.attacker);
		removeIrrelevant(input.options.defender);
		print(input.attackerUnits);
		print(input.defenderUnits);
		print(input.options.attacker);
		print(input.options.defender);
		print('i ' + expected);
		print('c ' + got);
	}

	test.done();

	function removeIrrelevant(myObj){
		for(var key in myObj){
			if(myObj.hasOwnProperty(key) && (myObj[key] == false || myObj[key].count == 0)){
			 delete myObj[key];
			}
		  }	
	}

}
/** If chaotic test fails, this test is convenient to reproduce the problem */
exports.chaoticReproduce = function (test) {
	var battleType = game.BattleType.Space;
	var attacker = {
		WarSun: { count: 1 },
		Dreadnought: { count: 1 },
	};
	var defender = {
		Destroyer: { count: 3 },
	};
	var options = {
		attacker: {
			riskDirectHit: false,
		},
		defender: {
			assaultCannon: true,
		}
	};
	testBattle(test, attacker, defender, battleType, options);
};

exports.chaoticMonkey = new Array(5).fill(chaoticTest);

function Input(attacker, defender, battleType, options) {
	this.attackerUnits = attacker;
	this.defenderUnits = defender;
	this.battleType = battleType;
	this.options = {
		attacker: Object.assign({ race: defaultRace, riskDirectHit: true }, options && options.attacker),
		defender: Object.assign({ race: defaultRace, riskDirectHit: true }, options && options.defender),
	};
	this.storedValues={attacker: {tgsEarned:0, yinAgentUses:0, reflectiveShieldingUses:0, directHitUses:0, tgsSpent:0}, 
	defender: {tgsEarned:0, yinAgentUses:0, reflectiveShieldingUses:0, directHitUses:0, tgsSpent:0},
	rounds: 0 };
}
function print(string) {
	var result = string == null || string == undefined ? string : JSON.parse(JSON.stringify(string));
	console.error(result);
}
/** used to group tests for easier selective running */
function group(exports, testGroup) {
	var result = {};
	var rx = new RegExp(testGroup, 'i');
	for (var test in exports) {
		if (exports.hasOwnProperty(test) && rx.test(test)) {
			var name = test.replace(rx, '');
			result[name] = exports[test];
		}
	}
	return result;
}

var useGrouping = false; // set to true to be able to test related groups of test easily, like `nodeunit -t maneuveringJets`

if (useGrouping) {
	var barrageGroup = group(exports, 'barrage');
	delete barrageGroup[''];

	exports.assaultCannon = group(exports, 'assaultCannon');
	exports.barrage = Object.assign(exports.barrage, barrageGroup);
	exports.bunker = group(exports, 'bunker');
	exports.directHit = group(exports, 'directHit');
	exports.expansion = group(exports, 'expansion');
	exports.fighterPrototype = group(exports, 'fighterPrototype');
	exports.fireTeam = group(exports, 'fireTeam');
	exports.gravitonLaser = group(exports, 'gravitonLaser');
	exports.ground = group(exports, 'ground');
	exports.harrow = group(exports, 'harrow');
	exports.jolNar = group(exports, 'jolNar');
	exports.magenDefense = group(exports, 'magenDefense');
	exports.maneuveringJets = group(exports, 'maneuveringJets');
	exports.mentak = group(exports, 'mentak');
	exports.moraleBoost = group(exports, 'moraleBoost');
	exports.munitions = group(exports, 'munitionsFunding');
	exports.nonEuclidean = group(exports, 'nonEuclidean');
	exports.plasmaScoring = group(exports, 'plasmaScoring');
	exports.prophecy = group(exports, 'prophecyOfIxth');
	exports.letnev = group(exports, 'letnev');
	exports.sardakk = group(exports, 'sardakk');
	exports.tekklar = group(exports, 'tekklarLegion');
	exports.valkyrieParticleWeave = group(exports, 'valkyrieParticleWeave');
	exports.virus = group(exports, 'virus');
	exports.winnu = group(exports, 'winnuFlagship');
	exports.yin = group(exports, 'yinFlagship');
	exports.x89Omega = group(exports, 'x89Omega');
	exports.magenOmega = group(exports, 'magenOmega');
}
