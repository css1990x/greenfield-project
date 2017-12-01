const db = require('../../database/db.js');
const { calculateBaseHealth, calculateBaseStat } = require('../../game-logic');
const { BattleMovedex } = require('../../database/moves');

/*

====== Game Creation Helpers ========

These functions help shape the data that ultimately build up the state of each
game. They return correctly parsed data that the client will eventually be expecting,
which will be emitted from the socket connection within server/app.js

*/

const createMoveMap = () => {
  const allMoves = Object.values(BattleMovedex);
  const moveMap = new Map();
  allMoves.filter(({ basePower, isZ }) => basePower > 0 && !isZ).forEach((moveInfo) => {
    moveMap.set(moveInfo.num, {
      name: moveInfo.name.toLowerCase(),
      power: moveInfo.basePower,
      accuracy: moveInfo.accuracy,
      category: moveInfo.category.toLowerCase(),
      type: moveInfo.type.toLowerCase(),
      isZ: moveInfo.isZ,
    });
  });

  // console.log('MOVELIST LENGTH: ', allMoves.length);
  return moveMap;
};

const moveMap = createMoveMap();

const createPokemon = (pokemon) => {
  // console.log(pokemon.types);
  // console.log(pokemon.name);
  // console.log(pokemon.frontSprite, pokemon.backSprite);
  // console.log(pokemon.baseSpecialAttack, pokemon.baseSpecialDefense, pokemon.baseSpeed);
  // console.log(pokemon.moveSet);
  const {
    name,
    baseHealth,
    baseAttack,
    baseDefense,
    baseSpecialAttack,
    baseSpecialDefense,
    baseSpeed,
    frontSprite,
    backSprite,
    types,
    moveSet,
  } = pokemon;
  const scaledHealth = calculateBaseHealth(baseHealth);
  const moves = [];
  let cnt = 0;
  for (let i = 0; i < moveSet.length; i += 1) {
    const move = moveMap.get(moveSet[i]);
    if (move) {
      moves.push(move);
      cnt += 1;
      if (cnt >= 4) {
        break;
      }
    }
  }

  // console.log(name, moves, moveSet.length);

  return {
    name,
    health: scaledHealth,
    initialHealth: scaledHealth,
    attack: calculateBaseStat(baseAttack),
    defense: calculateBaseStat(baseDefense),
    specialAttack: calculateBaseStat(baseSpecialAttack),
    specialDefense: calculateBaseStat(baseSpecialDefense),
    speed: calculateBaseStat(baseSpeed),
    sprites: { front_default: frontSprite, back_default: backSprite },
    types,
    // moveSet,
    moves,
  };
};

const createPokemonArr = () => {
  const random = () => Math.ceil(Math.random() * 150);
  return new Promise((resolve, reject) => {
    const pokemonCalls = [];
    for (let i = 0; i < 3; i += 1) {
      pokemonCalls.push(db.Pokemon.findOne({ where: { id: random() } }));
    }
    Promise.all(pokemonCalls)
      .then((results) => {
        const pokemonmini = [];
        results.forEach(result => pokemonmini.push(createPokemon(result)));
        resolve(pokemonmini);
      })
      .catch(err => reject(err));
  });
};

const createPlayer = (player, number) => (
  // returns a new promise
  new Promise((resolve, reject) => {
    const pokemonitems = [];
    for (let i = 0; i < 3; i += 1) {
      pokemonitems.push(createPokemonArr());
    }
    Promise.all(pokemonitems)
      .then((pokemon) => {
        // console.log(pokemon[0].length);
        resolve({
          player: number,
          name: player.name,
          pokemon,
        });
      })
      .catch(err => reject(err));
  })
  // creates a var called pokemoncallsArr = []
  // pushes a create player with (player, number) into the pokemoncallsArr until pokemoncallsArr = 3
  // promise.all pokemoncalls
  // .then
  // resolve(pokemoncalls)
  //
  // .catch(err => reject err)
);
// const createTurnlog = (game, turn, type) => {
const createTurnlog = (player, opponent, turn, type) => {
  const playerPokemonName = player.pokemon[0].name;
  if (type === 'attack') {
    const opponentPokemonName = opponent.pokemon[0].name;
    const turnlog = [{ command: `${playerPokemonName} attacked!` }];
    if (turn.logStatement !== '') {
      turnlog.push({ command: turn.logStatement });
    }
    turnlog.push({ command: `${opponentPokemonName} lost ${turn.damageToBeDone} HP` });
    if (opponent.pokemon[0].health <= 0) {
      turnlog.push({ command: `${opponentPokemonName} has fainted!` });
    }
    return turnlog;
  } else if (type === 'switch') {
    const turnlog = [{ command: `${playerPokemonName} appears!` }];
    return turnlog;
  }
  return [];
};

module.exports = {
  createMoveMap,
  createPokemon,
  createPlayer,
  createTurnlog,
  // createPokemonArr
};
